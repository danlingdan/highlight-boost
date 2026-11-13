import { EditorState, Transaction } from '@codemirror/state';
import { isolateHistory } from '@codemirror/commands';

export const editorHistory = EditorState.transactionExtender.of(transaction => {
  if (transaction.docChanged && !transaction.effects.length && transaction.startState.doc.eq(transaction.newDoc)) {
    return { annotations: Transaction.addToHistory.of(false) };
  }
  if (transaction.isUserEvent('highlight-boost')) return { annotations: isolateHistory.of('full') };
  return null;
});
