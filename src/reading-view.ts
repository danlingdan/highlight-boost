import { MarkdownRenderChild, MarkdownView, type App, type MarkdownPostProcessorContext } from 'obsidian';
import { clearRenderedCode, renderCode } from './rendering';
import { readingTargets } from './reading-mapping';

export class ReadingHighlights extends MarkdownRenderChild {
  private observer?: MutationObserver;
  private active = false;
  private revision = 0;
  constructor(element: HTMLElement, readonly context: MarkdownPostProcessorContext, private app: App, private dispose: () => void) { super(element); }
  onload(): void {
    this.active = true;
    this.observer = new this.containerEl.ownerDocument.defaultView!.MutationObserver(() => this.refresh());
    this.observe();
    this.refresh();
  }
  private observe(): void { this.observer?.observe(this.containerEl, { childList: true, subtree: true }); }
  refresh(): void {
    if (!this.active) return;
    const file = this.app.vault.getFileByPath(this.context.sourcePath);
    if (!file) return;
    const revision = ++this.revision;
    const editing = this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view).find(view => view instanceof MarkdownView && view.file?.path === file.path && view.getMode() === 'source') as MarkdownView | undefined;
    const source = editing ? Promise.resolve(editing.editor.getValue()) : this.app.vault.cachedRead(file);
    void source.then(text => {
      if (!this.active || revision !== this.revision) return;
      this.observer?.disconnect();
      try {
        const targets = readingTargets(this.containerEl, text, element => this.context.getSectionInfo(element));
        const matched = new Set(targets.map(target => target.code));
        for (const code of this.containerEl.querySelectorAll<HTMLElement>('pre > code')) if (!matched.has(code)) clearRenderedCode(code);
        for (const { code, block } of targets) renderCode(code, block);
      } finally { if (this.active) this.observe(); }
    }).catch(error => console.error('Highlight Boost 阅读渲染失败', error));
  }
  onunload(): void {
    this.active = false;
    this.revision++;
    this.observer?.disconnect();
    for (const code of this.containerEl.querySelectorAll<HTMLElement>('pre > code')) clearRenderedCode(code);
    this.dispose();
  }
}
