import { StateEffect, StateField } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

export const setComposing = StateEffect.define<boolean>();
export const composingState = StateField.define<boolean>({
  create: () => false,
  update: (value, transaction) => transaction.effects.find(effect => effect.is(setComposing))?.value ?? value,
});

class CompositionLifecycle {
  private timer?: number;
  private timerWindow?: Window;
  private cancel(): void { this.timerWindow?.clearTimeout(this.timer); this.timer = undefined; }
  begin(view: EditorView): void {
    this.cancel();
    view.dispatch({ effects: setComposing.of(true) });
  }
  end(view: EditorView): void {
    this.cancel();
    const window = view.dom.ownerDocument.defaultView!; this.timerWindow = window;
    this.timer = window.setTimeout(() => view.dispatch({ effects: setComposing.of(false) }), 0);
  }
  destroy(): void { this.cancel(); }
}

export const compositionEvents = ViewPlugin.fromClass(CompositionLifecycle, {
  eventHandlers: {
    compositionstart(_event, view) { this.begin(view); },
    compositionend(_event, view) { this.end(view); },
  },
});
