import type { CodeBlock } from './domain';
import { parseDocument } from './parsing';
import { renderedCodeText } from './rendering';

export interface ReadingSection { lineStart: number; lineEnd: number }

export function readingTargets(root: HTMLElement, text: string, sectionOf: (element: HTMLElement) => ReadingSection | null): { code: HTMLElement; block: CodeBlock }[] {
  const blocks = parseDocument(text).blocks;
  const codes = [...root.querySelectorAll<HTMLElement>('pre > code')];
  const result: { code: HTMLElement; block: CodeBlock }[] = [];
  const used = new Set<CodeBlock>();
  for (const code of codes) {
    const value = renderedCodeText(code);
    const section = sectionOf(code) ?? sectionOf(root);
    const candidates = blocks.filter(block => {
      const line = text.slice(0, block.fenceFrom).split('\n').length - 1;
      return (!section || (section.lineStart <= line && line <= section.lineEnd)) && (value === block.text || value === `${block.text}\n`);
    });
    let block: CodeBlock | undefined;
    if (candidates.length === 1) block = candidates[0];
    else {
      const matching = codes.filter(other => renderedCodeText(other) === value);
      if (matching.length === candidates.length) block = candidates[matching.indexOf(code)];
    }
    if (!block || used.has(block)) continue;
    used.add(block);
    result.push({ code, block });
  }
  return result;
}
