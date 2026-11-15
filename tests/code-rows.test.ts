// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { applyChanges, planHighlight } from '../src/editing';
import { presets } from '../src/domain';
import { parseDocument } from '../src/parsing';
import { clearRenderedCode, renderCode, renderedCodeText } from '../src/rendering';
import { readingTargets } from '../src/reading-mapping';

const html = '<div class="code-styler-line"><div class="code-styler-line-number">1</div><div class="code-styler-line-text"><span class="token function">run</span>();</div></div><div class="code-styler-line"><div class="code-styler-line-number">2</div><div class="code-styler-line-text"><br></div></div><div class="code-styler-line"><div class="code-styler-line-number">3</div><div class="code-styler-line-text"><span class="token function">stop</span>();</div></div>';
const source = '```js\nrun();\n\nstop();\n```';
function block() {
  let text = applyChanges(source, planHighlight(source, [{ from: source.indexOf('run'), to: source.indexOf('run') + 3 }], presets[0]!, 'lines').changes);
  text = applyChanges(text, planHighlight(text, [{ from: text.lastIndexOf('stop'), to: text.lastIndexOf('stop') + 4 }], presets[1]!).changes);
  return parseDocument(text).blocks[0]!;
}
it.each(['code-styler', 'codeblock-customizer'])('%s 源映射读取逻辑行正文，保留空行并排除行号', owner => {
  const root = document.createElement('div'); root.innerHTML = `<pre><code>${html.replaceAll('code-styler-', `${owner}-`)}</code></pre>`;
  expect(renderedCodeText(root.querySelector('code')!)).toBe('run();\n\nstop();');
  expect(readingTargets(root, source, () => null)[0]!.block.text).toBe('run();\n\nstop();');
});
it.each(['code-styler', 'codeblock-customizer'])('%s 标注和清理保留行节点、token 与事件', owner => {
  const code = document.createElement('code'); code.innerHTML = html.replaceAll('code-styler-', `${owner}-`);
  const row = code.firstElementChild!, token = code.querySelectorAll('.token')[1]!; let clicks = 0;
  token.addEventListener('click', () => { clicks++; });
  const model = block(); model.metadata!.marks.push({ ...model.metadata!.marks[0]!, id: 'overlap', color: 'green', label: 'Second' });
  renderCode(code, model);
  expect(code.firstElementChild).toBe(row); expect(row.classList.contains('hb-line')).toBe(true);
  expect(code.querySelector('.hb-text')!.textContent).toBe('stop');
  expect(code.querySelectorAll(`.${owner}-line-number`)).toHaveLength(3);
  clearRenderedCode(code);
  expect(code.firstElementChild).toBe(row); expect(code.querySelectorAll('.token')[1]).toBe(token);
  expect(row.hasAttribute('title')).toBe(false); expect(code.querySelector('.hb-line, .hb-text')).toBeNull();
  token.dispatchEvent(new MouseEvent('click')); expect(clicks).toBe(1);
  expect(renderedCodeText(code)).toBe('run();\n\nstop();');
});
it.each(['code-styler', 'codeblock-customizer'])('%s 重建行后重新标注并保留已有标题', owner => {
  const code = document.createElement('code'), markup = html.replaceAll('code-styler-', `${owner}-`); code.innerHTML = markup; const model = block();
  code.firstElementChild!.setAttribute('title', 'foreign'); renderCode(code, model); clearRenderedCode(code);
  expect(code.firstElementChild!.getAttribute('title')).toBe('foreign');
  renderCode(code, model); code.innerHTML = markup; renderCode(code, model);
  expect(code.querySelector('.hb-text')!.textContent).toBe('stop');
  expect(code.firstElementChild!.classList.contains('hb-line')).toBe(true);
});
it.each(['code-styler', 'codeblock-customizer'])('%s 序列化后的提示保持单行，完整批注保留原文', owner => {
  const root = document.createElement('div'), pre = root.appendChild(document.createElement('pre')), code = pre.appendChild(document.createElement('code'));
  code.innerHTML = html.replaceAll('code-styler-', `${owner}-`); const model = block(), note = 'line 1\nline 2 "quoted"';
  for (const mark of model.metadata!.marks) mark.note = note;
  renderCode(code, model); const serialized = code.innerHTML;
  expect(serialized.split('\n')).toHaveLength(1);
  expect(root.querySelector('.hb-note-text')!.textContent).toBe(note);
  code.innerHTML = serialized; renderCode(code, model);
  expect(renderedCodeText(code)).toBe('run();\n\nstop();');
  expect(model.metadata!.marks.every(mark => mark.note === note)).toBe(true);
});
