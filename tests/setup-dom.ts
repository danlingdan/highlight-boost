if (typeof Node !== 'undefined') {
  globalThis.createFragment = () => document.createDocumentFragment();
  Object.defineProperty(Node.prototype, 'createEl', {
    configurable: true,
    value(this: Node, tag: keyof HTMLElementTagNameMap) {
      const element = (this.ownerDocument ?? document).createElement(tag);
      this.appendChild(element);
      return element;
    },
  });
  Object.defineProperty(Node.prototype, 'createSpan', {
    configurable: true,
    value(this: Node) { return this.createEl('span'); },
  });
}
