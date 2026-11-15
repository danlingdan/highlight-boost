import type { InlineCode } from './domain';
import { annotationTitle } from './domain';
import { parseDocument } from './parsing';
import type { ReadingSection } from './reading-mapping';

export function inlineCodes(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('code')].filter(code => !code.closest('pre'));
}

export function inlineTargets(root: HTMLElement, text: string, sectionOf: (element: HTMLElement) => ReadingSection | null): { code: HTMLElement; inline: InlineCode }[] {
  const inlines = parseDocument(text).inlines;
  const codes = inlineCodes(root), used = new Set<InlineCode>();
  const result: { code: HTMLElement; inline: InlineCode }[] = [];
  const candidatesByCode = new Map(codes.map(code => {
    const section = sectionOf(code) ?? sectionOf(root);
    const candidates = inlines.filter(inline => {
      const first = text.slice(0, inline.from).split('\n').length - 1;
      const last = text.slice(0, inline.to).split('\n').length - 1;
      return code.textContent === inline.text && (!section || section.lineStart <= last && first <= section.lineEnd);
    });
    return [code, candidates] as const;
  }));
  for (const code of codes) {
    const candidates = candidatesByCode.get(code)!;
    const matching = codes.filter(other => candidatesByCode.get(other)!.some(candidate => candidates.includes(candidate)));
    const sameGroup = matching.every(other => {
      const otherCandidates = candidatesByCode.get(other)!;
      return otherCandidates.length === candidates.length && otherCandidates.every((candidate, index) => candidate === candidates[index]);
    });
    const inline = sameGroup && matching.length === candidates.length ? candidates[matching.indexOf(code)] : undefined;
    if (!inline || used.has(inline)) continue;
    used.add(inline);
    result.push({ code, inline });
  }
  return result;
}

const titles = new WeakMap<HTMLElement, string | null>();
export function clearInlineCode(code: HTMLElement): void {
  if (!titles.has(code)) return;
  code.classList.remove('hb-inline', 'hb-default', 'hb-red', 'hb-orange', 'hb-yellow', 'hb-green', 'hb-blue', 'hb-purple');
  const title = titles.get(code);
  if (title === null) code.removeAttribute('title');
  else code.setAttribute('title', title!);
  titles.delete(code);
}

export function renderInlineCode(code: HTMLElement, inline: InlineCode): void {
  clearInlineCode(code);
  if (!inline.metadata) return;
  titles.set(code, code.getAttribute('title'));
  code.classList.add('hb-inline', `hb-${inline.metadata.color}`);
  code.title = annotationTitle(inline.metadata.label, inline.metadata.note);
}

export function inlineExcerpt(value: string): string {
  const length = Math.max(0, ...[...value.matchAll(/`+/g)].map(match => match[0].length)) + 1;
  const ticks = '`'.repeat(length);
  const pad = value.startsWith('`') || value.endsWith('`') || (value.startsWith(' ') && value.endsWith(' ') && value.trim().length > 0) ? ' ' : '';
  return `${ticks}${pad}${value}${pad}${ticks}`;
}
