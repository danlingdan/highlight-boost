import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view';
import { editorInfoField, type Editor } from 'obsidian';
import { colors, type Color } from './domain';
import { composingState } from './composition';
import { selectionContext } from './selection-context';
import type HighlightBoost from './main';

export function selectionToolbar(plugin: HighlightBoost) {
  return ViewPlugin.fromClass(class {
    private element?: HTMLElement;
    private mode: 'text' | 'lines' = 'text';
    private dismissed = false;
    private executing = false;
    private disposed = false;
    private generation = 0;
    private takeFocus = false;
    private manual = false;
    private readonly reposition = () => this.refresh();
    private readonly outside = (event: Event) => {
      if (this.element && !event.composedPath().includes(this.element)) this.close(false);
    };
    private readonly escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.element) { event.preventDefault(); event.stopPropagation(); this.close(true); }
    };
    constructor(private view: EditorView) {
      plugin.toolbars.add(this);
      view.dom.ownerDocument.addEventListener('pointerdown', this.outside, true);
      view.dom.ownerDocument.addEventListener('keydown', this.escape, true);
      view.scrollDOM.addEventListener('scroll', this.reposition);
      view.dom.ownerDocument.defaultView?.addEventListener('resize', this.reposition);
    }
    update(update: ViewUpdate): void {
      if (update.selectionSet && !update.startState.selection.eq(update.state.selection)) { this.dismissed = false; if (!this.executing) this.mode = 'text'; }
      if (update.docChanged && !this.executing) { this.close(false); return; }
      if (update.selectionSet || update.focusChanged || update.geometryChanged || update.viewportChanged || update.transactions.some(t => t.effects.length)) this.refresh();
    }
    matches(editor: Editor): boolean { return this.view.state.field(editorInfoField, false)?.editor === editor; }
    open(): void { this.dismissed = false; this.manual = true; this.takeFocus = true; this.refresh(true); }
    close(focus: boolean): void {
      this.generation++; this.element?.remove(); this.element = undefined; this.dismissed = true; this.manual = false;
      if (focus) this.view.focus();
    }
    refresh(force = false): void {
      const view = this.view;
      const generation = ++this.generation;
      if (this.disposed) return;
      if (view.state.readOnly || (!force && ((!plugin.settings.selectionToolbar && !this.manual) || this.dismissed || (!view.hasFocus && !this.element?.contains(view.dom.ownerDocument.activeElement)))) || view.composing || view.state.field(composingState, false) || (!force && !this.manual && view.state.selection.ranges.every(range => range.empty))) {
        this.element?.remove(); this.element = undefined; return;
      }
      view.requestMeasure({
        key: this,
        read: () => view.coordsAtPos(view.state.selection.main.head),
        write: coords => {
          if (this.disposed || this.dismissed || generation !== this.generation) return;
          const bounds = view.scrollDOM.getBoundingClientRect();
          if (!coords || coords.bottom < bounds.top || coords.top > bounds.bottom) { this.element?.remove(); this.element = undefined; return; }
          this.render();
          const element = this.element!;
          const win = view.dom.ownerDocument.defaultView!;
          element.style.left = `${Math.max(8, Math.min(coords.left, win.innerWidth - element.offsetWidth - 8))}px`;
          const top = coords.bottom + 8 + element.offsetHeight <= win.innerHeight ? coords.bottom + 8 : coords.top - element.offsetHeight - 8;
          element.style.top = `${Math.max(8, Math.min(top, win.innerHeight - element.offsetHeight - 8))}px`;
        },
      });
    }
    private render(): void {
      const view = this.view, document = view.dom.ownerDocument;
      const activeAction = this.element?.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.hbAction : undefined;
      this.element?.remove();
      const element = document.createElement('div');
      this.element = element;
      element.className = 'hb-selection-toolbar';
      element.setAttribute('role', 'toolbar'); element.setAttribute('aria-label', plugin.t('selectionToolbar'));
      element.addEventListener('pointerdown', event => { if (event.button === 0) event.preventDefault(); });
      element.addEventListener('keydown', event => {
        const buttons = [...element.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let next: number | undefined;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + buttons.length - 1) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
      });
      const context = selectionContext(view.state.doc.toString(), view.state.selection.ranges);
      const contextLabel = context.kind === 'code' ? plugin.t('blockSelection', { block: context.block!, from: context.from!, to: context.to! }) : plugin.t(context.kind === 'mixed' ? 'mixedSelection' : context.kind === 'inline-code' ? 'inlineCode' : 'prose');
      const label = document.createElement('div'); label.className = 'hb-selection-context';
      label.textContent = plugin.t('selectionContext', { context: contextLabel, count: context.count }); element.append(label);
      const button = (id: string, text: string, run: () => void, color?: Color) => {
        const button = document.createElement('button');
        button.textContent = text; button.dataset.hbAction = id; button.setAttribute('aria-label', text);
        if (color) button.className = `hb-${color}`;
        button.addEventListener('click', () => {
          this.executing = true;
          try { run(); } finally { this.executing = false; }
          view.focus(); this.refresh(true);
        }); element.append(button); return button;
      };
      if (context.kind === 'code') for (const mode of ['text', 'lines'] as const) {
        const control = button(`mode-${mode}`, plugin.t(mode === 'text' ? 'textMode' : 'lineMode'), () => { this.mode = mode; });
        control.setAttribute('aria-pressed', String(this.mode === mode));
      }
      const editor = view.state.field(editorInfoField, false)?.editor;
      if (editor) {
        for (const preset of plugin.settings.presets) button(`preset-${preset.id}`, plugin.presetLabel(preset), () => plugin.apply(editor, plugin.presetForAction(preset.id), this.mode), preset.color);
        if (plugin.settings.recentColors.length) {
          const recent = document.createElement('span'); recent.textContent = plugin.t('recentColors'); element.append(recent);
          for (const color of plugin.settings.recentColors) button(`recent-${color}`, plugin.colorLabel(color), () => plugin.applyColor(editor, color, this.mode), color);
        }
        for (const color of colors) button(`color-${color}`, plugin.colorLabel(color), () => plugin.applyColor(editor, color, this.mode), color);
        button('remove', plugin.t('remove'), () => plugin.apply(editor, null));
      }
      const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', plugin.t('close'));
      close.dataset.hbAction = 'close'; close.addEventListener('click', () => this.close(true)); element.append(close);
      document.body.append(element);
      if (activeAction) [...element.querySelectorAll('button')].find(button => button.dataset.hbAction === activeAction)?.focus();
      else if (this.takeFocus) element.querySelector('button')?.focus();
      this.takeFocus = false;
    }
    destroy(): void {
      this.disposed = true; this.element?.remove();
      this.view.dom.ownerDocument.removeEventListener('pointerdown', this.outside, true);
      this.view.dom.ownerDocument.removeEventListener('keydown', this.escape, true);
      this.view.scrollDOM.removeEventListener('scroll', this.reposition);
      this.view.dom.ownerDocument.defaultView?.removeEventListener('resize', this.reposition);
      plugin.toolbars.delete(this);
    }
  });
}
