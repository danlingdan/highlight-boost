import { colors, emojis, colorPreset, type Change, type Color, type CodeMark } from './domain';
import { parseDocument, serializeMetadata } from './parsing';
import { applyChanges } from './editing';
import { fenceParameters, parameterLines } from './fence-params';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';

export interface ImportOptions { highlightr: boolean; hilo: boolean; fences: boolean; mapping: Record<string, Color | 'skip'> }
export interface ImportEntry { from: number; to: number; source: 'highlightr' | 'hilo' | 'fence'; key: string; before: string; after?: string; reason?: 'color' | 'structure' | 'attributes' | 'parameter'; count: number; lines?: { number: number; text: string; color: Color }[] }
export interface ImportPlan { before: string; after: string; entries: ImportEntry[]; changes: Change[] }
export const defaultImportOptions: ImportOptions = { highlightr: true, hilo: true, fences: false, mapping: {} };
const aliases: Record<string, Color> = { pink: 'purple', cyan: 'blue', grey: 'default', gray: 'default' };
const seeds: Record<string, Color> = { '#ffb8eb': 'purple', '#ff5582': 'red', '#ffb86c': 'orange', '#fff3a3': 'yellow', '#bbfabb': 'green', '#abf7f7': 'blue', '#adccff': 'blue', '#d2b3ff': 'purple', '#cacfd9': 'default' };
export function importColor(key: string, mapping: ImportOptions['mapping']): Color | undefined {
  if (Object.hasOwn(mapping, key)) return mapping[key] === 'skip' ? undefined : mapping[key];
  const value = key.slice(key.indexOf(':') + 1).toLowerCase();
  return colors.includes(value as Color) ? value as Color : Object.hasOwn(aliases, value) ? aliases[value] : Object.hasOwn(seeds, value) ? seeds[value] : undefined;
}
function cssColor(value: string): string {
  const raw = value.trim().toLowerCase().replace(/\s*!important$/, '');
  if (/^#[\da-f]{3,4}$/.test(raw)) return '#' + [...raw.slice(1, 4)].map(c => c + c).join('');
  if (/^#[\da-f]{6}(?:[\da-f]{2})?$/.test(raw)) return raw.slice(0, 7);
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,[^)]+)?\)$/.exec(raw);
  if (rgb && rgb.slice(1, 4).every(c => Number(c) <= 255)) return '#' + rgb.slice(1, 4).map(c => Number(c).toString(16).padStart(2, '0')).join('');
  return raw;
}
function markAttributes(tag: string): { key: string; extra: boolean } {
  const attributes = [...tag.replace(/^<mark\b|>$/gi, '').matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)];
  const values = new Map(attributes.map(match => [match[1]!.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '']));
  const classes = (values.get('class') ?? '').split(/\s+/).filter(Boolean);
  const style = values.get('style') ?? '', background = [...style.matchAll(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/gi)].at(-1)?.[1];
  const slug = classes.find(value => /^hltr-[\w-]+$/i.test(value))?.slice(5).toLowerCase();
  const rest = tag.replace(/^<mark\b|>$/gi, '').replace(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, '').trim();
  return { key: `highlightr:${background ? cssColor(background) : slug ?? 'default'}`, extra: Boolean(rest) || [...values.keys()].some(key => !['class', 'style'].includes(key)) || classes.some(value => !/^hltr-[\w-]+$/i.test(value)) || style.split(';').some(value => value.trim() && !/^\s*background(?:-color)?\s*:/i.test(value)) };
}
export function planImport(text: string, options: ImportOptions = defaultImportOptions): ImportPlan {
  const parsed = parseDocument(text), entries: ImportEntry[] = [], changes: Change[] = [];
  const intersects = (from: number, to: number, openEnd: number, closeStart: number) => parsed.excluded.some(span => span.from < to && from < span.to && !(span.from === from && span.to === openEnd || span.from === closeStart && span.to === to));
  const add = (entry: ImportEntry, body: string, extra = false) => {
    if (extra) entry.reason = 'attributes';
    else if (!body.trim() || /[\r\n]|==|<\/?mark\b/i.test(body) || /^\s|\s$/.test(body)) entry.reason = 'structure';
    else {
      const color = importColor(entry.key, options.mapping);
      if (!color) entry.reason = 'color';
      else { entry.after = `==${emojis[color] ?? ''}${body}==`; changes.push({ from: entry.from, to: entry.to, insert: entry.after }); }
    }
    entries.push(entry);
  };
  if (options.highlightr) {
    const codeSpans: { from: number; to: number }[] = [];
    const visit = (node: Nodes) => {
      if ((node.type === 'code' || node.type === 'inlineCode') && node.position) codeSpans.push({ from: node.position.start.offset!, to: node.position.end.offset! });
      else if ('children' in node) for (const child of node.children) visit(child);
    };
    visit(fromMarkdown(text));
    const stack: { from: number; tag: string; nested: boolean }[] = [];
    for (const match of text.matchAll(/<\/?mark\b(?:[^"'>]|"[^"]*"|'[^']*')*>/gi)) {
      const end = match.index + match[0].length;
      if (codeSpans.some(span => span.from <= match.index && end <= span.to) || parsed.excluded.some(span => span.from <= match.index && end <= span.to && !(span.from === match.index && span.to === end))) continue;
      if (!/^<\//i.test(match[0])) {
        if (stack.length) stack[0]!.nested = true;
        stack.push({ from: match.index, tag: match[0], nested: false });
      } else {
        const open = stack.pop(); if (!open || stack.length) continue;
        const to = match.index + match[0].length;
        const { key, extra } = markAttributes(open.tag);
        const entry: ImportEntry = { from: open.from, to, source: 'highlightr', key, before: text.slice(open.from, to), count: 1 };
        if (intersects(open.from, to, open.from + open.tag.length, match.index)) { entries.push({ ...entry, reason: 'structure' }); continue; }
        add(entry, text.slice(open.from + open.tag.length, match.index), extra || open.nested);
      }
    }
  }
  if (options.hilo) for (const highlight of parsed.highlights) {
    const match = /^\{([a-z0-9][a-z0-9-]*)\}([\s\S]*)$/.exec(highlight.quote);
    if (!match || highlight.metadata || entries.some(entry => entry.from < highlight.to && highlight.from < entry.to)) continue;
    add({ from: highlight.from, to: highlight.to, source: 'hilo', key: `hilo:${match[1]}`, before: text.slice(highlight.from, highlight.to), count: 1 }, match[2]!);
  }
  if (options.fences) for (const block of parsed.blocks) {
    const display = new Set(['title', 'file', 'ln', 'fold', 'unfold', 'wrap', 'showlinenumbers', 'startlinenumber', 'linenos', 'linenostart', 'hb-fold', 'hb-collapsed', 'lang', 'frame', 'collapse', 'collapsestyle', 'collapsepreserveindent']);
    for (const parameter of fenceParameters(block.meta ?? '')) if (!['hl', 'hl_lines', 'mark', 'ins', 'del'].includes(parameter.key) && !display.has(parameter.key) || parameter.key === 'ln' && parameter.value?.includes(':')) {
      const end = text.indexOf('\n', block.fenceFrom);
      entries.push({ from: block.fenceFrom, to: end < 0 ? text.length : end, source: 'fence', key: `fence:${parameter.key}`, before: text.slice(block.fenceFrom, end < 0 ? text.length : end), count: 0, reason: 'parameter' });
    }
    const marks = structuredClone(block.metadata?.marks ?? []), initial = marks.length;
    let offset = 0;
    parameterLines(block).forEach((kind, index) => {
      const quote = block.text.split('\n')[index]!, from = offset, to = from + quote.length; offset = to + 1;
      if (!kind || marks.some(mark => mark.kind === 'lines' && mark.from === from && mark.to === to && mark.quote === quote)) return;
      const color: Color = kind === 'insert' ? 'green' : kind === 'delete' ? 'red' : 'yellow', preset = colorPreset(color);
      const mark: CodeMark = { id: crypto.randomUUID(), kind: 'lines', from, to, quote, prefix: block.text.slice(Math.max(0, from - 32), from), suffix: block.text.slice(to, to + 32), color, semantic: preset.id, label: preset.name };
      marks.push(mark);
    });
    if (marks.length === initial) continue;
    const after = serializeMetadata({ v: 1, blockId: block.metadata?.blockId ?? crypto.randomUUID(), marks });
    const span = block.metadataSpan ?? { from: block.fenceFrom, to: block.fenceFrom };
    const insert = block.metadataSpan ? after : `${after}${text.includes('\r\n') ? '\r\n' : '\n'}${block.prefix}`;
    entries.push({ ...span, source: 'fence', key: 'fence:lines', before: text.slice(span.from, span.to), after: insert, count: marks.length - initial, lines: marks.slice(initial).map(mark => ({ number: block.text.slice(0, mark.from).split('\n').length, text: mark.quote, color: mark.color })) });
    changes.push({ ...span, insert });
  }
  return { before: text, after: applyChanges(text, changes), entries: entries.sort((a, b) => a.from - b.from), changes };
}
