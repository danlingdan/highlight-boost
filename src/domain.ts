export const colors = ['default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
export type Color = typeof colors[number];
export const emojis: Partial<Record<Color, string>> = {
  red: '🔴', orange: '🟠', yellow: '🟡', green: '🟢', blue: '🔵', purple: '🟣',
};
export interface Preset { id: string; name: string; color: Color }
export const presets: Preset[] = [
  { id: 'important', name: '重点', color: 'yellow' },
  { id: 'question', name: '疑问', color: 'red' },
  { id: 'reference', name: '引用', color: 'blue' },
  { id: 'action', name: '行动', color: 'green' },
];
export interface Span { from: number; to: number }
export interface CodeMark {
  id: string;
  kind: 'lines' | 'text';
  from: number;
  to: number;
  quote: string;
  prefix: string;
  suffix: string;
  color: Color;
  semantic: string;
  label: string;
  occurrenceCount?: number;
}
export interface CodeMetadata { v: 1; blockId: string; marks: CodeMark[] }
export interface SourceLine extends Span { text: string; number: number }
export interface CodeBlock extends Span {
  language: string;
  text: string;
  lines: SourceLine[];
  fenceFrom: number;
  prefix: string;
  metadata?: CodeMetadata;
  metadataSpan?: Span;
}
export interface ProseHighlight extends Span {
  content: Span;
  color: Color;
  quote: string;
}
export interface HighlightItem extends Span {
  id: string;
  kind: 'prose' | 'code-line' | 'code-range';
  color: Color;
  label: string;
  quote: string;
  language?: string;
  line?: number;
  status: 'resolved' | 'ambiguous' | 'missing';
  blockFrom?: number;
  blockId?: string;
  markId?: string;
}
export interface ParsedDocument {
  blocks: CodeBlock[];
  highlights: ProseHighlight[];
  excluded: Span[];
}
export interface Change extends Span { insert: string; positions?: { starts: number[]; ends: number[] } }
export interface EditPlan { changes: Change[]; selections: Span[] }

export function overlaps(a: Span, b: Span): boolean { return a.from < b.to && b.from < a.to; }
export function contains(outer: Span, inner: Span): boolean {
  return outer.from <= inner.from && inner.to <= outer.to;
}
