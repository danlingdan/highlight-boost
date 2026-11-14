import { Modal, Setting, normalizePath } from 'obsidian';
import { colors, type Color } from './domain';
import { defaultImportOptions, importColor, type ImportOptions } from './migration-plan';
import type { ImportFile } from './migration-service';
import type HighlightBoost from './main';
import type { Message } from './i18n';

export class MigrationModal extends Modal {
  private options: ImportOptions = structuredClone(defaultImportOptions);
  private importScope = 'note';
  private folder: string;
  private files: ImportFile[] = [];
  private selected = new Set<string>();
  private status!: HTMLElement;
  private mappings!: HTMLElement;
  private previewEl!: HTMLElement;
  private historyEl!: HTMLElement;
  private applyButton!: HTMLButtonElement;
  private busy = false;
  constructor(private plugin: HighlightBoost) { super(plugin.app); this.folder = plugin.app.workspace.getActiveFile()?.parent?.path ?? ''; }
  onOpen(): void {
    const t = this.plugin.t.bind(this.plugin); this.contentEl.classList.add('hb-migration');
    this.contentEl.createEl('h2', { text: t('migration') }); this.contentEl.createEl('p', { text: t('migrationHint') });
    new Setting(this.contentEl).setName(t('migrationScope')).addDropdown(dropdown => {
      dropdown.selectEl.dataset.hbImport = 'scope'; dropdown.addOption('note', t('noteScope')).addOption('folder', t('folderScope')).addOption('vault', t('vaultScope')).setValue(this.importScope).onChange(value => { this.importScope = value; this.invalidate(); });
    });
    new Setting(this.contentEl).setName(t('migrationFolder')).addText(text => { text.inputEl.dataset.hbImport = 'folder'; text.setValue(this.folder).onChange(value => { this.folder = value; this.invalidate(); }); });
    for (const [key, name] of [['highlightr', 'Highlightr'], ['hilo', 'Hilo'], ['fences', t('migrationFences')]] as const) {
      new Setting(this.contentEl).setName(name).addToggle(toggle => { toggle.toggleEl.dataset.hbImport = key; toggle.setValue(this.options[key]).onChange(value => { this.options[key] = value; this.invalidate(); }); });
    }
    const actions = this.contentEl.createDiv({ cls: 'hb-migration-actions' });
    const preview = actions.createEl('button', { text: t('migrationPreview'), attr: { 'data-hb-import': 'preview' } }); preview.onclick = () => { void this.run(() => this.buildPreview()); };
    this.applyButton = actions.createEl('button', { text: t('migrationApply'), attr: { 'data-hb-import': 'apply' } }); this.applyButton.disabled = true;
    this.applyButton.onclick = () => { void this.run(async () => {
      const run = await this.plugin.migrations.apply(this.files.filter(file => this.selected.has(file.path)));
      const applied = run.files.filter(file => file.status === 'applied');
      this.files = []; this.selected.clear(); this.previewEl.replaceChildren();
      this.status.textContent = t('migrationApplied', { files: applied.length, count: applied.reduce((sum, file) => sum + file.count, 0), errors: run.files.filter(file => file.status === 'error').length });
      await this.renderHistory();
    }); };
    this.status = this.contentEl.createEl('p', { attr: { role: 'status', 'data-hb-import': 'status' } });
    this.mappings = this.contentEl.createDiv(); this.previewEl = this.contentEl.createDiv({ cls: 'hb-migration-preview' });
    this.contentEl.createEl('h3', { text: t('migrationHistory') }); this.historyEl = this.contentEl.createDiv({ cls: 'hb-migration-history' });
    const close = this.contentEl.createEl('button', { text: t('close'), attr: { 'data-hb-import': 'close' } }); close.onclick = () => this.close();
    void this.run(() => this.renderHistory());
  }
  private invalidate(): void { this.files = []; this.selected.clear(); this.applyButton.disabled = true; this.previewEl.replaceChildren(); this.status.textContent = this.plugin.t('migrationRefresh'); }
  private summarize(): void {
    const entries = this.files.flatMap(file => file.entries), selected = this.files.filter(file => this.selected.has(file.path) && file.before !== file.after);
    this.status.textContent = entries.length ? this.plugin.t('migrationSummary', { files: selected.length, count: selected.flatMap(file => file.entries).filter(entry => entry.after !== undefined).reduce((sum, entry) => sum + entry.count, 0), skipped: entries.filter(entry => entry.after === undefined).length }) : this.plugin.t('migrationNoFiles');
  }
  private error(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return ['migrationChanged', 'migrationBusy', 'migrationRecordInvalid', 'missingSource', 'migrationEmptyNote'].includes(message) ? this.plugin.t(message as Message) : message;
  }
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return; this.busy = true;
    for (const control of this.contentEl.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input,button,select')) control.disabled = true;
    try { await action(); } catch (error) { this.status.textContent = this.error(error); }
    finally {
      this.busy = false;
      for (const control of this.contentEl.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input,button,select')) control.disabled = false;
      this.applyButton.disabled = !this.files.some(file => file.before !== file.after && this.selected.has(file.path));
    }
  }
  private async buildPreview(): Promise<void> {
    this.invalidatePreview();
    const active = this.app.workspace.getActiveFile();
    if (this.importScope === 'note' && active?.extension !== 'md') throw new Error('migrationEmptyNote');
    const folder = normalizePath(this.folder).replace(/^\/+|\/+$/g, '');
    const paths = this.app.vault.getMarkdownFiles().filter(file => this.importScope === 'vault' || (this.importScope === 'note' ? file.path === active?.path : !folder || file.path.startsWith(`${folder}/`))).map(file => file.path);
    this.status.textContent = this.plugin.t('migrationLoad');
    this.files = await this.plugin.migrations.preview(paths, structuredClone(this.options));
    this.selected = new Set(this.files.filter(file => file.before !== file.after).map(file => file.path));
    const entries = this.files.flatMap(file => file.entries); this.summarize();
    this.mappings.replaceChildren();
    const keys = [...new Set(entries.filter(entry => entry.source !== 'fence').map(entry => entry.key))];
    if (keys.length) this.mappings.createEl('h3', { text: this.plugin.t('migrationMapping') });
    for (const key of keys) new Setting(this.mappings).setName(key).addDropdown(dropdown => {
      dropdown.selectEl.dataset.hbMapping = key;
      const automatic = importColor(key, {});
      dropdown.addOption('auto', `${this.plugin.t('migrationAuto')} · ${automatic ? this.plugin.colorLabel(automatic) : this.plugin.t('migrationColor')}`).addOption('skip', this.plugin.t('migrationSkip'));
      for (const color of colors) dropdown.addOption(color, this.plugin.colorLabel(color));
      dropdown.setValue(this.options.mapping[key] ?? 'auto').onChange(value => { if (value === 'auto') delete this.options.mapping[key]; else this.options.mapping[key] = value as Color | 'skip'; this.invalidate(); });
    });
    this.previewEl.replaceChildren();
    for (const file of this.files) {
      const details = this.previewEl.createEl('details', { attr: { 'data-hb-import-file': file.path } }); details.open = true;
      details.createEl('summary', { text: file.path });
      if (file.before !== file.after) new Setting(details).setName(this.plugin.t('migrationSelect')).addToggle(toggle => {
        toggle.toggleEl.dataset.hbImportFileSelect = file.path; toggle.setValue(true).onChange(value => { if (value) this.selected.add(file.path); else this.selected.delete(file.path); this.applyButton.disabled = !this.selected.size; this.summarize(); });
      });
      for (const entry of file.entries) {
        const row = details.createDiv({ cls: 'hb-migration-entry' });
        if (entry.lines) {
          row.createEl('strong', { text: this.plugin.t('migrationFences') });
          for (const line of entry.lines) { row.createEl('div', { text: `${this.plugin.t('migrationLine', { line: line.number })} · ${this.plugin.colorLabel(line.color)}` }); row.createEl('pre', { text: line.text }); }
          continue;
        }
        row.createEl('strong', { text: entry.key }); row.createEl('div', { text: this.plugin.t('migrationBefore') }); row.createEl('pre', { text: entry.before });
        row.createEl('div', { text: entry.after !== undefined ? this.plugin.t('migrationAfter') : this.plugin.t(entry.reason === 'color' ? 'migrationColor' : entry.reason === 'attributes' ? 'migrationAttributes' : entry.reason === 'parameter' ? 'migrationSkip' : 'migrationStructure') });
        if (entry.after !== undefined) row.createEl('pre', { text: entry.after });
      }
    }
  }
  private async renderHistory(): Promise<void> {
    const runs = await this.plugin.migrations.history(); this.historyEl.replaceChildren();
    if (!runs.length) this.historyEl.createEl('p', { text: this.plugin.t('migrationNoHistory') });
    for (const run of runs) {
      const details = this.historyEl.createEl('details', { attr: { 'data-hb-import-run': run.id } });
      details.createEl('summary', { text: new Date(run.created).toLocaleString(this.plugin.locale === 'zh' ? 'zh-CN' : 'en-US') });
      for (const file of run.files) {
        const row = details.createDiv({ attr: { 'data-hb-restore-file': file.path } });
        const state = this.plugin.t(file.status === 'applied' ? 'migrationDone' : file.status === 'restored' ? 'migrationRestored' : file.status === 'pending' ? 'migrationPending' : 'migrationError');
        row.createEl('p', { text: `${file.path} · ${state}${file.error ? ` · ${this.error(file.error)}` : ''}` });
        if (file.status !== 'restored') {
          const button = row.createEl('button', { text: this.plugin.t('migrationRestore') }); button.onclick = () => { void this.run(async () => { await this.plugin.migrations.restore(run.id, file.path); this.status.textContent = this.plugin.t('migrationRestoredNotice', { path: file.path }); this.invalidatePreview(); await this.renderHistory(); }); };
        }
      }
    }
  }
  private invalidatePreview(): void { this.files = []; this.selected.clear(); this.previewEl.replaceChildren(); }
  onClose(): void { this.contentEl.empty(); }
}
