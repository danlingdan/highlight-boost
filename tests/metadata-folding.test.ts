import { EditorState, EditorSelection, StateEffect, StateField } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { createMetadataFolding } from '../src/metadata-folding';
import { applyChanges, planHighlight } from '../src/editing';
import { presets } from '../src/domain';
import { parseDocument } from '../src/parsing';

const switchMode = StateEffect.define<boolean>();
const live = StateField.define({
  create: () => true,
  update: (value, transaction) => transaction.effects.find(effect => effect.is(switchMode))?.value ?? value,
});
const folding = createMetadataFolding(live);
function fixture() {
  const source = '```js\nconst count = 1;\n```';
  const from = source.indexOf('count');
  const doc = applyChanges(source, planHighlight(source, [{ from, to: from + 5 }], presets[0]!).changes);
  return EditorState.create({ doc, selection: EditorSelection.cursor(doc.lastIndexOf('count')), extensions: [live, folding] });
}

describe('metadata folding', () => {
  it('folds only the metadata and keeps code positions unchanged', () => {
    const state = fixture();
    const expected = parseDocument(state.doc.toString()).blocks[0]!.metadataSpan!;
    const ranges: number[][] = [];
    state.field(folding).between(0, state.doc.length, (from, to) => { ranges.push([from, to]); });
    expect(ranges).toEqual([[expected.from, expected.to]]);
  });
  it('expands when the cursor or a selection reaches the metadata', () => {
    const state = fixture();
    const expanded = state.update({ selection: { anchor: 5 } }).state;
    expect(expanded.field(folding).size).toBe(0);
    const collapsed = expanded.update({ selection: { anchor: state.doc.length } }).state;
    expect(collapsed.field(folding).size).toBe(1);
  });
  it('shows raw metadata in Source mode and restores folding in Live Preview', () => {
    const state = fixture();
    const source = state.update({ effects: switchMode.of(false) }).state;
    expect(source.field(folding).size).toBe(0);
    expect(source.update({ effects: switchMode.of(true) }).state.field(folding).size).toBe(1);
  });
});
