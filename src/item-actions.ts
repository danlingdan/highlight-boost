import { MarkdownView, Notice } from 'obsidian';
import type HighlightBoost from './main';
import type { IndexHit } from './vault-index';
import { FocusModal } from './ui';
import { currentItem } from './item-editing';
import { errorMessage } from './i18n';
import { collectItems } from './anchors';

export function annotate(plugin: HighlightBoost, hit: IndexHit, trigger?: HTMLElement, preferred?: MarkdownView): void {
  new AnnotationModal(plugin, hit, trigger, preferred).open();
}

class AnnotationModal extends FocusModal {
  constructor(plugin: HighlightBoost, private hit: IndexHit, trigger?: HTMLElement, private preferred?: MarkdownView) { super(plugin, trigger); }
  onOpen(): void {
    super.onOpen(); this.messageTitle('editAnnotation');
    const excerpt = this.contentEl.createEl('blockquote', { text: this.hit.item.quote });
    this.contentEl.createEl('p', { text: this.hit.path, cls: 'hb-source-path' });
    const input = this.contentEl.createEl('textarea', { cls: 'hb-note-input', attr: { 'aria-label': this.plugin.t('annotation'), rows: '8' } }); input.value = this.hit.item.note ?? '';
    const status = this.contentEl.createDiv({ cls: 'hb-form-status', attr: { role: 'status' } });
    input.addEventListener('input', () => { status.textContent = this.plugin.t('unsaved'); });
    const refresh = this.button(this.contentEl, 'refreshTarget', () => {
      const view = this.plugin.openView(this.hit.path, this.preferred);
      const text = view?.editor.getValue() ?? this.plugin.index.notes.get(this.hit.path)?.text;
      const items = text === undefined ? [] : collectItems(text);
      const reference = this.hit.item;
      const candidates = items.filter(item => reference.markId ? item.kind === reference.kind && item.markId === reference.markId && item.blockId === reference.blockId : item.kind === reference.kind && item.quote === reference.quote && item.label === reference.label);
      const item = candidates.length === 1 ? candidates[0] : undefined;
      if (!item || text === undefined) { status.textContent = this.plugin.t('missingTarget'); return; }
      this.hit = { ...this.hit, text, item }; excerpt.textContent = item.quote;
      status.textContent = this.plugin.t('targetRefreshed'); refresh.hidden = true; input.focus();
    }); refresh.hidden = true;
    const footer = this.contentEl.createDiv({ cls: 'hb-modal-actions' });
    const save = this.button(footer, 'save', () => { void (async () => {
      save.disabled = true;
      try {
        const view = this.plugin.openView(this.hit.path, this.preferred);
        const text = view?.editor.getValue() ?? await this.plugin.app.vault.cachedRead(this.plugin.app.vault.getFileByPath(this.hit.path)!);
        currentItem(text, this.hit.item);
        await this.plugin.editNoteHit(this.hit, input.value, this.preferred); this.close();
      } catch (error) { status.textContent = errorMessage(error, this.plugin.locale); refresh.hidden = false; save.disabled = false; }
    })(); }); save.addClass('mod-cta');
    this.button(footer, 'cancel', () => this.close()); input.focus();
  }
}

export function createCollection(plugin: HighlightBoost, done: (id: string) => void | Promise<void>, trigger?: HTMLElement): void {
  new class extends FocusModal {
    onOpen(): void {
      super.onOpen(); this.messageTitle('newCollection');
      const input = this.contentEl.createEl('input', { cls: 'hb-collection-name', attr: { 'aria-label': plugin.t('collectionName'), placeholder: plugin.t('collectionName') } });
      const footer = this.contentEl.createDiv({ cls: 'hb-modal-actions' });
      const submit = this.button(footer, 'create', () => { void (async () => {
        const name = input.value.trim(); if (!name) { input.focus(); return; } submit.disabled = true;
        try { const id = crypto.randomUUID(); plugin.settings.collections.push({ id, name, entries: [] }); await plugin.saveSettings(); this.close(); await done(id); }
        catch (error) { new Notice(String(error)); submit.disabled = false; }
      })(); });
      this.button(footer, 'cancel', () => this.close());
      input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) submit.click(); }); input.focus();
    }
  }(plugin, trigger).open();
}

export function chooseCollection(plugin: HighlightBoost, hit: IndexHit, trigger?: HTMLElement): void {
  new class extends FocusModal {
    onOpen(): void {
      super.onOpen(); this.messageTitle('addCollection');
      this.contentEl.createEl('blockquote', { text: hit.item.quote });
      const select = this.contentEl.createEl('select', { cls: 'hb-add-collection', attr: { 'aria-label': plugin.t('chooseCollection') } });
      for (const collection of plugin.settings.collections) select.createEl('option', { value: collection.id, text: collection.name });
      const footer = this.contentEl.createDiv({ cls: 'hb-modal-actions' });
      this.button(footer, 'newCollection', () => createCollection(plugin, async id => { await plugin.addToCollection(id, hit); this.close(); }, select));
      const save = this.button(footer, 'addCollection', () => { save.disabled = true; void plugin.addToCollection(select.value, hit).then(() => this.close()).catch(error => { new Notice(String(error)); save.disabled = false; }); }); save.disabled = !select.options.length;
      this.button(footer, 'cancel', () => this.close()); select.focus();
    }
  }(plugin, trigger).open();
}

export function chooseTarget(plugin: HighlightBoost, hits: IndexHit[], run: (hit: IndexHit) => void, trigger?: HTMLElement): void {
  if (hits.length === 1) { run(hits[0]!); return; }
  new class extends FocusModal {
    onOpen(): void {
      super.onOpen(); this.messageTitle('chooseTarget');
      for (const hit of hits) this.contentEl.createEl('button', { cls: 'hb-target-option', text: `${hit.item.label} · ${hit.item.quote}` }, button => button.addEventListener('click', () => { this.close(); run(hit); }));
      this.button(this.contentEl, 'cancel', () => this.close());
    }
  }(plugin, trigger).open();
}
