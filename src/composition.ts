import { StateEffect, StateField } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

export const setComposing = StateEffect.define<boolean>();
export const composingState = StateField.define<boolean>({
  create: () => false,
  update: (value, transaction) => transaction.effects.find(effect => effect.is(setComposing))?.value ?? value,
});

class CompositionLifecycle {
  private timer?: ReturnType<typeof setTimeout>;
  begin(view: EditorView): void {
    clearTimeout(this.timer);
    view.dispatch({ effects: setComposing.of(true) });
  }
  end(view: EditorView): void {
    this.timer = setTimeout(() => view.dispatch({ effects: setComposing.of(false) }), 0);
  }
  destroy(): void { clearTimeout(this.timer); }
}

export const compositionEvents = ViewPlugin.fromClass(CompositionLifecycle, {
  eventHandlers: {
    compositionstart(_event, view) { this.begin(view); },
    compositionend(_event, view) { this.end(view); },
  },
});
