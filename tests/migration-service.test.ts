import { expect, it } from 'vitest';
import { MigrationService, validMigrationRun, type MigrationRun, type MigrationStorage } from '../src/migration-service';
import { defaultImportOptions } from '../src/migration-plan';

function fixture() {
  const files = new Map([['a.md', '=={red}one=='], ['b.md', '<mark>two</mark>']]);
  const runs = new Map<string, MigrationRun>(), events: string[] = [];
  const storage: MigrationStorage = {
    read: async path => { if (!files.has(path)) throw new Error('missingSource'); return files.get(path)!; },
    write: async (path, expected, replacement) => { events.push(`write:${path}`); if (files.get(path) !== expected) throw new Error('migrationChanged'); files.set(path, replacement); },
    save: async run => { events.push('journal'); runs.set(run.id, structuredClone(run)); },
    history: async () => [...runs.values()].map(run => structuredClone(run)),
  };
  return { service: new MigrationService(storage), storage, files, runs, events };
}
it('预览不写文件，按所选文件应用，先保存恢复记录再写笔记', async () => {
  const f = fixture(), preview = await f.service.preview(['b.md', 'a.md', 'a.md'], defaultImportOptions);
  expect(f.events).toEqual([]); expect(preview.map(file => file.path)).toEqual(['a.md', 'b.md']);
  const run = await f.service.apply([preview[0]!]);
  expect(f.events.slice(0, 2)).toEqual(['journal', 'write:a.md']); expect(f.files.get('b.md')).toBe('<mark>two</mark>');
  expect(run.files[0]!.status).toBe('applied');
  await f.service.restore(run.id, 'a.md'); expect(f.files.get('a.md')).toBe('=={red}one==');
});
it('旧预览逐文件记录冲突，其余文件继续应用', async () => {
  const f = fixture(), preview = await f.service.preview([...f.files.keys()], defaultImportOptions);
  f.files.set('a.md', 'later edit'); const run = await f.service.apply(preview);
  expect(run.files.map(file => file.status)).toEqual(['error', 'applied']); expect(f.files.get('a.md')).toBe('later edit');
  expect(f.files.get('b.md')).toBe('==two==');
});
it('迁移后的编辑保留原文，文件回到转换结果后可恢复，重复恢复保持一致', async () => {
  const f = fixture(), run = await f.service.apply(await f.service.preview(['a.md'], defaultImportOptions));
  f.files.set('a.md', 'new edit'); await expect(f.service.restore(run.id, 'a.md')).rejects.toThrow('migrationChanged'); expect(f.files.get('a.md')).toBe('new edit');
  f.files.set('a.md', run.files[0]!.after); await f.service.restore(run.id, 'a.md'); await f.service.restore(run.id, 'a.md');
  expect(f.files.get('a.md')).toBe(run.files[0]!.before);
});
it('第二次扫描无变更，不生成空迁移记录', async () => {
  const f = fixture(); await f.service.apply(await f.service.preview(['a.md'], defaultImportOptions));
  const repeated = await f.service.preview(['a.md'], defaultImportOptions); expect(repeated).toEqual([]);
  await f.service.apply(repeated); expect(f.runs.size).toBe(1);
});
it('记录写入失败时笔记不变；写完笔记后保存状态失败仍可从 pending 记录恢复', async () => {
  const f = fixture(), preview = await f.service.preview(['a.md'], defaultImportOptions), save = f.storage.save;
  f.storage.save = async () => { throw new Error('disk'); };
  await expect(f.service.apply(preview)).rejects.toThrow('disk'); expect(f.files.get('a.md')).toBe(preview[0]!.before);
  let count = 0; f.storage.save = async run => { if (++count === 2) throw new Error('state'); await save(run); };
  await expect(f.service.apply(preview)).rejects.toThrow('state'); const pending = [...f.runs.values()][0]!;
  expect(pending.files[0]!.status).toBe('pending');
  f.storage.save = save; await new MigrationService(f.storage).restore(pending.id, 'a.md'); expect(f.files.get('a.md')).toBe(preview[0]!.before);
});
it('同一服务串行运行写入，恢复记录校验路径和版本', async () => {
  const f = fixture(), preview = await f.service.preview(['a.md'], defaultImportOptions);
  const first = f.service.apply(preview); await expect(f.service.apply(preview)).rejects.toThrow('migrationBusy'); await first;
  const run = [...f.runs.values()][0]!; expect(validMigrationRun(run)).toBe(true);
  expect(validMigrationRun({ ...run, v: 2 })).toBe(false);
  expect(validMigrationRun({ ...run, files: [{ ...run.files[0], path: '../note.md' }] })).toBe(false);
});
