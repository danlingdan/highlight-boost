import { editorLivePreviewField, getLanguage, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, setTooltip, SuggestModal, TFile, type Command, type Editor, type MarkdownPostProcessorContext } from 'obsidian';
import { colorPreset, colors, type Color, type EditPlan, type HighlightItem, type Preset } from './domain';
import { applyChanges, planCodeRebind, planHighlight } from './editing';
import { parseDocument, sourceLines } from './parsing';
import { highlightExtension } from './rendering';
import { editorHistory } from './history';
import { createMetadataFolding, metadataLocale } from './metadata-folding';
import { ReadingHighlights } from './reading-view';
import { composingState, compositionEvents } from './composition';
import { normalizeSettings, type ConfiguredPreset, type Settings } from './settings';
import { SyntaxService } from './syntax/service';
import { colorName, colorSearch, errorMessage, presetName, resolveLocale, translate, type Language, type Locale, type Message } from './i18n';
import type { Extension } from '@codemirror/state';
import { selectionToolbar } from './selection-toolbar';
import { currentItem, planItemUpdate } from './item-editing';
import { excerptContext, formatExcerpt } from './excerpts';
import { HighlightIndex, type IndexHit } from './vault-index';
import { renameCollections, collectionEntry, resolveEntry } from './collections';
import { HighlightsView } from './workbench';
import type { SearchScope } from './query';
import { planNote } from './notes';
import { codeDisplayFacet, codeDisplayKey, diffAfter, unfoldSelectedCode } from './code-options';
import { liveCalloutHighlights } from './live-callouts';
import { createMigrationService } from './migration-obsidian';
import type { MigrationService } from './migration-service';
import { MigrationModal } from './migration-ui';

const VIEW = 'highlight-boost';

export default class HighlightBoost extends Plugin {
  settings: Settings = normalizeSettings(null);
  private settingsWrites: Promise<void> = Promise.resolve();
  private translatedCommands: { command: Command; title: () => string }[] = [];
  private uiExtensions: Extension[] = [];
  private lastLocale?: Locale;
  private lastDisplay = '';
  readonly codeDisplaySessions = new Map<string, boolean>();
  private ribbon?: HTMLElement;
  private settingTab?: HighlightSettings;
  private colorPickers = new Set<ColorPicker>();
  private readingChildren = new Set<ReadingHighlights>();
  toolbars = new Set<{ refresh(): void; open(): void; matches(editor: Editor): boolean; destroy(): void }>();
  syntax?: SyntaxService;
  index!: HighlightIndex;
  migrations!: MigrationService;
  async onload(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.settings = normalizeSettings(loaded);
    this.migrations = createMigrationService(this, path => this.openView(path));
    this.lastLocale = this.locale;
    this.lastDisplay = JSON.stringify(this.settings.codeDisplay);
    this.index = new HighlightIndex({
      paths: () => this.app.vault.getMarkdownFiles().map(file => file.path),
      read: async path => {
        const view = this.openView(path);
        if (view) return view.editor.getValue();
        const file = this.app.vault.getFileByPath(path);
        if (!file) throw new Error(path);
        return this.app.vault.cachedRead(file);
      },
    }, () => this.refreshPanels());
    if (JSON.stringify(loaded) !== JSON.stringify(this.settings)) await this.saveSettings();
    if (this.settings.syntaxProvider === 'shiki') {
      this.syntax = this.addChild(new SyntaxService(this, (element, context) => this.createReadingChild(element, context), () => this.locale));
      await this.syntax.initialize();
    }
    this.uiExtensions.push(metadataLocale.of(this.locale), codeDisplayFacet.of(this.settings.codeDisplay), composingState, compositionEvents, highlightExtension, editorHistory, createMetadataFolding(editorLivePreviewField), selectionToolbar(this), unfoldSelectedCode);
    this.registerEditorExtension(this.uiExtensions);
    this.registerEditorExtension(liveCalloutHighlights((element, context) => this.createReadingChild(element, context)));
    this.registerView(VIEW, leaf => new HighlightsView(leaf, this));
    this.settingTab = new HighlightSettings(this);
    this.addSettingTab(this.settingTab);
    for (const preset of this.settings.presets) {
      for (const lines of [false, true]) {
        this.addTranslatedCommand({
          id: `${lines ? 'lines' : 'apply'}-${preset.id}`,
          editorCallback: editor => this.apply(editor, this.presetForAction(preset.id), lines ? 'lines' : 'text'),
        }, () => this.t(lines ? 'linesPreset' : 'applyPreset', { preset: this.presetLabel(this.getPreset(preset.id)) }));
      }
    }
    for (const color of colors) this.addTranslatedCommand({
      id: `color-${color}`, editorCallback: editor => this.applyColor(editor, color),
    }, () => this.t('colorCommand', { color: this.colorLabel(color) }));
    this.addTranslatedCommand({ id: 'choose-color', editorCallback: editor => this.chooseColor(editor) }, () => this.t('chooseColor'));
    this.addTranslatedCommand({ id: 'remove', editorCallback: editor => this.apply(editor, null) }, () => this.t('remove'));
    this.addTranslatedCommand({ id: 'open-highlights', callback: () => { void this.openPanel('note'); } }, () => this.t('openPanel'));
    this.addTranslatedCommand({ id: 'open-workbench', callback: () => { void this.openPanel('vault'); } }, () => this.t('workbench'));
    this.addTranslatedCommand({ id: 'open-migration', callback: () => new MigrationModal(this).open() }, () => this.t('migration'));
    this.addTranslatedCommand({ id: 'copy-code', editorCallback: editor => { void this.copyCode(editor); } }, () => this.t('copyCode'));
    this.addTranslatedCommand({ id: 'copy-diff-after', editorCallback: editor => { void this.copyDiffAfter(editor); } }, () => this.t('copyDiffAfter'));
    this.addTranslatedCommand({ id: 'selection-toolbar', editorCallback: editor => {
      for (const toolbar of this.toolbars) if (toolbar.matches(editor)) toolbar.open();
    } }, () => this.t('openSelectionToolbar'));
    this.ribbon = this.addRibbonIcon('highlighter', this.t('panelTitle'), () => { void this.openPanel(); });
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
      for (const preset of this.settings.presets) menu.addItem(item => item.setTitle(this.t('applyPreset', { preset: this.presetLabel(preset) })).setIcon('highlighter').onClick(() => this.apply(editor, this.presetForAction(preset.id))));
      menu.addSeparator();
      menu.addItem(item => item.setTitle(`${this.t('chooseColor')}…`).setIcon('palette').onClick(() => this.chooseColor(editor)));
      menu.addItem(item => item.setTitle(this.t('markLines')).setIcon('list-ordered').onClick(() => this.apply(editor, this.defaultPreset(), 'lines')));
      menu.addItem(item => item.setTitle(this.t('remove')).setIcon('eraser').onClick(() => this.apply(editor, null)));
    }));
    this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
      if (info.file?.extension === 'md') this.index.set(info.file.path, editor.getValue());
      this.refreshPanels();
      for (const child of this.readingChildren) if (child.context.sourcePath === info.file?.path) child.refresh();
    }));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refreshPanels()));
    this.registerMarkdownPostProcessor((element, context) => {
      context.addChild(this.createReadingChild(element, context));
    }, 100);
    this.registerEvent(this.app.vault.on('modify', file => {
      if (file instanceof TFile && file.extension === 'md') void this.index.enqueue(file.path);
      this.refreshPanels();
      for (const child of this.readingChildren) if (child.context.sourcePath === file.path) child.refresh();
    }));
    this.registerEvent(this.app.vault.on('create', file => { if (file instanceof TFile && file.extension === 'md') void this.index.enqueue(file.path); }));
    this.registerEvent(this.app.vault.on('rename', (file, before) => {
      this.index.rename(before, file.path);
      if (file instanceof TFile && file.extension !== 'md') this.index.remove(file.path);
      for (const note of this.app.vault.getMarkdownFiles()) if (note.path === file.path || note.path.startsWith(`${file.path}/`)) void this.index.enqueue(note.path);
      if (renameCollections(this.settings.collections, before, file.path)) void this.saveSettings();
      this.refreshPanels();
    }));
    this.registerEvent(this.app.vault.on('delete', file => { this.index.remove(file.path); this.refreshPanels(); }));
    this.app.workspace.onLayoutReady(() => { void this.index.rebuild(); });
  }

  get locale(): Locale { return resolveLocale(this.settings.language, getLanguage()); }
  t(key: Message, values?: Record<string, string | number>): string { return translate(this.locale, key, values); }
  colorLabel(color: Color): string { return colorName(color, this.locale); }
  presetLabel(preset: ConfiguredPreset): string { return presetName(preset, this.locale); }
  getPreset(id: string): ConfiguredPreset { return this.settings.presets.find(preset => preset.id === id) ?? this.settings.presets[0]!; }
  presetForAction(id: string): Preset { const preset = this.getPreset(id); return { ...preset, name: this.presetLabel(preset) }; }
  applyColor(editor: Editor, color: Color, mode: 'text' | 'lines' = 'text'): void {
    if (this.apply(editor, { ...colorPreset(color), name: this.colorLabel(color) }, mode)) {
      this.settings.recentColors = [color, ...this.settings.recentColors.filter(item => item !== color)].slice(0, 3);
      void this.saveSettings();
    }
  }
  chooseColor(editor: Editor): void {
    const picker = new ColorPicker(this, editor, () => this.colorPickers.delete(picker));
    this.colorPickers.add(picker);
    picker.open();
  }
  private addTranslatedCommand(command: Omit<Command, 'name'>, title: () => string): void {
    this.translatedCommands.push({ command: this.addCommand({ ...command, name: title() }), title });
  }
  private createReadingChild(element: HTMLElement, context: MarkdownPostProcessorContext): ReadingHighlights {
    const child = new ReadingHighlights(element, context, this.app, () => this.readingChildren.delete(child), () => this.locale, () => this.settings.codeDisplay, this.codeDisplaySessions);
    this.readingChildren.add(child);
    return child;
  }
  defaultPreset(): Preset { return this.presetForAction(this.settings.defaultPreset); }

  saveSettings(): Promise<void> {
    this.settings = normalizeSettings(this.settings);
    for (const entry of this.translatedCommands) entry.command.name = `${this.manifest.name}: ${entry.title()}`;
    const locale = this.locale, changed = this.lastLocale !== locale;
    this.lastLocale = locale;
    const updates: Promise<unknown>[] = [];
    const display = JSON.stringify(this.settings.codeDisplay), displayChanged = display !== this.lastDisplay;
    this.lastDisplay = display;
    if (displayChanged && this.uiExtensions.length) {
      this.uiExtensions.splice(1, 1, codeDisplayFacet.of(this.settings.codeDisplay));
      this.app.workspace.updateOptions();
      for (const child of this.readingChildren) child.refresh();
    }
    if (changed && this.uiExtensions.length) {
      this.uiExtensions.splice(0, 1, metadataLocale.of(locale));
      this.app.workspace.updateOptions();
      if (this.ribbon) setTooltip(this.ribbon, this.t('panelTitle'));
      for (const picker of this.colorPickers) picker.refreshLocale();
      this.settingTab?.display();
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) updates.push(leaf.setViewState(leaf.getViewState()));
      if (this.syntax) updates.push(this.syntax.refresh());
      for (const child of this.readingChildren) child.refresh();
    }
    this.refreshPanels();
    for (const toolbar of this.toolbars) toolbar.refresh();
    const snapshot = structuredClone(this.settings);
    const write = this.settingsWrites.catch(() => {}).then(() => this.saveData(snapshot));
    this.settingsWrites = write;
    return Promise.all([write, ...updates]).then(() => {});
  }

  apply(editor: Editor, preset: Preset | null, mode: 'text' | 'lines' = 'text'): boolean {
    try {
      const selections = editor.listSelections().map(selection => {
        const a = editor.posToOffset(selection.anchor), b = editor.posToOffset(selection.head);
        return { from: Math.min(a, b), to: Math.max(a, b) };
      });
      const plan = planHighlight(editor.getValue(), selections, preset, mode);
      this.commitPlan(editor, plan);
      return plan.changes.length > 0;
    } catch (error) { new Notice(errorMessage(error, this.locale)); return false; }
  }

  updateItem(editor: Editor, item: HighlightItem, preset: Preset | null): void {
    try { this.commitPlan(editor, planItemUpdate(editor.getValue(), item, preset)); }
    catch (error) { new Notice(errorMessage(error, this.locale)); }
  }
  saveNote(editor: Editor, item: HighlightItem, note: string): void {
    const plan = planNote(editor.getValue(), item, note, item.markId ? item.label : this.colorLabel(item.color));
    if (plan.changes.length) this.commitPlan(editor, plan);
  }
  async editNoteHit(hit: IndexHit, note: string): Promise<void> {
    const file = this.app.vault.getFileByPath(hit.path);
    if (!file) throw new Error(this.t('missingSource'));
    let view = this.openView(hit.path);
    if (!view) { const leaf = this.app.workspace.getLeaf('tab'); await leaf.openFile(file); view = leaf.view as MarkdownView; }
    if (view.getMode() === 'preview') await view.leaf.setViewState({ type: 'markdown', state: { ...view.getState(), mode: 'source', source: false } });
    if (view.file !== file) throw new Error(this.t('staleMark'));
    this.saveNote(view.editor, hit.item, note);
  }

  async jumpToItem(view: MarkdownView, reference: HighlightItem): Promise<void> {
    try {
      const file = view.file;
      if (!file) return;
      currentItem(view.editor.getValue(), reference);
      if (reference.blockFrom !== undefined) {
        const blocks = parseDocument(view.editor.getValue()).blocks, block = blocks.find(block => block.fenceFrom === reference.blockFrom);
        if (block) this.codeDisplaySessions.set(codeDisplayKey(file.path, block, blocks), false);
        for (const child of this.readingChildren) if (child.context.sourcePath === file.path) { child.revealCode(view.editor.getValue(), reference.blockFrom); child.refresh(); }
      }
      await this.app.workspace.revealLeaf(view.leaf);
      if (view.getMode() === 'preview') await view.leaf.setViewState({ type: 'markdown', state: { ...view.getState(), mode: 'source', source: false } });
      if (view.file !== file) throw new Error(this.t('staleMark'));
      const item = currentItem(view.editor.getValue(), reference);
      const from = view.editor.offsetToPos(item.from), to = view.editor.offsetToPos(item.to);
      view.editor.setSelection(from, to);
      view.editor.scrollIntoView({ from, to }, true);
      view.editor.focus();
    } catch (error) { new Notice(errorMessage(error, this.locale)); }
  }

  rebind(editor: Editor, item: HighlightItem): void {
    try {
      const selections = editor.listSelections();
      if (selections.length !== 1) throw new Error(this.t('selectTarget'));
      const selected = selections[0]!;
      const a = editor.posToOffset(selected.anchor), b = editor.posToOffset(selected.head);
      this.commitPlan(editor, planCodeRebind(editor.getValue(), item, { from: Math.min(a, b), to: Math.max(a, b) }));
    } catch (error) { new Notice(errorMessage(error, this.locale)); }
  }

  private commitPlan(editor: Editor, plan: EditPlan): void {
      if (!plan.changes.length) { new Notice(this.t('selectText')); return; }
      const before = editor.getValue();
      const updated = applyChanges(before, plan.changes);
      const updatedLines = sourceLines(updated);
      const position = (offset: number) => {
        const line = [...updatedLines].reverse().find(line => line.from <= offset)!;
        return { line: line.number - 1, ch: offset - line.from };
      };
      editor.transaction({
        changes: plan.changes.map(change => ({ from: editor.offsetToPos(change.from), to: editor.offsetToPos(change.to), text: change.insert })),
        selections: plan.selections.map(span => ({ from: position(span.from), to: position(span.to) })),
      }, 'highlight-boost');
      this.refreshPanels();
  }

  async copyCode(editor: Editor): Promise<void> {
    const position = editor.posToOffset(editor.getCursor());
    const block = parseDocument(editor.getValue()).blocks.find(block => block.from <= position && position <= block.to);
    if (!block) { new Notice(this.t('cursorInCode')); return; }
    await navigator.clipboard.writeText(block.text);
    new Notice(this.t('copiedCode'));
  }
  async copyDiffAfter(editor: Editor): Promise<void> {
    const position = editor.posToOffset(editor.getCursor());
    const block = parseDocument(editor.getValue()).blocks.find(block => block.from <= position && position <= block.to && block.language === 'diff');
    if (!block) { new Notice(this.t('cursorInDiff')); return; }
    await navigator.clipboard.writeText(diffAfter(block.text)); new Notice(this.t('copiedCode'));
  }

  openView(path: string): MarkdownView | undefined {
    return this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view).find((view): view is MarkdownView => view instanceof MarkdownView && view.file?.path === path);
  }
  async editHit(hit: IndexHit, run: (view: MarkdownView) => void | Promise<void>): Promise<void> {
    try {
      const file = this.app.vault.getFileByPath(hit.path);
      if (!file) { new Notice(this.t('missingSource')); return; }
      let view = this.openView(hit.path);
      if (!view) {
        const leaf = this.app.workspace.getLeaf('tab'); await leaf.openFile(file); view = leaf.view as MarkdownView;
      }
      if (view.getMode() === 'preview') await view.leaf.setViewState({ type: 'markdown', state: { ...view.getState(), mode: 'source', source: false } });
      if (view.file !== file) throw new Error(this.t('staleMark'));
      currentItem(view.editor.getValue(), hit.item);
      await run(view);
    } catch (error) { new Notice(errorMessage(error, this.locale)); }
  }
  excerpt(hit: IndexHit): string {
    const file = this.app.vault.getFileByPath(hit.path), context = excerptContext(hit.text, hit.item);
    const subpath = context.blockId ? `#^${context.blockId}` : context.heading ? `#${context.heading}` : '';
    const link = file ? this.app.fileManager.generateMarkdownLink(file, '', subpath) : `[${hit.path.replace(/[\\[\]]/g, '\\$&')}](<${encodeURI(hit.path).replaceAll('#', '%23').replaceAll('>', '%3E')}>)`;
    return formatExcerpt(hit.item, context, link, hit.item.markId ? hit.item.label : this.colorLabel(hit.item.color), this.locale, this.settings.excerptTemplate);
  }
  async addToCollection(id: string, hit: IndexHit): Promise<void> {
    const collection = this.settings.collections.find(collection => collection.id === id);
    if (!collection) return;
    if (!collection.entries.some(entry => entry.path === hit.path && resolveEntry(this.index.notes.get(entry.path), entry).item.id === hit.item.id)) collection.entries.push(collectionEntry(hit));
    await this.saveSettings();
  }
  async exportHits(hits: IndexHit[]): Promise<TFile | undefined> {
    if (!hits.length) { new Notice(this.t('noExport')); return; }
    const folder = 'Highlight Boost';
    if (!this.app.vault.getFolderByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch (error) { if (!this.app.vault.getFolderByPath(folder)) throw error; }
    }
    const title = this.t('excerptNoteTitle'), path = `${folder}/${title}-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}.md`;
    const text = `---\nhighlight-boost-export: true\n---\n\n# ${title}\n\n${hits.map(hit => this.excerpt(hit)).join('\n\n---\n\n')}\n`;
    const file = await this.app.vault.create(path, text);
    new Notice(this.t('exported', { path })); return file;
  }
  async openPanel(scope: SearchScope = 'note'): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? undefined;
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof HighlightsView) await leaf.view.setScope(scope, true);
    this.refreshPanels();
  }

  refreshPanels(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) if (leaf.view instanceof HighlightsView) leaf.view.refresh();
  }

  onunload(): void {
    this.index.dispose();
    for (const toolbar of this.toolbars) toolbar.destroy();
    for (const picker of this.colorPickers) picker.close();
    for (const child of this.readingChildren) child.unload();
    this.codeDisplaySessions.clear();
  }
}

class HighlightSettings extends PluginSettingTab {
  constructor(private plugin: HighlightBoost) { super(plugin.app, plugin); }
  display(): void {
    this.containerEl.empty();
    const t = this.plugin.t.bind(this.plugin);
    new Setting(this.containerEl).setName(t('language')).setDesc(t('languageHint')).addDropdown(dropdown => {
      dropdown.selectEl.dataset.hbSetting = 'language';
      dropdown.selectEl.setAttribute('aria-label', t('language'));
      dropdown.addOption('auto', t('autoLanguage')).addOption('zh', '中文').addOption('en', 'English')
        .setValue(this.plugin.settings.language).onChange(async value => {
          this.plugin.settings.language = value as Language;
          await this.plugin.saveSettings();
        });
    });
    new Setting(this.containerEl).setName(t('syntax')).setDesc(t('syntaxHint')).addDropdown(dropdown => {
      dropdown.selectEl.dataset.hbSetting = 'syntax';
      dropdown.selectEl.setAttribute('aria-label', t('syntax'));
      dropdown.addOption('native', t('native')).addOption('shiki', t('builtinShiki'))
      .setValue(this.plugin.settings.syntaxProvider).onChange(async value => {
        this.plugin.settings.syntaxProvider = value as 'native' | 'shiki';
        await this.plugin.saveSettings();
      });
    });
    new Setting(this.containerEl).setName(t('selectionToolbar')).setDesc(t('selectionToolbarHint')).addToggle(toggle => {
      toggle.toggleEl.dataset.hbSetting = 'selectionToolbar';
      toggle.setValue(this.plugin.settings.selectionToolbar).onChange(async value => {
        this.plugin.settings.selectionToolbar = value;
        await this.plugin.saveSettings();
      });
    });
    this.containerEl.createEl('h3', { text: t('codeDisplay') });
    new Setting(this.containerEl).setName(t('migration')).setDesc(t('migrationHint')).addButton(button => button.setButtonText(t('migration')).onClick(() => new MigrationModal(this.plugin).open()));
    this.containerEl.createEl('p', { text: t('codeDisplayHint') });
    for (const [key, label] of [['showTitle', 'showCodeTitle'], ['showLineNumbers', 'showCodeNumbers'], ['collapsible', 'foldCode'], ['collapseByDefault', 'foldByDefault'], ['wrap', 'wrapCode'], ['diff', 'showDiff']] as const) {
      new Setting(this.containerEl).setName(t(label)).addToggle(toggle => {
        toggle.toggleEl.dataset.hbCodeSetting = key;
        toggle.setValue(this.plugin.settings.codeDisplay[key]).onChange(async value => { this.plugin.settings.codeDisplay[key] = value; await this.plugin.saveSettings(); });
      });
    }
    new Setting(this.containerEl).setName(t('startCodeLine')).addText(text => {
      text.inputEl.type = 'number'; text.inputEl.min = '1'; text.inputEl.max = '1000000'; text.inputEl.step = '1'; text.inputEl.dataset.hbCodeSetting = 'startLine'; text.inputEl.setAttribute('aria-label', t('startCodeLine'));
      text.setValue(String(this.plugin.settings.codeDisplay.startLine)).onChange(async value => { this.plugin.settings.codeDisplay.startLine = Number(value); await this.plugin.saveSettings(); });
    });
    new Setting(this.containerEl).setName(t('codeNumberFont')).addDropdown(dropdown => {
      dropdown.selectEl.dataset.hbCodeSetting = 'numberFont'; dropdown.selectEl.setAttribute('aria-label', t('codeNumberFont'));
      dropdown.addOption('monospace', t('monospaceFont')).addOption('interface', t('interfaceFont')).setValue(this.plugin.settings.codeDisplay.numberFont).onChange(async value => {
        this.plugin.settings.codeDisplay.numberFont = value as 'monospace' | 'interface'; await this.plugin.saveSettings();
      });
    });
    let defaults: HTMLSelectElement;
    new Setting(this.containerEl).setName(t('defaultPreset')).setDesc(t('defaultPresetHint')).addDropdown(dropdown => {
      defaults = dropdown.selectEl;
      defaults.dataset.hbSetting = 'defaultPreset';
      defaults.setAttribute('aria-label', t('defaultPreset'));
      for (const preset of this.plugin.settings.presets) dropdown.addOption(preset.id, this.plugin.presetLabel(preset));
      dropdown.setValue(this.plugin.settings.defaultPreset).onChange(async value => {
        this.plugin.settings.defaultPreset = value;
        await this.plugin.saveSettings();
      });
    });
    this.containerEl.createEl('h3', { text: t('presets') });
    this.containerEl.createEl('p', { text: t('presetsHint') });
    for (const preset of this.plugin.settings.presets) {
      const name = this.plugin.presetLabel(preset);
      const row = new Setting(this.containerEl).setName(name);
      row.addText(text => {
        text.inputEl.dataset.hbPreset = preset.id;
        text.inputEl.setAttribute('aria-label', t('presetName', { preset: name }));
        text.setPlaceholder(name).setValue(name).onChange(async value => {
          this.plugin.getPreset(preset.id).name = value;
          this.plugin.getPreset(preset.id).customName = true;
          await this.plugin.saveSettings();
          row.nameEl.textContent = this.plugin.presetLabel(this.plugin.getPreset(preset.id));
          for (const option of defaults.options) option.textContent = this.plugin.presetLabel(this.plugin.getPreset(option.value));
        });
      }).addDropdown(dropdown => {
          dropdown.selectEl.dataset.hbPresetColor = preset.id;
          dropdown.selectEl.setAttribute('aria-label', t('presetColor', { preset: name }));
          for (const color of colors) dropdown.addOption(color, this.plugin.colorLabel(color));
          dropdown.setValue(preset.color).onChange(async value => {
            this.plugin.getPreset(preset.id).color = value as Color;
            await this.plugin.saveSettings();
          });
        });
    }
    new Setting(this.containerEl).setName(t('resetPresets')).addButton(button => button.setButtonText(t('reset')).onClick(async () => {
      this.plugin.settings = normalizeSettings({ ...this.plugin.settings, presets: undefined, defaultPreset: undefined });
      await this.plugin.saveSettings();
      this.display();
    }));
    this.containerEl.createEl('p', { text: t('shortcutsHint') });
  }
}

class ColorPicker extends SuggestModal<Color> {
  constructor(private plugin: HighlightBoost, private editor: Editor, private dispose: () => void) {
    super(plugin.app);
    this.refreshLocale();
  }
  refreshLocale(): void {
    this.setPlaceholder(this.plugin.t('chooseColor'));
    this.inputEl.setAttribute('aria-label', this.plugin.t('chooseColor'));
    if (this.inputEl.isConnected) this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  getSuggestions(query: string): Color[] { return colors.filter(color => colorSearch(color, this.plugin.locale, query)); }
  renderSuggestion(color: Color, element: HTMLElement): void { element.createSpan({ text: this.plugin.colorLabel(color) }); }
  onChooseSuggestion(color: Color): void { this.plugin.applyColor(this.editor, color); }
  onClose(): void { super.onClose(); this.dispose(); }
}
