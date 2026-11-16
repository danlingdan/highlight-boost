import { detachedEl } from './dom';
import { ItemView, MarkdownView, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import { collectItems } from './anchors';
import { colors } from './domain';
import { createExcerptContext } from './excerpts';
import { queryHighlights, type SearchScope } from './query';
import { resolveEntry } from './collections';
import { isExportNote, type IndexHit } from './vault-index';
import type HighlightBoost from './main';
import { type Message } from './i18n';
import { action, menuAt } from './ui';
import { createCollection } from './item-actions';
import { renderCard } from './workbench-card';
import { ExcerptModal } from './excerpt-modal';

export class HighlightsView extends ItemView {
  private note?: MarkdownView;
  private sourcePath?: string;
  setSource(view: MarkdownView): void { this.note = view; this.sourcePath = view.file?.path; }
  hasSource(): boolean { return !!this.note; }
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
  private filterArea?: HTMLDetailsElement;
  private chips?: HTMLElement;
  private source?: HTMLElement;
  private expanded = new Map<string, boolean>();
  private temporary?: { paths: Set<string>; blockFrom?: number; label: string };
  showFiles(paths: string[], label: string, blockFrom?: number): void {
    this.temporary = { paths: new Set(paths), label, blockFrom }; void this.setScope('vault', true, true);
  }
  private excerptContexts = new Map<string, ReturnType<typeof createExcerptContext>>();
  constructor(leaf: WorkspaceLeaf, private plugin: HighlightBoost) { super(leaf); }
  getViewType(): string { return 'highlight-boost'; }
  getDisplayText(): string { return this.plugin.t('workbench'); }
  getIcon(): string { return 'highlighter'; }
  getState(): Record<string, unknown> {
    for (const details of this.cards?.querySelectorAll<HTMLDetailsElement>('details[data-hb-expanded]') ?? []) this.expanded.set(`${details.closest<HTMLElement>('[data-hb-item]')!.dataset.hbItem}:${details.dataset.hbExpanded}`, details.open);
    return { sourcePath: this.note?.file?.path ?? this.sourcePath, scroll: this.contentEl.scrollTop, expanded: [...this.expanded], filtersOpen: this.filterArea?.open, ...Object.fromEntries([...this.controls].map(([key, control]) => [key, control.value])), scope: this.searchScope, page: this.page }; }
  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const saved = state && typeof state === 'object' ? state as Record<string, unknown> : {};
    if (['note', 'folder', 'vault', 'collection'].includes(String(saved.scope))) this.searchScope = saved.scope as SearchScope;
    if (typeof saved.sourcePath === 'string') { this.sourcePath = saved.sourcePath; this.note = this.plugin.openView(saved.sourcePath, this.note); }
    if (Array.isArray(saved.expanded)) for (const pair of saved.expanded) if (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'boolean') this.expanded.set(pair[0], pair[1]);
    this.refresh();
    for (const [key, control] of this.controls) if (typeof saved[key] === 'string') control.value = saved[key];
    this.refresh(typeof saved.page === 'number' && Number.isSafeInteger(saved.page) && saved.page >= 0 ? saved.page : 0); if (this.filterArea && typeof saved.filtersOpen === 'boolean') this.filterArea.open = saved.filtersOpen;
    if (typeof saved.scroll === 'number') this.contentEl.scrollTop = saved.scroll;
    await super.setState(state, result);
  }
  async setScope(scope: SearchScope, reset = false, keepTemporary = false): Promise<void> {
    if (reset && !keepTemporary) this.temporary = undefined;
    if (this.searchScope !== scope || reset) this.page = 0;
    this.searchScope = scope;
    if (reset) for (const key of ['search', 'type-filter', 'semantic-filter', 'color-filter', 'language-filter', 'path-filter']) {
      const control = this.controls.get(key); if (control) control.value = '';
    }
    await this.leaf.setViewState({ type: this.getViewType(), state: this.getState() });
    this.refresh();
  }
  async onOpen(): Promise<void> { this.closed = false; const saved = this.plugin.workbenchStates.get(this.contentEl.ownerDocument); if (saved) await this.setState(saved, { history: false }); else this.refresh(); }
  private value(key: string): string { return this.controls.get(key)?.value ?? ''; }
  private initialize(): void {
    this.contentEl.empty(); this.contentEl.addClass('hb-panel');
    const header = this.contentEl.createDiv({ cls: 'hb-panel-header' }); header.createEl('h4', { attr: { tabindex: '-1' } });
    const more = action(header, this.plugin.t('more'), 'ellipsis', () => menuAt(more, menu => {
      menu.addItem(item => item.setTitle(this.plugin.t('rebuildIndex')).setIcon('refresh-cw').onClick(() => { void this.plugin.index.rebuild(); }));
      if (this.searchScope === 'collection' && this.value('collection')) menu.addItem(item => item.setTitle(this.plugin.t('deleteCollection')).setIcon('trash-2').onClick(() => {
        this.plugin.settings.collections = this.plugin.settings.collections.filter(collection => collection.id !== this.value('collection')); void this.plugin.saveSettings();
      }));
    }), 'hb-icon-only');
    const scopes = this.contentEl.createDiv({ cls: 'hb-scope-nav', attr: { role: 'group', 'aria-label': this.plugin.t('scope') } });
    for (const [scope, label] of [['note', 'noteScope'], ['folder', 'folderScope'], ['vault', 'vaultScope'], ['collection', 'collectionScope']] as const) {
      const button = scopes.createEl('button', { text: this.plugin.t(label), attr: { 'data-hb-scope': scope, 'data-hb-label': label } });
      button.addEventListener('click', () => { this.temporary = undefined; void this.setScope(scope); });
    }
    this.contentEl.addEventListener('scroll', () => this.app.workspace.requestSaveLayout());
    this.source = this.contentEl.createDiv({ cls: 'hb-current-source' });
    const collectionRow = this.contentEl.createDiv({ cls: 'hb-collection-row' });
    const searchRow = this.contentEl.createDiv({ cls: 'hb-search-row' });
    this.filterArea = this.contentEl.createEl('details', { cls: 'hb-filter-area' });
    this.filterArea.createEl('summary', { text: this.plugin.t('filters'), attr: { 'data-hb-label': 'filters' } });
    const filterGrid = this.filterArea.createDiv({ cls: 'hb-filter-grid' });
    this.chips = this.contentEl.createDiv({ cls: 'hb-filter-chips' });
    this.status = this.contentEl.createEl('p', { cls: 'hb-index-status', attr: { role: 'status' } });
    this.results = this.contentEl.createDiv({ cls: 'hb-results' });
    const resultHeader = this.results.createDiv({ cls: 'hb-result-header' });
    this.summary = resultHeader.createSpan({ cls: 'hb-summary' });
    for (const key of ['search', 'type-filter', 'semantic-filter', 'color-filter', 'language-filter', 'path-filter', 'sort', 'collection']) {
      const input = key === 'search' || key === 'path-filter';
      const parent = key === 'search' ? searchRow : key === 'sort' ? resultHeader : key === 'collection' ? collectionRow : filterGrid;
      const control = input ? parent.createEl('input', { type: key === 'search' ? 'search' : 'text', cls: `hb-${key}` }) : parent.createEl('select', { cls: `hb-${key}` });
      this.controls.set(key, control); control.addEventListener(input ? 'input' : 'change', () => this.refresh());
    }
    const add = action(collectionRow, this.plugin.t('newCollection'), 'plus', () => createCollection(this.plugin, async id => { this.controls.get('collection')!.value = id; await this.setScope('collection'); }, add)); add.dataset.hbWorkbenchAction = 'new-collection';
    const filters = action(searchRow, this.plugin.t('filters'), 'list-filter', () => { this.filterArea!.open = !this.filterArea!.open; filters.setAttribute('aria-expanded', String(this.filterArea!.open)); }, 'hb-icon-only');
    filters.setAttribute('aria-expanded', 'false');
    const exportButton = action(resultHeader, this.plugin.t('excerptPreview'), 'download', () => {
      new ExcerptModal(this.plugin, () => { this.refresh(); return { hits: this.hits, key: this.queryKey, description: [this.source?.textContent, ...[...this.controls].filter(([key, control]) => key !== 'sort' && key !== 'collection' && control.value).map(([, control]) => control.tagName === 'SELECT' ? (control as HTMLSelectElement).selectedOptions[0]?.textContent : control.value)].filter(Boolean).join(' · ') }; }, exportButton).open();
    }); exportButton.dataset.hbWorkbenchAction = 'preview';
    this.cards = this.results.createDiv({ cls: 'hb-result-cards' });
  }
  refresh(restorePage?: number): void {
    if (this.closed) return;
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active && (!this.note || active.containerEl.ownerDocument === this.contentEl.ownerDocument || active.file?.path === this.sourcePath)) this.setSource(active);
    if (!this.note && this.sourcePath) this.note = this.plugin.openView(this.sourcePath);
    if (!this.results) this.initialize();
    const t = this.plugin.t.bind(this.plugin);
    this.contentEl.querySelector('h4')!.textContent = this.getDisplayText();
    for (const [selector, message] of [['.hb-panel-header button', 'more'], ['[data-hb-workbench-action="new-collection"]', 'newCollection'], ['.hb-search-row button', 'filters'], ['[data-hb-workbench-action="preview"]', 'excerptPreview']] as const) {
      const button = this.contentEl.querySelector<HTMLButtonElement>(selector); if (!button) continue; button.setAttribute('aria-label', t(message)); button.title = t(message); button.lastElementChild!.textContent = t(message);
    }
    this.contentEl.querySelector('.hb-scope-nav')!.setAttribute('aria-label', t('scope'));
    const options = (key: string, title: Message, entries: [string, string][]) => {
      const select = this.controls.get(key) as HTMLSelectElement, value = select.value;
      select.setAttribute('aria-label', t(title));
      const keyValue = JSON.stringify(entries);
      if (this.optionKeys.get(key) !== keyValue) { select.replaceChildren(...entries.map(([value, label]) => {
        const option = detachedEl(select.ownerDocument, 'option'); option.value = value; option.textContent = label; return option;
      })); this.optionKeys.set(key, keyValue); }
      select.value = entries.some(([key]) => key === value) ? value : entries[0]?.[0] ?? '';
    };
    for (const button of this.contentEl.querySelectorAll<HTMLButtonElement>('[data-hb-scope]')) button.setAttribute('aria-pressed', String(button.dataset.hbScope === this.searchScope));
    options('type-filter', 'allTypes', [['', t('allTypes')], ['prose', t('prose')], ['inline-code', t('inlineCode')], ['code', t('code')]]);
    options('semantic-filter', 'allSemantics', [['', t('allSemantics')], ...this.plugin.settings.presets.map(preset => [preset.id, this.plugin.presetLabel(preset)] as [string, string])]);
    options('color-filter', 'allColors', [['', t('allColors')], ...colors.map(color => [color, this.plugin.colorLabel(color)] as [string, string])]);
    options('language-filter', 'allLanguages', [['', t('allLanguages')], ...[...new Set(this.plugin.index.all().flatMap(hit => hit.item.language ? [hit.item.language] : []))].sort().map(language => [language, language] as [string, string])]);
    options('sort', 'sortOrder', [['source', t('sourceOrder')], ['semantic', t('semanticOrder')]]);
    options('collection', 'chooseCollection', [['', t('chooseCollection')], ...this.plugin.settings.collections.map(collection => [collection.id, collection.name] as [string, string])]);
    this.controls.get('collection')!.hidden = this.searchScope !== 'collection';
    for (const [key, title] of [['search', this.searchScope === 'note' ? 'searchHighlights' : 'searchAllHighlights'], ['path-filter', 'pathFilter']] as const) {
      const input = this.controls.get(key) as HTMLInputElement; input.placeholder = t(title); input.setAttribute('aria-label', t(title));
    }
    for (const button of this.contentEl.querySelectorAll<HTMLButtonElement>('[data-hb-label]')) button.textContent = t(button.dataset.hbLabel as Message);
    this.contentEl.querySelector<HTMLElement>('.hb-collection-row')!.hidden = this.searchScope !== 'collection';
    this.chips!.empty();
    for (const key of ['type-filter', 'semantic-filter', 'color-filter', 'language-filter', 'path-filter']) {
      const control = this.controls.get(key)!; if (!control.value) continue;
      const label = control.tagName === 'SELECT' ? (control as HTMLSelectElement).selectedOptions[0]?.textContent ?? control.value : control.value;
      action(this.chips!, label + ' ×', 'x', () => { control.value = ''; this.refresh(); });
    }
    if (this.chips!.childElementCount) action(this.chips!, t('clearFilters'), 'filter-x', () => { for (const key of ['search', 'type-filter', 'semantic-filter', 'color-filter', 'language-filter', 'path-filter']) this.controls.get(key)!.value = ''; this.refresh(); });
    this.status!.textContent = t('indexedNotes', { count: this.plugin.index.notes.size }) + (this.plugin.index.errors.size ? ` · ${t('indexErrors', { count: this.plugin.index.errors.size })}` : '');
    if (this.plugin.index.errors.size) {
      const retry = action(this.status!, t('rebuildIndex'), 'refresh-cw', () => { for (const path of this.plugin.index.errors.keys()) void this.plugin.index.enqueue(path); });
      retry.dataset.hbRetry = 'true';
      const errors = this.status!.createEl('details'); errors.createEl('summary', { text: t('indexErrors', { count: this.plugin.index.errors.size }) });
      for (const [path, error] of this.plugin.index.errors) errors.createDiv({ text: `${path}: ${error}` });
    }
    this.status!.title = [...this.plugin.index.errors].map(([path, error]) => `${path}: ${error}`).join('\n');
    const results = this.results!;
    const view = this.note;
    const file = view?.file && this.app.workspace.getLeavesOfType('markdown').includes(view.leaf) ? view.file : undefined;
    if ((this.searchScope === 'note' || this.searchScope === 'folder') && (!file || this.app.vault.getFileByPath(file.path) !== file)) {
      this.hits = []; this.rendered = []; this.renderKey = ''; this.renderedNote = undefined;
      this.page = 0; this.queryKey = ''; this.summary!.textContent = t('panelEmpty'); this.source!.textContent = t('noteScope');
      this.cards!.empty(); action(this.cards!, t('vaultScope'), 'library', () => { void this.setScope('vault'); }); this.pagination?.remove(); this.pagination = undefined; return;
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
    if (this.temporary) all = all.filter(hit => this.temporary!.paths.has(hit.path) && (this.temporary!.blockFrom === undefined || hit.item.blockFrom === this.temporary!.blockFrom));
    this.hits = queryHighlights(all, query, label);
    this.page = Math.max(0, Math.min(restorePage ?? this.page, Math.ceil(this.hits.length / this.pageSize) - 1));
    const name = this.searchScope === 'note' ? file!.basename : this.searchScope === 'folder' ? file!.parent?.path || '/' : this.searchScope === 'collection' ? collection?.name || t('collectionScope') : t('vaultScope');
    this.source!.textContent = this.temporary?.label ?? name; this.source!.title = file?.path ?? name;
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
    const renderKey = JSON.stringify([queryKey, this.page, this.plugin.settings.codeDisplay.wrap, this.plugin.locale, this.plugin.settings.presets, this.plugin.settings.collections.map(({ id, name }) => [id, name])]);
    if (visible.length && renderKey === this.renderKey && this.renderedNote === this.note && visible.length === this.rendered.length && visible.every(({ hit, view, file }, index) => {
      const before = this.rendered[index]!; return hit.path === before.hit.path && hit.text === before.hit.text && hit.item === before.hit.item && hit.entryId === before.hit.entryId && view === before.view && file === before.file;
    })) return;
    this.renderKey = renderKey; this.rendered = visible; this.renderedNote = this.note;
    const scroll = this.contentEl.scrollTop;
    const focused = this.cards!.contains(this.contentEl.ownerDocument.activeElement) ? this.contentEl.ownerDocument.activeElement as HTMLElement : undefined;
    const focusItem = focused?.closest<HTMLElement>('[data-hb-item]')?.dataset.hbItem, focusClass = focused?.className;
    for (const details of this.cards!.querySelectorAll<HTMLDetailsElement>('details[data-hb-expanded]')) this.expanded.set(`${details.closest<HTMLElement>('[data-hb-item]')!.dataset.hbItem}:${details.dataset.hbExpanded}`, details.open);
    this.cards!.empty();
    if (!this.hits.length) this.cards!.createEl('p', { text: this.searchScope === 'collection' && !collection ? t('noCollection') : all.length ? t('noMatches') : t('noHighlights', { preset: this.plugin.presetLabel(this.plugin.getPreset('important')) }) });
    if (!this.hits.length) {
      if (all.length) action(this.cards!, t('clearFilters'), 'filter-x', () => { for (const key of ['search', 'type-filter', 'semantic-filter', 'color-filter', 'language-filter', 'path-filter']) this.controls.get(key)!.value = ''; this.refresh(); });
      else action(this.cards!, t(this.searchScope === 'collection' ? 'noteScope' : 'openSelectionToolbar'), 'highlighter', () => { if (this.searchScope === 'collection') void this.setScope('note'); else if (this.note) for (const toolbar of this.plugin.toolbars) if (toolbar.matches(this.note.editor)) toolbar.open(); });
    }
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
      const collection = this.plugin.settings.collections.find(collection => collection.id === this.value('collection'));
      renderCard(this.cards!, this.plugin, hit, context(hit.item), this.note, hit.entryId && collection ? () => { collection.entries = collection.entries.filter(entry => entry.id !== hit.entryId); void this.plugin.saveSettings(); } : undefined);
    }
    for (const details of this.cards!.querySelectorAll<HTMLDetailsElement>('details[data-hb-expanded]')) details.open = this.expanded.get(`${details.closest<HTMLElement>('[data-hb-item]')!.dataset.hbItem}:${details.dataset.hbExpanded}`) ?? false;
    if (focusItem) { const card = [...this.cards!.querySelectorAll<HTMLElement>('[data-hb-item]')].find(card => card.dataset.hbItem === focusItem); (card && [...card.querySelectorAll<HTMLElement>('button,summary')].find(button => button.className === focusClass) || this.contentEl.querySelector<HTMLElement>('h4'))?.focus({ preventScroll: true }); }
    this.contentEl.scrollTop = scroll;
  }
  async onClose(): Promise<void> {
    this.plugin.workbenchStates.set(this.contentEl.ownerDocument, this.getState());
    this.closed = true;
    this.hits = []; this.rendered = []; this.note = undefined; this.renderedNote = undefined;
    this.renderKey = ''; this.queryKey = ''; this.controls.clear(); this.optionKeys.clear(); this.excerptContexts.clear();
    this.contentEl.empty(); this.results = undefined; this.summary = undefined; this.cards = undefined; this.pagination = undefined;
  }
}
