// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { inlineTargets, renderInlineCode, clearInlineCode } from '../src/inline-rendering';
import { planHighlight, applyChanges } from '../src/editing';
import { parseDocument } from '../src/parsing';
import { presets } from '../src/domain';

it('相同代码按来源段落分别着色，保留 token 和原有属性', () => {
  let source = '`same`\n\n`same`';
  source = applyChanges(source, planHighlight(source, [{ from: 2, to: 4 }], presets[0]!).changes);
  const second = source.lastIndexOf('`same`') + 1;
  source = applyChanges(source, planHighlight(source, [{ from: second, to: second + 4 }], presets[1]!).changes);
  const root = document.createElement('div');
  root.innerHTML = '<p><code title="原有标题"><span class="token">same</span></code></p><p><code>same</code></p>';
  const paragraphs = [...root.querySelectorAll('p')];
  const targets = inlineTargets(root, source, element => {
    const paragraph = element.closest('p');
    return paragraph ? { lineStart: paragraphs.indexOf(paragraph) * 2, lineEnd: paragraphs.indexOf(paragraph) * 2 } : null;
  });
  expect(targets).toHaveLength(2);
  for (const target of targets) renderInlineCode(target.code, target.inline);
  expect(root.querySelectorAll('.hb-yellow')).toHaveLength(1);
  expect(root.querySelectorAll('.hb-red')).toHaveLength(1);
  const first = targets[0]!.code;
  expect(first.querySelector('.token')?.textContent).toBe('same');
  clearInlineCode(first);
  expect(first.title).toBe('原有标题');
  expect(first.querySelector('.token')).not.toBeNull();
  expect(first.classList.contains('hb-inline')).toBe(false);
});

it('同段落未标记的副本参与对应，局部重复 DOM 不猜测来源', () => {
  const original = '`same` gap `same`';
  const source = applyChanges(original, planHighlight(original, [{ from: original.lastIndexOf('same'), to: original.lastIndexOf('same') + 4 }], presets[0]!).changes);
  const root = document.createElement('div');
  root.innerHTML = '<p><code>same</code> gap <code>same</code></p><pre><code>same</code></pre>';
  const targets = inlineTargets(root, source, () => null);
  expect(targets).toHaveLength(2);
  expect(targets[0]!.inline.metadata).toBeUndefined();
  expect(targets[1]!.inline.metadata?.color).toBe('yellow');
  root.innerHTML = '<code>same</code>';
  expect(inlineTargets(root, source, () => null)).toEqual([]);
});

it('移除元数据后清除阅读强调并保留代码内容', () => {
  const source = '`a==b`';
  const marked = applyChanges(source, planHighlight(source, [{ from: 2, to: 3 }], presets[0]!).changes);
  const code = document.createElement('code');
  code.textContent = 'a==b';
  renderInlineCode(code, parseDocument(marked).inlines[0]!);
  expect(code.classList.contains('hb-inline')).toBe(true);
  renderInlineCode(code, parseDocument(source).inlines[0]!);
  expect(code.className).toBe('');
  expect(code.textContent).toBe('a==b');
});

it('跨行代码的阅读区间与完整源区间相交时正确对应', () => {
  const source = '`multi\nline`';
  const marked = applyChanges(source, planHighlight(source, [{ from: 2, to: 4 }], presets[0]!).changes);
  expect(parseDocument(marked).inlines[0]?.text).toBe('multi line');
  const root = document.createElement('p');
  root.innerHTML = '<code>multi line</code>';
  expect(inlineTargets(root, marked, () => ({ lineStart: 1, lineEnd: 1 }))).toHaveLength(1);
});
