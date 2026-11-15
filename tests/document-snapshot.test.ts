import { EditorState, StateEffect } from '@codemirror/state';
import { expect, it, vi } from 'vitest';
import { DocumentSnapshot } from '../src/document-snapshot';
import { clearEditorDocuments, editorDocument } from '../src/editor-document';
import { highlightExtension } from '../src/rendering';
import { createMetadataFolding } from '../src/metadata-folding';
import { StateField } from '@codemirror/state';
import { planHighlight, applyChanges } from '../src/editing';
import { presets } from '../src/domain';
import { HighlightIndex } from '../src/vault-index';
import * as parsing from '../src/parsing';

it('快照按需解析，条目与摘录复用同一结构', () => {
  const spy = vi.spyOn(parsing, 'parseDocument');
  try {
    const snapshot = new DocumentSnapshot('# Title\n\n==word==');
    expect(spy).not.toHaveBeenCalled();
    expect(snapshot.items[0]!.quote).toBe('word');
    expect(snapshot.context(snapshot.items[0]!)).toMatchObject({ headings: ['Title'] });
    expect(snapshot.items).toBe(snapshot.items); expect(snapshot.context).toBe(snapshot.context);
    expect(spy).toHaveBeenCalledTimes(1);
  } finally { spy.mockRestore(); }
});
it('选区和重配置保留快照，内容变更及撤销使用对应文档', () => {
  let state = EditorState.create({ doc: '==first==' }); const first = editorDocument(state);
  state = state.update({ selection: { anchor: 3 } }).state; expect(editorDocument(state)).toBe(first);
  state = state.update({ effects: StateEffect.reconfigure.of([]) }).state; expect(editorDocument(state)).toBe(first);
  state = state.update({ changes: { from: 2, to: 7, insert: 'second' } }).state;
  expect(editorDocument(state)).not.toBe(first); expect(editorDocument(state).items[0]!.quote).toBe('second');
  state = state.update({ changes: { from: 2, to: 8, insert: 'first' } }).state;
  expect(editorDocument(state).items[0]!.quote).toBe('first'); expect(first.items[0]!.quote).toBe('first');
});
it('装饰、元数据、标注计划与索引共享编辑器文档解析', () => {
  const spy = vi.spyOn(parsing, 'parseDocument');
  try {
    const live = StateField.define({ create: () => true, update: value => value });
    const state = EditorState.create({ doc: '==word==\n\n```js\ntarget();\n```', extensions: [highlightExtension, live, createMetadataFolding(live)] });
    const snapshot = editorDocument(state);
    const plan = planHighlight(snapshot.text, [{ from: 2, to: 6 }], presets[0]!, 'text', snapshot.parsed);
    expect(applyChanges(snapshot.text, plan.changes)).toContain('==🟡word==');
    const index = new HighlightIndex({ paths: () => [], read: async () => '' }, () => {});
    index.set('a.md', snapshot.text, snapshot);
    expect(index.notes.get('a.md')!.items).toBe(snapshot.items);
    expect(snapshot.context(snapshot.items[0]!).headings).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1); index.dispose();
  } finally { spy.mockRestore(); }
});
it('不同编辑器内容独立，卸载清除当前缓存', () => {
  const first = EditorState.create({ doc: '==one==' }), second = EditorState.create({ doc: '==two==' });
  const snapshot = editorDocument(first);
  expect(editorDocument(second).items[0]!.quote).toBe('two');
  clearEditorDocuments(); expect(editorDocument(first)).not.toBe(snapshot);
});
it('索引忽略与当前文本不符的预计算快照', () => {
  const index = new HighlightIndex({ paths: () => [], read: async () => '' }, () => {});
  index.set('a.md', '==new==', new DocumentSnapshot('==old=='));
  expect(index.notes.get('a.md')!.items[0]!.quote).toBe('new'); index.dispose();
});
