// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readingTargets } from '../src/reading-mapping';
import { applyChanges, planHighlight } from '../src/editing';
import { presets } from '../src/domain';
import { parseDocument } from '../src/parsing';
import { renderCode } from '../src/rendering';

function fixture() {
  let source = '```js\ncount();\n```\n\n```js\ncount();\n```';
  const first = source.indexOf('count');
  source = applyChanges(source, planHighlight(source, [{ from: first, to: first + 5 }], presets[0]!).changes);
  const last = source.lastIndexOf('count');
  return applyChanges(source, planHighlight(source, [{ from: last, to: last + 5 }], presets[1]!).changes);
}
function code(root: HTMLElement) {
  const pre = root.ownerDocument.createElement('pre');
  const code = pre.appendChild(root.ownerDocument.createElement('code'));
  code.textContent = 'count();\n'; root.append(pre);
  return code;
}

describe('reading source mapping', () => {
  it('maps code rows inside Expressive Code collapsed sections', () => {
    const root = document.createElement('div');
    root.innerHTML = '<pre><code><div class="ec-line"><div class="code">one();</div></div><details><summary><div class="ec-line"><div class="code">2 collapsed lines</div></div></summary><div class="ec-line"><div class="code">two();</div></div><div class="ec-line"><div class="code">three();</div></div></details></code></pre>';
    const text = '```js collapse={2-3}\none();\ntwo();\nthree();\n```';
    expect(readingTargets(root, text, () => null)[0]?.block.text).toBe('one();\ntwo();\nthree();');
  });
  it('uses each code section to distinguish identical blocks', () => {
    const text = fixture();
    const root = document.createElement('div'); const second = code(root);
    const line = text.slice(0, parseDocument(text).blocks[1]!.fenceFrom).split('\n').length - 1;
    const targets = readingTargets(root, text, element => element === second ? { lineStart: line, lineEnd: line + 2 } : null);
    expect(targets[0]!.block.metadata!.marks[0]!.color).toBe('red');
  });
  it('maps a complete set of equal blocks in document order', () => {
    const root = document.createElement('div'); code(root); code(root);
    expect(readingTargets(root, fixture(), () => null).map(target => target.block.metadata!.marks[0]!.color)).toEqual(['yellow', 'red']);
  });
  it('leaves a partial duplicate unresolved when its source section is absent', () => {
    const root = document.createElement('div'); code(root);
    expect(readingTargets(root, fixture(), () => null)).toEqual([]);
  });
  it('reapplies changed marks and clears them on undo while retaining tokens', () => {
    const root = document.createElement('div'); const element = code(root);
    const token = document.createElement('span'); token.className = 'token function'; token.textContent = 'count';
    element.replaceChildren(token, '();\n');
    const blocks = parseDocument(fixture()).blocks;
    renderCode(element, blocks[0]!);
    expect(element.querySelector('.hb-yellow')).toBeTruthy();
    renderCode(element, blocks[1]!);
    expect(element.querySelector('.hb-red')).toBeTruthy();
    expect(element.querySelector('.hb-yellow')).toBeNull();
    renderCode(element, { ...blocks[0]!, metadata: undefined });
    expect(element.querySelector('.hb-code-row')).toBeNull();
    expect(element.querySelector('.token.function')?.textContent).toBe('count');
    expect(element.textContent).toBe('count();\n');
  });
  it('retains newly rendered code text when the source changes', () => {
    const root = document.createElement('div'); const element = code(root);
    const block = parseDocument(fixture()).blocks[0]!;
    renderCode(element, block);
    element.querySelector('.hb-code-row')!.prepend(document.createTextNode('before();'));
    renderCode(element, { ...block, text: 'before();count();' });
    expect(element.textContent).toBe('before();count();\n');
    expect(element.querySelector('.hb-text')?.textContent).toBe('count');
  });
});
