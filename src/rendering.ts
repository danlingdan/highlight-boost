import { EditorState, StateField, Transaction } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { parseDocument } from './parsing';
import { resolveMark, sourceOffset } from './anchors';
import type { CodeBlock, CodeMark } from './domain';

const rendered = new WeakMap<HTMLElement, { original: Node[]; signature: string }>();

export function clearRenderedCode(code: HTMLElement): void {
  const previous = rendered.get(code);
  if (previous && code.querySelector('.hb-code-row')) {
    if (previous.original.map(node => node.textContent ?? '').join('') === code.textContent) {
      code.replaceChildren(...previous.original.map(node => node.cloneNode(true)));
    } else {
      for (const element of code.querySelectorAll('.hb-text, .hb-code-row')) element.replaceWith(...element.childNodes);
    }
  }
  rendered.delete(code);
  delete code.dataset.hbRendered;
}

function editorDecorations(text: string): DecorationSet {
  const ranges = [];
  for (const block of parseDocument(text).blocks) for (const mark of block.metadata?.marks ?? []) {
    const resolved = resolveMark(block, mark);
    if (resolved.status !== 'resolved') continue;
    const from = sourceOffset(block, resolved.span.from);
    const to = sourceOffset(block, resolved.span.to);
    if (mark.kind === 'lines') {
      for (const line of block.lines) {
        if (from === to ? line.from !== from : line.to < from || line.from >= to) continue;
        const start = text.lastIndexOf('\n', Math.max(0, line.from - 1)) + 1;
        ranges.push(Decoration.line({ attributes: { class: `hb-line hb-${mark.color}`, 'data-hb-label': mark.label } }).range(start));
      }
    } else if (from < to) {
      for (const line of block.lines) {
        const a = Math.max(from, line.from), b = Math.min(to, line.to);
        if (a < b) ranges.push(Decoration.mark({ class: `hb-text hb-${mark.color}`, attributes: { title: mark.label } }).range(a, b));
      }
    }
  }
  return Decoration.set(ranges, true);
}

export const highlightExtension = StateField.define<DecorationSet>({
  create: state => editorDecorations(state.doc.toString()),
  update: (value, transaction) => transaction.docChanged ? editorDecorations(transaction.state.doc.toString()) : value,
  provide: field => EditorView.decorations.from(field),
});

export const unchangedHistory = EditorState.transactionExtender.of(transaction => {
  if (transaction.docChanged && !transaction.effects.length && transaction.startState.doc.eq(transaction.newDoc)) {
    return { annotations: Transaction.addToHistory.of(false) };
  }
  return null;
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

export function renderCode(code: HTMLElement, block: CodeBlock): void {
  const signature = JSON.stringify({ text: block.text, marks: block.metadata?.marks ?? [] });
  const previous = rendered.get(code);
  if (previous?.signature === signature && code.querySelector('.hb-code-row')) return;
  clearRenderedCode(code);
  if (!block.metadata?.marks.length) return;
  const original = code.textContent ?? '';
  if (original !== block.text && original !== `${block.text}\n`) return;
  rendered.set(code, { original: [...code.childNodes].map(node => node.cloneNode(true)), signature });
  const doc = code.ownerDocument;
  const output = doc.createDocumentFragment();
  let offset = 0;
  const lines = original.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const content = lines[i]!;
    const row = doc.createElement('span');
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
          row.title = mark.label;
        }
        position = end + 1;
      }
    } else wrapMark(code, resolved.span.from, resolved.span.to, mark);
  }
}

function wrapMark(code: HTMLElement, from: number, to: number, mark: CodeMark): void {
  let offset = 0;
  for (const node of textNodes(code)) {
    const end = offset + node.length;
    const a = Math.max(0, from - offset), b = Math.min(node.length, to - offset);
    if (a < b && node.parentElement?.closest('.hb-code-row')) {
      const range = code.ownerDocument.createRange();
      range.setStart(node, a); range.setEnd(node, b);
      const wrapper = code.ownerDocument.createElement('span');
      wrapper.className = `hb-text hb-${mark.color}`;
      wrapper.title = mark.label;
      range.surroundContents(wrapper);
    }
    offset = end;
  }
}
