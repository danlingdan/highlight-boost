import { EditorState } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';
import { describe, expect, it } from 'vitest';
import { editorHistory } from '../src/history';

describe('highlight operation history', () => {
  it('keeps following input and a highlight as separate undo steps', () => {
    let state = EditorState.create({ doc: 'word', extensions: [history(), editorHistory] });
    state = state.update({ changes: { from: 0, to: 4, insert: '==word==' }, userEvent: 'highlight-boost' }).state;
    state = state.update({ changes: { from: 8, insert: '中' }, userEvent: 'input.type.compose.start' }).state;
    const dispatch = (transaction: { state: EditorState }) => { state = transaction.state; };
    undo({ state, dispatch });
    expect(state.doc.toString()).toBe('==word==');
    undo({ state, dispatch });
    expect(state.doc.toString()).toBe('word');
  });
});
