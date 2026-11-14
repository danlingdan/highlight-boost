import type { IndexHit } from './vault-index';
import { isWithin } from './vault-index';
export type SearchScope = 'note' | 'folder' | 'vault' | 'collection';
export interface HighlightQuery {
  scope: SearchScope; note?: string; search?: string; type?: string; semantic?: string; color?: string; language?: string; path?: string; sort?: string;
}
export function queryHighlights(hits: IndexHit[], query: HighlightQuery, label: (hit: IndexHit) => string): IndexHit[] {
  const needle = query.search?.trim().toLocaleLowerCase() ?? '', path = query.path?.trim().replaceAll('\\', '/').toLocaleLowerCase() ?? '';
  const folder = query.note?.includes('/') ? query.note.slice(0, query.note.lastIndexOf('/')) : '';
  return hits.filter(hit => (query.scope !== 'note' || hit.path === query.note) && (query.scope !== 'folder' || Boolean(query.note) && isWithin(hit.path, folder)) &&
    (!needle || `${hit.item.quote}\n${label(hit)}\n${hit.item.language ?? ''}\n${hit.item.note ?? ''}`.toLocaleLowerCase().includes(needle)) &&
    (!query.type || (query.type === 'code' ? hit.item.kind.startsWith('code-') : hit.item.kind === query.type)) &&
    (!query.semantic || hit.item.semantic === query.semantic) && (!query.color || hit.item.color === query.color) &&
    (!query.language || hit.item.language === query.language) && (!path || hit.path.toLocaleLowerCase().includes(path)))
    .sort((a, b) => (query.sort === 'semantic' ? label(a).localeCompare(label(b)) : 0) || a.path.localeCompare(b.path) || a.item.from - b.item.from || a.item.id.localeCompare(b.item.id));
}
