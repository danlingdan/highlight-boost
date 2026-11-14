// @vitest-environment jsdom
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import type { EditorView, WidgetType } from '@codemirror/view';
import { expect, it } from 'vitest';
import { createMetadataFolding, metadataLocale } from '../src/metadata-folding';
import { applyChanges, planHighlight } from '../src/editing';
import { presets } from '../src/domain';

it('切换语言重建三类按钮和无障碍标签，并保持文档原样', () => {
  const source = '正文 `inline`\n\n```js\nconst value = 1;\n```';
  const doc = applyChanges(source, planHighlight(source, [{ from: 0, to: source.length }], presets[0]!).changes);
  const live = StateField.define({ create: () => true, update: value => value });
  const folding = createMetadataFolding(live);
  const state = EditorState.create({ doc, extensions: [live, folding, metadataLocale.of('zh')] });
  const elements = (state: EditorState) => {
    const widgets: WidgetType[] = [];
    state.field(folding).between(0, state.doc.length, (_from, _to, decoration) => { widgets.push(decoration.spec.widget); });
    const view = { dom: document.body } as EditorView;
    return widgets.map(widget => widget.toDOM(view));
  };
  expect(elements(state).map(element => element.textContent)).toEqual(['正文标注', '行内标注', '代码标注 · 1 条']);
  const translated = state.update({ effects: StateEffect.reconfigure.of([live, folding, metadataLocale.of('en')]) });
  expect(translated.docChanged).toBe(false);
  expect(translated.state.doc.toString()).toBe(doc);
  expect(elements(translated.state).map(element => element.textContent)).toEqual(['Prose annotation', 'Inline annotation', 'Code annotations · 1']);
  expect(elements(translated.state).every(element => element.getAttribute('aria-label') === 'Expand annotation metadata')).toBe(true);
});
