import { expect, it } from 'vitest';
import { HighlightIndex, isExportNote } from '../src/vault-index';

it('增量只读取指定文件，重建与增量结果一致', async () => {
  const files = new Map([['a.md', '==alpha=='], ['dir/b.md', '==beta==']]), reads: string[] = [];
  const index = new HighlightIndex({ paths: () => [...files.keys()], read: async path => { reads.push(path); return files.get(path)!; } }, () => {});
  await index.rebuild();
  reads.length = 0; files.set('a.md', '==updated=='); await index.enqueue('a.md');
  expect(reads).toEqual(['a.md']);
  const snapshot = index.all(); await index.rebuild(); expect(index.all()).toEqual(snapshot);
});

it('旧读取不会覆盖编辑器新缓冲区，连续入队以最新请求为准', async () => {
  let release!: (value: string) => void, started!: () => void;
  const reading = new Promise<void>(resolve => { started = resolve; });
  let calls = 0;
  const index = new HighlightIndex({ paths: () => ['a.md'], read: async () => { calls++; started(); return new Promise<string>(resolve => { release = resolve; }); } }, () => {});
  void index.enqueue('a.md'); await reading;
  index.set('a.md', '==buffer=='); release('==old=='); await index.ready;
  expect(index.all()[0]!.item.quote).toBe('buffer');
  expect(calls).toBe(1);
});

it('改名和删除取消旧路径读取，目录名称按完整边界处理', async () => {
  const index = new HighlightIndex({ paths: () => [], read: async () => '==read==' }, () => {});
  index.set('a/n.md', '==one=='); index.set('ab/n.md', '==two==');
  void index.enqueue('a/n.md'); index.rename('a', 'new'); await index.ready;
  expect([...index.notes.keys()].sort()).toEqual(['ab/n.md', 'new/n.md']);
  expect(index.notes.get('new/n.md')!.items[0]!.quote).toBe('one');
  void index.enqueue('new/n.md'); index.remove('new'); await index.ready;
  expect([...index.notes.keys()]).toEqual(['ab/n.md']);
});

it('读取失败保留上一快照并可重试，卸载后异步结果不再发布', async () => {
  let fail = true, changed = 0;
  const index = new HighlightIndex({ paths: () => ['a.md'], read: async () => { if (fail) throw new Error('read'); return '==fresh=='; } }, () => { changed++; });
  index.set('a.md', '==old=='); await index.enqueue('a.md');
  expect(index.errors.has('a.md')).toBe(true); expect(index.all()[0]!.item.quote).toBe('old');
  fail = false; await index.rebuild(); expect(index.errors.size).toBe(0); expect(index.all()[0]!.item.quote).toBe('fresh');
  const before = changed; void index.enqueue('a.md'); index.dispose(); await index.ready;
  expect(changed).toBe(before);
});

it('导出标记仅从 frontmatter 读取，摘录笔记不回流索引', () => {
  const index = new HighlightIndex({ paths: () => [], read: async () => '' }, () => {});
  const exported = '---\nhighlight-boost-export: true\n---\n==word==';
  expect(isExportNote(exported)).toBe(true); index.set('export.md', exported); expect(index.all()).toEqual([]);
  expect(isExportNote('text\nhighlight-boost-export: true\n==word==')).toBe(false);
  expect(isExportNote('---\nother: true\n---\nhighlight-boost-export: true')).toBe(false);
});
