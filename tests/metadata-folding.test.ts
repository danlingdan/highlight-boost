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
  it('正文语义只折叠相邻注释并保留原生高亮', () => {
    const source = '正文';
    const doc = applyChanges(source, planHighlight(source, [{ from: 0, to: 2 }], presets[0]!).changes);
    const highlight = parseDocument(doc).highlights[0]!;
    const state = EditorState.create({ doc, selection: EditorSelection.cursor(highlight.content.from), extensions: [live, folding] });
    const ranges: number[][] = [];
    state.field(folding).between(0, state.doc.length, (from, to) => { ranges.push([from, to]); });
    expect(ranges).toEqual([[highlight.metadataSpan!.from, highlight.metadataSpan!.to]]);
    expect(state.update({ effects: switchMode.of(false) }).state.field(folding).size).toBe(0);
  });
  it('将行内元数据单独折叠，保留代码内容范围', () => {
    const source = '前文 `a==b` 后文';
    const doc = applyChanges(source, planHighlight(source, [{ from: source.indexOf('a==b'), to: source.indexOf('a==b') + 1 }], presets[0]!).changes);
    const inline = parseDocument(doc).inlines[0]!;
    const state = EditorState.create({ doc, selection: EditorSelection.cursor(inline.content.from), extensions: [live, folding] });
    const ranges: number[][] = [];
    state.field(folding).between(0, state.doc.length, (from, to) => { ranges.push([from, to]); });
    expect(ranges).toEqual([[inline.metadataSpan!.from, inline.metadataSpan!.to]]);
    const expanded = state.update({ selection: { anchor: inline.metadataSpan!.from + 2 } }).state;
    expect(expanded.field(folding).size).toBe(0);
  });
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
