import type { EditorState, Text } from '@codemirror/state';
import { DocumentSnapshot } from './document-snapshot';

let documents = new WeakMap<Text, DocumentSnapshot>();
export function editorDocument(state: EditorState): DocumentSnapshot {
  let snapshot = documents.get(state.doc);
  if (!snapshot) { snapshot = new DocumentSnapshot(state.doc.toString()); documents.set(state.doc, snapshot); }
  return snapshot;
}
export function clearEditorDocuments(): void { documents = new WeakMap(); }
