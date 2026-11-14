import { Facet, EditorState, type StateEffect } from '@codemirror/state';
import { foldedRanges, unfoldEffect } from '@codemirror/language';
import type { CodeBlock } from './domain';
import { fenceParameters, parameterValue } from './fence-params';

export interface CodeDisplaySettings {
  showTitle: boolean; showLineNumbers: boolean; startLine: number; numberFont: 'monospace' | 'interface';
  collapsible: boolean; collapseByDefault: boolean; wrap: boolean; diff: boolean;
}
export const defaultCodeDisplay: CodeDisplaySettings = { showTitle: false, showLineNumbers: false, startLine: 1, numberFont: 'monospace', collapsible: false, collapseByDefault: false, wrap: false, diff: true };
export function normalizeCodeDisplay(value: unknown): CodeDisplaySettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { showTitle: input.showTitle === true, showLineNumbers: input.showLineNumbers === true,
    startLine: Number.isSafeInteger(input.startLine) && Number(input.startLine) >= 1 && Number(input.startLine) <= 1000000 ? Number(input.startLine) : 1,
    numberFont: input.numberFont === 'interface' ? 'interface' : 'monospace', collapsible: input.collapsible === true,
    collapseByDefault: input.collapseByDefault === true, wrap: input.wrap === true, diff: input.diff !== false };
}
export const codeDisplayFacet = Facet.define<CodeDisplaySettings, CodeDisplaySettings>({ combine: values => values[0] ?? defaultCodeDisplay });
export function codeOptions(block: CodeBlock, settings: CodeDisplaySettings): CodeDisplaySettings & { title: string } {
  const parameters = fenceParameters(block.meta ?? '');
  const value = (...keys: string[]) => parameterValue(parameters, ...keys);
  const flag = (key: string, fallback: boolean) => value(key) !== undefined ? value(key) !== 'false' : fallback;
  const folded = value('fold') !== undefined && value('fold') !== 'false', unfolded = value('unfold') !== undefined && value('unfold') !== 'false';
  const foldTitle = value('fold');
  const title = value('title', 'file') ?? (foldTitle && !['true', 'false'].includes(foldTitle) ? foldTitle : '');
  const ln = value('ln', 'linenos'), numbered = ln === 'true' || ln === 'table' || ln === 'inline' || /^\d+$/.test(ln ?? '');
  const first = Number(value('startLineNumber', 'linenostart') ?? (/^\d+$/.test(ln ?? '') ? ln : undefined));
  return { ...settings, title, showTitle: settings.showTitle || Boolean(title), showLineNumbers: flag('showLineNumbers', ln === 'false' ? false : numbered || settings.showLineNumbers),
    startLine: Number.isSafeInteger(first) && first > 0 && first <= 1000000 ? first : settings.startLine,
    wrap: flag('wrap', settings.wrap), collapsible: flag('hb-fold', settings.collapsible || folded || unfolded || flag('hb-collapsed', false)), collapseByDefault: flag('hb-collapsed', unfolded ? false : folded || settings.collapseByDefault) };
}
export type DiffKind = 'insert' | 'delete' | 'context' | 'meta';
export function diffKinds(code: string): DiffKind[] {
  const lines = code.split('\n'); let old = 0, next = 0, hunk = false;
  return lines.map((line, index) => {
    const header = line.match(/^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/);
    if (header) { old = Number(header[1] ?? 1); next = Number(header[2] ?? 1); hunk = old > 0 || next > 0; return 'meta'; }
    if (/^(?:diff --git |index |\\ No newline)/.test(line)) { if (!line.startsWith('\\')) hunk = false; return 'meta'; }
    if (!hunk && (/^---(?:\s|$)/.test(line) && /^\+\+\+(?:\s|$)/.test(lines[index + 1] ?? '') || /^\+\+\+(?:\s|$)/.test(line) && /^---(?:\s|$)/.test(lines[index - 1] ?? ''))) return 'meta';
    const kind: DiffKind = line.startsWith('+') ? 'insert' : line.startsWith('-') ? 'delete' : 'context';
    if (hunk) { if (kind !== 'insert') old--; if (kind !== 'delete') next--; if (old <= 0 && next <= 0) hunk = false; }
    return kind;
  });
}
export function diffAfter(code: string): string {
  const kinds = diffKinds(code);
  return code.split('\n').flatMap((line, index) => kinds[index] === 'delete' || kinds[index] === 'meta' ? [] : [line.startsWith('+') || line.startsWith(' ') ? line.slice(1) : line]).join('\n');
}
export function codeDisplayKey(path: string, block: CodeBlock, blocks: CodeBlock[]): string {
  const identity = block.metadata?.blockId;
  const occurrence = identity ? blocks.filter(other => other.metadata?.blockId === identity).findIndex(other => other.fenceFrom === block.fenceFrom) : block.fenceFrom;
  return `${path}\u0000${identity ?? block.language}\u0000${occurrence}`;
}
export const unfoldSelectedCode = EditorState.transactionExtender.of(transaction => {
  if (!transaction.selection) return null;
  const effects: StateEffect<unknown>[] = [];
  foldedRanges(transaction.startState).between(0, transaction.startState.doc.length, (from, to) => {
    const start = transaction.changes.mapPos(from, 1), end = transaction.changes.mapPos(to, -1);
    if (start < end && transaction.newSelection.ranges.some(range => start < range.head && range.head <= end)) effects.push(unfoldEffect.of({ from: start, to: end }));
  });
  return effects.length ? { effects } : null;
});
