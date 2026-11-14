import { planImport, type ImportOptions, type ImportPlan } from './migration-plan';

export interface ImportFile extends ImportPlan { path: string }
export interface MigrationFile { path: string; before: string; after: string; count: number; status: 'pending' | 'applied' | 'restored' | 'error'; error?: string }
export interface MigrationRun { v: 1; id: string; created: string; files: MigrationFile[] }
export interface MigrationStorage {
  read(path: string): Promise<string>;
  write(path: string, expected: string, replacement: string): Promise<void>;
  save(run: MigrationRun): Promise<void>;
  history(): Promise<MigrationRun[]>;
}
export function validMigrationRun(value: unknown): value is MigrationRun {
  if (!value || typeof value !== 'object') return false;
  const run = value as MigrationRun;
  return run.v === 1 && typeof run.id === 'string' && /^[a-zA-Z0-9-]+$/.test(run.id) && typeof run.created === 'string' && Array.isArray(run.files) && run.files.every(file =>
    file && typeof file.path === 'string' && /\.md$/i.test(file.path) && !/^(?:[\\/]|[A-Za-z]:)/.test(file.path) && !file.path.split(/[\\/]/).some(part => part === '..' || !part) &&
    typeof file.before === 'string' && typeof file.after === 'string' && Number.isSafeInteger(file.count) && file.count >= 0 && ['pending', 'applied', 'restored', 'error'].includes(file.status));
}
export class MigrationService {
  private busy = false;
  constructor(private storage: MigrationStorage) {}
  async preview(paths: string[], options: ImportOptions): Promise<ImportFile[]> {
    const result: ImportFile[] = [];
    for (const path of [...new Set(paths)].sort()) {
      const plan = planImport(await this.storage.read(path), options);
      if (plan.entries.length) result.push({ path, ...plan });
    }
    return result;
  }
  history(): Promise<MigrationRun[]> { return this.storage.history(); }
  private async exclusive<T>(run: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('migrationBusy');
    this.busy = true;
    try { return await run(); } finally { this.busy = false; }
  }
  apply(files: ImportFile[]): Promise<MigrationRun> {
    return this.exclusive(async () => {
      const run: MigrationRun = { v: 1, id: crypto.randomUUID(), created: new Date().toISOString(), files: files.filter(file => file.before !== file.after).map(file => ({ path: file.path, before: file.before, after: file.after, count: file.entries.filter(entry => entry.after !== undefined).reduce((sum, entry) => sum + entry.count, 0), status: 'pending' })) };
      if (!validMigrationRun(run) || new Set(run.files.map(file => file.path)).size !== run.files.length) throw new Error('migrationRecordInvalid');
      if (!run.files.length) return run;
      await this.storage.save(run);
      for (const file of run.files) {
        try { await this.storage.write(file.path, file.before, file.after); file.status = 'applied'; }
        catch (error) { file.status = 'error'; file.error = error instanceof Error ? error.message : String(error); }
        await this.storage.save(run);
      }
      return run;
    });
  }
  restore(id: string, path: string): Promise<MigrationRun> {
    return this.exclusive(async () => {
      const run = (await this.history()).find(run => run.id === id);
      const file = run?.files.find(file => file.path === path);
      if (!run || !file || !validMigrationRun(run)) throw new Error('migrationRecordInvalid');
      const text = await this.storage.read(path);
      if (text === file.before) { file.status = 'restored'; delete file.error; }
      else {
        if (text !== file.after) throw new Error('migrationChanged');
        await this.storage.write(path, file.after, file.before); file.status = 'restored'; delete file.error;
      }
      await this.storage.save(run); return run;
    });
  }
}
