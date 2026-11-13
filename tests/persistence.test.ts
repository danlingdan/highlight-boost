import { describe, expect, it } from 'vitest';
import { collectItems } from '../src/anchors';
import { applyChanges, planHighlight } from '../src/editing';
import { parseDocument } from '../src/parsing';
import { presets } from '../src/domain';

function annotate(text: string, word: string) {
  const from = text.lastIndexOf(word);
  return applyChanges(text, planHighlight(text, [{ from, to: from + word.length }], presets[0]!).changes);
}

describe('persistent block identity', () => {
  it('assigns fresh IDs when editing a copied block and retains the original', () => {
    const original = annotate('```js\nconst count = 1;\n```', 'count');
    const copy = `${original}\n\n${original}`;
    const items = collectItems(copy);
    expect(new Set(items.map(item => item.id)).size).toBe(2);
    const updated = annotate(copy, 'count');
    const blocks = parseDocument(updated).blocks;
    expect(updated.startsWith(original)).toBe(true);
    expect(blocks[0]!.metadata!.blockId).not.toBe(blocks[1]!.metadata!.blockId);
    expect(blocks[0]!.metadata!.marks[0]!.id).not.toBe(blocks[1]!.metadata!.marks[0]!.id);
    expect(blocks.map(block => block.text)).toEqual(['const count = 1;', 'const count = 1;']);
  });

  it('does not associate a quote-container annotation with an unrelated top-level block', () => {
    const annotated = annotate('```js\ncount();\n```', 'count');
    const lines = annotated.split('\n');
    lines[0] = `> ${lines[0]}`;
    expect(parseDocument(lines.join('\n')).blocks[0]!.metadata).toBeUndefined();
  });

  it('does not relocate to the surviving duplicate after its original context is removed', () => {
    const annotated = annotate('```js\nleft(); count();\nright(); count();\n```', 'count');
    const updated = annotated.replace('\nright(); count();', '\nother();');
    expect(collectItems(updated)[0]!.status).toBe('ambiguous');
  });

  it('continues resolving a duplicate when one of its contexts identifies it', () => {
    const annotated = annotate('```js\nleft(); count();\nright(); count();\n```', 'count');
    expect(collectItems(annotated)[0]!.status).toBe('resolved');
  });
});
