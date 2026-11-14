// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { clearRenderedCode, renderCode, renderedCodeText } from '../src/rendering';
import { renderCodeDisplay } from '../src/code-display';
import { defaultCodeDisplay } from '../src/code-options';
import { parseDocument } from '../src/parsing';

it('折叠、标题、行号和复制独立于代码字符，重复更新保留状态并可清理', async () => {
  const block = parseDocument('```js title="<file>.js"\n\tfirst();\n\nlast();\n```').blocks[0]!;
  const root = document.createElement('div'), pre = document.createElement('pre'), code = document.createElement('code'); code.textContent = block.text + '\n'; pre.append(code); root.append(pre);
  const options = { ...defaultCodeDisplay, showLineNumbers: true, startLine: 10, collapsible: true, collapseByDefault: true }, sessions = new Map<string, boolean>();
  renderCode(code, block, 'en', true); renderCodeDisplay(code, block, options, 'en', sessions, 'one');
  expect(root.querySelector('.hb-code-title')?.textContent).toBe('<file>.js'); expect(root.querySelector('file')).toBeNull();
  expect(root.querySelector<HTMLElement>('.hb-code-body')?.hidden).toBe(true);
  expect([...code.querySelectorAll('[data-hb-number]')].map(row => row.getAttribute('data-hb-number'))).toEqual(['10', '11', '12']);
  (root.querySelector('[data-hb-display-action="toggle"]') as HTMLButtonElement).click();
  expect(sessions.get('one')).toBe(false); expect(root.querySelector<HTMLElement>('.hb-code-body')?.hidden).toBe(false);
  const write = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
  (root.querySelector('[data-hb-display-action="copy"]') as HTMLButtonElement).click(); await Promise.resolve(); await Promise.resolve();
  expect(write).toHaveBeenCalledWith(block.text); expect(code.textContent).toBe(block.text + '\n');
  renderCodeDisplay(code, block, options, 'en', sessions, 'one'); expect(root.querySelectorAll('.hb-code-display')).toHaveLength(1);
  clearRenderedCode(code); expect(root.querySelector('.hb-code-display')).toBeNull(); expect(root.querySelector('pre')).toBe(pre); expect(code.textContent).toBe(block.text + '\n');
});
it('无标注代码重复刷新保留展示外框和展开状态', () => {
  const block = parseDocument('```js title="plain.js" showLineNumbers=false\none();\n```').blocks[0]!;
  const root = document.createElement('div'); root.innerHTML = '<pre><code>one();</code></pre>';
  const code = root.querySelector('code')!, sessions = new Map<string, boolean>();
  renderCode(code, block); renderCodeDisplay(code, block, defaultCodeDisplay, 'zh', sessions, 'plain');
  const wrapper = root.querySelector('.hb-code-display');
  renderCode(code, block); renderCodeDisplay(code, block, defaultCodeDisplay, 'zh', sessions, 'plain');
  expect(root.querySelector('.hb-code-display')).toBe(wrapper);
});
it('围栏行强调与人工标注共存，参数变化后清理旧强调', () => {
  const block = parseDocument('```js hl:2\none();\ntwo();\n```').blocks[0]!;
  const root = document.createElement('div'); root.innerHTML = '<pre><code>one();\ntwo();</code></pre>';
  const code = root.querySelector('code')!, sessions = new Map<string, boolean>();
  renderCode(code, block, 'zh', true); renderCodeDisplay(code, block, defaultCodeDisplay, 'zh', sessions, 'params');
  expect(root.querySelector('[data-hb-param="mark"]')?.textContent).toBe('two();');
  renderCodeDisplay(code, { ...block, meta: 'hl:1' }, defaultCodeDisplay, 'zh', sessions, 'params');
  expect(root.querySelectorAll('[data-hb-param]')).toHaveLength(1);
  expect(root.querySelector('[data-hb-param="mark"]')?.textContent).toBe('one();');
  clearRenderedCode(code); expect(root.querySelector('[data-hb-param]')).toBeNull(); expect(code.textContent).toBe(block.text);
});
it('diff 增删背景保留原始代码，复制两种内容并保留行号', async () => {
  const block = parseDocument('```diff\n-old\n+new\n same\n```').blocks[0]!;
  const root = document.createElement('div'), pre = document.createElement('pre'), code = document.createElement('code'); code.textContent = block.text; pre.append(code); root.append(pre);
  renderCode(code, block, 'zh', true); renderCodeDisplay(code, block, { ...defaultCodeDisplay, showLineNumbers: true }, 'zh', new Map(), 'one');
  expect([...code.querySelectorAll('[data-hb-diff]')].map(row => row.getAttribute('data-hb-diff'))).toEqual(['delete', 'insert', 'context']);
  const write = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
  (root.querySelector('[data-hb-display-action="copy-after"]') as HTMLButtonElement).click(); await Promise.resolve(); await Promise.resolve();
  expect(write).toHaveBeenCalledWith('new\nsame'); expect(renderedCodeText(code)).toBe(block.text);
});
