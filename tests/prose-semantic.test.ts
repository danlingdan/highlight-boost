import { describe, expect, it } from 'vitest';
import { parseDocument, serializeProseMetadata } from '../src/parsing';
import { applyChanges, planHighlight } from '../src/editing';
import { colorPreset, presets, type Preset } from '../src/domain';
import { collectItems } from '../src/anchors';

const important = presets[0]!, question = presets[1]!;
function apply(text: string, from: number, to: number, preset: Preset | null) {
  const plan = planHighlight(text, [{ from, to }], preset);
  return { text: applyChanges(text, plan.changes), plan };
}
const semantic = (text: string) => parseDocument(text).highlights.map(item => ({ quote: item.quote, color: item.color, semantic: item.metadata?.semantic, label: item.metadata?.label }));

describe('正文持久语义', () => {
  it('保存稳定身份、语义和名称快照，重复应用保持源文本一致', () => {
    const first = apply('正文', 0, 2, important).text;
    const highlight = parseDocument(first).highlights[0]!;
    expect(highlight.metadata?.semantic).toBe('important');
    expect(collectItems(first)[0]?.label).toBe('重点');
    const second = apply(first, highlight.content.from, highlight.content.to, important).text;
    expect(second).toBe(first);
    expect(collectItems(second)[0]?.semantic).toBe('important');
    const item = collectItems(second)[0]!;
    expect(second.slice(item.from, item.to)).toBe('正文');
  });

  it('局部改语义后保留两侧语义，各片段有独立身份', () => {
    const text = apply('alpha beta gamma', 0, 16, important).text;
    const from = text.indexOf('beta');
    const output = apply(text, from, from + 4, question).text;
    expect(semantic(output)).toEqual([
      { quote: 'alpha', color: 'yellow', semantic: 'important', label: '重点' },
      { quote: 'beta', color: 'red', semantic: 'question', label: '疑问' },
      { quote: 'gamma', color: 'yellow', semantic: 'important', label: '重点' },
    ]);
    expect(new Set(parseDocument(output).highlights.map(item => item.metadata?.id)).size).toBe(3);
  });

  it('局部移除和再次合并保持文本与剩余语义', () => {
    const text = apply('alpha beta gamma', 0, 16, important).text;
    const from = text.indexOf('beta');
    const output = apply(text, from, from + 4, null).text;
    expect(semantic(output).map(item => item.quote)).toEqual(['alpha', 'gamma']);
    expect(parseDocument(output).highlights.every(item => item.metadata?.semantic === 'important')).toBe(true);
    const merged = apply(output, 0, output.length, question).text;
    expect(semantic(merged)).toEqual([{ quote: 'alpha beta gamma', color: 'red', semantic: 'question', label: '疑问' }]);
    const removed = apply(merged, 0, merged.length, null).text;
    expect(removed).toBe('alpha beta gamma');
  });

  it('颜色相同而语义不同的相邻条目分别保留', () => {
    const first = apply('first second', 0, 5, important).text;
    const from = first.indexOf('second');
    const second = apply(first, from, from + 6, { ...question, color: 'yellow' }).text;
    expect(semantic(second).map(item => item.semantic)).toEqual(['important', 'question']);
    const recolored = apply(second, 0, second.length, colorPreset('blue')).text;
    expect(semantic(recolored).map(item => item.semantic)).toEqual(['important', 'question']);
    expect(semantic(recolored).map(item => item.color)).toEqual(['blue', 'blue']);
  });

  it.each(['word', '`word`', '```js\nword\n```'])('直接改色保留已有语义和名称：%s', source => {
    const from = source.indexOf('word');
    const marked = apply(source, from, from + 4, important).text;
    const at = marked.lastIndexOf('word');
    const recolored = apply(marked, at, at + 4, colorPreset('purple')).text;
    const item = collectItems(recolored)[0]!;
    expect([item.semantic, item.label, item.color]).toEqual(['important', '重点', 'purple']);
  });

  it('原生颜色高亮沿用原生格式，应用语义后写入身份', () => {
    const first = apply('word', 0, 4, colorPreset('red')).text;
    expect(first).toBe('==🔴word==');
    expect(collectItems(first)[0]?.semantic).toBeUndefined();
    const assigned = apply(first, 4, 8, important).text;
    expect(collectItems(assigned)[0]?.semantic).toBe('important');
  });

  it.each(['`word`', '```js\nword\n```'])('纯颜色代码标注改色后更新颜色名称：%s', source => {
    const at = source.indexOf('word');
    const first = apply(source, at, at + 4, colorPreset('red')).text;
    const from = first.lastIndexOf('word');
    const second = apply(first, from, from + 4, colorPreset('purple')).text;
    expect(collectItems(second)[0]?.label).toBe('紫色');
    expect(collectItems(second)[0]?.semantic).toBe('color:purple');
  });

  it('多选区拆分保持选区与语义，编辑副本时分配新 ID', () => {
    const text = apply('same gap same', 0, 13, important).text;
    const a = text.indexOf('same'), b = text.lastIndexOf('same');
    const plan = planHighlight(text, [{ from: a, to: a + 4 }, { from: b, to: b + 4 }], question);
    const output = applyChanges(text, plan.changes);
    expect(plan.selections.map(span => output.slice(span.from, span.to))).toEqual(['same', 'same']);
    expect(semantic(output).map(item => item.semantic)).toEqual(['question', 'important', 'question']);
    const single = apply('same', 0, 4, important).text;
    const copy = `${single}\n\n${single}`;
    const at = copy.lastIndexOf('same');
    const changed = apply(copy, at, at + 4, question).text;
    expect(new Set(parseDocument(changed).highlights.map(item => item.metadata?.id)).size).toBe(2);
  });

  it('表格与特殊名称保持结构，外部颜色编辑保留语义', () => {
    const source = '| 字段 |\r\n| --- |\r\n| 值 |\r\n';
    const at = source.indexOf('值');
    const text = apply(source, at, at + 1, { ...important, name: '考点 | %% `标签`' }).text;
    expect(parseDocument(text).highlights[0]?.metadata?.label).toBe('考点 | %% `标签`');
    expect(parseDocument(text).inlines).toEqual([]);
    expect(text.split('|')).toHaveLength(source.split('|').length);
    expect(collectItems(text.replace('🟡', '🔴'))[0]?.semantic).toBe('important');
  });

  it('忽略代码、注释与前置属性中的正文标注样例', () => {
    const comment = serializeProseMetadata({ v: 1, id: 'id', semantic: 'important', label: '重点' });
    const source = `---\ntitle: ==元数据==${comment}\n---\n\`==代码==${comment}\`\n%% ==隐藏== %%\n==可见==${comment}`;
    expect(parseDocument(source).highlights.map(item => item.quote)).toEqual(['可见']);
  });
});
