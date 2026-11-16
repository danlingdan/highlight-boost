import { MarkdownRenderChild, MarkdownView, type App, type MarkdownPostProcessorContext } from 'obsidian';
import { clearRenderedCode, renderCode } from './rendering';
import { readingTargets } from './reading-mapping';
import { clearInlineCode, inlineCodes, inlineTargets, renderInlineCode } from './inline-rendering';
import type { Locale } from './i18n';
import { codeDisplayKey, defaultCodeDisplay, type CodeDisplaySettings } from './code-options';
import { renderCodeDisplay } from './code-display';
import { parseDocument } from './parsing';
import type { SyntaxEngine } from './syntax/engine';
import { renderUnifiedCode } from './syntax/component';
import { inlineLanguage } from './syntax/languages';

export class ReadingHighlights extends MarkdownRenderChild {
  private observer?: MutationObserver;
  private active = false;
  private revision = 0;
  private components = new Map<HTMLElement, { original: HTMLElement; signature: string }>();
  constructor(element: HTMLElement, readonly context: MarkdownPostProcessorContext, private app: App, private dispose: () => void, private getLocale: () => Locale = () => 'zh', private getDisplay: () => CodeDisplaySettings = () => defaultCodeDisplay, private sessions = new Map<string, boolean>(), private getEngine?: () => SyntaxEngine | undefined) { super(element); }
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
      for (const details of code.querySelectorAll<HTMLDetailsElement>('details')) { details.open = true; if (details.dataset.hbSectionKey) this.sessions.set(details.dataset.hbSectionKey, false); }
    }
  }
  refresh(): void {
    if (!this.active) return;
    const file = this.app.vault.getFileByPath(this.context.sourcePath);
    if (!file) return;
    const revision = ++this.revision;
    const editing = this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view).find(view => view instanceof MarkdownView && view.file?.path === file.path && view.getMode() === 'source') as MarkdownView | undefined;
    const source = editing ? Promise.resolve(editing.editor.getValue()) : this.app.vault.cachedRead(file);
    void source.then(async text => {
      if (!this.active || revision !== this.revision) return;
      this.observer?.disconnect();
      try {
        for (const holder of this.components.keys()) if (!this.containerEl.contains(holder)) this.components.delete(holder);
        const inlines = inlineTargets(this.containerEl, text, element => this.context.getSectionInfo(element)).filter(target => this.owns(target.code));
        const matchedInlines = new Set(inlines.map(target => target.code));
        for (const code of inlineCodes(this.containerEl)) if (this.owns(code) && !matchedInlines.has(code)) clearInlineCode(code);
        const engine = this.getEngine?.();
        for (const { code, inline } of inlines) {
          const syntax = inlineLanguage(inline.text);
          if (code.dataset.hbInlineSource !== undefined) code.textContent = inline.text;
          if (engine?.inlineHighlighting && syntax && engine.owns(syntax.language) && engine.supports(syntax.language)) {
            const tokens = await engine.tokens(syntax.code, syntax.language);
            if (!this.active || revision !== this.revision) return;
            code.dataset.hbInlineSource = inline.text;
            code.style.setProperty('--hb-syntax-background', engine.background); code.style.setProperty('--hb-syntax-foreground', engine.foreground);
            code.replaceChildren(); let cursor = 0;
            for (const token of tokens) {
              code.append(code.ownerDocument.createTextNode(syntax.code.slice(cursor, token.from)));
              const span = code.ownerDocument.createElement('span'); span.textContent = syntax.code.slice(token.from, token.to); span.style.color = token.color;
              if (token.fontStyle & 1) span.classList.add('hb-token-italic'); if (token.fontStyle & 2) span.classList.add('hb-token-bold');
              span.style.textDecoration = [token.fontStyle & 4 ? 'underline' : '', token.fontStyle & 8 ? 'line-through' : ''].filter(Boolean).join(' ');
              if (token.background) span.style.backgroundColor = token.background;
              code.append(span); cursor = token.to;
            }
            code.append(code.ownerDocument.createTextNode(syntax.code.slice(cursor)));
          } else { delete code.dataset.hbInlineSource; code.style.removeProperty('--hb-syntax-background'); code.style.removeProperty('--hb-syntax-foreground'); }
          renderInlineCode(code, inline);
        }
        const blocks = parseDocument(text).blocks, display = this.getDisplay();
        const targets = readingTargets(this.containerEl, text, element => this.context.getSectionInfo(element)).filter(target => this.owns(target.code));
        for (const holder of this.components.keys()) {
          const code = holder.querySelector<HTMLElement>('pre > code');
          if (!code || targets.some(target => target.code === code)) continue;
          const section = this.context.getSectionInfo(holder) ?? this.context.getSectionInfo(this.containerEl);
          if (!section) continue;
          const candidates = blocks.filter(block => { const line = text.slice(0, block.fenceFrom).split('\n').length - 1; return section.lineStart <= line && line <= section.lineEnd; });
          if (candidates.length === 1) targets.push({ code, block: candidates[0]! });
        }
        const matched = new Set(targets.map(target => target.code));
        for (const code of this.containerEl.querySelectorAll<HTMLElement>('pre > code')) if (this.owns(code) && !matched.has(code) && !code.closest('.hb-unified-code')) clearRenderedCode(code);
        for (const { code, block } of targets) {
          if (engine) {
            const holder = code.closest<HTMLElement>('.hb-unified-code');
            const existing = holder ? this.components.get(holder) : undefined;
            if (holder && !existing) continue;
            const external = code.closest('.expressive-code, .code-styler-pre, .codeblock-customizer-pre');
            if (!engine.owns(block.language) || external && !holder) {
              if (holder && existing) { holder.replaceWith(existing.original); this.components.delete(holder); }
              if (external && !holder && engine.owns(block.language)) {
                renderCode(code, block, this.getLocale(), true);
                renderCodeDisplay(code, block, display, this.getLocale(), this.sessions, codeDisplayKey(file.path, block, blocks));
              }
              continue;
            }
            const signature = JSON.stringify({ block, display, locale: this.getLocale(), engine: engine.revision });
            if (existing?.signature === signature && holder?.querySelector('.hb-code-display')) {
              renderCodeDisplay(code, block, display, this.getLocale(), this.sessions, codeDisplayKey(file.path, block, blocks));
              continue;
            }
            const pre = code.closest('pre'); if (!pre) continue;
            const original = existing?.original ?? pre.cloneNode(true) as HTMLElement;
            if (existing) {
              const originalCode = original.querySelector('code');
              if (originalCode) { originalCode.className = block.language ? `language-${block.language}` : ''; originalCode.textContent = `${block.text}\n`; }
            }
            const rendered = await renderUnifiedCode(engine, block, code.ownerDocument, this.getLocale(), display, this.sessions, codeDisplayKey(file.path, block, blocks));
            if (!this.active || revision !== this.revision) return;
            (holder ?? pre).replaceWith(rendered);
            if (holder) this.components.delete(holder);
            this.components.set(rendered, { original, signature });
            continue;
          }
        }
      } finally { if (this.active) this.observe(); }
    }).catch(error => console.error('Highlight Boost 阅读渲染失败', error));
  }
  onunload(): void {
    this.active = false;
    this.revision++;
    this.observer?.disconnect();
    for (const [holder, component] of this.components) holder.replaceWith(component.original);
    this.components.clear();
    for (const code of inlineCodes(this.containerEl)) if (code.dataset.hbInlineSource !== undefined) { code.textContent = code.dataset.hbInlineSource; delete code.dataset.hbInlineSource; code.style.removeProperty('--hb-syntax-background'); code.style.removeProperty('--hb-syntax-foreground'); }
    for (const code of inlineCodes(this.containerEl)) if (this.owns(code)) clearInlineCode(code);
    for (const code of this.containerEl.querySelectorAll<HTMLElement>('pre > code')) if (this.owns(code) && !code.closest('.hb-unified-code')) clearRenderedCode(code);
    this.dispose();
  }
}
