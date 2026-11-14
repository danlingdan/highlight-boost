import { describe, expect, it } from 'vitest';
import { parseDocument, serializeInlineMetadata } from '../src/parsing';
import { applyChanges, planHighlight } from '../src/editing';
import { collectItems } from '../src/anchors';
import { presets } from '../src/domain';
import { inlineExcerpt } from '../src/inline-rendering';

const important = presets[0]!, question = presets[1]!;
function mark(text: string, from: number, to = from, preset = important) {
  const plan = planHighlight(text, [{ from, to }], preset);
  return { plan, output: applyChanges(text, plan.changes) };
}

describe('行内代码标注', () => {
  it('识别表格中的行内代码并在单元格内保存标注', () => {
    const source = '| 字段 |\n| --- |\n| `value` |\n';
    const from = source.indexOf('value');
    expect(parseDocument(source).inlines.map(inline => inline.text)).toEqual(['value']);
    expect(mark(source, from, from + 5).output).toContain('| `value`%%hbi:');
  });
  it.each(['`a==b`', '`` a`b ``', '` 文本😀 `', '`  `', '`first\nsecond`', '> `first\n> second`'])('代码源文本与 CommonMark 值保持原样：%s', source => {
    const before = parseDocument(source).inlines[0]!;
    const { output } = mark(source, before.content.from, before.content.to);
    const after = parseDocument(output).inlines[0]!;
    expect(output.slice(after.from, after.to)).toBe(source.slice(before.from, before.to));
    expect(after.text).toBe(before.text);
    expect(after.metadata?.semantic).toBe('important');
    expect(after.metadata?.label).toBe('重点');
    expect(collectItems(output)[0]?.kind).toBe('inline-code');
  });

  it('部分选择与空光标都标记整段代码，改色保留身份', () => {
    const source = '调用 `read(buffer)` 继续';
    const { output, plan } = mark(source, source.indexOf('buffer'), source.indexOf('buffer') + 6);
    expect(output.slice(plan.selections[0]!.from, plan.selections[0]!.to)).toBe('buffer');
    const first = parseDocument(output).inlines[0]!;
    const updated = mark(output, output.indexOf('buffer'), undefined, question).output;
    const second = parseDocument(updated).inlines[0]!;
    expect(second.metadata?.id).toBe(first.metadata?.id);
    expect(second.metadata?.color).toBe('red');
    expect(collectItems(updated)[0]?.quote).toBe('read(buffer)');
  });

  it('移除相邻元数据后完整恢复原始笔记', () => {
    const source = '- 调用 `` a`b == c `` 继续\r\n';
    const { output } = mark(source, source.indexOf('a`b'));
    const plan = planHighlight(output, [{ from: output.indexOf('a`b'), to: output.indexOf('a`b') }], null);
    expect(applyChanges(output, plan.changes)).toBe(source);
  });

  it('混合正文、行内代码和代码块时各自保存标注', () => {
    const source = '前文 `first()` 后文\n\n```js\nsecond();\n```';
    const { output } = mark(source, 0, source.length);
    const parsed = parseDocument(output);
    expect(parsed.inlines[0]?.metadata?.color).toBe('yellow');
    expect(parsed.blocks[0]?.metadata?.marks[0]?.quote).toBe('second();');
    expect(parsed.highlights.map(item => item.quote)).toEqual(['前文', '后文']);
    expect(collectItems(output).map(item => item.kind)).toEqual(['prose', 'inline-code', 'prose', 'code-range']);
  });

  it('重复代码的多选区分别标记，复制标注后改色分配新身份', () => {
    const source = '`same` gap `same`';
    const a = source.indexOf('same'), b = source.lastIndexOf('same');
    const plan = planHighlight(source, [{ from: a, to: a + 4 }, { from: b, to: b + 4 }], important);
    const output = applyChanges(source, plan.changes);
    expect(plan.selections.map(span => output.slice(span.from, span.to))).toEqual(['same', 'same']);
    expect(new Set(parseDocument(output).inlines.map(inline => inline.metadata?.id)).size).toBe(2);
    const single = mark('`same`', 2).output;
    const copy = `${single} gap ${single}`;
    const changed = mark(copy, copy.lastIndexOf('same'), undefined, question).output;
    expect(new Set(parseDocument(changed).inlines.map(inline => inline.metadata?.id)).size).toBe(2);
  });

  it('注释和前置属性中的反引号不成为标注对象', () => {
    const source = '---\ntitle: `metadata`\n---\n%% `hidden` %%\n`visible`';
    expect(parseDocument(source).inlines.map(inline => inline.text)).toEqual(['visible']);
  });

  it('安全保存百分号、反引号标签，并读取代码编辑后的当前内容', () => {
    const source = '`old`';
    const output = mark(source, 2, undefined, { id: 'custom', color: 'purple', name: '%% `标签`' }).output;
    expect(parseDocument(output).inlines).toHaveLength(1);
    expect(collectItems(output)[0]?.label).toBe('%% `标签`');
    expect(collectItems(output.replace('`old`', '`new`'))[0]?.quote).toBe('new');
    const serialized = serializeInlineMetadata({ v: 1, id: 'id', color: 'red', semantic: 'question', label: '%%' });
    expect(serialized.match(/%%/g)).toHaveLength(2);
  });

  it.each(['plain', 'a`b', '`edge`', ' a ', '   '])('摘录能重新解析为原代码值：%s', value => {
    expect(parseDocument(inlineExcerpt(value)).inlines[0]?.text).toBe(value);
  });
});
