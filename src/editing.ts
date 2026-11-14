import { contains, emojis, overlaps, type Change, type CodeBlock, type CodeMark, type CodeMetadata, type EditPlan, type HighlightItem, type Preset, type ProseMetadata, type Span } from './domain';
import { logicalOffset, resolveMark } from './anchors';
import { parseDocument, serializeInlineMetadata, serializeMetadata, serializeProseMetadata } from './parsing';

export function applyChanges(text: string, changes: Change[]): string {
  let result = text;
  for (const change of [...changes].sort((a, b) => b.from - a.from || b.to - a.to)) result = result.slice(0, change.from) + change.insert + result.slice(change.to);
  return result;
}

function proseChange(text: string, span: Span, preset: Preset | null, selections: Span[] = [span]): Change {
  const parsed = parseDocument(text);
  const highlights = parsed.highlights.filter(item => overlaps(item, span));
  const from = Math.min(span.from, ...highlights.map(item => item.from));
  const to = Math.max(span.to, ...highlights.map(item => item.metadataSpan?.to ?? item.to));
  const runs: { text: string; color: string | null; metadata?: ProseMetadata; sources: number[] }[] = [];
  const whole = highlights.length === 1 && selections.some(selection => contains(selection, highlights[0]!.content)) ? highlights[0]!.metadata : undefined;
  const applied: ProseMetadata | undefined = preset && !preset.id.startsWith('color:') ? { v: 1, id: whole?.id ?? '', semantic: preset.id, label: preset.name } : undefined;
  function add(value: string, color: string | null, metadata: ProseMetadata | undefined, source: number) {
    const last = runs.at(-1);
    if (last && last.color === color && last.metadata?.id === metadata?.id && last.metadata?.semantic === metadata?.semantic && last.metadata?.label === metadata?.label) { last.text += value; last.sources.push(source); }
    else runs.push({ text: value, color, metadata, sources: [source] });
  }
  for (let p = from; p < to;) {
    const metadata = highlights.find(item => item.metadataSpan && item.metadataSpan.from <= p && p < item.metadataSpan.to)?.metadataSpan;
    if (metadata) { p = metadata.to; continue; }
    const highlight = highlights.find(item => item.from <= p && p < item.to);
    if (highlight && (p < highlight.content.from || p >= highlight.content.to)) { p++; continue; }
    const selected = selections.some(selection => selection.from <= p && p < selection.to);
    add(text[p]!, selected ? preset?.color ?? null : highlight?.color ?? null,
      selected ? preset ? applied ?? highlight?.metadata : undefined : highlight?.metadata, p);
    p++;
  }
  let insert = '';
  const starts = new Array<number>(to - from + 1).fill(-1);
  const ends = new Array<number>(to - from + 1).fill(-1);
  const usedIds = new Set(parsed.highlights.filter(item => item.from < from).flatMap(item => item.metadata ? [item.metadata.id] : []));
  for (const run of runs) {
    const base = insert.length;
    const parts = run.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    const opening = run.color && run.text.trim() ? `==${emojis[run.color as keyof typeof emojis] ?? ''}` : '';
    const leading = parts[1]!.length, trailing = leading + parts[2]!.length;
    for (let i = 0; i < run.sources.length; i++) {
      const at = base + i + (i >= leading ? opening.length : 0) + (i >= trailing && opening ? 2 : 0);
      starts[run.sources[i]! - from] = at;
      ends[run.sources[i]! + 1 - from] = at + 1;
    }
    let suffix = '';
    if (opening && run.metadata) {
      const id = run.metadata.id && !usedIds.has(run.metadata.id) ? run.metadata.id : crypto.randomUUID();
      usedIds.add(id);
      suffix = serializeProseMetadata({ ...run.metadata, id });
    }
    if (suffix) for (let i = trailing; i < run.sources.length; i++) {
      starts[run.sources[i]! - from] = starts[run.sources[i]! - from]! + suffix.length;
      ends[run.sources[i]! + 1 - from] = ends[run.sources[i]! + 1 - from]! + suffix.length;
    }
    insert += opening ? `${parts[1]}${opening}${parts[2]}==${suffix}${parts[3]}` : run.text;
  }
  let next = insert.length;
  for (let i = starts.length - 1; i >= 0; i--) { if (starts[i]! >= 0) next = starts[i]!; else starts[i] = next; }
  let previous = 0;
  for (let i = 0; i < ends.length; i++) { if (ends[i]! >= 0) previous = ends[i]!; else ends[i] = previous; }
  return { from, to, insert, positions: { starts, ends } };
}

function codeMark(block: CodeBlock, span: Span, preset: Preset, mode: 'lines' | 'text'): CodeMark {
  let from = logicalOffset(block, span.from);
  let to = logicalOffset(block, span.to);
  if (mode === 'lines') {
    from = from > 0 ? block.text.lastIndexOf('\n', from - 1) + 1 : 0;
    const end = block.text.indexOf('\n', Math.max(from, to - 1));
    to = end < 0 ? block.text.length : end;
  }
  const quote = block.text.slice(from, to);
  let occurrenceCount = 0;
  if (quote) for (let at = block.text.indexOf(quote); at >= 0; at = block.text.indexOf(quote, at + 1)) occurrenceCount++;
  return {
    id: crypto.randomUUID(), kind: mode, from, to, quote: block.text.slice(from, to),
    prefix: block.text.slice(Math.max(0, from - 32), from), suffix: block.text.slice(to, to + 32),
    color: preset.color, semantic: preset.id, label: preset.name,
    occurrenceCount: occurrenceCount || 1,
  };
}

function editableMetadata(block: CodeBlock, blocks: CodeBlock[]): CodeMetadata {
  const metadata = block.metadata ? structuredClone(block.metadata) : { v: 1 as const, blockId: crypto.randomUUID(), marks: [] };
  const earlier = blocks.filter(other => other.fenceFrom < block.fenceFrom);
  if (earlier.some(other => other.metadata?.blockId === metadata.blockId)) metadata.blockId = crypto.randomUUID();
  const seen = new Set(earlier.flatMap(other => other.metadata?.marks.map(mark => mark.id) ?? []));
  metadata.marks = metadata.marks.map(mark => {
    if (seen.has(mark.id)) mark.id = crypto.randomUUID();
    seen.add(mark.id);
    const resolved = resolveMark(block, mark);
    return resolved.status === 'resolved' ? {
      ...mark, ...resolved.span,
      prefix: block.text.slice(Math.max(0, resolved.span.from - 32), resolved.span.from),
      suffix: block.text.slice(resolved.span.to, resolved.span.to + 32),
    } : mark;
  });
  return metadata;
}

export function planCodeRebind(text: string, reference: Pick<HighlightItem, 'blockFrom' | 'blockId' | 'markId'>, span: Span): EditPlan {
  const parsed = parseDocument(text);
  const block = parsed.blocks.find(block => block.fenceFrom === reference.blockFrom && block.metadata?.blockId === reference.blockId);
  const index = block?.metadata?.marks.findIndex(mark => mark.id === reference.markId) ?? -1;
  if (!block?.metadataSpan || index < 0) throw new Error('标注位置已变化，请刷新侧栏后重试。');
  const previous = block.metadata!.marks[index]!;
  const content = { from: block.lines[0]?.from ?? block.to, to: block.lines.at(-1)?.to ?? block.from };
  if (!contains(content, span) || (span.from === span.to && previous.kind === 'text')) throw new Error('请在该代码块中选择新的标注位置。');
  const metadata = editableMetadata(block, parsed.blocks);
  metadata.marks[index] = {
    ...codeMark(block, span, { id: previous.semantic, name: previous.label, color: previous.color }, previous.kind),
    id: metadata.marks[index]!.id,
  };
  const insert = serializeMetadata(metadata);
  const delta = insert.length - (block.metadataSpan.to - block.metadataSpan.from);
  return { changes: [{ ...block.metadataSpan, insert }], selections: [{ from: span.from + delta, to: span.to + delta }] };
}

export function planHighlight(text: string, selections: Span[], preset: Preset | null, mode: 'lines' | 'text' = 'text'): EditPlan {
  const parsed = parseDocument(text);
  const changes: Change[] = [];
  const prose: Span[] = [];
  const codeSelections = new Map<CodeBlock, Span[]>();
  const inlineSelections = new Set<typeof parsed.inlines[number]>();
  for (const original of selections) {
    let span = { ...original };
    if (mode === 'text') for (const inline of parsed.inlines) {
      if (span.from === span.to ? inline.from < span.from && span.from < inline.to : overlaps(inline, span)) inlineSelections.add(inline);
    }
    for (const block of parsed.blocks) {
      if (!block.lines.length) continue;
      const content = { from: block.lines[0]!.from, to: block.lines.at(-1)!.to };
      const cursor = span.from === span.to && block.lines.some(line => line.from <= span.from && span.from <= line.to);
      if (!cursor && !(span.from < span.to && (overlaps(content, span) || (content.from === content.to && span.from <= content.from && content.to < span.to)))) continue;
      if (mode === 'text' && cursor && preset) throw new Error('请先选择要标记的代码文本。');
      const clipped = { from: Math.max(span.from, content.from), to: Math.min(span.to, content.to) };
      if (mode === 'text' && clipped.from === clipped.to && !cursor) continue;
      codeSelections.set(block, [...(codeSelections.get(block) ?? []), clipped]);
    }
    if (span.from === span.to) {
      const existing = parsed.highlights.find(item => item.from <= span.from && span.from <= item.to);
      if (!existing) continue;
      span = { ...existing.content };
    }
    for (const range of parsed.prose) {
      const part = { from: Math.max(span.from, range.from), to: Math.min(span.to, range.to) };
      if (part.from >= part.to) continue;
      let fragments = [part];
      for (const excluded of parsed.excluded) fragments = fragments.flatMap(fragment => {
        if (!overlaps(fragment, excluded)) return [fragment];
        return [
          { from: fragment.from, to: Math.min(fragment.to, excluded.from) },
          { from: Math.max(fragment.from, excluded.to), to: fragment.to },
        ].filter(fragment => fragment.from < fragment.to);
      });
      prose.push(...fragments);
    }
  }
  for (const inline of inlineSelections) {
    if (!preset && !inline.metadataSpan) continue;
    const duplicated = parsed.inlines.some(other => other.from < inline.from && other.metadata?.id === inline.metadata?.id);
    const insert = preset ? serializeInlineMetadata({
      v: 1, id: inline.metadata && !duplicated ? inline.metadata.id : crypto.randomUUID(),
      color: preset.color, semantic: preset.id.startsWith('color:') && inline.metadata && !inline.metadata.semantic.startsWith('color:') ? inline.metadata.semantic : preset.id,
      label: preset.id.startsWith('color:') && inline.metadata && !inline.metadata.semantic.startsWith('color:') ? inline.metadata.label : preset.name,
    }) : '';
    changes.push({ ...(inline.metadataSpan ?? { from: inline.to, to: inline.to }), insert });
  }
  for (const [block, spans] of codeSelections) {
    const metadata = editableMetadata(block, parsed.blocks);
    for (const span of spans) {
      const target = codeMark(block, span, preset ?? { id: '', name: '', color: 'default' }, mode);
      const matches = (mark: CodeMark) => span.from === span.to
        ? mark.from <= target.from && target.from <= mark.to
        : overlaps(mark, target) || (mark.from === target.from && mark.to === target.to);
      if (!preset) metadata.marks = metadata.marks.filter(mark => !matches(mark));
      else {
        const existing = metadata.marks.find(mark => mark.from === target.from && mark.to === target.to && mark.kind === mode);
        if (existing) Object.assign(existing, { ...target, id: existing.id,
          semantic: preset.id.startsWith('color:') && !existing.semantic.startsWith('color:') ? existing.semantic : target.semantic,
          label: preset.id.startsWith('color:') && !existing.semantic.startsWith('color:') ? existing.label : target.label,
        });
        else metadata.marks.push(target);
      }
    }
    if (block.metadataSpan) changes.push({ ...block.metadataSpan, insert: metadata.marks.length ? serializeMetadata(metadata) : '' });
    else if (metadata.marks.length) changes.push({ from: block.fenceFrom, to: block.fenceFrom, insert: `${serializeMetadata(metadata)}${text.includes('\r\n') ? '\r\n' : '\n'}${block.prefix}` });
  }
  // Selections touching the same existing highlight share one replacement.
  const groups: Span[][] = [];
  for (const span of prose.sort((a, b) => a.from - b.from)) {
    const affected = proseChange(text, span, preset);
    const group = groups.at(-1);
    const previous = group && proseChange(text, { from: group[0]!.from, to: Math.max(...group.map(span => span.to)) }, preset);
    if (group && previous && affected.from <= previous.to) group.push(span);
    else groups.push([span]);
  }
  for (const group of groups) {
    changes.push(proseChange(text, { from: group[0]!.from, to: Math.max(...group.map(span => span.to)) }, preset, group));
  }
  const ordered = changes.sort((a, b) => a.from - b.from);
  function map(pos: number, association: 'starts' | 'ends'): number {
    let shift = 0;
    for (const change of ordered) {
      if (pos < change.from) break;
      if (pos <= change.to && change.from !== change.to) return change.from + shift + (change.positions?.[association][pos - change.from] ?? change.insert.length);
      shift += change.insert.length - (change.to - change.from);
    }
    return pos + shift;
  }
  return { changes: ordered, selections: selections.map(span => ({ from: map(span.from, 'starts'), to: map(span.to, span.from === span.to ? 'starts' : 'ends') })) };
}
