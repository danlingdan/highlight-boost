// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../src/parsing';
import { applyChanges, planHighlight } from '../src/editing';
import { presets } from '../src/domain';
import { clearRenderedCode, renderCode } from '../src/rendering';
import { planNote } from '../src/notes';
import { collectItems } from '../src/anchors';

describe('reading view code decorations', () => {
  it('批注独立于代码显示，可展开且重复渲染和清理不改变复制内容', () => {
    const source = '```js\nconst value = 1;\n```', from = source.indexOf('value');
    let text = applyChanges(source, planHighlight(source, [{ from, to: from + 5 }], presets[0]!).changes);
    text = applyChanges(text, planNote(text, collectItems(text)[0]!, '<b>literal</b>\n说明').changes);
    const root = document.createElement('div'), pre = document.createElement('pre'), code = document.createElement('code');
    code.textContent = 'const value = 1;\n'; pre.append(code); root.append(pre);
    const block = parseDocument(text).blocks[0]!;
    renderCode(code, block, 'en');
    const details = root.querySelector('details')!; details.open = true;
    expect(root.querySelector('.hb-code-notes')?.getAttribute('aria-label')).toBe('Annotation');
    expect(root.querySelector('.hb-note-text')?.textContent).toBe('<b>literal</b>\n说明');
    expect(root.querySelector('b')).toBeNull();
    renderCode(code, block, 'en');
    expect(root.querySelectorAll('details')).toHaveLength(1); expect(root.querySelector('details')).toBe(details);
    expect(details.open).toBe(true); expect(code.textContent).toBe('const value = 1;\n');
    clearRenderedCode(code);
    expect(root.querySelector('.hb-code-notes')).toBeNull(); expect(code.textContent).toBe('const value = 1;\n');
  });
  it('preserves Prism tokens and the exact code text across token boundaries', () => {
    const source = '```js\nconst value = "hello";\nreturn value;\n```';
    const start = source.indexOf('value =');
    const output = applyChanges(source, planHighlight(source, [{ from: start, to: start + 15 }], presets[1]!).changes);
    const code = document.createElement('code');
    const keyword = document.createElement('span'); keyword.className = 'token keyword'; keyword.textContent = 'const';
    const string = document.createElement('span'); string.className = 'token string'; string.textContent = '"hello"';
    code.append(keyword, ' value = ', string, ';\nreturn value;\n');
    const original = code.textContent;
    renderCode(code, parseDocument(output).blocks[0]!);
    expect(code.textContent).toBe(original);
    expect(code.querySelector('.token.keyword')?.textContent).toBe('const');
    expect(code.querySelector('.token.string .hb-text')?.textContent).toBe('"hello"');
    expect(code.querySelectorAll('.hb-text').length).toBeGreaterThan(1);
    const html = code.innerHTML;
    renderCode(code, parseDocument(output).blocks[0]!);
    expect(code.innerHTML).toBe(html);
  });
  it('splits a multiline token while keeping line marks and blank lines', () => {
    const source = '```js\n/* hello\n\nworld */\n```';
    const start = source.indexOf('world');
    const output = applyChanges(source, planHighlight(source, [{ from: start, to: start + 5 }], presets[0]!, 'lines').changes);
    const code = document.createElement('code');
    const token = document.createElement('span'); token.className = 'token comment'; token.textContent = '/* hello\n\nworld */';
    code.append(token, '\n');
    renderCode(code, parseDocument(output).blocks[0]!);
    expect(code.textContent).toBe('/* hello\n\nworld */\n');
    expect(code.querySelectorAll('.token.comment')).toHaveLength(3);
    expect(code.querySelector('.hb-line')?.getAttribute('data-hb-line')).toBe('3');
  });
});
