import { contains, overlaps, type Span } from './domain';
import { parseDocument } from './parsing';

export interface SelectionContext {
  kind: 'prose' | 'inline-code' | 'code' | 'mixed';
  count: number;
  block?: number;
  from?: number;
  to?: number;
}

export function selectionContext(text: string, selections: readonly Span[], parsed = parseDocument(text)): SelectionContext {
  const blocks = new Set<number>(), kinds = new Set<string>();
  const lines: number[] = [];
  for (const selection of selections) {
    const touches = (span: Span) => selection.from === selection.to ? span.from <= selection.from && selection.from < span.to : overlaps(span, selection);
    const touchesLine = (span: Span) => selection.from === selection.to ? span.from <= selection.from && selection.from <= span.to : touches(span);
    const block = parsed.blocks.findIndex(block => block.lines.some(touchesLine));
    if (block >= 0) {
      kinds.add('code'); blocks.add(block);
      parsed.blocks[block]!.lines.forEach((line, index) => { if (touchesLine(line)) lines.push(index + 1); });
      if (!contains(parsed.blocks[block]!, selection)) kinds.add('prose');
    }
    if (parsed.inlines.some(touches)) kinds.add('inline-code');
    if (block < 0 && !parsed.inlines.some(inline => contains(inline, selection))) kinds.add('prose');
  }
  const kind = kinds.size > 1 || blocks.size > 1 ? 'mixed' : kinds.has('code') ? 'code' : kinds.has('inline-code') ? 'inline-code' : 'prose';
  return { kind, count: selections.length, ...(kind === 'code' ? { block: [...blocks][0]! + 1, from: Math.min(...lines), to: Math.max(...lines) } : {}) };
}
