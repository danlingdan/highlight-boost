import { normalizePath, type Plugin, type MarkdownView } from 'obsidian';
import { MigrationService, validMigrationRun, type MigrationFile } from './migration-service';

type SavedState = Pick<MigrationFile, 'path' | 'status' | 'error'>;
function validSavedState(value: unknown): value is SavedState {
  if (!value || typeof value !== 'object' || !('path' in value) || !('status' in value)) return false;
  return typeof value.path === 'string' &&
    (value.status === 'pending' || value.status === 'applied' || value.status === 'restored' || value.status === 'error') &&
    (!('error' in value) || value.error === undefined || typeof value.error === 'string');
}

export function createMigrationService(plugin: Plugin, openView: (path: string) => MarkdownView | undefined): MigrationService {
  const vault = plugin.app.vault, adapter = vault.adapter;
  const directory = normalizePath(`${plugin.manifest.dir ?? `${vault.configDir}/plugins/${plugin.manifest.id}`}/migrations`);
  return new MigrationService({
    read: async path => {
      const file = vault.getFileByPath(path); if (!file) throw new Error('missingSource');
      return openView(path)?.editor.getValue() ?? vault.read(file);
    },
    write: async (path, expected, replacement) => {
      const file = vault.getFileByPath(path); if (!file) throw new Error('missingSource');
      const view = openView(path);
      if (view && view.editor.getValue() !== expected) throw new Error('migrationChanged');
      await vault.process(file, text => { if (text !== expected) throw new Error('migrationChanged'); return replacement; });
    },
    save: async run => {
      if (!validMigrationRun(run)) throw new Error('migrationRecordInvalid');
      if (!await adapter.exists(directory)) await adapter.mkdir(directory);
      const path = normalizePath(`${directory}/${run.id}.json`);
      if (!await adapter.exists(path)) await adapter.write(path, JSON.stringify(run, null, 2));
      else await adapter.write(normalizePath(`${directory}/${run.id}.state.json`), JSON.stringify({ files: run.files.map(({ path, status, error }) => ({ path, status, error })) }));
    },
    history: async () => {
      if (!await adapter.exists(directory)) return [];
      const records = [];
      for (const path of (await adapter.list(directory)).files.filter(path => path.endsWith('.json') && !path.endsWith('.state.json'))) {
        const run: unknown = JSON.parse(await adapter.read(path));
        if (!validMigrationRun(run)) throw new Error('migrationRecordInvalid');
        const statePath = path.replace(/\.json$/, '.state.json');
        if (await adapter.exists(statePath)) {
          try {
            const state: unknown = JSON.parse(await adapter.read(statePath));
            const files = state && typeof state === 'object' && 'files' in state ? state.files : undefined;
            if (Array.isArray(files) && files.every(validSavedState) && files.length === run.files.length && files.every((file, index) => file.path === run.files[index]!.path)) {
              run.files.forEach((file, index) => { const saved = files[index]!; file.status = saved.status; if (saved.error) file.error = saved.error; else delete file.error; });
            }
          } catch { /* 原始快照独立保存，状态写入中断后仍可逐文件恢复。 */ }
        }
        records.push(run);
      }
      return records.sort((a, b) => b.created.localeCompare(a.created));
    },
  });
}
