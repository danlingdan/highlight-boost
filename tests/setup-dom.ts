if (typeof Node !== 'undefined') {
  Object.defineProperty(Node.prototype, 'createEl', {
    configurable: true,
    value(this: Node, tag: keyof HTMLElementTagNameMap) {
      const element = (this.ownerDocument ?? document).createElement(tag);
      this.appendChild(element);
      return element;
    },
  });
}
