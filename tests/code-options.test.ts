import { EditorState } from '@codemirror/state';
import { codeFolding, foldEffect, foldedRanges } from '@codemirror/language';
import { expect, it } from 'vitest';
import { codeDisplayKey, codeOptions, defaultCodeDisplay, diffAfter, diffKinds, normalizeCodeDisplay, unfoldSelectedCode } from '../src/code-options';
import { parseDocument } from '../src/parsing';

it('校验展示选项和显示行号，重复规范化保持一致', () => {
  const result = normalizeCodeDisplay({ showTitle: true, startLine: -2, numberFont: 'bad', diff: false });
  expect(result).toEqual({ ...defaultCodeDisplay, showTitle: true, diff: false });
  expect(normalizeCodeDisplay(result)).toEqual(result);
  expect(normalizeCodeDisplay({ startLine: 42 }).startLine).toBe(42);
});
it('围栏标题、显式关闭行号、起始行和换行覆盖默认值', () => {
  const block = parseDocument('```js title="src/my file.js" showLineNumbers=false startLineNumber=20 wrap hb-collapsed\nx();\n```').blocks[0]!;
  expect(codeOptions(block, { ...defaultCodeDisplay, showLineNumbers: true })).toMatchObject({ title: 'src/my file.js', showTitle: true, showLineNumbers: false, startLine: 20, wrap: true, collapsible: true, collapseByDefault: true });
});
it('简洁 diff 保留原始前缀，变更后片段移除删除行和一个前缀', () => {
  const code = '-old();\n+new();\n context();\n+++counter;\n---counter;';
  expect(diffKinds(code)).toEqual(['delete', 'insert', 'context', 'insert', 'delete']);
  expect(diffAfter(code)).toBe('new();\ncontext();\n++counter;');
});
it('统一 diff 跳过文件和区块头，保留区块中类似头部的实际代码', () => {
  const code = 'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1,2 +1,2 @@\n--- comment\n+++ comment\n same\n\\ No newline at end of file';
  expect(diffAfter(code)).toBe('++ comment\nsame');
  expect(diffKinds(code).slice(4, 7)).toEqual(['delete', 'insert', 'context']);
});
it('多个文件和空白代码片段按差异块顺序复制', () => {
  const code = '--- a/a\n+++ b/a\n@@ -0,0 +1,1 @@\n+first\n--- a/b\n+++ b/b\n@@ -1,1 +1,2 @@\n same\n+\n';
  expect(diffAfter(code)).toBe('first\nsame\n\n');
});
it('有身份的块在源偏移变化后保留会话键，副本各自独立', () => {
  const block = parseDocument('```js\nx();\n```').blocks[0]!;
  block.metadata = { v: 1, blockId: 'one', marks: [] };
  const moved = { ...block, fenceFrom: block.fenceFrom + 10 };
  expect(codeDisplayKey('a.md', block, [block])).toBe(codeDisplayKey('a.md', moved, [moved]));
  expect(codeDisplayKey('a.md', block, [block, moved])).not.toBe(codeDisplayKey('a.md', moved, [block, moved]));
});
it('选中折叠区内目标时展开，源文和撤销内容不变', () => {
  const doc = '```js\nfirst();\nlast();\n```';
  let state = EditorState.create({ doc, extensions: [codeFolding(), unfoldSelectedCode] });
  state = state.update({ effects: foldEffect.of({ from: 5, to: doc.length - 3 }) }).state;
  expect(foldedRanges(state).size).toBe(1);
  state = state.update({ selection: { anchor: doc.indexOf('last') } }).state;
  expect(foldedRanges(state).size).toBe(0); expect(state.doc.toString()).toBe(doc);
});
