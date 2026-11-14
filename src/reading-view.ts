import { MarkdownRenderChild, MarkdownView, type App, type MarkdownPostProcessorContext } from 'obsidian';
import { clearRenderedCode, renderCode } from './rendering';
import { readingTargets } from './reading-mapping';
import { clearInlineCode, inlineCodes, inlineTargets, renderInlineCode } from './inline-rendering';
import type { Locale } from './i18n';
import { codeOptions, codeDisplayKey, defaultCodeDisplay, type CodeDisplaySettings } from './code-options';
import { renderCodeDisplay } from './code-display';
import { parseDocument } from './parsing';
import { parameterLines } from './fence-params';

export class ReadingHighlights extends MarkdownRenderChild {
  private observer?: MutationObserver;
  private active = false;
  private revision = 0;
  constructor(element: HTMLElement, readonly context: MarkdownPostProcessorContext, private app: App, private dispose: () => void, private getLocale: () => Locale = () => 'zh', private getDisplay: () => CodeDisplaySettings = () => defaultCodeDisplay, private sessions = new Map<string, boolean>()) { super(element); }
  onload(): void {
    this.active = true;
    this.observer = new this.containerEl.ownerDocument.defaultView!.MutationObserver(() => this.refresh());
    this.observe();
    this.refresh();
  }
  private observe(): void { this.observer?.observe(this.containerEl, { childList: true, subtree: true }); }
  private owns(element: HTMLElement): boolean {
    const owner = element.closest('[data-hb-live-callout]');
    return !owner || owner === this.containerEl;
  }
  revealCode(text: string, fenceFrom: number): void {
    for (const { code, block } of readingTargets(this.containerEl, text, element => this.context.getSectionInfo(element))) if (block.fenceFrom === fenceFrom) {
      for (const details of code.querySelectorAll<HTMLDetailsElement>('details')) details.open = true;
    }
  }
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
        const inlines = inlineTargets(this.containerEl, text, element => this.context.getSectionInfo(element)).filter(target => this.owns(target.code));
        const matchedInlines = new Set(inlines.map(target => target.code));
        for (const code of inlineCodes(this.containerEl)) if (this.owns(code) && !matchedInlines.has(code)) clearInlineCode(code);
        for (const { code, inline } of inlines) renderInlineCode(code, inline);
        const targets = readingTargets(this.containerEl, text, element => this.context.getSectionInfo(element)).filter(target => this.owns(target.code));
        const matched = new Set(targets.map(target => target.code));
        for (const code of this.containerEl.querySelectorAll<HTMLElement>('pre > code')) if (this.owns(code) && !matched.has(code)) clearRenderedCode(code);
        const blocks = parseDocument(text).blocks, display = this.getDisplay();
        for (const { code, block } of targets) {
          const options = codeOptions(block, display);
          renderCode(code, block, this.getLocale(), options.showLineNumbers || block.language === 'diff' && options.diff || parameterLines(block).some(Boolean));
          renderCodeDisplay(code, block, display, this.getLocale(), this.sessions, codeDisplayKey(file.path, block, blocks));
        }
      } finally { if (this.active) this.observe(); }
    }).catch(error => console.error('Highlight Boost 阅读渲染失败', error));
  }
  onunload(): void {
    this.active = false;
    this.revision++;
    this.observer?.disconnect();
    for (const code of inlineCodes(this.containerEl)) if (this.owns(code)) clearInlineCode(code);
    for (const code of this.containerEl.querySelectorAll<HTMLElement>('pre > code')) if (this.owns(code)) clearRenderedCode(code);
    this.dispose();
  }
}
