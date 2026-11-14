import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField, type MarkdownPostProcessorContext, type MarkdownRenderChild } from 'obsidian';

export function liveCalloutHighlights(decorate: (element: HTMLElement, context: MarkdownPostProcessorContext) => MarkdownRenderChild) {
  return ViewPlugin.fromClass(class {
    private children = new Map<HTMLElement, { path: string; child: MarkdownRenderChild }>();
    private observer: MutationObserver;
    private timer?: ReturnType<typeof setTimeout>;
    constructor(private view: EditorView) {
      this.observer = new MutationObserver(() => this.schedule());
      this.observer.observe(view.contentDOM, { childList: true, subtree: true }); this.schedule();
    }
    update(update: ViewUpdate): void { if (update.docChanged || update.viewportChanged) this.schedule(); }
    private schedule(): void { clearTimeout(this.timer); this.timer = setTimeout(() => this.refresh(), 0); }
    private refresh(): void {
      const path = this.view.state.field(editorInfoField, false)?.file?.path;
      const live = this.view.state.field(editorLivePreviewField, false);
      const elements = path && live ? [...this.view.contentDOM.querySelectorAll<HTMLElement>('.callout')].filter(element => !element.parentElement?.closest('.callout')) : [];
      for (const [element, entry] of this.children) if (!elements.includes(element) || entry.path !== path) { entry.child.unload(); delete element.dataset.hbLiveCallout; this.children.delete(element); }
      if (!path) return;
      for (const element of elements) if (!this.children.has(element)) {
        const context: MarkdownPostProcessorContext = {
          sourcePath: path, docId: `hb-callout-${crypto.randomUUID()}`, frontmatter: null,
          addChild: child => child.load(),
          getSectionInfo: () => {
            if (!this.view.contentDOM.contains(element)) return null;
            const doc = this.view.state.doc, position = this.view.posAtDOM(element), line = doc.lineAt(position);
            let last = line.number;
            while (last < doc.lines && /^\s*>/.test(doc.line(last + 1).text)) last++;
            return { text: doc.toString(), lineStart: line.number - 1, lineEnd: last - 1 };
          },
        };
        element.dataset.hbLiveCallout = context.docId;
        const child = decorate(element, context); this.children.set(element, { path, child }); child.load();
      }
    }
    destroy(): void { clearTimeout(this.timer); this.observer.disconnect(); for (const [element, { child }] of this.children) { child.unload(); delete element.dataset.hbLiveCallout; } this.children.clear(); }
  });
}
