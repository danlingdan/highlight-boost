import { StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField } from 'obsidian';
import type { CodeBlock } from '../domain';
import { editorDocument } from '../editor-document';
import { codeDisplayKey, type CodeDisplaySettings } from '../code-options';
import { composingState } from '../composition';
import type { SyntaxEngine } from './engine';
import type { Locale } from '../i18n';
import { renderUnifiedCode } from './component';
import { refreshSyntax } from './editor';
import { inlineLanguage, inlineSourceOffsets } from './languages';

class CodeWidget extends WidgetType {
  private active = true;
  constructor(private engine: SyntaxEngine, private block: CodeBlock, private locale: Locale, private display: CodeDisplaySettings, private sessions: Map<string, boolean>, private key: string) { super(); }
  eq(other: CodeWidget): boolean { return this.engine === other.engine && this.key === other.key && this.locale === other.locale && JSON.stringify(this.block) === JSON.stringify(other.block) && JSON.stringify(this.display) === JSON.stringify(other.display); }
  toDOM(view: EditorView): HTMLElement {
    const holder = view.dom.ownerDocument.createElement('div'); holder.className = 'hb-code-widget';
    if (this.block.prefix) {
      holder.classList.add('hb-nested-code-widget');
      holder.style.setProperty('--hb-code-indent', `${this.block.prefix.replaceAll('>', '').length}ch`);
      if (this.block.prefix.includes('>')) holder.classList.add('hb-quoted-code-widget');
    }
    const loading = view.dom.ownerDocument.createElement('pre'); loading.textContent = this.block.text; holder.append(loading);
    const edit = view.dom.ownerDocument.createElement('button'); edit.className = 'edit-block-button'; edit.textContent = this.locale === 'zh' ? '编辑代码' : 'Edit code';
    edit.setAttribute('aria-label', edit.textContent);
    const enter = () => { view.dispatch({ selection: { anchor: this.block.lines[0]?.from ?? this.block.fenceFrom } }); view.focus(); };
    edit.addEventListener('click', enter);
    void renderUnifiedCode(this.engine, this.block, holder.ownerDocument, this.locale, this.display, this.sessions, this.key).then(node => {
      if (!this.active) return;
      holder.replaceChildren(edit, node); view.requestMeasure();
    }).catch(error => console.error('HB 代码展示失败', error));
    holder.addEventListener('dblclick', event => {
      if ((event.target as Element).closest('button, summary, details')) return;
      enter();
    });
    return holder;
  }
  ignoreEvent(): boolean { return true; }
  destroy(): void { this.active = false; }
}

export function syntaxCodeWidgets(getEngine: () => SyntaxEngine, getLocale: () => Locale, getDisplay: () => CodeDisplaySettings, sessions: Map<string, boolean>) {
  const build = (state: EditorState): DecorationSet => {
    if (!state.field(editorLivePreviewField, false) || state.field(composingState, false)) return Decoration.none;
    const engine = getEngine(), parsed = editorDocument(state).parsed, path = state.field(editorInfoField, false)?.file?.path ?? '';
    const ranges = [];
    if (engine.inlineHighlighting) for (const inline of parsed.inlines) {
      const syntax = inlineLanguage(inline.text);
      if (!syntax || !engine.supports(syntax.language) || !engine.owns(syntax.language) || state.selection.ranges.some(range => range.from <= inline.to && inline.from <= range.to)) continue;
      const offsets = inlineSourceOffsets(inline, editorDocument(state).text);
      ranges.push(Decoration.replace({}).range(offsets[0]!, offsets[syntax.prefix]));
    }
    for (const block of parsed.blocks) {
      if (!engine.owns(block.language)) continue;
      const from = state.doc.lineAt(block.fenceFrom).from, to = block.to;
      if (state.selection.ranges.some(range => range.from <= to && from <= range.to)) continue;
      if (from >= to) continue;
      ranges.push(Decoration.replace({ block: true, widget: new CodeWidget(engine, block, getLocale(), getDisplay(), sessions, codeDisplayKey(path, block, parsed.blocks)) }).range(from, to));
    }
    return Decoration.set(ranges, true);
  };
  return StateField.define<DecorationSet>({
    create: build,
    update: (value, transaction) => transaction.docChanged || transaction.selection || transaction.reconfigured || transaction.effects.some(effect => effect.is(refreshSyntax)) ? build(transaction.state) : value,
    provide: field => EditorView.decorations.from(field),
  });
}
