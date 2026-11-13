import { colorLabels, type CodeBlock, type CodeMark, type HighlightItem, type Span } from './domain';
import { parseDocument } from './parsing';

export function logicalOffset(block: CodeBlock, source: number): number {
  let offset = 0;
  for (const line of block.lines) {
    if (source <= line.to) return offset + Math.max(0, source - line.from);
    offset += line.text.length + 1;
  }
  return block.text.length;
}

export function sourceOffset(block: CodeBlock, logical: number): number {
  let offset = 0;
  for (const line of block.lines) {
    if (logical <= offset + line.text.length) return line.from + Math.max(0, logical - offset);
    offset += line.text.length + 1;
  }
  return block.lines.at(-1)?.to ?? block.fenceFrom;
}

export function resolveMark(block: CodeBlock, mark: CodeMark): { span: Span; status: HighlightItem['status'] } {
  const candidates: number[] = [];
  if (mark.quote.length) {
    let at = block.text.indexOf(mark.quote);
    while (at >= 0) { candidates.push(at); at = block.text.indexOf(mark.quote, at + 1); }
  } else if (mark.kind === 'lines') {
    let offset = 0;
    for (const line of block.lines) {
      if (!line.text) candidates.push(offset);
      offset += line.text.length + 1;
    }
  }
  const contextual = candidates.filter(at =>
    block.text.slice(Math.max(0, at - mark.prefix.length), at) === mark.prefix &&
    block.text.slice(at + mark.quote.length, at + mark.quote.length + mark.suffix.length) === mark.suffix);
  const matches = contextual.length ? contextual : candidates;
  if (matches.length === 1 && (contextual.length || (mark.occurrenceCount ?? 1) <= 1)) {
    const from = matches[0]!;
    return { span: { from, to: from + mark.quote.length }, status: 'resolved' };
  }
  return { span: { from: mark.from, to: mark.to }, status: matches.length ? 'ambiguous' : 'missing' };
}

export function collectItems(text: string): HighlightItem[] {
  const parsed = parseDocument(text);
  const items: HighlightItem[] = parsed.highlights.map(highlight => ({
    ...highlight, id: `prose:${highlight.from}`, kind: 'prose', label: colorLabels[highlight.color], status: 'resolved',
  }));
  for (const block of parsed.blocks) for (const mark of block.metadata?.marks ?? []) {
    const resolved = resolveMark(block, mark);
    const from = sourceOffset(block, resolved.span.from);
    items.push({
      id: `${block.metadata!.blockId}:${mark.id}:${block.fenceFrom}`, kind: mark.kind === 'lines' ? 'code-line' : 'code-range',
      from, to: sourceOffset(block, resolved.span.to), color: mark.color, label: mark.label,
      quote: mark.quote, language: block.language, status: resolved.status,
      line: block.lines.findIndex(line => from <= line.to) + 1,
      blockFrom: block.fenceFrom, blockId: block.metadata!.blockId, markId: mark.id,
    });
  }
  return items.sort((a, b) => a.from - b.from);
}
