export function detachedEl<K extends keyof HTMLElementTagNameMap>(document: Document, tag: K): HTMLElementTagNameMap[K] {
  return document.adoptNode(createFragment()).createEl(tag);
}
