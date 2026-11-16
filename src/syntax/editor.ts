import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { StateEffect, type Range } from '@codemirror/state';
import { sourceOffset } from '../anchors';
import { editorDocument } from '../editor-document';
import type { SyntaxEngine } from './engine';
import { inlineLanguage, inlineSourceOffsets } from './languages';

export const refreshSyntax = StateEffect.define<string>();

export function syntaxEditor(getEngine: () => SyntaxEngine) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet = Decoration.none;
    private generation = 0;
    private destroyed = false;
    private composition = false;
    private timer: number | undefined;
    private timerWindow?: Window;
    private frameWindow?: Window;
    private frame: number | undefined;
    constructor(private view: EditorView) { this.schedule(); }

    update(update: ViewUpdate): void {
      this.decorations = this.decorations.map(update.changes);
      if (update.docChanged || update.transactions.some(transaction => transaction.effects.some(effect => effect.is(refreshSyntax)))) this.schedule();
    }

    schedule(delay = 0): void {
      this.generation++;
      this.timerWindow?.clearTimeout(this.timer);
      if (this.frame !== undefined) this.frameWindow?.cancelAnimationFrame(this.frame);
      if (this.destroyed || this.composition) return;
      const window = this.view.dom.ownerDocument.defaultView!; this.timerWindow = window;
      this.timer = window.setTimeout(() => {
        if (this.view.composing || this.view.compositionStarted) this.schedule(30);
        else void this.build().catch(error => console.error('HB 语法着色失败', error));
      }, delay);
    }

    private async build(): Promise<void> {
      const generation = this.generation, state = this.view.state;
      const current = () => !this.destroyed && !this.composition && !this.view.composing && !this.view.compositionStarted && generation === this.generation && state.doc === this.view.state.doc;
      const ranges: Range<Decoration>[] = [];
      const engine = getEngine();
      for (const block of editorDocument(state).parsed.blocks) {
        if (!engine.owns(block.language)) continue;
        for (const line of block.lines) ranges.push(Decoration.line({ attributes: { class: 'hb-syntax-code-line', style: `--hb-syntax-background:${engine.background};--hb-syntax-foreground:${engine.foreground}` } }).range(state.doc.lineAt(line.from).from));
        for (const token of await engine.tokens(block.text, block.language, block.meta)) {
          if (!current()) return;
          const from = sourceOffset(block, token.from), to = sourceOffset(block, token.to);
          if (from >= to) continue;
          const decoration = [token.fontStyle & 4 ? 'underline' : '', token.fontStyle & 8 ? 'line-through' : ''].filter(Boolean).join(' ');
          const font = `${token.fontStyle & 1 ? 'font-style:italic;' : ''}${token.fontStyle & 2 ? 'font-weight:bold;' : ''}${decoration ? `text-decoration:${decoration};` : ''}${token.background ? `background-color:${token.background};` : ''}`;
          ranges.push(Decoration.mark({ class: 'hb-syntax-token', attributes: { style: `color:${token.color};${font}` } }).range(from, to));
        }
        for (const marker of await engine.markers(block.text, block.language, block.meta ?? '', this.view.dom.ownerDocument)) {
          if (!current()) return;
          const from = sourceOffset(block, marker.from), to = sourceOffset(block, marker.to);
          if (marker.line) {
            ranges.push(Decoration.line({ attributes: { 'data-hb-param-label': marker.label, title: marker.label } }).range(state.doc.lineAt(from).from));
            continue;
          }
          if (from < to) ranges.push(Decoration.mark({ class: `hb-param-inline hb-param-${marker.kind}`, attributes: { title: marker.label } }).range(from, to));
        }
      }
      if (engine.inlineHighlighting) for (const inline of editorDocument(state).parsed.inlines) {
        const syntax = inlineLanguage(inline.text);
        if (!syntax || !engine.owns(syntax.language) || !engine.supports(syntax.language)) continue;
        const offsets = inlineSourceOffsets(inline, editorDocument(state).text);
        ranges.push(Decoration.mark({ attributes: { style: `background-color:${engine.background};color:${engine.foreground}` } }).range(inline.content.from, inline.content.to));
        for (const token of await engine.tokens(syntax.code, syntax.language)) {
          if (!current()) return;
          const from = offsets[syntax.prefix + token.from]!, to = offsets[syntax.prefix + token.to]!;
          const decoration = [token.fontStyle & 4 ? 'underline' : '', token.fontStyle & 8 ? 'line-through' : ''].filter(Boolean).join(' ');
          if (from < to && to <= inline.content.to) ranges.push(Decoration.mark({ class: `hb-syntax-token${token.fontStyle & 1 ? ' hb-token-italic' : ''}${token.fontStyle & 2 ? ' hb-token-bold' : ''}`, attributes: { style: `color:${token.color};${decoration ? `text-decoration:${decoration};` : ''}${token.background ? `background-color:${token.background};` : ''}` } }).range(from, to));
        }
      }
      if (!current()) return;
      const decorations = Decoration.set(ranges, true);
      const window = this.view.dom.ownerDocument.defaultView!; this.frameWindow = window;
      this.frame = window.requestAnimationFrame(() => {
        this.frame = undefined;
        if (!current()) return;
        this.decorations = decorations;
        this.view.update([]);
      });
    }

    destroy(): void {
      this.destroyed = true;
      this.generation++;
      this.timerWindow?.clearTimeout(this.timer);
      if (this.frame !== undefined) this.frameWindow?.cancelAnimationFrame(this.frame);
    }

    startComposition(): void { this.composition = true; this.schedule(); }
    endComposition(): void { this.composition = false; this.schedule(); }
  }, {
    decorations: value => value.decorations,
    eventHandlers: {
      compositionstart() { this.startComposition(); },
      compositionend() { this.endComposition(); },
    },
  });
}
