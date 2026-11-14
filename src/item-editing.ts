import { collectItems } from './anchors';
import { planHighlight } from './editing';
import { parseDocument, serializeMetadata } from './parsing';
import type { EditPlan, HighlightItem, Preset } from './domain';

export function currentItem(text: string, reference: HighlightItem): HighlightItem {
  const current = collectItems(text).find(item => item.id === reference.id);
  if (!current || current.status !== 'resolved' || current.quote !== reference.quote || current.from !== reference.from || current.to !== reference.to || current.semantic !== reference.semantic || current.color !== reference.color || current.label !== reference.label) throw new Error('标注位置已变化，请刷新侧栏后重试。');
  return current;
}

export function planItemUpdate(text: string, reference: HighlightItem, preset: Preset | null): EditPlan {
  const current = currentItem(text, reference);
  if (current.kind === 'prose' || current.kind === 'inline-code') return planHighlight(text, [{ from: current.from, to: current.to }], preset);
  const block = parseDocument(text).blocks.find(block => block.fenceFrom === current.blockFrom);
  const metadata = structuredClone(block!.metadata!);
  const index = metadata.marks.findIndex(mark => mark.id === current.markId);
  if (preset) metadata.marks[index] = { ...metadata.marks[index]!, semantic: preset.id, label: preset.name, color: preset.color };
  else metadata.marks.splice(index, 1);
  const span = block!.metadataSpan!, insert = metadata.marks.length ? serializeMetadata(metadata) : '';
  const delta = span.from <= current.from ? insert.length - (span.to - span.from) : 0;
  return { changes: [{ ...span, insert }], selections: [{ from: current.from + delta, to: current.to + delta }] };
}
