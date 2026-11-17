import { detachedEl } from './dom';
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view';
import { editorInfoField, MarkdownView, type Editor } from 'obsidian';
import { colors, overlaps, type Color, type Preset } from './domain';
import { composingState } from './composition';
import { selectionContext } from './selection-context';
import type HighlightBoost from './main';
import { annotate, chooseCollection, chooseTarget } from './item-actions';
import { editorDocument } from './editor-document';

export function selectionToolbar(plugin: HighlightBoost) {
  return ViewPlugin.fromClass(class {
    private element?: HTMLElement;
    private owner?: Document;
    private palette = false;
    private mode: 'text' | 'lines' = 'text';
    private dismissed = false;
    private executing = false;
    private disposed = false;
    private generation = 0;
    private takeFocus = false;
    private manual = false;
    private renderKey = '';
    private frame?: number;
    private frameWindow?: Window;
    private readonly reposition = () => this.refresh();
    private readonly pagehide = () => this.destroy();
    private readonly outside = (event: Event) => {
      if (this.element && !event.composedPath().includes(this.element)) this.close(false);
    };
    private readonly modalClose = (event: Event) => { if (event.target === this.view.contentDOM) { this.dismissed = false; this.manual = true; this.view.focus(); this.refresh(true); } };
    private readonly escape = (event: KeyboardEvent) => {
      const target = event.target as Node | null;
      const ownsFocus = target && (this.view.dom.contains(target) || this.element?.contains(target));
      if (!event.defaultPrevented && event.key === 'Escape' && this.element && ownsFocus && !this.view.dom.ownerDocument.querySelector('.menu, .modal-container')) { event.preventDefault(); event.stopPropagation(); this.close(true); }
    };
    constructor(private view: EditorView) {
      plugin.toolbars.add(this);
      this.bindDocument();
      view.scrollDOM.addEventListener('scroll', this.reposition);
    }
    private unbindDocument(): void {
      this.owner?.removeEventListener('pointerdown', this.outside, true);
      this.owner?.removeEventListener('keydown', this.escape, true);
      this.owner?.removeEventListener('hb-modal-close', this.modalClose);
      this.owner?.defaultView?.removeEventListener('resize', this.reposition);
      this.owner?.defaultView?.removeEventListener('pagehide', this.pagehide);
      this.owner = undefined;
    }
    private bindDocument(): void {
      const document = this.view.dom.ownerDocument; if (this.owner === document) return;
      this.unbindDocument(); this.owner = document;
      document.addEventListener('pointerdown', this.outside, true);
      document.addEventListener('keydown', this.escape, true);
      document.addEventListener('hb-modal-close', this.modalClose);
      document.defaultView?.addEventListener('resize', this.reposition);
      document.defaultView?.addEventListener('pagehide', this.pagehide, { once: true });
    }
    update(update: ViewUpdate): void {
      if (update.selectionSet && !update.startState.selection.eq(update.state.selection)) { this.dismissed = false; if (!this.executing) this.mode = 'text'; }
      if (update.docChanged && !this.executing) { this.close(false); return; }
      if (update.selectionSet || update.focusChanged || update.geometryChanged || update.viewportChanged || update.transactions.some(t => t.effects.length)) this.refresh();
    }
    matches(editor: Editor): boolean { return this.view.state.field(editorInfoField, false)?.editor === editor; }
    open(): void { this.dismissed = false; this.manual = true; this.takeFocus = true; this.refresh(true); }
    close(focus: boolean): void {
      this.cancelFrame();
      this.generation++; this.element?.remove(); this.element = undefined; this.dismissed = true; this.manual = false;
      if (focus) this.view.focus();
    }
    refresh(force = false): void {
      const view = this.view;
      this.generation++;
      if (this.disposed) return;
      this.bindDocument();
      if (view.state.readOnly || (!force && ((!plugin.settings.selectionToolbar && !this.manual) || this.dismissed || (!view.hasFocus && !this.element?.contains(view.dom.ownerDocument.activeElement)))) || view.composing || view.state.field(composingState, false) || (!force && !this.manual && view.state.selection.ranges.every(range => range.empty))) {
        this.cancelFrame(); this.element?.remove(); this.element = undefined; return;
      }
      const win = view.dom.ownerDocument.defaultView!;
      if (this.frame !== undefined && this.frameWindow === win) return;
      this.cancelFrame(); this.frameWindow = win;
      this.frame = win.requestAnimationFrame(() => {
        this.frame = undefined; this.frameWindow = undefined;
        if (this.disposed || this.dismissed) return;
        this.render();
        const element = this.element!, generation = this.generation;
        view.requestMeasure({
          key: this,
          read: () => ({ coords: view.coordsAtPos(view.state.selection.main.head), bounds: view.scrollDOM.getBoundingClientRect(), width: element.offsetWidth, height: element.offsetHeight, viewportWidth: win.innerWidth, viewportHeight: win.innerHeight }),
          write: ({ coords, bounds, width, height, viewportWidth, viewportHeight }) => {
            if (this.disposed || this.dismissed || generation !== this.generation || this.element !== element) return;
            if (!coords || coords.bottom < bounds.top || coords.top > bounds.bottom) { element.remove(); this.element = undefined; return; }
            const left = Math.max(8, Math.min(coords.left, viewportWidth - width - 8));
            const top = coords.bottom + 8 + height <= viewportHeight ? coords.bottom + 8 : coords.top - height - 8;
            element.setCssStyles({ left: `${left}px`, top: `${Math.max(8, Math.min(top, viewportHeight - height - 8))}px` });
            element.addClass('hb-selection-positioned');
          },
        });
      });
    }
    private cancelFrame(): void {
      if (this.frame !== undefined) this.frameWindow?.cancelAnimationFrame(this.frame);
      this.frame = undefined; this.frameWindow = undefined;
    }
    private render(): void {
      const view = this.view, document = view.dom.ownerDocument;
      const context = selectionContext(view.state.doc.toString(), view.state.selection.ranges, editorDocument(view.state).parsed);
      const contextLabel = context.kind === 'code' ? plugin.t('blockSelection', { block: context.block!, from: context.from!, to: context.to! }) : plugin.t(context.kind === 'mixed' ? 'mixedSelection' : context.kind === 'inline-code' ? 'inlineCode' : 'prose');
      const editor = view.state.field(editorInfoField, false)?.editor;
      const text = view.state.doc.toString();
      const path = view.state.field(editorInfoField, false)?.file?.path;
      const selected = editorDocument(view.state).items.filter(item => item.status === 'resolved' && view.state.selection.ranges.some(range => range.empty ? item.from <= range.from && range.from <= item.to : overlaps(item, range)));
      const overlapping = selected.some((item, index) => selected.slice(index + 1).some(other => overlaps(item, other)));
      const renderKey = JSON.stringify({ selected, palette: this.palette, context, contextLabel, mode: this.mode, locale: plugin.locale, presets: plugin.settings.presets, recentColors: plugin.settings.recentColors });
      if (this.element?.isConnected && this.element.ownerDocument === document && renderKey === this.renderKey) {
        if (this.takeFocus) this.element.querySelector('button')?.focus();
        this.takeFocus = false; return;
      }
      this.renderKey = renderKey;
      const activeAction = this.element?.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.hbAction : undefined;
      this.element?.remove();
      const element = detachedEl(document, 'div');
      this.element = element;
      element.className = 'hb-selection-toolbar';
      element.setAttribute('role', 'toolbar'); element.setAttribute('aria-label', plugin.t('selectionToolbar'));
      element.addEventListener('pointerdown', event => { if (event.button === 0) event.preventDefault(); });
      element.addEventListener('keydown', event => {
        if (event.isComposing || view.composing) return;
        const buttons = [...element.querySelectorAll('button')].filter(button => !button.closest('[hidden]'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let next: number | undefined;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + buttons.length - 1) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
      });
      const label = detachedEl(document, 'div'); label.className = 'hb-selection-context';
      label.textContent = plugin.t(context.count === 1 ? 'selectionContextOne' : 'selectionContext', { context: contextLabel, count: context.count }); element.append(label);
      const button = (id: string, text: string, run: () => void, color?: Color) => {
        const button = detachedEl(document, 'button');
        button.textContent = text; button.dataset.hbAction = id; button.setAttribute('aria-label', text);
        if (color) button.className = `hb-${color}`;
        button.addEventListener('click', () => {
          this.executing = true;
          try { run(); } finally { this.executing = false; }
          if (!this.dismissed) { if (id === 'palette' || id.startsWith('mode-')) button.focus(); else view.focus(); this.refresh(true); } else this.element?.remove();
        }); element.append(button); return button;
      };
      if (context.kind === 'code') for (const mode of ['text', 'lines'] as const) {
        const control = button(`mode-${mode}`, plugin.t(mode === 'text' ? 'textMode' : 'lineMode'), () => { this.mode = mode; });
        control.setAttribute('aria-pressed', String(this.mode === mode));
      }
      if (editor) {
        const apply = (preset: Preset) => {
          if (overlapping && view.state.selection.ranges.length === 1 && path) {
            this.dismissed = true; this.manual = false;
            chooseTarget(plugin, selected.map(item => ({ path, text, item })), hit => plugin.updateItem(editor, hit.item, preset), view.contentDOM);
          } else plugin.apply(editor, preset, this.mode);
        };
        const recolor = (color: Color) => {
          if (overlapping && view.state.selection.ranges.length === 1 && path) {
            this.dismissed = true; this.manual = false;
            chooseTarget(plugin, selected.map(item => ({ path, text, item })), hit => plugin.updateItem(editor, hit.item, { id: hit.item.semantic ?? `color:${color}`, name: hit.item.label, color }), view.contentDOM);
          } else plugin.applyColor(editor, color, this.mode);
        };
        for (const preset of plugin.settings.presets) button(`preset-${preset.id}`, plugin.presetLabel(preset), () => apply(plugin.presetForAction(preset.id)), preset.color);
        const paletteButton = button('palette', plugin.t('chooseColor'), () => { this.palette = !this.palette; }); paletteButton.setAttribute('aria-expanded', String(this.palette));
        const paletteStart = element.childElementCount;
        if (plugin.settings.recentColors.length) {
          const recent = detachedEl(document, 'span'); recent.textContent = plugin.t('recentColors'); element.append(recent);
          for (const color of plugin.settings.recentColors) button(`recent-${color}`, plugin.colorLabel(color), () => recolor(color), color);
        }
        for (const color of colors) { const control = button(`color-${color}`, plugin.colorLabel(color), () => recolor(color), color); control.setAttribute('aria-pressed', String(selected.length > 0 && selected.every(item => item.color === color))); }
        for (const child of [...element.children].slice(paletteStart)) (child as HTMLElement).hidden = !this.palette;
        if (selected.length && path) {
          const hits = selected.map(item => ({ path, text, item }));
          const run = (trigger: HTMLElement, operation: 'note' | 'collection' | 'remove') => {
            this.dismissed = true; this.manual = false;
            chooseTarget(plugin, hits, hit => {
              if (operation === 'note') {
                const source = plugin.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view).find((source): source is MarkdownView => source instanceof MarkdownView && source.editor === editor);
                annotate(plugin, hit, view.contentDOM, source);
              }
              else if (operation === 'collection') chooseCollection(plugin, hit, view.contentDOM);
              else plugin.updateItem(editor, hit.item, null);
            }, trigger);
          };
          const note = button('annotation', plugin.t('annotation'), () => run(note, 'note'));
          const collection = button('collection', plugin.t('addCollection'), () => run(collection, 'collection'));
          const remove = button('remove', plugin.t('removeItem'), () => run(remove, 'remove'));
          for (const preset of plugin.settings.presets) element.querySelector(`[data-hb-action="preset-${preset.id}"]`)?.setAttribute('aria-pressed', String(selected.every(item => item.semantic === preset.id)));
        } else button('remove', plugin.t('remove'), () => plugin.apply(editor, null));
      }
      const close = detachedEl(document, 'button'); close.textContent = '×'; close.setAttribute('aria-label', plugin.t('close'));
      close.dataset.hbAction = 'close'; close.addEventListener('click', () => this.close(true)); element.append(close);
      document.body.append(element);
      if (activeAction) [...element.querySelectorAll('button')].find(button => button.dataset.hbAction === activeAction)?.focus();
      else if (this.takeFocus) element.querySelector('button')?.focus();
      this.takeFocus = false;
    }
    destroy(): void {
      if (this.disposed) return;
      this.cancelFrame();
      this.disposed = true; this.element?.remove();
      this.unbindDocument();
      this.view.scrollDOM.removeEventListener('scroll', this.reposition);
      plugin.toolbars.delete(this);
    }
  });
}
