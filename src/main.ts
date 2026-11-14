import { editorLivePreviewField, getLanguage, ItemView, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, setTooltip, SuggestModal, type Command, type Editor, type MarkdownPostProcessorContext, type WorkspaceLeaf } from 'obsidian';
import { collectItems } from './anchors';
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
import { inlineExcerpt } from './inline-rendering';
import { colorName, colorSearch, errorMessage, presetName, resolveLocale, translate, type Language, type Locale, type Message } from './i18n';
import type { Extension } from '@codemirror/state';
import { selectionToolbar } from './selection-toolbar';
import { planItemUpdate } from './item-editing';

const VIEW = 'highlight-boost';

export default class HighlightBoost extends Plugin {
  settings: Settings = normalizeSettings(null);
  private settingsWrites: Promise<void> = Promise.resolve();
  private translatedCommands: { command: Command; title: () => string }[] = [];
  private uiExtensions: Extension[] = [];
  private lastLocale?: Locale;
  private ribbon?: HTMLElement;
  private settingTab?: HighlightSettings;
  private colorPickers = new Set<ColorPicker>();
  private readingChildren = new Set<ReadingHighlights>();
  toolbars = new Set<{ refresh(): void; open(): void; matches(editor: Editor): boolean; destroy(): void }>();
  syntax?: SyntaxService;
  async onload(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.settings = normalizeSettings(loaded);
    this.lastLocale = this.locale;
    if (JSON.stringify(loaded) !== JSON.stringify(this.settings)) await this.saveSettings();
    if (this.settings.syntaxProvider === 'shiki') {
      this.syntax = this.addChild(new SyntaxService(this, (element, context) => this.createReadingChild(element, context), () => this.locale));
      await this.syntax.initialize();
    }
    this.uiExtensions.push(metadataLocale.of(this.locale), composingState, compositionEvents, highlightExtension, editorHistory, createMetadataFolding(editorLivePreviewField), selectionToolbar(this));
    this.registerEditorExtension(this.uiExtensions);
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
    this.addTranslatedCommand({ id: 'open-highlights', callback: () => { void this.openPanel(); } }, () => this.t('openPanel'));
    this.addTranslatedCommand({ id: 'copy-code', editorCallback: editor => { void this.copyCode(editor); } }, () => this.t('copyCode'));
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
    this.registerEvent(this.app.workspace.on('editor-change', (_editor, info) => {
      this.refreshPanels();
      for (const child of this.readingChildren) if (child.context.sourcePath === info.file?.path) child.refresh();
    }));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refreshPanels()));
    this.registerMarkdownPostProcessor((element, context) => {
      context.addChild(this.createReadingChild(element, context));
    }, 100);
    this.registerEvent(this.app.vault.on('modify', file => {
      this.refreshPanels();
      for (const child of this.readingChildren) if (child.context.sourcePath === file.path) child.refresh();
    }));
    this.registerEvent(this.app.vault.on('rename', () => this.refreshPanels()));
    this.registerEvent(this.app.vault.on('delete', () => this.refreshPanels()));
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
    const child = new ReadingHighlights(element, context, this.app, () => this.readingChildren.delete(child));
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
    if (changed && this.uiExtensions.length) {
      this.uiExtensions.splice(0, 1, metadataLocale.of(locale));
      this.app.workspace.updateOptions();
      if (this.ribbon) setTooltip(this.ribbon, this.t('panelTitle'));
      for (const picker of this.colorPickers) picker.refreshLocale();
      this.settingTab?.display();
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) updates.push(leaf.setViewState(leaf.getViewState()));
      if (this.syntax) updates.push(this.syntax.refresh());
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

  async openPanel(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? undefined;
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    this.refreshPanels();
  }

  refreshPanels(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) if (leaf.view instanceof HighlightsView) leaf.view.refresh();
  }

  onunload(): void {
    for (const toolbar of this.toolbars) toolbar.destroy();
    for (const picker of this.colorPickers) picker.close();
    for (const child of this.readingChildren) child.unload();
  }
}

class HighlightsView extends ItemView {
  private note: MarkdownView | undefined;
  constructor(leaf: WorkspaceLeaf, private plugin: HighlightBoost) { super(leaf); }
  getViewType(): string { return VIEW; }
  getDisplayText(): string { return this.plugin.t('panelTitle'); }
  getIcon(): string { return 'highlighter'; }
  async onOpen(): Promise<void> { this.refresh(); }
  refresh(): void {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) this.note = active;
    this.contentEl.empty();
    this.contentEl.addClass('hb-panel');
    this.contentEl.createEl('h4', { text: this.plugin.t('panelTitle') });
    const view = this.note;
    if (!view?.file) { this.contentEl.createEl('p', { text: this.plugin.t('panelEmpty') }); return; }
    const text = view.editor.getValue();
    const items = collectItems(text);
    this.contentEl.createEl('p', { text: this.plugin.t(items.length === 1 ? 'summaryOne' : 'summary', { note: view.file.basename, count: items.length }), cls: 'hb-summary' });
    if (!items.length) this.contentEl.createEl('p', { text: this.plugin.t('noHighlights', { preset: this.plugin.presetLabel(this.plugin.getPreset('important')) }) });
    for (const item of items) this.card(view, item);
  }
  private card(view: MarkdownView, item: HighlightItem): void {
    const card = this.contentEl.createDiv({ cls: `hb-card hb-${item.color}` });
    if (item.semantic) card.dataset.hbSemantic = item.semantic;
    const jump = card.createEl('button', { text: item.quote || this.plugin.t('blankLine'), cls: item.kind === 'prose' ? 'hb-quote' : 'hb-quote hb-code-quote' });
    const label = item.markId ? item.label : this.plugin.colorLabel(item.color);
    const info = item.kind === 'prose' ? this.plugin.t('prose') : item.kind === 'inline-code' ? this.plugin.t('inlineInfo', { line: item.line! }) : this.plugin.t('codeInfo', { language: item.language || this.plugin.t('code'), line: item.line! });
    card.createEl('small', { text: `${label} · ${info}${item.status === 'resolved' ? '' : ` · ${this.plugin.t('pending')}`}` });
    this.registerDomEvent(jump, 'click', () => {
      if (item.status !== 'resolved') { new Notice(this.plugin.t('contentChanged')); return; }
      void this.app.workspace.revealLeaf(view.leaf);
      const from = view.editor.offsetToPos(item.from), to = view.editor.offsetToPos(item.to);
      view.editor.setSelection(from, to);
      view.editor.scrollIntoView({ from, to }, true);
      view.editor.focus();
    });
    if (item.kind === 'code-line' || item.kind === 'code-range') {
      const rebind = card.createEl('button', { text: this.plugin.t('rebind'), cls: 'hb-rebind' });
      rebind.title = this.plugin.t('rebindHint');
      this.registerDomEvent(rebind, 'click', () => this.plugin.rebind(view.editor, item));
    }
    const copy = card.createEl('button', { text: this.plugin.t('copyExcerpt'), cls: 'hb-copy-excerpt' });
    this.registerDomEvent(copy, 'click', () => {
      const quote = item.kind === 'prose' ? `> ${item.quote}` : item.kind === 'inline-code' ? inlineExcerpt(item.quote) : `\`\`\`${item.language}\n${item.quote}\n\`\`\``;
      void navigator.clipboard.writeText(`${quote}\n\n${this.plugin.t('sourceLine', { path: view.file!.path, label })}`);
    });
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
