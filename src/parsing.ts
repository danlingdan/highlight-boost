import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import type { Nodes, Root } from 'mdast';
import { colors, emojis, type CodeBlock, type CodeMetadata, type InlineMetadata, type ProseMetadata, type ParsedDocument, type SourceLine, type Span } from './domain';

const trees = new WeakMap<ParsedDocument, Root>();
export function parsedTree(document: ParsedDocument): Root | undefined { return trees.get(document); }

function mergedSpans(spans: Span[]): Span[] {
  const result: Span[] = [];
  for (const span of [...spans].sort((a, b) => a.from - b.from || a.to - b.to)) {
    const last = result.at(-1);
    if (last && span.from <= last.to) last.to = Math.max(last.to, span.to);
    else result.push({ ...span });
  }
  return result;
}
function intersects(spans: Span[], from: number, to: number): boolean {
  let low = 0, high = spans.length;
  while (low < high) { const middle = (low + high) >>> 1; if (spans[middle]!.from < to) low = middle + 1; else high = middle; }
  return low > 0 && spans[low - 1]!.to > from;
}

export function sourceLines(text: string): SourceLine[] {
  const result: SourceLine[] = [];
  const re = /([^\r\n]*)(\r\n|\n|\r|$)/g;
  for (let match = re.exec(text); match && match[0]; match = re.exec(text)) {
    result.push({ from: match.index, to: match.index + match[1]!.length, text: match[1]!, number: result.length + 1 });
  }
  if (!result.length || /[\r\n]$/.test(text)) result.push({ from: text.length, to: text.length, text: '', number: result.length + 1 });
  return result;
}

function isMetadata(value: unknown): value is CodeMetadata {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CodeMetadata>;
  return data.v === 1 && typeof data.blockId === 'string' && Array.isArray(data.marks) && data.marks.every(mark =>
    mark && typeof mark.id === 'string' && (mark.kind === 'lines' || mark.kind === 'text') &&
    Number.isSafeInteger(mark.from) && Number.isSafeInteger(mark.to) && mark.from >= 0 && mark.to >= mark.from &&
    typeof mark.quote === 'string' && typeof mark.prefix === 'string' && typeof mark.suffix === 'string' &&
    typeof mark.semantic === 'string' && typeof mark.label === 'string' && colors.includes(mark.color) &&
      (mark.occurrenceCount === undefined || (Number.isSafeInteger(mark.occurrenceCount) && mark.occurrenceCount > 0)) && (mark.note === undefined || typeof mark.note === 'string'));
}

export function serializeMetadata(data: CodeMetadata): string {
  return `%%hb:${JSON.stringify(data).replaceAll('%', '\\u0025')}%%`;
}

function semanticJson(data: unknown): string {
  return JSON.stringify(data).replace(/[%|`]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function serializeInlineMetadata(data: InlineMetadata): string {
  return `%%hbi:${semanticJson(data)}%%`;
}

export function serializeProseMetadata(data: ProseMetadata): string {
  return `%%hbp:${semanticJson(data)}%%`;
}

function isProseMetadata(value: unknown): value is ProseMetadata {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ProseMetadata>;
  return data.v === 1 && typeof data.id === 'string' && data.id.length > 0 &&
    typeof data.semantic === 'string' && typeof data.label === 'string' && (data.noteRef === undefined || typeof data.noteRef === 'string' && /^hb-[A-Za-z0-9-]+$/.test(data.noteRef));
}

function isInlineMetadata(value: unknown): value is InlineMetadata {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<InlineMetadata>;
  return data.v === 1 && typeof data.id === 'string' && data.id.length > 0 &&
    colors.includes(data.color!) && typeof data.semantic === 'string' && typeof data.label === 'string' && (data.note === undefined || typeof data.note === 'string');
}

export function parseDocument(text: string): ParsedDocument {
  const tree = fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const lines = sourceLines(text);
  const result: ParsedDocument = { blocks: [], highlights: [], excluded: [], prose: [], inlines: [], footnotes: [], footnoteReferences: [] };
  trees.set(result, tree);
  if (/^---\r?\n/.test(text)) {
    const end = /\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/g;
    end.lastIndex = text.indexOf('\n') + 1;
    const match = end.exec(text);
    if (match) result.excluded.push({ from: 0, to: match.index + match[0].length });
  }

  function visit(node: Nodes): void {
    const from = node.position?.start.offset;
    const to = node.position?.end.offset;
    if (from === undefined || to === undefined) return;
    if (node.type === 'footnoteDefinition') {
      const raw = text.slice(from, to).replace(/^\[\^[^\]]+\]:[ \t]*/, '');
      const content = raw.split(/\r\n|\n|\r/).map((line, index) => index ? line.replace(/^(?: {4}|\t)/, '') : line).join('\n');
      result.footnotes.push({ id: node.identifier, text: content, span: { from, to } });
      if (node.identifier.startsWith('hb-')) { result.excluded.push({ from, to }); return; }
    }
    if (node.type === 'footnoteReference') {
      result.footnoteReferences.push({ id: node.identifier, span: { from, to } }); result.excluded.push({ from, to }); return;
    }
    if ((node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') && node.children.length) {
      const first = node.children[0]!.position!.start.offset!;
      const last = node.children.at(-1)!.position!.end.offset!;
      const firstLine = node.children[0]!.position!.start.line - 1;
      const lastLine = node.children.at(-1)!.position!.end.line - 1;
      for (let i = firstLine; i <= lastLine; i++) {
        const line = lines[i]!;
        const prefix = line.text.match(/^(?:[ \t]*>[ \t]?)+/)?.[0].length ?? 0;
        const callout = prefix ? line.text.slice(prefix).match(/^\[![^\]\r\n]+\][+-]?(?:[ \t]+|$)/)?.[0].length ?? 0 : 0;
        const start = Math.max(first, line.from + prefix + callout), end = Math.min(last, line.to);
        if (start < end) result.prose.push({ from: start, to: end });
      }
    }
    if (node.type === 'code') {
      result.excluded.push({ from, to });
      const first = lines[node.position!.start.line - 1]!;
      const opening = text.slice(from, first.to).match(/^(`{3,}|~{3,})([^\r\n]*)$/);
      if (!opening) return;
      const contentLines = node.value.split('\n');
      const last = lines[node.position!.end.line - 1]!;
      const closing = new RegExp(`^${opening[1]![0]}{${opening[1]!.length},}\\s*$`);
      const closed = closing.test(text.slice(Math.max(last.from, to - last.text.trimStart().length), to).trimStart()) ||
        closing.test(last.text.replace(/^[\s>]+/, ''));
      const available = lines.slice(first.number, closed ? last.number - 1 : last.number);
      const mapped: SourceLine[] = [];
      for (let i = 0; i < available.length; i++) {
        const raw = available[i]!;
        const value = contentLines[i] ?? '';
        const column = value ? raw.text.lastIndexOf(value) : raw.text.length;
        mapped.push({ from: raw.from + Math.max(0, column), to: raw.from + Math.max(0, column) + value.length, text: value, number: i + 1 });
      }
      const block: CodeBlock = {
        from, to, fenceFrom: from, language: node.lang ?? '', meta: node.meta ?? '', text: node.value, lines: mapped,
        prefix: text.slice(first.from, from).replace(/(?:[-+*]|\d+[.)])\s+/g, token => ' '.repeat(token.length)),
      };
      const previous = lines[first.number - 2];
      const metadataMatch = previous?.text.match(/%%hb:(.+)%%\s*$/);
      const metadataPrefix = previous?.text.slice(0, previous.text.indexOf('%%hb:')).replace(/(?:[-+*]|\d+[.)])\s+/g, token => ' '.repeat(token.length));
      if (metadataMatch && previous && metadataPrefix === block.prefix) {
        try {
          const metadata: unknown = JSON.parse(metadataMatch[1]!);
          if (isMetadata(metadata)) {
            block.metadata = metadata;
            block.metadataSpan = { from: previous.from + previous.text.indexOf('%%hb:'), to: previous.from + previous.text.lastIndexOf('%%') + 2 };
          }
        } catch { /* An incomplete metadata line remains editable source text. */ }
      }
      result.blocks.push(block);
      return;
    }
    if (node.type === 'inlineCode') {
      const ticks = text.slice(from, to).match(/^`+/)![0].length;
      const inline: ParsedDocument['inlines'][number] = { from, to, content: { from: from + ticks, to: to - ticks }, text: node.value.replace(/\r\n|\r|\n/g, ' ') };
      const comment = text.slice(to).match(/^%%hbi:(.+?)%%/);
      if (comment) {
        try {
          const metadata: unknown = JSON.parse(comment[1]!);
          if (isInlineMetadata(metadata)) {
            inline.metadata = metadata;
            inline.metadataSpan = { from: to, to: to + comment[0].length };
          }
        } catch { /* 未闭合的注释继续作为源文本编辑。 */ }
      }
      result.inlines.push(inline);
      result.excluded.push({ from, to });
      return;
    }
    if (['html', 'image'].includes(node.type)) { result.excluded.push({ from, to }); return; }
    if ('children' in node) for (const child of node.children) visit(child);
  }
  visit(tree);

  const chunks: string[] = []; let cursor = 0;
  for (const span of mergedSpans(result.excluded)) { chunks.push(text.slice(cursor, span.from), ' '.repeat(span.to - span.from)); cursor = span.to; }
  chunks.push(text.slice(cursor));
  const commentSource = chunks.join('');
  for (const match of commentSource.matchAll(/%%[\s\S]*?%%/g)) {
    result.excluded.push({ from: match.index, to: match.index + match[0].length });
  }
  const inlineSpans = new Set(result.inlines.map(inline => `${inline.from}:${inline.to}`));
  const outerExcluded = mergedSpans(result.excluded.filter(span => !inlineSpans.has(`${span.from}:${span.to}`)));
  result.inlines = result.inlines.filter(inline => !intersects(outerExcluded, inline.from, inline.to));
  const excluded = mergedSpans(result.excluded);

  for (const line of lines) {
    const matches = line.text.matchAll(/==([^=\r\n]+(?:=(?!=)[^=\r\n]*)*)==/g);
    for (const match of matches) {
      const from = line.from + match.index;
      const to = from + match[0].length;
      if (intersects(excluded, from, to)) continue;
      let slashes = 0;
      for (let p = from - 1; p >= 0 && text[p] === '\\'; p--) slashes++;
      if (slashes % 2) continue;
      const body = match[1]!;
      const color = colors.find(key => emojis[key] && body.startsWith(emojis[key])) ?? 'default';
      const content = { from: from + 2 + (emojis[color]?.length ?? 0), to: to - 2 };
      const highlight: ParsedDocument['highlights'][number] = { from, to, content, color, quote: text.slice(content.from, content.to) };
      const comment = text.slice(to).match(/^%%hbp:(.+?)%%/);
      if (comment) {
        try {
          const metadata: unknown = JSON.parse(comment[1]!);
          if (isProseMetadata(metadata)) {
            highlight.metadata = metadata;
            highlight.metadataSpan = { from: to, to: to + comment[0].length };
            const reference = text.slice(highlight.metadataSpan.to).match(/^\[\^(hb-[A-Za-z0-9-]+)\]/);
            if (reference && reference[1]!.toLowerCase() === metadata.noteRef?.toLowerCase()) highlight.footnoteSpan = { from: highlight.metadataSpan.to, to: highlight.metadataSpan.to + reference[0].length };
          }
        } catch { /* 未闭合的注释继续作为源文本编辑。 */ }
      }
      result.highlights.push(highlight);
    }
  }
  return result;
}
