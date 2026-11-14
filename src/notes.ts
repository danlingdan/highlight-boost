import type { Change, EditPlan, HighlightItem, ProseMetadata } from './domain';
import { currentItem } from './item-editing';
import { parseDocument, serializeInlineMetadata, serializeMetadata, serializeProseMetadata } from './parsing';

export function planNote(text: string, reference: HighlightItem, value: string, label?: string): EditPlan {
  const item = currentItem(text, reference), parsed = parseDocument(text);
  const note = value.replace(/\r\n|\r/g, '\n').trim();
  const proseRef = item.kind === 'prose' && parsed.highlights.find(mark => mark.content.from === item.from && mark.content.to === item.to)?.metadata?.noteRef;
  if (note === (item.note ?? '') && (note || !proseRef)) return { changes: [], selections: [{ from: item.from, to: item.to }] };
  const changes: Change[] = [];
  if (item.kind === 'prose') {
    const highlight = parsed.highlights.find(mark => mark.content.from === item.from && mark.content.to === item.to)!;
    const metadata: ProseMetadata = { ...(highlight.metadata ?? { v: 1, id: crypto.randomUUID(), semantic: `color:${highlight.color}`, label: label ?? item.label }) };
    const existing = metadata.noteRef && parsed.footnotes.find(footnote => footnote.id.toLowerCase() === metadata.noteRef!.toLowerCase());
    const span = highlight.metadataSpan ?? { from: highlight.to, to: highlight.to };
    let end = highlight.footnoteSpan?.to ?? span.to;
    if (note) {
      const id = metadata.noteRef ?? `hb-${crypto.randomUUID()}`;
      metadata.noteRef = id;
      const newline = text.includes('\r\n') ? '\r\n' : '\n';
      const definition = `[^${id}]: ${note.split('\n').join(`${newline}    `)}`;
      if (existing) changes.push({ ...existing.span, insert: definition });
      else changes.push({ from: text.length, to: text.length, insert: `${text.endsWith(newline + newline) ? '' : text.endsWith(newline) ? newline : newline + newline}${definition}${newline}` });
      changes.push({ from: span.from, to: end, insert: `${serializeProseMetadata(metadata)}[^${id}]` });
    } else {
      const id = metadata.noteRef;
      delete metadata.noteRef;
      if (!highlight.metadata && !id) return { changes: [], selections: [{ from: item.from, to: item.to }] };
      const references = id ? parsed.footnoteReferences.filter(ref => ref.id.toLowerCase() === id.toLowerCase()) : [];
      const shared = id && parsed.highlights.some(other => other !== highlight && other.metadata?.noteRef === id);
      if (shared && highlight.footnoteSpan && references.every(ref => ref.span.from === highlight.footnoteSpan!.from)) {
        const other = parsed.highlights.find(other => other !== highlight && other.metadata?.noteRef === id)!;
        changes.push({ from: other.metadataSpan!.to, to: other.metadataSpan!.to, insert: `[^${id}]` });
      }
      if (existing && !shared && references.every(ref => highlight.footnoteSpan && ref.span.from === highlight.footnoteSpan.from)) changes.push({ ...existing.span, insert: '' });
      if (!highlight.footnoteSpan) end = span.to;
      changes.push({ from: span.from, to: end, insert: serializeProseMetadata(metadata) });
    }
  } else if (item.kind === 'inline-code') {
    const inline = parsed.inlines.find(inline => inline.content.from === item.from && inline.content.to === item.to)!;
    const metadata = { ...inline.metadata! };
    if (note) metadata.note = note; else delete metadata.note;
    changes.push({ ...inline.metadataSpan!, insert: serializeInlineMetadata(metadata) });
  } else {
    const block = parsed.blocks.find(block => block.fenceFrom === item.blockFrom)!;
    const metadata = structuredClone(block.metadata!);
    const mark = metadata.marks.find(mark => mark.id === item.markId)!;
    if (note) mark.note = note; else delete mark.note;
    changes.push({ ...block.metadataSpan!, insert: serializeMetadata(metadata) });
  }
  changes.sort((a, b) => a.from - b.from || a.to - b.to);
  for (let index = changes.length - 1; index > 0; index--) {
    const current = changes[index]!, previous = changes[index - 1]!;
    if (current.from === current.to && previous.from === previous.to && current.from === previous.from) {
      previous.insert = current.insert + previous.insert; changes.splice(index, 1);
    }
  }
  const shift = changes.filter(change => change.to <= item.from).reduce((sum, change) => sum + change.insert.length - (change.to - change.from), 0);
  return { changes, selections: [{ from: item.from + shift, to: item.to + shift }] };
}
