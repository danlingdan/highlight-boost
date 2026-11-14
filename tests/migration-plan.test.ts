import { expect, it } from 'vitest';
import { defaultImportOptions, importColor, planImport } from '../src/migration-plan';
import { parseDocument } from '../src/parsing';
import { collectItems } from '../src/anchors';
const all = { ...defaultImportOptions, fences: true };

it('导入 Highlightr 内联十六进制、CSS 类和 Hilo，保留 Markdown 格式', () => {
  const source = '<mark style="background: #FF5582A6;">**重点** [[链接]]</mark> 与 <mark class="hltr-blue">蓝色</mark>，=={green}绿色==';
  const plan = planImport(source);
  expect(plan.after).toBe('==🔴**重点** [[链接]]== 与 ==🔵蓝色==，==🟢绿色==');
  expect(plan.entries).toHaveLength(3); expect(collectItems(plan.after)).toHaveLength(3);
  expect(planImport(plan.after).changes).toEqual([]);
});
it('自定义颜色先保留原文，显式映射后转换，可选择跳过', () => {
  const source = '=={soft-rose}word== <mark class="hltr-custom">text</mark>';
  expect(planImport(source).entries.every(entry => entry.reason === 'color')).toBe(true);
  const mapped = planImport(source, { ...defaultImportOptions, mapping: { 'hilo:soft-rose': 'purple', 'highlightr:custom': 'skip' } });
  expect(mapped.after).toBe('==🟣word== <mark class="hltr-custom">text</mark>');
  expect(importColor('hilo:constructor', {})).toBeUndefined();
});
it('跳过围栏、未闭合围栏、行内代码、缩进代码、YAML 和注释中的格式示例', () => {
  const source = '---\nsample: =={red}yaml==\n---\n\n`<mark>inline</mark>`\n\n    <mark>\n\n<!-- <mark>comment</mark> -->\n\n<mark>real</mark>\n\n```html\n<mark>example</mark>\n=={blue}literal==';
  const plan = planImport(source);
  expect(plan.changes).toHaveLength(1); expect(plan.after).toBe(source.replace('<mark>real</mark>', '==real=='));
});
it('HTML 属性、嵌套标记、多行、内部分隔符及复杂 HTML 保留原文并列出', () => {
  const source = '<mark id="a">one</mark> <mark><mark>nested</mark></mark> <mark>line\nnext</mark> <mark>a==b</mark> <mark style="background:red;color:black">styled</mark>';
  const plan = planImport(source);
  expect(plan.after).toBe(source); expect(plan.entries).toHaveLength(5);
  expect(plan.entries.every(entry => entry.after === undefined)).toBe(true);
});
it('RGB、短十六进制、大小写标签和实体使用明确颜色映射', () => {
  const plan = planImport('<MARK style="background-color: rgba(255,85,130,0.5)">&amp;</MARK> <mark style="background:#f00">red</mark>', { ...defaultImportOptions, mapping: { 'highlightr:#ff0000': 'red' } });
  expect(plan.after).toBe('==🔴&amp;== ==🔴red==');
});
it('Hilo 转换遵守反斜杠转义，保留已有 HB 语义和普通高亮', () => {
  const source = '\\=={red}literal== 与 ==plain== 与 =={yellow}**bold**==';
  expect(planImport(source).after).toBe('\\=={red}literal== 与 ==plain== 与 ==🟡**bold**==');
});
it('围栏行参数转成独立标注，代码和原参数保持原样且重复导入不增加记录', () => {
  const source = '> ```js hl:1,3 ins={2} hlt:word ln:10:20\r\n> one();\r\n> two();\r\n> three();\r\n> ```';
  const plan = planImport(source, all), block = parseDocument(plan.after).blocks[0]!;
  expect(block.text).toBe(parseDocument(source).blocks[0]!.text); expect(block.meta).toBe(parseDocument(source).blocks[0]!.meta);
  expect(block.metadata!.marks.map(mark => mark.color)).toEqual(['yellow', 'green', 'yellow']);
  expect(plan.entries.find(entry => entry.lines)?.lines?.map(line => line.number)).toEqual([1, 2, 3]);
  expect(plan.entries.filter(entry => entry.reason === 'parameter').map(entry => entry.key)).toEqual(['fence:hlt', 'fence:ln']);
  expect(planImport(plan.after, all).changes).toEqual([]);
  expect(plan.after).toContain('%%\r\n> ```');
});
it('导入来源可分别选择，不修改未选择的来源', () => {
  const source = '<mark>one</mark> =={red}two==';
  expect(planImport(source, { ...defaultImportOptions, highlightr: false }).after).toBe('<mark>one</mark> ==🔴two==');
  expect(planImport(source, { ...defaultImportOptions, hilo: false }).after).toBe('==one== =={red}two==');
});
