import { describe, expect, it } from 'vitest';
import { planHighlight, applyChanges } from '../src/editing';
import { parseDocument } from '../src/parsing';
import { presets } from '../src/domain';

const preset = presets[1]!;
function whole(text: string, mode: 'text' | 'lines' = 'text') {
  const plan = planHighlight(text, [{ from: 0, to: text.length }], preset, mode);
  return { plan, output: applyChanges(text, plan.changes) };
}

describe('连续跨区域选区', () => {
  it('同时处理正文、多个代码块并保留围栏和语言', () => {
    const text = '开头\n\n```js title\nfirst();\n```\n\n中间\n\n~~~python\nsecond()\n~~~\n\n结尾';
    const { output, plan } = whole(text);
    const parsed = parseDocument(output);
    expect(parsed.highlights.map(item => item.quote)).toEqual(['开头', '中间', '结尾']);
    expect(parsed.blocks.map(block => [block.text, block.metadata?.marks[0]?.quote])).toEqual([
      ['first();', 'first();'], ['second()', 'second()'],
    ]);
    expect(output).toContain('```js title\nfirst();\n```');
    expect(output).toContain('~~~python\nsecond()\n~~~');
    expect(plan.selections[0]!.to).toBeLessThanOrEqual(output.length);
  });

  it('保留标题、任务列表、引用与表格结构', () => {
    const text = '# 标题 #\n\n- [x] 任务\n\n> 引用\n> 第二行\n\n| 字段 | 含义 |\n| --- | --- |\n| 名称 | **值** |';
    const { output } = whole(text);
    expect(output).toBe('# ==🔴标题== #\n\n- [x] ==🔴任务==\n\n> ==🔴引用==\n> ==🔴第二行==\n\n| ==🔴字段== | ==🔴含义== |\n| --- | --- |\n| ==🔴名称== | ==🔴**值**== |');
  });

  it('跨 callout 代码块时保持容器及逻辑代码', () => {
    const text = '> [!note]\n> 说明\n> ```js\n> one();\n> two();\n> ```\n> 结束';
    const { output } = whole(text, 'lines');
    const block = parseDocument(output).blocks[0]!;
    expect(block.text).toBe('one();\ntwo();');
    expect(block.metadata?.marks[0]?.kind).toBe('lines');
    expect(block.metadata?.marks[0]?.quote).toBe(block.text);
    expect(output).toContain('> ```js\n> one();\n> two();\n> ```');
    expect(output.startsWith('> [!note]\n> ==🔴说明==')).toBe(true);
  });

  it('保留前置属性、注释、HTML、图片与行内代码', () => {
    const text = '---\ntitle: 标题\n---\n\n前文 `code()` 后文 %%备注%% 尾文\n\n<div>HTML</div>\n\n![图片](file.png)';
    const { output } = whole(text);
    expect(output.startsWith('---\ntitle: 标题\n---')).toBe(true);
    expect(output).toContain('==🔴前文== `code()`%%hbi:');
    expect(parseDocument(output).inlines[0]?.metadata?.color).toBe('red');
    expect(parseDocument(output).highlights.map(item => item.quote)).toEqual(['前文', '后文', '尾文']);
    expect(output).toContain('<div>HTML</div>');
    expect(output).toContain('![图片](file.png)');
  });

  it('跨区域改色和移除时保留代码，并可以再次解析', () => {
    const input = '正文\r\n\r\n```js\r\nconst 文本 = "😀";\r\n```\r\n结尾';
    const { output } = whole(input);
    const plan = planHighlight(output, [{ from: 0, to: output.length }], null);
    expect(applyChanges(output, plan.changes)).toContain('```js\r\nconst 文本 = "😀";\r\n```');
    const removed = parseDocument(applyChanges(output, plan.changes));
    expect(removed.highlights).toEqual([]);
    expect(removed.blocks[0]!.metadata).toBeUndefined();
    expect(removed.blocks[0]!.text).toBe(parseDocument(input).blocks[0]!.text);
  });

  it('合并重叠选区，保留最大的覆盖范围', () => {
    const text = 'alpha beta gamma';
    const plan = planHighlight(text, [{ from: 0, to: text.length }, { from: 0, to: 5 }], preset);
    const output = applyChanges(text, plan.changes);
    expect(output).toBe('==🔴alpha beta gamma==');
    expect(plan.selections.map(span => output.slice(span.from, span.to))).toEqual([text, 'alpha']);
  });
});
