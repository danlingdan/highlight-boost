import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';
import { applyChanges } from './editing';
import { parseDocument } from './parsing';
import { inlineExcerpt } from './inline-rendering';
import type { HighlightItem } from './domain';
import { translate, type Locale } from './i18n';

export interface ExcerptContext {
  headings: string[];
  heading?: string;
  blockId?: string;
  line?: number;
  endLine?: number;
  code?: string;
  contextFrom?: number;
  contextTo?: number;
}

function plainText(node: Nodes): string {
  return 'children' in node ? node.children.map(plainText).join('') : node.type === 'text' || node.type === 'inlineCode' ? node.value : node.type === 'break' ? ' ' : '';
}

export function excerptContext(text: string, item: HighlightItem): ExcerptContext { return createExcerptContext(text)(item); }

export function createExcerptContext(text: string): (item: HighlightItem) => ExcerptContext {
  const parsed = parseDocument(text), tree = fromMarkdown(text);
  return item => {
  const stack: { depth: number; title: string }[] = [];
  const position = item.blockFrom ?? item.from;
  for (const heading of tree.children) {
    if (heading.type !== 'heading' || heading.position!.start.offset! > position) continue;
    const from = heading.position!.start.offset!, to = heading.position!.end.offset!;
    if (parsed.excluded.some(span => span.from <= from && to <= span.to)) continue;
    const removals = parsed.highlights.flatMap(mark => [
      { from: mark.from, to: mark.content.from }, { from: mark.content.to, to: mark.to }, ...(mark.metadataSpan ? [mark.metadataSpan] : []), ...(mark.footnoteSpan ? [mark.footnoteSpan] : []),
    ]).concat(parsed.inlines.flatMap(inline => inline.metadataSpan ? [inline.metadataSpan] : []))
      .filter(span => from <= span.from && span.to <= to).map(span => ({ from: span.from - from, to: span.to - from, insert: '' }));
    const title = plainText(fromMarkdown(applyChanges(text.slice(from, to), removals)).children[0]!).trim();
    while (stack.length && stack.at(-1)!.depth >= heading.depth) stack.pop();
    stack.push({ depth: heading.depth, title });
  }
  const context: ExcerptContext = { headings: stack.map(heading => heading.title), heading: stack.at(-1)?.title };
  const findBlockId = (node: Nodes): void => {
    const from = node.position?.start.offset, to = node.position?.end.offset;
    if (from === undefined || to === undefined || from > item.from || to < item.to) return;
    if (node.type === 'paragraph') context.blockId = text.slice(from, to).match(/(?:^|\s)\^([A-Za-z0-9-]+)\s*$/)?.[1];
    if ('children' in node) node.children.forEach(findBlockId);
  };
  findBlockId(tree);
  if (item.kind !== 'code-line' && item.kind !== 'code-range') return context;
  const block = parsed.blocks.find(block => block.fenceFrom === item.blockFrom);
  if (!block || item.status !== 'resolved') return context;
  context.blockId = text.slice(block.to).match(/^[ \t]*\r?\n[ \t]*\^([A-Za-z0-9-]+)(?=[ \t]*(?:\r?\n|$))/)?.[1];
  const first = block.lines.findIndex(line => line.from <= item.from && item.from <= line.to);
  const last = block.lines.findIndex(line => line.from <= Math.max(item.from, item.to - 1) && Math.max(item.from, item.to - 1) <= line.to);
  if (first < 0 || last < 0) return context;
  const start = Math.max(0, first - 1), end = Math.min(block.lines.length - 1, last + 1);
  return { ...context, line: first + 1, endLine: last + 1, contextFrom: start + 1, contextTo: end + 1, code: block.lines.slice(start, end + 1).map(line => line.text).join('\n') };
  };
}

export function fencedExcerpt(value: string, language = ''): string {
  const fence = '`'.repeat(Math.max(3, ...[...value.matchAll(/`+/g)].map(match => match[0].length + 1)));
  const info = language.replace(/[\r\n`]/g, '');
  return `${fence}${info}\n${value}\n${fence}`;
}

export type ExcerptTemplate = 'markdown' | 'plain' | 'quote' | 'code';
export function formatExcerpt(item: HighlightItem, context: ExcerptContext, sourceLink: string, label: string, locale: Locale, template: ExcerptTemplate = 'markdown'): string {
  const plain = item.kind === 'prose' ? plainText(fromMarkdown(item.quote)) : item.quote;
  const quoted = item.kind === 'prose' ? plain : item.kind === 'inline-code' ? inlineExcerpt(item.quote) : fencedExcerpt(item.quote, item.language);
  const quote = template === 'plain' ? plain : template === 'quote' ? quoted.split(/\r\n|\n|\r/).map(line => `> ${line}`).join('\n') : template === 'code' ? fencedExcerpt(item.quote, item.language || 'text') : item.kind === 'prose' ? item.quote.split(/\r\n|\n|\r/).map(line => `> ${line}`).join('\n') : item.kind === 'inline-code' ? inlineExcerpt(item.quote) : fencedExcerpt(item.quote, item.language);
  const parts = [quote, translate(locale, 'excerptSource', { link: sourceLink, label })];
  if (context.headings.length) parts.push(translate(locale, 'excerptHeadings', { headings: context.headings.join(' › ') }));
  if (context.line !== undefined) parts.push(translate(locale, 'excerptLines', { language: item.language || translate(locale, 'code'), from: context.line, to: context.endLine! }));
  if (context.code !== undefined && context.code !== item.quote) parts.push(`${translate(locale, 'excerptCodeContext', { from: context.contextFrom!, to: context.contextTo! })}\n\n${template === 'plain' ? context.code : template === 'quote' ? fencedExcerpt(context.code, item.language).split('\n').map(line => `> ${line}`).join('\n') : fencedExcerpt(context.code, item.language)}`);
  if (item.status !== 'resolved') parts.push(translate(locale, 'pending'));
  if (item.note) parts.push(`${translate(locale, 'annotation')}\n\n${item.note}`);
  return parts.join('\n\n');
}
