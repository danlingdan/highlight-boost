import { collectItems } from './anchors';
import type { HighlightItem } from './domain';

export interface IndexedNote { path: string; text: string; items: HighlightItem[] }
export interface IndexHit { path: string; text: string; item: HighlightItem; entryId?: string }
export interface IndexSource { paths(): string[]; read(path: string): Promise<string> }
export const isWithin = (path: string, folder: string) => !folder || path === folder || path.startsWith(`${folder}/`);
export const renamedPath = (path: string, before: string, after: string) => isWithin(path, before) ? after + path.slice(before.length) : path;
export function isExportNote(text: string): boolean {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  return frontmatter !== undefined && /^highlight-boost-export:[ \t]*true[ \t]*\r?$/m.test(frontmatter);
}

export class HighlightIndex {
  readonly notes = new Map<string, IndexedNote>();
  readonly errors = new Map<string, string>();
  private versions = new Map<string, number>();
  private tail: Promise<void> = Promise.resolve();
  private closed = false;
  constructor(private source: IndexSource, private changed: () => void) {}
  get ready(): Promise<void> { return this.drain(); }
  private async drain(): Promise<void> {
    let pending: Promise<void>;
    do { pending = this.tail; await pending; } while (pending !== this.tail);
  }
  private version(path: string): number {
    const version = (this.versions.get(path) ?? 0) + 1; this.versions.set(path, version); return version;
  }
  set(path: string, text: string): void {
    if (this.closed) return;
    this.version(path); this.publish(path, text);
  }
  private publish(path: string, text: string): void {
    this.errors.delete(path);
    if (isExportNote(text)) this.notes.delete(path);
    else this.notes.set(path, { path, text, items: collectItems(text) });
    this.changed();
  }
  enqueue(path: string): Promise<void> {
    if (this.closed) return this.tail;
    const version = this.version(path);
    this.tail = this.tail.then(async () => {
      if (this.closed || this.versions.get(path) !== version) return;
      try {
        const text = await this.source.read(path);
        if (!this.closed && this.versions.get(path) === version) this.publish(path, text);
      } catch (error) {
        if (!this.closed && this.versions.get(path) === version) { this.errors.set(path, String(error)); this.changed(); }
      }
    });
    return this.tail;
  }
  remove(path: string): void {
    for (const key of new Set([...this.versions.keys(), ...this.notes.keys(), ...this.errors.keys()])) if (isWithin(key, path)) {
      this.version(key); this.notes.delete(key); this.errors.delete(key);
    }
    if (!this.closed) this.changed();
  }
  rename(before: string, after: string): void {
    const moved = [...this.notes.values()].filter(note => isWithin(note.path, before));
    this.remove(before);
    for (const note of moved) this.set(renamedPath(note.path, before, after), note.text);
  }
  rebuild(): Promise<void> {
    if (this.closed) return this.tail;
    const paths = new Set(this.source.paths());
    for (const path of this.notes.keys()) if (!paths.has(path)) this.remove(path);
    for (const path of this.errors.keys()) if (!paths.has(path)) this.remove(path);
    for (const path of paths) void this.enqueue(path);
    return this.tail;
  }
  all(): IndexHit[] { return [...this.notes.values()].flatMap(note => note.items.map(item => ({ path: note.path, text: note.text, item }))); }
  dispose(): void { this.closed = true; }
}
