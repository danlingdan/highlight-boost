import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { composingState, setComposing } from '../src/composition';
import { highlightExtension } from '../src/rendering';
import { applyChanges, planHighlight } from '../src/editing';
import { presets } from '../src/domain';

describe('composition decoration lifecycle', () => {
  it('maps decorations during preedit and resolves them after commit', () => {
    const source = '```js\ncount();\n```'; const at = source.indexOf('count');
    const text = applyChanges(source, planHighlight(source, [{ from: at, to: at + 5 }], presets[0]!).changes);
    let state = EditorState.create({ doc: text, extensions: [composingState, highlightExtension] });
    state = state.update({ effects: setComposing.of(true) }).state;
    state = state.update({ changes: { from: text.lastIndexOf('count') + 2, insert: '中' } }).state;
    expect(state.field(highlightExtension).size).toBe(1);
    state = state.update({ effects: setComposing.of(false) }).state;
    expect(state.field(highlightExtension).size).toBe(0);
  });
});
