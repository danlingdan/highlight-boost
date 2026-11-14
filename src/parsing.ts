import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import type { Nodes } from 'mdast';
import { colors, emojis, type CodeBlock, type CodeMetadata, type ParsedDocument, type SourceLine } from './domain';

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
    (mark.occurrenceCount === undefined || (Number.isSafeInteger(mark.occurrenceCount) && mark.occurrenceCount > 0)));
}

export function serializeMetadata(data: CodeMetadata): string {
  return `%%hb:${JSON.stringify(data).replaceAll('%', '\\u0025')}%%`;
}

export function parseDocument(text: string): ParsedDocument {
  const tree = fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const lines = sourceLines(text);
  const result: ParsedDocument = { blocks: [], highlights: [], excluded: [], prose: [] };
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
    if ((node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') && node.children.length) {
      const first = node.children[0]!.position!.start.offset!;
      const last = node.children.at(-1)!.position!.end.offset!;
      for (const line of lines) {
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
        from, to, fenceFrom: from, language: node.lang ?? '', text: node.value, lines: mapped,
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
    if (['inlineCode', 'html', 'image'].includes(node.type)) { result.excluded.push({ from, to }); return; }
    if ('children' in node) for (const child of node.children) visit(child);
  }
  visit(tree);

  let commentSource = text;
  for (const span of [...result.excluded].sort((a, b) => b.from - a.from)) {
    commentSource = commentSource.slice(0, span.from) + ' '.repeat(span.to - span.from) + commentSource.slice(span.to);
  }
  for (const match of commentSource.matchAll(/%%[\s\S]*?%%/g)) {
    result.excluded.push({ from: match.index, to: match.index + match[0].length });
  }

  for (const line of lines) {
    const matches = line.text.matchAll(/==([^=\r\n]+(?:=(?!=)[^=\r\n]*)*)==/g);
    for (const match of matches) {
      const from = line.from + match.index;
      const to = from + match[0].length;
      if (result.excluded.some(span => span.from < to && from < span.to)) continue;
      let slashes = 0;
      for (let p = from - 1; p >= 0 && text[p] === '\\'; p--) slashes++;
      if (slashes % 2) continue;
      const body = match[1]!;
      const color = colors.find(key => emojis[key] && body.startsWith(emojis[key]!)) ?? 'default';
      const content = { from: from + 2 + (emojis[color]?.length ?? 0), to: to - 2 };
      result.highlights.push({ from, to, content, color, quote: text.slice(content.from, content.to) });
    }
  }
  return result;
}
