export function detachedEl<K extends keyof HTMLElementTagNameMap>(document: Document, tag: K): HTMLElementTagNameMap[K] {
  return document.createDocumentFragment().createEl(tag);
}
