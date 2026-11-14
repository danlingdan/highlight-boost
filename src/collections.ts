import type { Color, HighlightItem } from './domain';
import { colors } from './domain';
import type { IndexedNote, IndexHit } from './vault-index';
import { renamedPath } from './vault-index';

export interface CollectionEntry {
  id: string; path: string; kind: HighlightItem['kind']; from: number; quote: string; prefix: string; suffix: string;
  color: Color; label: string; semantic?: string; markId?: string; blockId?: string; language?: string; line?: number; note?: string;
}
export interface HighlightCollection { id: string; name: string; entries: CollectionEntry[] }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export function normalizeCollections(value: unknown): HighlightCollection[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap(raw => {
    const saved = object(raw);
    if (typeof saved.id !== 'string' || !saved.id || ids.has(saved.id) || typeof saved.name !== 'string' || !saved.name.trim()) return [];
    ids.add(saved.id);
    const entries: CollectionEntry[] = [], entryIds = new Set<string>();
    for (const raw of Array.isArray(saved.entries) ? saved.entries : []) {
      const entry = object(raw);
      if (typeof entry.id !== 'string' || !entry.id || entryIds.has(entry.id) || typeof entry.path !== 'string' || entry.path.split('/').some(part => !part || part === '..' || part === '.') ||
        !['prose', 'inline-code', 'code-line', 'code-range'].includes(String(entry.kind)) || !Number.isSafeInteger(entry.from) || Number(entry.from) < 0 ||
        typeof entry.quote !== 'string' || typeof entry.prefix !== 'string' || typeof entry.suffix !== 'string' || typeof entry.label !== 'string' || !colors.includes(entry.color as Color)) continue;
      entryIds.add(entry.id);
      entries.push({ id: entry.id, path: entry.path, kind: entry.kind as HighlightItem['kind'], from: Number(entry.from), quote: entry.quote, prefix: entry.prefix, suffix: entry.suffix, color: entry.color as Color, label: entry.label,
        ...(typeof entry.semantic === 'string' ? { semantic: entry.semantic } : {}), ...(typeof entry.markId === 'string' ? { markId: entry.markId } : {}), ...(typeof entry.blockId === 'string' ? { blockId: entry.blockId } : {}),
        ...(typeof entry.language === 'string' ? { language: entry.language } : {}), ...(Number.isSafeInteger(entry.line) && Number(entry.line) > 0 ? { line: Number(entry.line) } : {}), ...(typeof entry.note === 'string' ? { note: entry.note } : {}) });
    }
    return [{ id: saved.id, name: saved.name.trim(), entries }];
  });
}
export function collectionEntry(hit: IndexHit): CollectionEntry {
  const { item, text, path } = hit;
  return { id: crypto.randomUUID(), path, kind: item.kind, from: item.from, quote: item.quote,
    prefix: text.slice(Math.max(0, item.from - 32), item.from), suffix: text.slice(item.to, item.to + 32),
    color: item.color, label: item.label, semantic: item.semantic, markId: item.markId, blockId: item.blockId, language: item.language, line: item.line, note: item.note };
}
export function resolveEntry(note: IndexedNote | undefined, entry: CollectionEntry): IndexHit {
  const candidates = note?.items.filter(item => item.kind === entry.kind && (entry.markId ? item.markId === entry.markId && item.blockId === entry.blockId : !item.markId && item.quote === entry.quote)) ?? [];
  const contextual = candidates.filter(item => note!.text.slice(Math.max(0, item.from - entry.prefix.length), item.from) === entry.prefix && note!.text.slice(item.to, item.to + entry.suffix.length) === entry.suffix);
  const item = candidates.length === 1 ? candidates[0] : contextual.length === 1 ? contextual[0] : undefined;
  return { path: entry.path, text: note?.text ?? '', entryId: entry.id, item: item ?? {
    id: `collection:${entry.id}`, kind: entry.kind, from: entry.from, to: entry.from, quote: entry.quote, color: entry.color, label: entry.label, semantic: entry.semantic,
    markId: entry.markId, blockId: entry.blockId, language: entry.language, line: entry.line, note: entry.note, status: candidates.length ? 'ambiguous' : 'missing',
  } };
}
export function renameCollections(collections: HighlightCollection[], before: string, after: string): boolean {
  let changed = false;
  for (const collection of collections) for (const entry of collection.entries) {
    const path = renamedPath(entry.path, before, after);
    if (path !== entry.path) { entry.path = path; changed = true; }
  }
  return changed;
}
