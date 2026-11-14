export const colors = ['default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
export type Color = typeof colors[number];
export const colorLabels: Record<Color, string> = {
  default: '默认色', red: '红色', orange: '橙色', yellow: '黄色', green: '绿色', blue: '蓝色', purple: '紫色',
};
export function colorPreset(color: Color): Preset { return { id: `color:${color}`, name: colorLabels[color], color }; }
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
  note?: string;
}
export interface CodeMetadata { v: 1; blockId: string; marks: CodeMark[] }
export interface InlineMetadata { v: 1; id: string; color: Color; semantic: string; label: string; note?: string }
export type ProseMetadata = Omit<InlineMetadata, 'color' | 'note'> & { noteRef?: string };
export interface InlineCode extends Span {
  content: Span;
  text: string;
  metadata?: InlineMetadata;
  metadataSpan?: Span;
}
export interface SourceLine extends Span { text: string; number: number }
export interface CodeBlock extends Span {
  language: string;
  meta?: string;
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
  metadata?: ProseMetadata;
  metadataSpan?: Span;
  footnoteSpan?: Span;
}
export interface HighlightItem extends Span {
  id: string;
  kind: 'prose' | 'inline-code' | 'code-line' | 'code-range';
  color: Color;
  label: string;
  semantic?: string;
  quote: string;
  language?: string;
  line?: number;
  status: 'resolved' | 'ambiguous' | 'missing';
  blockFrom?: number;
  blockId?: string;
  markId?: string;
  note?: string;
}
export interface ParsedDocument {
  blocks: CodeBlock[];
  highlights: ProseHighlight[];
  excluded: Span[];
  prose: Span[];
  inlines: InlineCode[];
  footnotes: { id: string; text: string; span: Span }[];
  footnoteReferences: { id: string; span: Span }[];
}
export interface Change extends Span { insert: string; positions?: { starts: number[]; ends: number[] } }
export interface EditPlan { changes: Change[]; selections: Span[] }

export function overlaps(a: Span, b: Span): boolean { return a.from < b.to && b.from < a.to; }
export function contains(outer: Span, inner: Span): boolean {
  return outer.from <= inner.from && inner.to <= outer.to;
}
