import { expect, it, vi } from 'vitest';
import * as parsing from '../src/parsing';
import { applyChanges, planHighlight } from '../src/editing';
import { collectItems } from '../src/anchors';
import { presets } from '../src/domain';
import { createExcerptContext } from '../src/excerpts';

it('段落局部扫描保持 CRLF、callout 和表格的正文边界', () => {
  const text = '# 标题\r\n\r\n> [!note] 说明\r\n> 第一行 **重点**\r\n> 第二行\r\n\r\n| 列 |\r\n| --- |\r\n| 值 |\r\n';
  expect(parsing.parseDocument(text).prose.map(span => text.slice(span.from, span.to))).toEqual(['标题', '说明', '第一行 **重点**', '第二行', '列', '值']);
  const adjacent = parsing.parseDocument('`a`==good== %% ==hidden== `inside` %% ==next==');
  expect(adjacent.highlights.map(mark => mark.quote)).toEqual(['good', 'next']);
  expect(adjacent.inlines.map(inline => inline.text)).toEqual(['a']);
});
it('多段正文标注共享一次结构解析并保留两处选区', () => {
  const spy = vi.spyOn(parsing, 'parseDocument');
  try {
    const text = 'first paragraph\n\nsecond paragraph';
    const plan = planHighlight(text, [{ from: 0, to: 5 }, { from: 17, to: 23 }], presets[0]!);
    expect(spy).toHaveBeenCalledTimes(1); expect(plan.changes).toHaveLength(2); expect(plan.selections).toHaveLength(2);
    expect(applyChanges(text, plan.changes)).toContain('==🟡second==');
  } finally { spy.mockRestore(); }
});
it('共享摘录上下文按各条目的标题与代码位置独立返回', () => {
  let text = '# Root\n\n## Topic\n\n==word== ^p-one\n\n```js\nfirst();\ntarget();\nlast();\n```\n^cb-one\n\n## Next\n\n==last==';
  const from = text.indexOf('target'); text = applyChanges(text, planHighlight(text, [{ from, to: from + 6 }], presets[0]!).changes);
  const items = collectItems(text), lookup = createExcerptContext(text);
  expect(lookup(items[0]!)).toMatchObject({ headings: ['Root', 'Topic'], blockId: 'p-one' });
  expect(lookup(items[1]!)).toMatchObject({ line: 2, endLine: 2, blockId: 'cb-one', code: 'first();\ntarget();\nlast();' });
  expect(lookup(items[2]!)).toMatchObject({ headings: ['Root', 'Next'] });
  expect(lookup(items[0]!).headings).toEqual(['Root', 'Topic']);
});
