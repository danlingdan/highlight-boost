import { expect, it } from 'vitest';
import { collectItems } from '../src/anchors';
import { queryHighlights } from '../src/query';

const hits = ['a/n.md', 'a/sub/n.md', 'ab/n.md'].map(path => ({ path, text: '==word==', item: collectItems('==word==')[0]! }));
it('目录包含子目录并区分相似前缀，当前笔记和全库范围可组合过滤', () => {
  expect(queryHighlights(hits, { scope: 'folder', note: 'a/n.md' }, hit => hit.item.label)).toHaveLength(2);
  expect(queryHighlights(hits, { scope: 'note', note: 'a/n.md' }, hit => hit.item.label)).toHaveLength(1);
  expect(queryHighlights(hits, { scope: 'vault', path: 'a\\sub', search: 'WORD', type: 'prose', color: 'default' }, hit => hit.item.label)).toHaveLength(1);
  expect(queryHighlights(hits, { scope: 'vault', language: 'c' }, hit => hit.item.label)).toHaveLength(0);
  expect(queryHighlights(hits, { scope: 'folder' }, hit => hit.item.label)).toHaveLength(0);
});
