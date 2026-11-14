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

it('冷索引按时间片让出线程，批量通知与最终快照一致', async () => {
  let clock = 0, yields = 0, changes = 0;
  const paths = Array.from({ length: 12 }, (_, i) => `${i}.md`);
  const index = new HighlightIndex({ paths: () => paths, read: async path => { clock += 5; return `==${path}==`; } }, () => { changes++; }, { now: () => clock, budgetMs: 8, yield: async () => { yields++; } });
  await index.rebuild();
  expect(yields).toBeGreaterThan(0); expect(changes).toBeLessThan(paths.length);
  expect(index.notes.size).toBe(paths.length); expect(index.all()).toHaveLength(paths.length);
});

it('热重建复用未变的条目，清除读取错误时仍通知视图', async () => {
  let changes = 0;
  const index = new HighlightIndex({ paths: () => ['a.md'], read: async () => '==same==' }, () => { changes++; });
  await index.rebuild(); const items = index.notes.get('a.md')!.items, count = changes;
  await index.rebuild(); expect(index.notes.get('a.md')!.items).toBe(items); expect(changes).toBe(count);
  index.errors.set('a.md', 'old error'); await index.enqueue('a.md');
  expect(index.errors.size).toBe(0); expect(changes).toBe(count + 1);
});

it('索引让出线程时的编辑仍以编辑器新缓冲区为准，卸载清除缓存', async () => {
  let clock = 0, release!: () => void, entered!: () => void;
  const blocked = new Promise<void>(resolve => { entered = resolve; });
  const index = new HighlightIndex({ paths: () => ['a.md', 'b.md'], read: async () => { clock += 20; return '==disk=='; } }, () => {}, { now: () => clock, budgetMs: 8, yield: () => { entered(); return new Promise<void>(resolve => { release = resolve; }); } });
  const pending = index.rebuild(); await blocked; index.set('b.md', '==buffer=='); release(); await pending;
  expect(index.notes.get('b.md')!.items[0]!.quote).toBe('buffer');
  index.dispose(); expect(index.notes.size).toBe(0);
});
