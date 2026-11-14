import { StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { parseDocument } from './parsing';
import { composingState } from './composition';

class MetadataWidget extends WidgetType {
  constructor(private from: number, private to: number, private count: number, private kind: 'block' | 'inline' | 'prose' = 'block') { super(); }
  eq(other: MetadataWidget): boolean { return this.from === other.from && this.to === other.to && this.count === other.count && this.kind === other.kind; }
  toDOM(view: EditorView): HTMLElement {
    const button = view.dom.ownerDocument.createElement('button');
    button.className = 'hb-metadata-chip';
    button.textContent = this.kind === 'inline' ? '行内标注' : this.kind === 'prose' ? '正文标注' : `代码标注 · ${this.count} 条`;
    button.setAttribute('aria-label', '展开标注元数据');
    const expand = () => {
      view.dispatch({ selection: { anchor: this.from, head: this.to } });
      view.focus();
    };
    button.addEventListener('mousedown', event => {
      event.preventDefault();
      event.stopPropagation();
      expand();
    });
    button.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      expand();
    });
    return button;
  }
}

export function createMetadataFolding(livePreview: StateField<boolean>): StateField<DecorationSet> {
  function decorations(state: EditorState): DecorationSet {
    if (!state.field(livePreview, false)) return Decoration.none;
    const ranges = [];
    const parsed = parseDocument(state.doc.toString());
    for (const inline of [...parsed.inlines, ...parsed.highlights]) {
      const span = inline.metadataSpan;
      if (!span || state.selection.ranges.some(range => range.from <= span.to && span.from <= range.to)) continue;
      ranges.push(Decoration.replace({ widget: new MetadataWidget(span.from, span.to, 1, 'color' in inline ? 'prose' : 'inline') }).range(span.from, span.to));
    }
    for (const block of parsed.blocks) {
      const span = block.metadataSpan;
      if (!span || !block.metadata) continue;
      if (state.selection.ranges.some(range => range.from <= span.to && span.from <= range.to)) continue;
      ranges.push(Decoration.replace({ widget: new MetadataWidget(span.from, span.to, block.metadata.marks.length) }).range(span.from, span.to));
    }
    return Decoration.set(ranges, true);
  }
  return StateField.define<DecorationSet>({
    create: decorations,
    update: (value, transaction) => transaction.state.field(composingState, false) ? value.map(transaction.changes) : transaction.docChanged || transaction.selection ||
      transaction.startState.field(composingState, false) !== transaction.state.field(composingState, false) ||
      transaction.startState.field(livePreview, false) !== transaction.state.field(livePreview, false)
      ? decorations(transaction.state) : value,
    provide: field => EditorView.decorations.from(field),
  });
}
