import type HighlightBoost from './main';
import type { IndexHit } from './vault-index';
import type { ExcerptTemplate } from './excerpts';
import { FocusModal } from './ui';

export interface ExcerptQuery { hits: IndexHit[]; description: string; key: string }

export class ExcerptModal extends FocusModal {
  private snapshot!: ExcerptQuery;
  private template: ExcerptTemplate;
  private output = '';
  private sourceLinks: string[] = [];
  private preview!: HTMLTextAreaElement;
  private status!: HTMLElement;
  private count!: HTMLElement;
  private changed!: HTMLElement;
  private timer?: number;
  private accepted = '';
  private copyButton?: HTMLButtonElement;
  private exportButton?: HTMLButtonElement;
  constructor(plugin: HighlightBoost, private query: () => ExcerptQuery, trigger?: HTMLElement) { super(plugin, trigger); this.template = plugin.settings.excerptTemplate; }
  onOpen(): void {
    super.onOpen(); this.messageTitle('excerptPreview');
    this.count = this.contentEl.createEl('p', { cls: 'hb-excerpt-summary' });
    const select = this.contentEl.createEl('select', { cls: 'hb-template', attr: { 'aria-label': this.plugin.t('exportTemplate') } });
    for (const [value, key] of [['markdown', 'templateMarkdown'], ['plain', 'templatePlain'], ['quote', 'templateQuote'], ['code', 'templateCode']] as const) select.createEl('option', { value, text: this.plugin.t(key), attr: { 'data-hb-message': key } });
    select.value = this.template; select.addEventListener('change', () => {
      this.template = select.value as ExcerptTemplate; this.plugin.settings.excerptTemplate = this.template;
      void this.plugin.saveSettings(); this.format();
    });
    this.changed = this.contentEl.createDiv({ cls: 'hb-snapshot-changed', attr: { role: 'status' } });
    this.changed.createEl('p', { text: this.plugin.t('snapshotChanged'), attr: { 'data-hb-message': 'snapshotChanged' } });
    this.button(this.changed, 'refreshSnapshot', () => this.capture());
    this.button(this.changed, 'keepSnapshot', () => { this.accepted = this.signature(this.query()); this.changed.hidden = true; });
    this.preview = this.contentEl.createEl('textarea', { cls: 'hb-excerpt-preview', attr: { readonly: '', 'aria-label': this.plugin.t('excerptPreview'), rows: '16' } });
    this.status = this.contentEl.createDiv({ attr: { role: 'status' } });
    const footer = this.contentEl.createDiv({ cls: 'hb-modal-actions' });
    this.copyButton = this.button(footer, 'copyExcerpt', () => { void this.preview.ownerDocument.defaultView!.navigator.clipboard.writeText(this.output).then(() => { this.status.textContent = this.plugin.t('copied'); }).catch(() => { this.status.textContent = this.plugin.t('copyFailed'); }); });
    const exportButton = this.button(footer, 'exportNote', () => {
      exportButton.disabled = true;
      void this.plugin.exportExcerpt(this.output).then(async file => { await this.plugin.app.workspace.getLeaf('tab').openFile(file); this.close(); }).catch(error => { this.status.textContent = String(error); exportButton.disabled = false; });
    }); this.exportButton = exportButton; exportButton.dataset.hbWorkbenchAction = 'export';
    this.button(footer, 'cancel', () => this.close()); this.capture();
    this.timer = this.contentEl.ownerDocument.defaultView!.setInterval(() => { this.changed.hidden = this.signature(this.query()) === this.accepted; }, 400);
  }
  refreshLocale(): void { super.refreshLocale(); if (this.preview && this.snapshot) this.format(); }
  private signature(query: ExcerptQuery): string { return JSON.stringify([query.key, query.hits.map(hit => [hit.path, hit.text, hit.item.id, hit.item.note])]); }
  private capture(): void { this.snapshot = structuredClone(this.query()); this.sourceLinks = this.snapshot.hits.map(hit => this.plugin.excerptLink(hit)); this.accepted = this.signature(this.snapshot); this.changed.hidden = true; if (this.copyButton) this.copyButton.disabled = !this.snapshot.hits.length; if (this.exportButton) this.exportButton.disabled = !this.snapshot.hits.length; this.format(); }
  private format(): void {
    this.output = this.snapshot.hits.map((hit, index) => this.plugin.excerpt(hit, this.template, this.sourceLinks[index])).join('\n\n---\n\n'); this.preview.value = this.output;
    this.count.textContent = `${this.snapshot.description} · ${this.plugin.t('snapshotCount', { count: this.snapshot.hits.length })}`;
  }
  onClose(): void { if (this.timer !== undefined) this.contentEl.ownerDocument.defaultView!.clearInterval(this.timer); super.onClose(); }
}
