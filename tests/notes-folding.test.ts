// @vitest-environment jsdom
import { EditorState, StateField } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { collectItems } from '../src/anchors';
import { applyChanges } from '../src/editing';
import { planNote } from '../src/notes';
import { parseDocument } from '../src/parsing';
import { createMetadataFolding, metadataLocale } from '../src/metadata-folding';

it('Live Preview 将正文元数据连同脚注引用收起，并以摘要替换脚注定义；选中后展开', () => {
  const source = '==word==', text = applyChanges(source, planNote(source, collectItems(source)[0]!, '说明\n第二行').changes);
  const live = StateField.define({ create: () => true, update: value => value }), folding = createMetadataFolding(live);
  const state = EditorState.create({ doc: text, extensions: [live, folding, metadataLocale.of('en')] });
  const elements: HTMLElement[] = [], spans: { from: number; to: number }[] = [];
  state.field(folding).between(0, text.length, (from, to, decoration) => { spans.push({ from, to }); elements.push(decoration.spec.widget.toDOM({ dom: document.body } as EditorView)); });
  expect(elements.map(element => element.textContent)).toEqual(['Prose annotation · 🗨', 'Footnote · 说明\n第二行']);
  expect(elements.some(element => element.textContent?.includes('hb-'))).toBe(false);
  const parsed = parseDocument(text);
  expect(spans[0]!.to).toBe(parsed.highlights[0]!.footnoteSpan!.to);
  const selected = state.update({ selection: { anchor: parsed.footnotes[0]!.span.from } }).state;
  let count = 0; selected.field(folding).between(0, text.length, () => { count++; });
  expect(count).toBe(1); expect(selected.doc.toString()).toBe(text);
});
