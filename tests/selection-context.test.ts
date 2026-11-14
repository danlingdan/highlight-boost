import { expect, it } from 'vitest';
import { selectionContext } from '../src/selection-context';

it('识别正文、行内代码和代码块的逻辑行范围', () => {
  const text = '正文 `inline`\n\n```js\nfirst\nsecond\n```\n';
  expect(selectionContext(text, [{ from: 0, to: 2 }])).toEqual({ kind: 'prose', count: 1 });
  expect(selectionContext(text, [{ from: text.indexOf('inline'), to: text.indexOf('inline') + 2 }]).kind).toBe('inline-code');
  expect(selectionContext(text, [{ from: text.indexOf('first'), to: text.indexOf('second') + 3 }])).toEqual({ kind: 'code', count: 1, block: 1, from: 1, to: 2 });
});

it('保留多选区计数，跨对象和跨代码块显示混合内容', () => {
  const text = 'text\n```js\nfirst\n```\n```c\nsecond\n```';
  expect(selectionContext(text, [{ from: 0, to: text.indexOf('first') + 3 }]).kind).toBe('mixed');
  expect(selectionContext(text, ['first', 'second'].map(word => ({ from: text.indexOf(word), to: text.indexOf(word) + 2 })))).toEqual({ kind: 'mixed', count: 2 });
});

it('空代码行的光标显示所属代码块与逻辑行', () => {
  const text = '```js\na\n\nb\n```', at = text.indexOf('\n\n') + 1;
  expect(selectionContext(text, [{ from: at, to: at }])).toEqual({ kind: 'code', count: 1, block: 1, from: 2, to: 2 });
});
