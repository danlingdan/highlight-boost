import { detachedEl } from './dom';
import { ItemView, MarkdownView, Modal, Notice, Setting, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import { collectItems } from './anchors';
import { colors } from './domain';
import { createExcerptContext, type ExcerptContext, type ExcerptTemplate } from './excerpts';
import { queryHighlights, type SearchScope } from './query';
import { resolveEntry } from './collections';
import { isExportNote, type IndexHit } from './vault-index';
import type HighlightBoost from './main';
import { errorMessage, type Message } from './i18n';

export class HighlightsView extends ItemView {
  private note?: MarkdownView;
  private searchScope: SearchScope = 'note';
  private controls = new Map<string, HTMLInputElement | HTMLSelectElement>();
  private results?: HTMLElement;
  private status?: HTMLElement;
  private hits: IndexHit[] = [];
  private page = 0;
  private queryKey = '';
  private readonly pageSize = 50;
  private summary?: HTMLElement;
  private cards?: HTMLElement;
  private pagination?: HTMLElement;
  private optionKeys = new Map<string, string>();
  private rendered: { hit: IndexHit; view?: MarkdownView; file: MarkdownView['file'] | undefined }[] = [];
  private renderKey = '';
  private renderedNote?: MarkdownView;
  private closed = false;
  private excerptContexts = new Map<string, ReturnType<typeof createExcerptContext>>();
  constructor(leaf: WorkspaceLeaf, private plugin: HighlightBoost) { super(leaf); }
  getViewType(): string { return 'highlight-boost'; }
  getDisplayText(): string { return this.plugin.t(this.searchScope === 'note' ? 'panelTitle' : 'workbench'); }
  getIcon(): string { return 'highlighter'; }
  getState(): Record<string, unknown> { return { ...Object.fromEntries([...this.controls].map(([key, control]) => [key, control.value])), scope: this.searchScope, page: this.page }; }
  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const saved = state && typeof state === 'object' ? state as Record<string, unknown> : {};
    if (['note', 'folder', 'vault', 'collection'].includes(String(saved.scope))) this.searchScope = saved.scope as SearchScope;
    this.refresh();
    for (const [key, control] of this.controls) if (typeof saved[key] === 'string') control.value = saved[key];
    this.refresh(typeof saved.page === 'number' && Number.isSafeInteger(saved.page) && saved.page >= 0 ? saved.page : 0); await super.setState(state, result);
  }
  async setScope(scope: SearchScope, reset = false): Promise<void> {
    if (this.searchScope !== scope || reset) this.page = 0;
    this.searchScope = scope;
    if (reset) for (const key of ['search', 'type-filter', 'semantic-filter', 'color-filter', 'language-filter', 'path-filter']) {
      const control = this.controls.get(key); if (control) control.value = '';
    }
    await this.leaf.setViewState({ type: this.getViewType(), state: this.getState() });
    this.refresh();
  }
  async onOpen(): Promise<void> { this.closed = false; this.refresh(); }
  private value(key: string): string { return this.controls.get(key)?.value ?? ''; }
  private initialize(): void {
    this.contentEl.empty(); this.contentEl.addClass('hb-panel'); this.contentEl.createEl('h4');
    const scope = this.contentEl.createEl('select', { cls: 'hb-scope' }); this.controls.set('scope', scope);
    scope.addEventListener('change', () => { void this.setScope(scope.value as SearchScope); });
    for (const key of ['search', 'type-filter', 'semantic-filter', 'color-filter', 'language-filter', 'path-filter', 'sort', 'collection', 'template']) {
      const input = key === 'search' || key === 'path-filter';
      const control = input ? this.contentEl.createEl('input', { type: key === 'search' ? 'search' : 'text', cls: `hb-${key}` }) : this.contentEl.createEl('select', { cls: `hb-${key}` });
      this.controls.set(key, control);
      control.addEventListener(input ? 'input' : 'change', () => {
        if (key === 'template') { this.plugin.settings.excerptTemplate = control.value as ExcerptTemplate; void this.plugin.saveSettings(); }
        else this.refresh();
      });
    }
    for (const [action, key] of [['rebuild', 'rebuildIndex'], ['new-collection', 'newCollection'], ['delete-collection', 'deleteCollection'], ['export', 'exportNote']] as const) {
      const button = this.contentEl.createEl('button'); button.dataset.hbWorkbenchAction = action; button.dataset.hbLabel = key;
      button.addEventListener('click', () => {
        if (action === 'new-collection') {
          new CollectionNameModal(this.plugin, async name => {
            const id = crypto.randomUUID(); this.plugin.settings.collections.push({ id, name, entries: [] });
            await this.plugin.saveSettings(); this.controls.get('collection')!.value = id; await this.setScope('collection');
          }).open();
        } else if (action === 'delete-collection') {
          this.plugin.settings.collections = this.plugin.settings.collections.filter(collection => collection.id !== this.value('collection')); void this.plugin.saveSettings();
        } else {
          button.disabled = true;
          const operation = action === 'rebuild' ? this.plugin.index.rebuild() : this.plugin.index.ready.then(() => { this.refresh(); return this.plugin.exportHits(this.hits); });
          void operation.catch(error => new Notice(String(error))).finally(() => { button.disabled = false; });
        }
      });
    }
    this.status = this.contentEl.createEl('p', { cls: 'hb-index-status' });
    this.results = this.contentEl.createDiv({ cls: 'hb-results' });
    this.summary = this.results.createEl('p', { cls: 'hb-summary' });
    this.cards = this.results.createDiv({ cls: 'hb-result-cards' });
  }
  refresh(restorePage?: number): void {
    if (this.closed) return;
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) this.note = active;
    if (!this.results) this.initialize();
    const t = this.plugin.t.bind(this.plugin);
    this.contentEl.querySelector('h4')!.textContent = this.getDisplayText();
    const options = (key: string, title: Message, entries: [string, string][]) => {
      const select = this.controls.get(key) as HTMLSelectElement, value = select.value;
      select.setAttribute('aria-label', t(title));
      const keyValue = JSON.stringify(entries);
      if (this.optionKeys.get(key) !== keyValue) { select.replaceChildren(...entries.map(([value, label]) => {
        const option = detachedEl(select.ownerDocument, 'option'); option.value = value; option.textContent = label; return option;
      })); this.optionKeys.set(key, keyValue); }
      select.value = entries.some(([key]) => key === value) ? value : entries[0]?.[0] ?? '';
    };
    options('scope', 'scope', [['note', t('noteScope')], ['folder', t('folderScope')], ['vault', t('vaultScope')], ['collection', t('collectionScope')]]);
    this.controls.get('scope')!.value = this.searchScope;
    options('type-filter', 'allTypes', [['', t('allTypes')], ['prose', t('prose')], ['inline-code', t('inlineCode')], ['code', t('code')]]);
    options('semantic-filter', 'allSemantics', [['', t('allSemantics')], ...this.plugin.settings.presets.map(preset => [preset.id, this.plugin.presetLabel(preset)] as [string, string])]);
    options('color-filter', 'allColors', [['', t('allColors')], ...colors.map(color => [color, this.plugin.colorLabel(color)] as [string, string])]);
    options('language-filter', 'allLanguages', [['', t('allLanguages')], ...[...new Set(this.plugin.index.all().flatMap(hit => hit.item.language ? [hit.item.language] : []))].sort().map(language => [language, language] as [string, string])]);
    options('sort', 'sortOrder', [['source', t('sourceOrder')], ['semantic', t('semanticOrder')]]);
    options('collection', 'chooseCollection', [['', t('chooseCollection')], ...this.plugin.settings.collections.map(collection => [collection.id, collection.name] as [string, string])]);
    this.controls.get('collection')!.hidden = this.searchScope !== 'collection';
    options('template', 'exportTemplate', [['markdown', t('templateMarkdown')], ['plain', t('templatePlain')], ['quote', t('templateQuote')], ['code', t('templateCode')]]);
    this.controls.get('template')!.value = this.plugin.settings.excerptTemplate;
    for (const [key, title] of [['search', this.searchScope === 'note' ? 'searchHighlights' : 'searchAllHighlights'], ['path-filter', 'pathFilter']] as const) {
      const input = this.controls.get(key) as HTMLInputElement; input.placeholder = t(title); input.setAttribute('aria-label', t(title));
    }
    for (const button of this.contentEl.querySelectorAll<HTMLButtonElement>('[data-hb-label]')) button.textContent = t(button.dataset.hbLabel as Message);
    this.contentEl.querySelector<HTMLButtonElement>('[data-hb-workbench-action="delete-collection"]')!.hidden = this.searchScope !== 'collection' || !this.value('collection');
    this.status!.textContent = t('indexedNotes', { count: this.plugin.index.notes.size }) + (this.plugin.index.errors.size ? ` · ${t('indexErrors', { count: this.plugin.index.errors.size })}` : '');
    const results = this.results!;
    const view = this.note;
    const file = view?.file && this.app.workspace.getLeavesOfType('markdown').includes(view.leaf) ? view.file : undefined;
    if ((this.searchScope === 'note' || this.searchScope === 'folder') && (!file || this.app.vault.getFileByPath(file.path) !== file)) {
      this.hits = []; this.rendered = []; this.renderKey = ''; this.renderedNote = undefined;
      this.page = 0; this.queryKey = ''; this.summary!.textContent = t('panelEmpty');
      this.cards!.empty(); this.pagination?.remove(); this.pagination = undefined; return;
    }
    const collection = this.plugin.settings.collections.find(collection => collection.id === this.value('collection'));
    let all = this.searchScope === 'collection' ? collection?.entries.map(entry => resolveEntry(this.plugin.index.notes.get(entry.path), entry)) ?? [] : this.plugin.index.all();
    if (this.searchScope !== 'collection') for (const leaf of this.app.workspace.getLeavesOfType('markdown')) if (leaf.view instanceof MarkdownView && leaf.view.file?.extension === 'md') {
      const path = leaf.view.file.path, text = leaf.view.editor.getValue();
      const items = this.plugin.index.notes.get(path)?.text === text ? this.plugin.index.notes.get(path)!.items : collectItems(text);
      if (this.app.vault.getFileByPath(path) === leaf.view.file && !isExportNote(text)) all = [...all.filter(hit => hit.path !== path), ...items.map(item => ({ path, text, item }))];
    }
    const label = (hit: IndexHit) => hit.item.markId ? hit.item.label : this.plugin.colorLabel(hit.item.color);
    const query = { scope: this.searchScope, note: file?.path, search: this.value('search'), type: this.value('type-filter'), semantic: this.value('semantic-filter'), color: this.value('color-filter'), language: this.value('language-filter'), path: this.value('path-filter'), sort: this.value('sort') };
    const queryKey = JSON.stringify({ ...query, collection: this.value('collection') });
    if (queryKey !== this.queryKey) this.page = 0;
    this.queryKey = queryKey;
    this.hits = queryHighlights(all, query, label);
    this.page = Math.max(0, Math.min(restorePage ?? this.page, Math.ceil(this.hits.length / this.pageSize) - 1));
    const name = this.searchScope === 'note' ? file!.basename : this.searchScope === 'folder' ? file!.parent?.path || '/' : this.searchScope === 'collection' ? collection?.name || t('collectionScope') : t('vaultScope');
    this.summary!.textContent = t(this.hits.length === 1 ? 'summaryOne' : 'summary', { note: name, count: this.hits.length });
    if (this.hits.length > this.pageSize) {
      const navigation = this.pagination ??= results.createEl('nav', { cls: 'hb-pagination' });
      if (navigation.nextSibling !== this.cards) results.insertBefore(navigation, this.cards!);
      navigation.setAttribute('aria-label', t('resultPages'));
      const turn = (page: number, direction: string) => {
        this.refresh(page); this.contentEl.scrollTop = 0;
        const buttons = [...this.results!.querySelectorAll<HTMLButtonElement>('.hb-pagination button')];
        (buttons.find(button => button.dataset.hbPage === direction && !button.disabled) ?? buttons.find(button => !button.disabled))?.focus();
      };
      let previous = navigation.querySelector<HTMLButtonElement>('[data-hb-page="previous"]');
      if (!previous) { previous = navigation.createEl('button'); previous.dataset.hbPage = 'previous'; previous.addEventListener('click', () => turn(this.page - 1, 'previous')); }
      previous.textContent = t('previousPage'); previous.disabled = this.page === 0;
      const status = navigation.querySelector('span') ?? navigation.createSpan();
      status.textContent = t('pageStatus', { page: this.page + 1, pages: Math.ceil(this.hits.length / this.pageSize), from: this.page * this.pageSize + 1, to: Math.min((this.page + 1) * this.pageSize, this.hits.length), count: this.hits.length });
      status.setAttribute('role', 'status');
      let next = navigation.querySelector<HTMLButtonElement>('[data-hb-page="next"]');
      if (!next) { next = navigation.createEl('button'); next.dataset.hbPage = 'next'; next.addEventListener('click', () => turn(this.page + 1, 'next')); }
      next.textContent = t('nextPage'); next.disabled = (this.page + 1) * this.pageSize >= this.hits.length;
    } else { this.pagination?.remove(); this.pagination = undefined; }
    const visible = this.hits.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize).map(hit => {
      const view = this.plugin.openView(hit.path, this.note); return { hit, view, file: view?.file };
    });
    const renderKey = JSON.stringify([queryKey, this.page, this.plugin.locale, this.plugin.settings.presets, this.plugin.settings.collections.map(({ id, name }) => [id, name])]);
    if (visible.length && renderKey === this.renderKey && this.renderedNote === this.note && visible.length === this.rendered.length && visible.every(({ hit, view, file }, index) => {
      const before = this.rendered[index]!; return hit.path === before.hit.path && hit.text === before.hit.text && hit.item === before.hit.item && hit.entryId === before.hit.entryId && view === before.view && file === before.file;
    })) return;
    this.renderKey = renderKey; this.rendered = visible; this.renderedNote = this.note;
    this.cards!.empty();
    if (!this.hits.length) this.cards!.createEl('p', { text: this.searchScope === 'collection' && !collection ? t('noCollection') : all.length ? t('noMatches') : t('noHighlights', { preset: this.plugin.presetLabel(this.plugin.getPreset('important')) }) });
    let group = '';
    for (const { hit } of visible) {
      const key = this.value('sort') === 'semantic' ? label(hit) : this.searchScope === 'note' ? '' : hit.path;
      if (key && group !== key) { this.cards!.createEl('h5', { text: key, cls: 'hb-result-group' }); group = key; }
      let context = this.excerptContexts.get(hit.text);
      if (!context) {
        const view = this.plugin.openView(hit.path, this.note), snapshot = view && this.plugin.documentFor(view.editor);
        context = snapshot?.text === hit.text ? snapshot.context : createExcerptContext(hit.text);
      }
      this.excerptContexts.delete(hit.text); this.excerptContexts.set(hit.text, context);
      while (this.excerptContexts.size > this.pageSize) this.excerptContexts.delete(this.excerptContexts.keys().next().value!);
      this.card(hit, context(hit.item));
    }
  }
  private card(hit: IndexHit, context: ExcerptContext): void {
    const { item } = hit, t = this.plugin.t.bind(this.plugin);
    const card = this.cards!.createDiv({ cls: `hb-card hb-${item.color}` }); card.dataset.hbPath = hit.path;
    if (item.semantic) card.dataset.hbSemantic = item.semantic;
    const jump = card.createEl('button', { text: item.quote || t('blankLine'), cls: item.kind === 'prose' ? 'hb-quote' : 'hb-quote hb-code-quote' });
    const label = item.markId ? item.label : this.plugin.colorLabel(item.color);
    const info = item.kind === 'prose' ? t('prose') : item.kind === 'inline-code' ? item.line ? t('inlineInfo', { line: item.line }) : t('inlineCode') : item.line ? t('codeInfo', { language: item.language || t('code'), line: item.line }) : t('code');
    card.createEl('small', { text: `${label} · ${info}${item.status === 'resolved' ? '' : ` · ${t('pending')}`}` });
    if (this.searchScope !== 'note') card.createEl('small', { text: hit.path, cls: 'hb-source-path' });
    if (item.note) {
      const note = card.createEl('details', { cls: 'hb-note' }); note.createEl('summary', { text: t('annotation') });
      note.createDiv({ text: item.note, cls: 'hb-note-text' });
    }
    if (context.headings.length) card.createEl('small', { text: context.headings.join(' › '), cls: 'hb-heading-context' });
    if (context.code !== undefined && context.code !== item.quote) {
      const details = card.createEl('details', { cls: 'hb-card-context' }); details.createEl('summary', { text: t('excerptCodeContext', { from: context.contextFrom!, to: context.contextTo! }) }); details.createEl('pre').createEl('code', { text: context.code });
    }
    const sourceView = this.plugin.openView(hit.path, this.note), file = sourceView?.file;
    const act = (run: (view: MarkdownView) => void | Promise<void>) => {
      if (sourceView && sourceView.file !== file) { new Notice(t('staleMark')); return; }
      void this.plugin.editHit(hit, run, sourceView);
    };
    jump.addEventListener('click', () => { if (item.status !== 'resolved') new Notice(t('contentChanged')); else act(view => this.plugin.jumpToItem(view, item)); });
    if ((item.kind === 'code-line' || item.kind === 'code-range') && sourceView && sourceView === this.note) {
      const rebind = card.createEl('button', { text: t('rebind'), cls: 'hb-rebind' }); rebind.title = t('rebindHint');
      rebind.addEventListener('click', () => { if (sourceView.file === file) this.plugin.rebind(sourceView.editor, item); });
    }
    if (item.status === 'resolved') {
      card.createEl('button', { text: t('editAnnotation'), cls: 'hb-edit-note' }).addEventListener('click', () => {
        new AnnotationModal(this.plugin, item.note ?? '', note => this.plugin.editNoteHit(hit, note, sourceView)).open();
      });
      const semantic = card.createEl('select', { cls: 'hb-change-semantic' }); semantic.setAttribute('aria-label', t('changeSemantic')); semantic.createEl('option', { value: '', text: t('changeSemantic') });
      for (const preset of this.plugin.settings.presets) semantic.createEl('option', { value: preset.id, text: this.plugin.presetLabel(preset) });
      semantic.addEventListener('change', () => { if (semantic.value) act(view => this.plugin.updateItem(view.editor, item, this.plugin.presetForAction(semantic.value))); });
      card.createEl('button', { text: t('removeItem'), cls: 'hb-remove-item' }).addEventListener('click', () => act(view => this.plugin.updateItem(view.editor, item, null)));
      const add = card.createEl('select', { cls: 'hb-add-collection' }); add.setAttribute('aria-label', t('addCollection')); add.createEl('option', { value: '', text: t('addCollection') });
      for (const collection of this.plugin.settings.collections) add.createEl('option', { value: collection.id, text: collection.name });
      add.disabled = !this.plugin.settings.collections.length;
      add.addEventListener('change', () => { if (add.value) void this.plugin.addToCollection(add.value, hit); });
    }
    if (hit.entryId) card.createEl('button', { text: t('removeCollectionEntry'), cls: 'hb-remove-collection' }).addEventListener('click', () => {
      const collection = this.plugin.settings.collections.find(collection => collection.id === this.value('collection'));
      if (collection) { collection.entries = collection.entries.filter(entry => entry.id !== hit.entryId); void this.plugin.saveSettings(); }
    });
    card.createEl('button', { text: t('copyExcerpt'), cls: 'hb-copy-excerpt' }).addEventListener('click', () => { void navigator.clipboard.writeText(this.plugin.excerpt(hit)); });
  }
  async onClose(): Promise<void> {
    this.closed = true;
    this.hits = []; this.rendered = []; this.note = undefined; this.renderedNote = undefined;
    this.renderKey = ''; this.queryKey = ''; this.controls.clear(); this.optionKeys.clear(); this.excerptContexts.clear();
    this.contentEl.empty(); this.results = undefined; this.summary = undefined; this.cards = undefined; this.pagination = undefined;
  }
}

class AnnotationModal extends Modal {
  constructor(private plugin: HighlightBoost, private note: string, private submit: (note: string) => Promise<void>) { super(plugin.app); }
  onOpen(): void {
    this.contentEl.createEl('h3', { text: this.plugin.t('editAnnotation') });
    this.contentEl.createEl('p', { text: this.plugin.t('annotationHint') });
    const input = this.contentEl.createEl('textarea', { cls: 'hb-note-input' }); input.value = this.note;
    input.setAttribute('aria-label', this.plugin.t('annotation')); input.rows = 8;
    new Setting(this.contentEl).addButton(button => button.setButtonText(this.plugin.t('save')).onClick(async () => {
      button.setDisabled(true);
      try { await this.submit(input.value); this.close(); } catch (error) { new Notice(errorMessage(error, this.plugin.locale)); button.setDisabled(false); }
    })).addButton(button => button.setButtonText(this.plugin.t('cancel')).onClick(() => this.close()));
  }
  onClose(): void { this.contentEl.empty(); }
}

class CollectionNameModal extends Modal {
  constructor(private plugin: HighlightBoost, private submit: (name: string) => Promise<void>) { super(plugin.app); }
  onOpen(): void {
    let name = '';
    this.contentEl.createEl('h3', { text: this.plugin.t('newCollection') });
    const row = new Setting(this.contentEl).setName(this.plugin.t('collectionName'));
    row.addText(text => { text.inputEl.className = 'hb-collection-name'; text.inputEl.setAttribute('aria-label', this.plugin.t('collectionName')); text.onChange(value => { name = value.trim(); }); });
    row.addButton(button => button.setButtonText(this.plugin.t('create')).onClick(async () => {
      if (!name) return; button.setDisabled(true);
      try { await this.submit(name); this.close(); } catch (error) { new Notice(String(error)); button.setDisabled(false); }
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}
