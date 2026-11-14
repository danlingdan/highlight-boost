// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyChanges, planHighlight } from '../src/editing';
import { presets } from '../src/domain';
import { parseDocument } from '../src/parsing';
import { clearRenderedCode, renderCode, renderedCodeText } from '../src/rendering';

describe('Expressive Code integration', () => {
  it('preserves native rows, token styles and copy data while decorating', () => {
    const source = '```js\nconst count = 1;\nconsole.log(count);\n```';
    const first = source.indexOf('count');
    let annotated = applyChanges(source, planHighlight(source, [{ from: first, to: first + 5 }], presets[0]!).changes);
    const last = annotated.lastIndexOf('console');
    annotated = applyChanges(annotated, planHighlight(annotated, [{ from: last, to: last + 7 }], presets[1]!, 'lines').changes);
    const block = parseDocument(annotated).blocks[0]!;
    const root = document.createElement('div'), pre = document.createElement('pre'), code = document.createElement('code');
    root.append(pre); pre.append(code);
    for (const text of block.text.split('\n')) {
      const line = document.createElement('div'); line.className = 'ec-line';
      const content = document.createElement('div'); content.className = 'code';
      const token = document.createElement('span'); token.style.setProperty('--0', 'var(--shiki-code-normal)'); token.textContent = text;
      content.append(token); line.append(content); code.append(line);
    }
    const button = document.createElement('button'); button.dataset.code = block.text; root.append(button);
    const original = code.innerHTML;
    renderCode(code, block);
    expect(renderedCodeText(code)).toBe(block.text);
    expect(code.querySelectorAll('.ec-line')).toHaveLength(2);
    expect(code.querySelectorAll('.hb-code-row')).toHaveLength(0);
    expect(code.querySelector('.hb-text')?.textContent).toBe('count');
    expect(code.querySelector('.ec-line.hb-red')?.textContent).toBe('console.log(count);');
    expect(code.querySelector('[style]')?.getAttribute('style')).toContain('--0');
    expect(button.dataset.code).toBe(block.text);
    clearRenderedCode(code);
    expect(code.innerHTML).toBe(original);
  });
});
