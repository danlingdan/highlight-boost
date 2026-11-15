import { detachedEl } from './dom';
import { Facet, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { editorDocument } from './editor-document';
import { composingState } from './composition';
import { translate, type Locale } from './i18n';

export const metadataLocale = Facet.define<Locale, Locale>({ combine: values => values[0] ?? 'zh' });

class MetadataWidget extends WidgetType {
  constructor(private from: number, private to: number, private count: number, private kind: 'block' | 'inline' | 'prose' | 'footnote', private locale: Locale, private note = false, private preview = '') { super(); }
  eq(other: MetadataWidget): boolean { return this.from === other.from && this.to === other.to && this.count === other.count && this.kind === other.kind && this.locale === other.locale && this.note === other.note && this.preview === other.preview; }
  toDOM(view: EditorView): HTMLElement {
    const button = detachedEl(view.dom.ownerDocument, 'button');
    button.className = 'hb-metadata-chip';
    button.dataset.hbMetadata = this.kind;
    button.textContent = this.kind === 'footnote' ? `${translate(this.locale, 'footnote')} · ${this.preview.slice(0, 64)}` : translate(this.locale, this.kind === 'inline' ? 'inlineMark' : this.kind === 'prose' ? 'proseMark' : 'codeMarks', { count: this.count }) + (this.note ? ' · 🗨' : '');
    button.setAttribute('aria-label', translate(this.locale, this.kind === 'footnote' ? 'expandFootnote' : 'expandMetadata'));
    if (this.preview) button.title = this.preview;
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
    const parsed = editorDocument(state).parsed;
    for (const inline of [...parsed.inlines, ...parsed.highlights]) {
      const base = inline.metadataSpan;
      const span = base && { from: base.from, to: 'footnoteSpan' in inline ? inline.footnoteSpan?.to ?? base.to : base.to };
      if (!span || state.selection.ranges.some(range => range.from <= span.to && span.from <= range.to)) continue;
      ranges.push(Decoration.replace({ widget: new MetadataWidget(span.from, span.to, 1, 'color' in inline ? 'prose' : 'inline', state.facet(metadataLocale), Boolean(inline.metadata && ('noteRef' in inline.metadata ? inline.metadata.noteRef : 'note' in inline.metadata ? inline.metadata.note : undefined))) }).range(span.from, span.to));
    }
    for (const block of parsed.blocks) {
      const span = block.metadataSpan;
      if (!span || !block.metadata) continue;
      if (state.selection.ranges.some(range => range.from <= span.to && span.from <= range.to)) continue;
      ranges.push(Decoration.replace({ widget: new MetadataWidget(span.from, span.to, block.metadata.marks.length, 'block', state.facet(metadataLocale), block.metadata.marks.some(mark => Boolean(mark.note))) }).range(span.from, span.to));
    }
    for (const footnote of parsed.footnotes.filter(note => note.id.startsWith('hb-'))) {
      const span = footnote.span;
      if (state.selection.ranges.some(range => range.from <= span.to && span.from <= range.to)) continue;
      ranges.push(Decoration.replace({ widget: new MetadataWidget(span.from, span.to, 1, 'footnote', state.facet(metadataLocale), true, footnote.text) }).range(span.from, span.to));
    }
    return Decoration.set(ranges, true);
  }
  return StateField.define<DecorationSet>({
    create: decorations,
    update: (value, transaction) => transaction.state.field(composingState, false) ? value.map(transaction.changes) : transaction.docChanged || transaction.selection ||
      transaction.startState.field(composingState, false) !== transaction.state.field(composingState, false) ||
      transaction.startState.facet(metadataLocale) !== transaction.state.facet(metadataLocale) ||
      transaction.startState.field(livePreview, false) !== transaction.state.field(livePreview, false)
      ? decorations(transaction.state) : value,
    provide: field => EditorView.decorations.from(field),
  });
}
