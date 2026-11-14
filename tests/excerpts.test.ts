import { expect, it } from 'vitest';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { excerptContext, fencedExcerpt, formatExcerpt } from '../src/excerpts';
import { applyChanges, planHighlight } from '../src/editing';
import { collectItems } from '../src/anchors';
import { presets } from '../src/domain';

it.each(['```\ninside\n```', 'const ticks = "``````";', '\t中文 😀\n\nlast\n'])('代码摘录选择足够长的围栏，重新解析保留字符：%s', value => {
  const tree = fromMarkdown(fencedExcerpt(value, 'markdown'));
  expect(tree.children).toHaveLength(1);
  expect(tree.children[0]).toMatchObject({ type: 'code', lang: 'markdown', value });
});

it('围栏语言不引入换行或反引号', () => {
  const tree = fromMarkdown(fencedExcerpt('code', 'js\n`'));
  expect(tree.children[0]).toMatchObject({ type: 'code', lang: 'js', value: 'code' });
});

it('标题链按层级切换，跳过 frontmatter 和代码中的伪标题', () => {
  const text = '---\ntitle: metadata\n---\n# Root\n## Old\nold\n## New **title**\n```md\n# fake\n```\n==word==';
  expect(excerptContext(text, collectItems(text)[0]!).headings).toEqual(['Root', 'New title']);
});

it('标题含语义高亮或行内标注时，提取实际标题文本', () => {
  let text = '# Root\n\n## A `code` title\n\n==body==';
  const at = text.indexOf('A `code` title');
  text = applyChanges(text, planHighlight(text, [{ from: at, to: at + 'A `code` title'.length }], presets[0]!).changes);
  expect(excerptContext(text, collectItems(text).find(item => item.quote === 'body')!).headings).toEqual(['Root', 'A code title']);
});

it('容器代码使用块内行号，摘录补充相邻行并保留精确标注', () => {
  let text = '# Root\n\n> ```js\n> first();\n> target();\n> last();\n> ```';
  const at = text.indexOf('target');
  text = applyChanges(text, planHighlight(text, [{ from: at, to: at + 6 }], presets[1]!).changes);
  const item = collectItems(text)[0]!, context = excerptContext(text, item);
  expect(context).toMatchObject({ headings: ['Root'], heading: 'Root', line: 2, endLine: 2, contextFrom: 1, contextTo: 3, code: 'first();\ntarget();\nlast();' });
  const excerpt = formatExcerpt(item, context, '[[note#Root]]', item.label, 'zh');
  expect(excerpt).toContain('```js\ntarget\n```');
  expect(excerpt).toContain('来源：[[note#Root]] · 疑问');
  expect(excerpt).toContain('js · 第 2—2 行');
  expect(fromMarkdown(excerpt).children.filter(node => node.type === 'code')).toHaveLength(2);
});

it('多行正文逐行引用，待定位代码使用原摘录与状态', () => {
  const item = { ...collectItems('==word==')[0]!, quote: 'first\nsecond' };
  expect(formatExcerpt(item, { headings: [] }, '[[note]]', 'Yellow', 'en')).toBe('> first\n> second\n\nSource: [[note]] · Yellow');
  const missing = { ...item, kind: 'code-range' as const, status: 'missing' as const, language: 'c' };
  expect(formatExcerpt(missing, excerptContext('', missing), '[[note]]', 'Question', 'en')).toContain('Needs relocation');
});

it('读取已有正文块 ID 和代码块 ID，代码语言内容中的伪标识不作为来源', () => {
  const prose = '==word== ^prose-id';
  expect(excerptContext(prose, collectItems(prose)[0]!).blockId).toBe('prose-id');
  let text = '# Root\n```c\nword\n```\n^code-id\n';
  const from = text.indexOf('word');
  text = applyChanges(text, planHighlight(text, [{ from, to: from + 4 }], presets[0]!).changes);
  expect(excerptContext(text, collectItems(text)[0]!).blockId).toBe('code-id');
});
