import { expect, it } from 'vitest';
import { collectItems } from '../src/anchors';
import { applyChanges, planCodeRebind, planHighlight } from '../src/editing';
import { planNote } from '../src/notes';
import { parseDocument } from '../src/parsing';
import { presets } from '../src/domain';
import { collectionEntry, resolveEntry } from '../src/collections';
import { queryHighlights } from '../src/query';
import { excerptContext, formatExcerpt } from '../src/excerpts';

function annotated(source: string, word: string) {
  const from = source.lastIndexOf(word);
  return applyChanges(source, planHighlight(source, [{ from, to: from + word.length }], presets[0]!).changes);
}
function note(text: string, value: string, quote?: string): string {
  const item = quote ? collectItems(text).find(item => item.quote === quote)! : collectItems(text)[0]!;
  return applyChanges(text, planNote(text, item, value).changes);
}

it('普通正文在文件末尾创建语义和标准脚注，合并同位插入为一个事务变更', () => {
  const source = '==word==', plan = planNote(source, collectItems(source)[0]!, '第一行\n\n**第二段**');
  expect(plan.changes).toHaveLength(1);
  const text = applyChanges(source, plan.changes), parsed = parseDocument(text);
  expect(collectItems(text)[0]).toMatchObject({ quote: 'word', semantic: 'color:default', note: '第一行\n\n**第二段**' });
  expect(parsed.highlights[0]!.footnoteSpan).toBeDefined();
  expect(parsed.footnotes).toHaveLength(1);
  expect(parsed.footnoteReferences).toHaveLength(1);
});

it('多行脚注保留 CRLF，脚注中的高亮和代码不进入源索引', () => {
  const source = annotated('# Root\r\n\r\nword\r\n', 'word');
  const text = note(source, '说明 ==literal==\n\n```js\nconst value = 1;\n```');
  expect(text.replaceAll('\r\n', '')).not.toContain('\n');
  expect(collectItems(text)).toHaveLength(1); expect(parseDocument(text).blocks).toHaveLength(0);
  expect(collectItems(text)[0]!.note).toContain('```js\nconst value = 1;\n```');
});

it('改色、改语义和局部拆分继承原脚注引用，分段不吞掉脚注语法', () => {
  let text = note(annotated('alpha beta gamma', 'alpha beta gamma'), '共享解释');
  const from = text.indexOf('beta');
  text = applyChanges(text, planHighlight(text, [{ from, to: from + 4 }], presets[1]!).changes);
  expect(collectItems(text).map(item => item.note)).toEqual(['共享解释', '共享解释', '共享解释']);
  expect(parseDocument(text).footnotes).toHaveLength(1);
  expect(parseDocument(text).footnoteReferences).toHaveLength(1);
  text = note(text, '更新共享解释', 'beta');
  expect(collectItems(text).every(item => item.note === '更新共享解释')).toBe(true);
});

it('清空批注删除独占 HB 脚注，保留外部引用和普通脚注', () => {
  let text = note(annotated('word\n\nother[^user]\n\n[^user]: 原脚注', 'word'), 'HB 解释');
  text = note(text, '');
  expect(collectItems(text)[0]!.note).toBeUndefined();
  expect(parseDocument(text).footnotes.map(note => note.id)).toEqual(['user']);
  expect(text).toContain('[^user]: 原脚注');
  let shared = note(annotated('word', 'word'), '保留说明');
  const id = parseDocument(shared).highlights[0]!.metadata!.noteRef!;
  shared = `extra[^${id}]\n\n${shared}`;
  shared = note(shared, '');
  expect(shared).toContain(`extra[^${id}]`); expect(shared).toContain('保留说明');
  let broken = note(annotated('word', 'word'), '即将删除的定义');
  const definition = parseDocument(broken).footnotes[0]!;
  broken = applyChanges(broken, [{ ...definition.span, insert: '' }]);
  broken = note(broken, '');
  expect(parseDocument(broken).highlights[0]!.metadata!.noteRef).toBeUndefined();
  expect(broken).not.toContain('[^hb-');
});

it('清空共享脚注的最后一个可见引用时，将引用保留给其他片段', () => {
  let text = note(annotated('alpha beta gamma', 'alpha beta gamma'), '共享解释');
  const from = text.indexOf('beta');
  text = applyChanges(text, planHighlight(text, [{ from, to: from + 4 }], presets[1]!).changes);
  text = note(text, '', 'gamma');
  expect(collectItems(text).map(item => item.note)).toEqual(['共享解释', '共享解释', undefined]);
  expect(parseDocument(text).footnoteReferences).toHaveLength(1);
});

it.each(['`a==b`', '```js\na==b\n```'])('代码批注保存特殊字符且保持代码：%s', source => {
  const text = annotated(source, 'a==b'), content = '说明 | %% `tick` <b>raw</b>\n下一行 😀';
  const output = note(text, content);
  expect(collectItems(output)[0]!.note).toBe(content);
  const parsed = parseDocument(output);
  expect(parsed.blocks[0]?.text ?? parsed.inlines[0]?.text).toBe('a==b');
  const from = output.lastIndexOf('a==b');
  const recolored = applyChanges(output, planHighlight(output, [{ from, to: from + 4 }], { id: 'color:red', name: '红色', color: 'red' }).changes);
  expect(collectItems(recolored)[0]!.note).toBe(content);
  expect(collectItems(note(recolored, ''))[0]!.note).toBeUndefined();
});

it('代码重新绑定保留批注，重复保存不产生变更', () => {
  const text = note(annotated('```js\ncount();\n```', 'count'), '解释');
  expect(planNote(text, collectItems(text)[0]!, '解释').changes).toEqual([]);
  const changed = text.replace('\ncount();', '\ntotal();'), from = changed.lastIndexOf('total');
  const updated = applyChanges(changed, planCodeRebind(changed, collectItems(changed)[0]!, { from, to: from + 5 }).changes);
  expect(collectItems(updated)[0]).toMatchObject({ quote: 'total', note: '解释' });
});

it('旧批注对话框不能覆盖另一处已经保存的批注', () => {
  const text = annotated('word', 'word'), old = collectItems(text)[0]!;
  const updated = note(text, '新内容');
  expect(() => planNote(updated, old, '旧内容')).toThrow('标注位置已变化');
});

it('批注参与查询和集合快照，源文删除后仍可读取说明', () => {
  const text = note(annotated('`word`', 'word'), '独特检索词'), item = collectItems(text)[0]!;
  const hit = { path: 'a.md', text, item };
  expect(queryHighlights([hit], { scope: 'vault', search: '独特检索词' }, hit => hit.item.label)).toHaveLength(1);
  expect(resolveEntry(undefined, collectionEntry(hit)).item.note).toBe('独特检索词');
});

it('标题脚注不会进入标题来源，批注随摘录输出', () => {
  let text = note(annotated('# Heading\n\n==body==', 'Heading'), '标题说明', 'Heading');
  const body = collectItems(text).find(item => item.quote === 'body')!;
  expect(excerptContext(text, body).heading).toBe('Heading');
  text = note(text, '正文说明', 'body');
  const item = collectItems(text).find(item => item.quote === 'body')!;
  expect(formatExcerpt(item, excerptContext(text, item), '[[note#Heading]]', item.label, 'en')).toContain('Annotation\n\n正文说明');
});
