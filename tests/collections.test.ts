import { expect, it } from 'vitest';
import { collectItems } from '../src/anchors';
import { collectionEntry, normalizeCollections, renameCollections, resolveEntry } from '../src/collections';
import { applyChanges, planHighlight } from '../src/editing';
import { presets } from '../src/domain';

it('持久身份在位置及语义变化后仍可解析，删除后保留原摘录', () => {
  const source = 'word', text = applyChanges(source, planHighlight(source, [{ from: 0, to: 4 }], presets[0]!).changes);
  const ref = collectionEntry({ path: 'a.md', text, item: collectItems(text)[0]! });
  const moved = `prefix\n${text}`;
  expect(resolveEntry({ path: 'a.md', text: moved, items: collectItems(moved) }, ref).item.from).toBeGreaterThan(ref.from);
  const missing = resolveEntry(undefined, ref); expect(missing.item.status).toBe('missing'); expect(missing.item.quote).toBe('word');
});

it('普通原生高亮使用原句与上下文定位，重复且无上下文时展示歧义', () => {
  const text = 'left ==same== right';
  const ref = collectionEntry({ path: 'a.md', text, item: collectItems(text)[0]! });
  const moved = 'before\n' + text;
  expect(resolveEntry({ path: 'a.md', text: moved, items: collectItems(moved) }, ref).item.status).toBe('resolved');
  const duplicates = '==same==\n==same==';
  expect(resolveEntry({ path: 'a.md', text: duplicates, items: collectItems(duplicates) }, ref).item.status).toBe('ambiguous');
});

it('校验集合、去重身份、保留空集合并迁移目录路径', () => {
  const text = '==word==', ref = collectionEntry({ path: 'old/a.md', text, item: collectItems(text)[0]! });
  const result = normalizeCollections([{ id: 'one', name: '  Study  ', entries: [ref, ref, { ...ref, id: 'bad', path: '../a.md' }] }, { id: 'one', name: 'duplicate' }, { id: 'two', name: 'empty' }]);
  expect(result).toHaveLength(2); expect(result[0]!.entries).toHaveLength(1); expect(result[0]!.name).toBe('Study');
  expect(normalizeCollections(result)).toEqual(result); expect(renameCollections(result, 'old', 'new')).toBe(true);
  expect(result[0]!.entries[0]!.path).toBe('new/a.md'); expect(renameCollections(result, 'old', 'new')).toBe(false);
  renameCollections(result, 'new/a.md', 'new/a.txt');
  expect(normalizeCollections(result)[0]!.entries[0]!.path).toBe('new/a.txt');
});
