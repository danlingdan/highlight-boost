import { detachedEl } from './dom';
import { StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { parseDocument } from './parsing';
import { resolveMark, sourceOffset } from './anchors';
import { annotationTitle, type CodeBlock, type CodeMark } from './domain';
import { composingState } from './composition';
import { translate, type Locale } from './i18n';
import { codeDisplayFacet, codeOptions, diffKinds, type CodeDisplaySettings } from './code-options';
import { clearCodeDisplay } from './code-display';
import { parameterLines } from './fence-params';
import { editorDocument } from './editor-document';
import { structuredRows, rowText } from './code-rows';
import { unifiedCodeModel } from './syntax/model';

const rendered = new WeakMap<HTMLElement, { original: Node[]; signature: string; rows: HTMLElement[] }>();
const rowTitles = new WeakMap<HTMLElement, { original: string | null; applied: string }>();
const noteRegions = new WeakMap<HTMLElement, { element: HTMLElement; signature: string }>();

export function renderedCodeText(code: HTMLElement): string {
  const rows = structuredRows(code);
  return rows.length ? rows.map(rowText).join('\n') : code.textContent ?? '';
}

export function clearRenderedCode(code: HTMLElement): void {
  clearCodeDisplay(code);
  noteRegions.get(code)?.element.remove(); noteRegions.delete(code);
  const previous = rendered.get(code);
  if (previous && code.querySelector('.hb-code-row, .hb-text, .hb-line')) {
    if (!previous.rows.length && previous.original.map(node => node.textContent ?? '').join('') === code.textContent) {
      code.replaceChildren(...previous.original.map(node => node.cloneNode(true)));
    } else {
      for (const element of code.querySelectorAll('.hb-text, .hb-code-row')) element.replaceWith(...element.childNodes);
      for (const row of code.querySelectorAll<HTMLElement>('.hb-line')) {
        row.classList.remove('hb-line', 'hb-default', 'hb-red', 'hb-orange', 'hb-yellow', 'hb-green', 'hb-blue', 'hb-purple');
        const title = rowTitles.get(row);
        if (title && row.title === title.applied) { if (title.original === null) row.removeAttribute('title'); else row.title = title.original; }
        rowTitles.delete(row);
      }
    }
  }
  rendered.delete(code);
  delete code.dataset.hbRendered;
}

function editorDecorations(text: string, settings: CodeDisplaySettings, parsed = parseDocument(text)): DecorationSet {
  const ranges = [];
  for (const block of parsed.blocks) {
    const options = codeOptions(block, settings), diff = unifiedCodeModel(block, settings).diff ? diffKinds(block.text) : [];
    const markers = parameterLines(block);
    if (!options.showLineNumbers && !diff.length && !markers.some(Boolean)) continue;
    for (const [index, line] of block.lines.entries()) {
      const start = text.lastIndexOf('\n', Math.max(0, line.from - 1)) + 1;
      ranges.push(Decoration.line({ attributes: { class: options.showLineNumbers ? 'hb-editor-code-line hb-numbered' : 'hb-editor-code-line',
        ...(options.showLineNumbers ? { 'data-hb-number': String(options.startLine + index) } : {}), ...(diff[index] ? { 'data-hb-diff': diff[index] } : {}),
        ...(markers[index] ? { 'data-hb-param': markers[index] } : {}),
        style: `--hb-number-font:var(${options.numberFont === 'interface' ? '--font-interface' : '--font-monospace'})` } }).range(start));
    }
  }
  for (const inline of parsed.inlines) if (inline.metadata && inline.content.from < inline.content.to) {
    ranges.push(Decoration.mark({ class: `hb-inline hb-${inline.metadata.color}`, attributes: { title: annotationTitle(inline.metadata.label, inline.metadata.note) } }).range(inline.content.from, inline.content.to));
  }
  for (const block of parsed.blocks) for (const mark of block.metadata?.marks ?? []) {
    const resolved = resolveMark(block, mark);
    if (resolved.status !== 'resolved') continue;
    const from = sourceOffset(block, resolved.span.from);
    const to = sourceOffset(block, resolved.span.to);
    if (mark.kind === 'lines') {
      for (const line of block.lines) {
        if (from === to ? line.from !== from : line.to < from || line.from >= to) continue;
        const start = text.lastIndexOf('\n', Math.max(0, line.from - 1)) + 1;
        ranges.push(Decoration.line({ attributes: { class: `hb-line hb-${mark.color}`, 'data-hb-label': annotationTitle(mark.label), title: annotationTitle(mark.label, mark.note) } }).range(start));
      }
    } else if (from < to) {
      for (const line of block.lines) {
        const a = Math.max(from, line.from), b = Math.min(to, line.to);
        if (a < b) ranges.push(Decoration.mark({ class: `hb-text hb-${mark.color}`, attributes: { title: annotationTitle(mark.label, mark.note) } }).range(a, b));
      }
    }
  }
  return Decoration.set(ranges, true);
}

export const highlightExtension = StateField.define<DecorationSet>({
  create: state => editorDecorations(state.doc.toString(), state.facet(codeDisplayFacet), editorDocument(state).parsed),
  update: (value, transaction) => transaction.state.field(composingState, false) ? value.map(transaction.changes) :
    transaction.docChanged || transaction.startState.field(composingState, false) !== transaction.state.field(composingState, false) || transaction.startState.facet(codeDisplayFacet) !== transaction.state.facet(codeDisplayFacet)
      ? editorDecorations(transaction.state.doc.toString(), transaction.state.facet(codeDisplayFacet), editorDocument(transaction.state).parsed) : value,
  provide: field => EditorView.decorations.from(field),
});

function textNodes(element: HTMLElement): Text[] {
  const walker = element.ownerDocument.createTreeWalker(element, 4);
  const result: Text[] = [];
  while (walker.nextNode()) result.push(walker.currentNode as Text);
  return result;
}

function rangeFor(element: HTMLElement, from: number, to: number): Range | undefined {
  const nodes = textNodes(element);
  let offset = 0;
  let start: [Text, number] | undefined;
  for (const node of nodes) {
    const end = offset + node.length;
    if (!start && from <= end) start = [node, Math.max(0, from - offset)];
    if (start && to <= end) {
      const range = element.ownerDocument.createRange();
      range.setStart(...start);
      range.setEnd(node, Math.max(0, to - offset));
      return range;
    }
    offset = end;
  }
  return undefined;
}

function renderNotes(code: HTMLElement, block: CodeBlock, locale: Locale): void {
  const notes = block.metadata?.marks.filter(mark => mark.note) ?? [], pre = code.closest('pre');
  const previous = noteRegions.get(code), signature = JSON.stringify({ notes, locale });
  if (previous?.signature === signature && previous.element.parentElement === pre?.parentElement) return;
  previous?.element.remove(); noteRegions.delete(code);
  if (!notes.length || !pre?.parentElement) return;
  const region = detachedEl(code.ownerDocument, 'div'); region.className = 'hb-code-notes';
  region.setAttribute('aria-label', translate(locale, 'annotation'));
  for (const mark of notes) {
    const details = detachedEl(code.ownerDocument, 'details'); details.dataset.hbNoteId = mark.id;
    const summary = detachedEl(code.ownerDocument, 'summary'); summary.textContent = `🗨 ${mark.label}`;
    const content = detachedEl(code.ownerDocument, 'div'); content.className = 'hb-note-text'; content.textContent = mark.note!;
    details.append(summary, content); region.append(details);
  }
  pre.after(region); noteRegions.set(code, { element: region, signature });
}

export function renderCode(code: HTMLElement, block: CodeBlock, locale: Locale = 'zh', rowsRequired = false): void {
  const signature = JSON.stringify({ text: block.text, marks: block.metadata?.marks ?? [], rowsRequired });
  const previous = rendered.get(code);
  const rows = structuredRows(code);
  if (!block.metadata?.marks.length && !rowsRequired) { if (previous) clearRenderedCode(code); return; }
  if (previous?.signature === signature && previous.rows.length === rows.length && previous.rows.every((row, index) => row === rows[index]) && (code.querySelector('.hb-code-row, .hb-text, .hb-line') || rows.length && !block.metadata?.marks.length)) { renderNotes(code, block, locale); return; }
  clearRenderedCode(code);
  const original = renderedCodeText(code);
  if (original !== block.text && original !== `${block.text}\n`) return;
  rendered.set(code, { original: rows.length ? [] : [...code.childNodes].map(node => node.cloneNode(true)), signature, rows });
  renderNotes(code, block, locale);
  if (rows.length) {
    code.dataset.hbRendered = '1';
    for (const mark of block.metadata?.marks ?? []) {
      const resolved = resolveMark(block, mark);
      if (resolved.status !== 'resolved') continue;
      let offset = 0;
      for (const row of rows) {
        const end = offset + rowText(row).length;
        if (mark.kind === 'lines') {
          if (resolved.span.from === resolved.span.to ? offset === resolved.span.from : offset < resolved.span.to && resolved.span.from <= end) {
            row.parentElement!.classList.add('hb-line', `hb-${mark.color}`);
            const parent = row.parentElement!, title = annotationTitle(mark.label, mark.note);
            const previousTitle = rowTitles.get(parent);
            rowTitles.set(parent, { original: previousTitle ? previousTitle.original : parent.getAttribute('title'), applied: title }); parent.title = title;
          }
        } else {
          const a = Math.max(0, resolved.span.from - offset), b = Math.min(end - offset, resolved.span.to - offset);
          if (a < b) wrapMark(row, a, b, mark, false);
        }
        offset = end + 1;
      }
    }
    return;
  }
  const doc = code.ownerDocument;
  const output = doc.adoptNode(createFragment());
  let offset = 0;
  const lines = original.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const content = lines[i]!;
    const row = detachedEl(doc, 'span');
    row.className = 'hb-code-row';
    row.dataset.hbLine = String(i + 1);
    const range = rangeFor(code, offset, offset + content.length);
    let contents: Node | undefined = range?.cloneContents();
    if (range && contents) {
      let ancestor = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
      while (ancestor && ancestor !== code) {
        const clone = ancestor.cloneNode(false);
        clone.appendChild(contents);
        contents = clone;
        ancestor = ancestor.parentNode;
      }
    }
    if (contents) row.append(contents);
    else row.textContent = content;
    output.append(row);
    if (i < lines.length - 1) output.append(doc.createTextNode('\n'));
    offset += content.length + 1;
  }
  code.replaceChildren(output);
  code.dataset.hbRendered = '1';
  for (const mark of block.metadata?.marks ?? []) {
    const resolved = resolveMark(block, mark);
    if (resolved.status !== 'resolved') continue;
    if (mark.kind === 'lines') {
      let position = 0;
      for (const row of code.querySelectorAll<HTMLElement>('.hb-code-row')) {
        const end = position + (row.textContent?.length ?? 0);
        if (resolved.span.from === resolved.span.to ? position === resolved.span.from : position < resolved.span.to && resolved.span.from <= end) {
          row.classList.add('hb-line', `hb-${mark.color}`);
          row.title = annotationTitle(mark.label, mark.note);
        }
        position = end + 1;
      }
    } else wrapMark(code, resolved.span.from, resolved.span.to, mark);
  }
}

function wrapMark(code: HTMLElement, from: number, to: number, mark: CodeMark, requireRow = true): void {
  let offset = 0;
  for (const node of textNodes(code)) {
    const end = offset + node.length;
    const a = Math.max(0, from - offset), b = Math.min(node.length, to - offset);
    if (a < b && (!requireRow || node.parentElement?.closest('.hb-code-row'))) {
      const range = code.ownerDocument.createRange();
      range.setStart(node, a); range.setEnd(node, b);
      const wrapper = detachedEl(code.ownerDocument, 'span');
      wrapper.className = `hb-text hb-${mark.color}`;
      wrapper.title = annotationTitle(mark.label, mark.note);
      range.surroundContents(wrapper);
    }
    offset = end;
  }
}
