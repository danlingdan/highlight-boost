import { describe, expect, it } from 'vitest';
import { applyChanges, planHighlight } from '../src/editing';
import { collectItems } from '../src/anchors';
import { parseDocument, serializeMetadata } from '../src/parsing';
import { presets, type Span } from '../src/domain';

const important = presets[0]!;
const question = presets[1]!;
function mark(text: string, selection: Span, mode: 'text' | 'lines' = 'text') {
  return applyChanges(text, planHighlight(text, [selection], question, mode).changes);
}

describe('document regions', () => {
  it('distinguishes default and explicit yellow and ignores code/comments/frontmatter', () => {
    const input = '---\ntitle: ==metadata==\n---\n==plain== ==🟡yellow== `==inline==`\n%% ==comment== %%\n```js\n"==code=="\n```';
    expect(parseDocument(input).highlights.map(item => [item.color, item.quote])).toEqual([['default', 'plain'], ['yellow', 'yellow']]);
  });
  it('keeps code comment delimiters from consuming surrounding prose', () => {
    const input = '```js\nconst token = "%%";\n```\n==real==\n%%hidden%%\n==visible==';
    expect(parseDocument(input).highlights.map(item => item.quote)).toEqual(['real', 'visible']);
  });
  it.each([
    ['```c\n  memcpy(dst, src, n);\n```', 'memcpy'],
    ['> [!note]\n> ```python\n> print("hello")\n> ```', 'print'],
    ['- ```asm\n  mov rax, rbx\n  ```', 'mov'],
    ['~~~~markdown\n```js\nlet n = 1;\n```\n~~~~', 'let'],
  ])('maps logical code to the exact source: %s', (text, word) => {
    const block = parseDocument(text).blocks[0]!;
    expect(block).toBeDefined();
    expect(block.lines.map(line => text.slice(line.from, line.to)).join('\n')).toBe(block.text);
    const at = text.indexOf(word);
    const output = mark(text, { from: at, to: at + word.length });
    const reparsed = parseDocument(output).blocks[0]!;
    expect(reparsed.text).toBe(block.text);
    expect(reparsed.metadata?.marks[0]?.quote).toBe(word);
    expect(collectItems(output)[0]?.quote).toBe(word);
  });
});

describe('prose transformations', () => {
  it('preserves both sides when recoloring part of an existing highlight', () => {
    const text = '==🟡alpha beta gamma==';
    const from = text.indexOf('beta');
    const output = mark(text, { from, to: from + 4 });
    expect(output).toBe('==🟡alpha== ==🔴beta== ==🟡gamma==');
  });
  it('removes only the selected part', () => {
    const text = '==🟡alpha beta gamma==';
    const from = text.indexOf('beta');
    const output = applyChanges(text, planHighlight(text, [{ from, to: from + 4 }], null).changes);
    expect(output).toBe('==🟡alpha== beta ==🟡gamma==');
  });
  it('keeps Markdown inside selected prose', () => {
    const text = '**bold** and [[Note]]';
    expect(mark(text, { from: 0, to: text.length })).toBe('==🔴**bold** and [[Note]]==');
  });
  it('handles disjoint multi-selections without recoloring the gap', () => {
    const text = '==🟡alpha beta gamma==';
    const a = text.indexOf('alpha'), g = text.indexOf('gamma');
    const plan = planHighlight(text, [{ from: a, to: a + 5 }, { from: g, to: g + 5 }], question);
    const output = applyChanges(text, plan.changes);
    expect(parseDocument(output).highlights.map(item => [item.color, item.quote])).toEqual([
      ['red', 'alpha'], ['yellow', 'beta'], ['red', 'gamma'],
    ]);
  });
  it('is idempotent for repeated application', () => {
    const once = mark('alpha', { from: 0, to: 5 });
    const twice = mark(once, parseDocument(once).highlights[0]!.content);
    expect(twice).toBe(once);
  });
  it('keeps repeated text selections on their original logical occurrences', () => {
    const text = '==🟡same gap same==';
    const a = text.indexOf('same'), b = text.lastIndexOf('same');
    const plan = planHighlight(text, [{ from: a, to: a + 4 }, { from: b, to: b + 4 }], question);
    const output = applyChanges(text, plan.changes);
    expect(plan.selections.map(span => output.slice(span.from, span.to))).toEqual(['same', 'same']);
    expect(plan.selections[1]!.from).toBeGreaterThan(plan.selections[0]!.to);
    expect(parseDocument(output).highlights.map(item=>item.quote)).toEqual(['same', 'gap', 'same']);
  });
});

describe('code persistence and relocation', () => {
  it('handles CRLF, tab, CJK and UTF-16 selections without changing code', () => {
    const input = '```js\r\n\tconst 文本 = "😀";\r\n\r\n```';
    const from = input.indexOf('😀');
    const output = mark(input, { from, to: from + 2 });
    expect(parseDocument(output).blocks[0]!.text).toBe(parseDocument(input).blocks[0]!.text);
    expect(collectItems(output)[0]?.quote).toBe('😀');
    expect(output).toContain('%%\r\n```js');
  });
  it('relocates a unique quote after inserting a preceding line', () => {
    const input = '```c\nint x = 1;\nreturn x;\n```';
    const from = input.indexOf('return');
    const output = mark(input, { from, to: from + 6 }).replace('\nint x = 1;', '\nint y = 2;\nint x = 1;');
    const item = collectItems(output)[0]!;
    expect(item.status).toBe('resolved');
    expect(output.slice(item.from, item.to)).toBe('return');
    expect(item.line).toBe(3);
  });
  it('does not jump to an arbitrary duplicate after context is removed', () => {
    const input = '```js\nfirst(); repeat();\n```';
    const from = input.indexOf('repeat');
    const output = mark(input, { from, to: from + 6 }).replace('first(); repeat();', 'repeat();\nrepeat();');
    expect(collectItems(output)[0]?.status).toBe('ambiguous');
  });
  it('sets exact whole-line bounds and can remove the mark', () => {
    const input = '```c\nint x = 1;\nreturn x;\n```';
    const from = input.indexOf('x =');
    const output = mark(input, { from, to: from + 1 }, 'lines');
    expect(collectItems(output)[0]?.quote).toBe('int x = 1;');
    const at = output.lastIndexOf('int x');
    const removed = applyChanges(output, planHighlight(output, [{ from: at, to: at + 4 }], null).changes);
    expect(parseDocument(removed).blocks[0]?.metadata).toBeUndefined();
    expect(parseDocument(removed).blocks[0]?.text).toBe(parseDocument(input).blocks[0]?.text);
  });
  it('escapes comment delimiters in serialized quotes', () => {
    const serialized = serializeMetadata({ v: 1, blockId: 'test', marks: [{
      id: 'mark', kind: 'text', from: 0, to: 2, quote: '%%', prefix: '', suffix: '',
      color: important.color, semantic: important.id, label: important.name,
    }] });
    expect(serialized.match(/%%/g)).toHaveLength(2);
    expect(JSON.parse(serialized.slice(5, -2)).marks[0].quote).toBe('%%');
  });
  it('marks an empty code line at an empty cursor', () => {
    const input = '```python\nfirst()\n\nlast()\n```';
    const at = input.indexOf('\n\n') + 1;
    const output = mark(input, { from: at, to: at }, 'lines');
    const item = collectItems(output)[0]!;
    expect(item.status).toBe('resolved');
    expect(item.line).toBe(2);
    expect(item.quote).toBe('');
  });
});
