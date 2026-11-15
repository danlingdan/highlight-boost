import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { sourceOffset } from '../anchors';
import { editorDocument } from '../editor-document';
import type { SyntaxEngine } from './engine';

export function syntaxEditor(engine: SyntaxEngine) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet = Decoration.none;
    private generation = 0;
    private destroyed = false;
    private composition = false;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private frame: number | undefined;
    constructor(private view: EditorView) { this.schedule(); }

    update(update: ViewUpdate): void {
      this.decorations = this.decorations.map(update.changes);
      if (update.docChanged) this.schedule();
    }

    schedule(delay = 0): void {
      this.generation++;
      clearTimeout(this.timer);
      if (this.frame !== undefined) cancelAnimationFrame(this.frame);
      if (this.destroyed || this.composition) return;
      this.timer = setTimeout(() => {
        if (this.view.composing || this.view.compositionStarted) this.schedule(30);
        else void this.build().catch(error => console.error('HB 语法着色失败', error));
      }, delay);
    }

    private async build(): Promise<void> {
      const generation = this.generation, state = this.view.state;
      const current = () => !this.destroyed && !this.composition && !this.view.composing && !this.view.compositionStarted && generation === this.generation && state.doc === this.view.state.doc;
      const ranges: Range<Decoration>[] = [];
      for (const block of editorDocument(state).parsed.blocks) {
        for (const token of await engine.tokens(block.text, block.language)) {
          if (!current()) return;
          const from = sourceOffset(block, token.from), to = sourceOffset(block, token.to);
          if (from >= to) continue;
          const font = `${token.fontStyle & 1 ? 'font-style:italic;' : ''}${token.fontStyle & 2 ? 'font-weight:bold;' : ''}${token.fontStyle & 4 ? 'text-decoration:underline;' : ''}`;
          ranges.push(Decoration.mark({ class: 'hb-syntax-token', attributes: { style: `color:${token.color};${font}` } }).range(from, to));
        }
      }
      if (!current()) return;
      const decorations = Decoration.set(ranges, true);
      this.frame = requestAnimationFrame(() => {
        if (!current()) return;
        this.decorations = decorations;
        this.view.update([]);
      });
    }

    destroy(): void {
      this.destroyed = true;
      this.generation++;
      clearTimeout(this.timer);
      if (this.frame !== undefined) cancelAnimationFrame(this.frame);
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
