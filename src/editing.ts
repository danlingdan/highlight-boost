import { contains, emojis, overlaps, type Change, type CodeBlock, type CodeMark, type EditPlan, type Preset, type Span } from './domain';
import { logicalOffset, resolveMark } from './anchors';
import { parseDocument, serializeMetadata, sourceLines } from './parsing';

export function applyChanges(text: string, changes: Change[]): string {
  let result = text;
  for (const change of [...changes].sort((a, b) => b.from - a.from)) result = result.slice(0, change.from) + change.insert + result.slice(change.to);
  return result;
}

function proseChange(text: string, span: Span, preset: Preset | null, selections: Span[] = [span]): Change {
  const highlights = parseDocument(text).highlights.filter(item => overlaps(item, span));
  const from = Math.min(span.from, ...highlights.map(item => item.from));
  const to = Math.max(span.to, ...highlights.map(item => item.to));
  const runs: { text: string; color: string | null; sources: number[] }[] = [];
  function add(value: string, color: string | null, source: number) {
    const last = runs.at(-1);
    if (last && last.color === color) { last.text += value; last.sources.push(source); }
    else runs.push({ text: value, color, sources: [source] });
  }
  for (let p = from; p < to;) {
    const highlight = highlights.find(item => item.from <= p && p < item.to);
    if (highlight && (p < highlight.content.from || p >= highlight.content.to)) { p++; continue; }
    const selected = selections.some(selection => selection.from <= p && p < selection.to);
    add(text[p]!, selected ? preset?.color ?? null : highlight?.color ?? null, p);
    p++;
  }
  let insert = '';
  const starts = new Array<number>(to - from + 1).fill(-1);
  const ends = new Array<number>(to - from + 1).fill(-1);
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
    insert += opening ? `${parts[1]}${opening}${parts[2]}==${parts[3]}` : run.text;
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
  return {
    id: crypto.randomUUID(), kind: mode, from, to, quote: block.text.slice(from, to),
    prefix: block.text.slice(Math.max(0, from - 32), from), suffix: block.text.slice(to, to + 32),
    color: preset.color, semantic: preset.id, label: preset.name,
    occurrenceCount: to > from ? block.text.split(block.text.slice(from, to)).length - 1 : 1,
  };
}

export function planHighlight(text: string, selections: Span[], preset: Preset | null, mode: 'lines' | 'text' = 'text'): EditPlan {
  const parsed = parseDocument(text);
  const changes: Change[] = [];
  const prose: Span[] = [];
  const codeSelections = new Map<CodeBlock, Span[]>();
  for (const original of selections) {
    let span = { ...original };
    const block = parsed.blocks.find(item => contains(item, span) && item.lines.some(line => line.from <= span.from && span.from <= line.to));
    if (block) {
      if (mode === 'text' && span.from === span.to && preset) throw new Error('请先选择要标记的代码文本。');
      if (!block.lines.length) continue;
      const clipped = { from: Math.max(span.from, block.lines[0]!.from), to: Math.min(span.to, block.lines.at(-1)!.to) };
      codeSelections.set(block, [...(codeSelections.get(block) ?? []), clipped]);
      continue;
    }
    if (span.from === span.to) {
      const existing = parsed.highlights.find(item => item.from <= span.from && span.from <= item.to);
      if (!existing) continue;
      span = { ...existing.content };
    }
    for (const line of sourceLines(text)) {
      const part = { from: Math.max(span.from, line.from), to: Math.min(span.to, line.to) };
      if (part.from >= part.to) continue;
      if (parsed.excluded.some(item => overlaps(item, part))) throw new Error('请分别选择正文或单个代码块中的内容。');
      prose.push(part);
    }
  }
  for (const [block, spans] of codeSelections) {
    const metadata = block.metadata ? structuredClone(block.metadata) : { v: 1 as const, blockId: crypto.randomUUID(), marks: [] };
    const earlier = parsed.blocks.filter(other => other.fenceFrom < block.fenceFrom);
    if (earlier.some(other => other.metadata?.blockId === metadata.blockId)) metadata.blockId = crypto.randomUUID();
    const seen = new Set(earlier.flatMap(other => other.metadata?.marks.map(mark => mark.id) ?? []));
    for (const mark of metadata.marks) {
      if (seen.has(mark.id)) mark.id = crypto.randomUUID();
      seen.add(mark.id);
    }
    metadata.marks = metadata.marks.map(mark => {
      const resolved = resolveMark(block, mark);
      return resolved.status === 'resolved' ? {
        ...mark, ...resolved.span,
        prefix: block.text.slice(Math.max(0, resolved.span.from - 32), resolved.span.from),
        suffix: block.text.slice(resolved.span.to, resolved.span.to + 32),
      } : mark;
    });
    for (const span of spans) {
      const target = codeMark(block, span, preset ?? { id: '', name: '', color: 'default' }, mode);
      const matches = (mark: CodeMark) => span.from === span.to
        ? mark.from <= target.from && target.from <= mark.to
        : overlaps(mark, target) || (mark.from === target.from && mark.to === target.to);
      if (!preset) metadata.marks = metadata.marks.filter(mark => !matches(mark));
      else {
        const existing = metadata.marks.find(mark => mark.from === target.from && mark.to === target.to && mark.kind === mode);
        if (existing) Object.assign(existing, { ...target, id: existing.id });
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
    const previous = group && proseChange(text, { from: group[0]!.from, to: group.at(-1)!.to }, preset);
    if (group && previous && affected.from <= previous.to) group.push(span);
    else groups.push([span]);
  }
  for (const group of groups) {
    changes.push(proseChange(text, { from: group[0]!.from, to: group.at(-1)!.to }, preset, group));
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
