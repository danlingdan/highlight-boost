import { editorLivePreviewField, ItemView, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, SuggestModal, type Command, type Editor, type MarkdownPostProcessorContext, type WorkspaceLeaf } from 'obsidian';
import { collectItems } from './anchors';
import { colorLabels, colorPreset, colors, type Color, type EditPlan, type HighlightItem, type Preset } from './domain';
import { applyChanges, planCodeRebind, planHighlight } from './editing';
import { parseDocument, sourceLines } from './parsing';
import { highlightExtension } from './rendering';
import { editorHistory } from './history';
import { createMetadataFolding } from './metadata-folding';
import { ReadingHighlights } from './reading-view';
import { composingState, compositionEvents } from './composition';
import { normalizeSettings, type Settings } from './settings';
import { SyntaxService } from './syntax/service';
import { inlineExcerpt } from './inline-rendering';

const VIEW = 'highlight-boost';

export default class HighlightBoost extends Plugin {
  settings: Settings = normalizeSettings(null);
  private settingsWrites: Promise<void> = Promise.resolve();
  private presetCommands: { id: string; lines: boolean; command: Command }[] = [];
  private readingChildren = new Set<ReadingHighlights>();
  syntax?: SyntaxService;
  async onload(): Promise<void> {
    const loaded: unknown = await this.loadData();
    this.settings = normalizeSettings(loaded);
    if (JSON.stringify(loaded) !== JSON.stringify(this.settings)) await this.saveSettings();
    if (this.settings.syntaxProvider === 'shiki') {
      this.syntax = this.addChild(new SyntaxService(this, (element, context) => this.createReadingChild(element, context)));
      await this.syntax.initialize();
    }
    this.registerEditorExtension([composingState, compositionEvents, highlightExtension, editorHistory, createMetadataFolding(editorLivePreviewField)]);
    this.registerView(VIEW, leaf => new HighlightsView(leaf, this));
    this.addSettingTab(new HighlightSettings(this));
    for (const preset of this.settings.presets) {
      for (const lines of [false, true]) {
        const command = this.addCommand({
          id: `${lines ? 'lines' : 'apply'}-${preset.id}`, name: `${lines ? '代码行：' : '标记为'}${preset.name}`,
          editorCallback: editor => this.apply(editor, this.getPreset(preset.id), lines ? 'lines' : 'text'),
        });
        this.presetCommands.push({ id: preset.id, lines, command });
      }
    }
    for (const color of colors) this.addCommand({
      id: `color-${color}`, name: `高亮颜色：${colorLabels[color]}`,
      editorCallback: editor => this.apply(editor, colorPreset(color)),
    });
    this.addCommand({ id: 'choose-color', name: '选择高亮颜色', editorCallback: editor => new ColorPicker(this, editor).open() });
    this.addCommand({ id: 'remove', name: '移除所选标注', editorCallback: editor => this.apply(editor, null) });
    this.addCommand({ id: 'open-highlights', name: '打开当前笔记重点', callback: () => { void this.openPanel(); } });
    this.addCommand({ id: 'copy-code', name: '复制当前代码块', editorCallback: editor => { void this.copyCode(editor); } });
    this.addRibbonIcon('highlighter', '当前笔记重点', () => { void this.openPanel(); });
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
      for (const preset of this.settings.presets) menu.addItem(item => item.setTitle(`标记为${preset.name}`).setIcon('highlighter').onClick(() => this.apply(editor, preset)));
      menu.addSeparator();
      menu.addItem(item => item.setTitle('选择高亮颜色…').setIcon('palette').onClick(() => new ColorPicker(this, editor).open()));
      menu.addItem(item => item.setTitle('标记所选代码行').setIcon('list-ordered').onClick(() => this.apply(editor, this.defaultPreset(), 'lines')));
      menu.addItem(item => item.setTitle('移除所选标注').setIcon('eraser').onClick(() => this.apply(editor, null)));
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
      for (const child of this.readingChildren) if (child.context.sourcePath === file.path) child.refresh();
    }));
  }

  getPreset(id: string): Preset { return this.settings.presets.find(preset => preset.id === id) ?? this.settings.presets[0]!; }
  private createReadingChild(element: HTMLElement, context: MarkdownPostProcessorContext): ReadingHighlights {
    const child = new ReadingHighlights(element, context, this.app, () => this.readingChildren.delete(child));
    this.readingChildren.add(child);
    return child;
  }
  defaultPreset(): Preset { return this.getPreset(this.settings.defaultPreset); }

  saveSettings(): Promise<void> {
    this.settings = normalizeSettings(this.settings);
    for (const entry of this.presetCommands) entry.command.name = `${this.manifest.name}: ${entry.lines ? '代码行：' : '标记为'}${this.getPreset(entry.id).name}`;
    const snapshot = structuredClone(this.settings);
    const write = this.settingsWrites.catch(() => {}).then(() => this.saveData(snapshot));
    this.settingsWrites = write;
    return write;
  }

  apply(editor: Editor, preset: Preset | null, mode: 'text' | 'lines' = 'text'): void {
    try {
      const selections = editor.listSelections().map(selection => {
        const a = editor.posToOffset(selection.anchor), b = editor.posToOffset(selection.head);
        return { from: Math.min(a, b), to: Math.max(a, b) };
      });
      const plan = planHighlight(editor.getValue(), selections, preset, mode);
      this.commitPlan(editor, plan);
    } catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
  }

  rebind(editor: Editor, item: HighlightItem): void {
    try {
      const selections = editor.listSelections();
      if (selections.length !== 1) throw new Error('请选择一处新的标注位置。');
      const selected = selections[0]!;
      const a = editor.posToOffset(selected.anchor), b = editor.posToOffset(selected.head);
      this.commitPlan(editor, planCodeRebind(editor.getValue(), item, { from: Math.min(a, b), to: Math.max(a, b) }));
    } catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
  }

  private commitPlan(editor: Editor, plan: EditPlan): void {
      if (!plan.changes.length) { new Notice('请选择文本，或将光标放入已有高亮。'); return; }
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
    if (!block) { new Notice('请将光标放入代码块。'); return; }
    await navigator.clipboard.writeText(block.text);
    new Notice('已复制代码。');
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

  onunload(): void { for (const child of this.readingChildren) child.unload(); }
}

class HighlightsView extends ItemView {
  private note: MarkdownView | undefined;
  constructor(leaf: WorkspaceLeaf, private plugin: HighlightBoost) { super(leaf); }
  getViewType(): string { return VIEW; }
  getDisplayText(): string { return '当前笔记重点'; }
  getIcon(): string { return 'highlighter'; }
  async onOpen(): Promise<void> { this.refresh(); }
  refresh(): void {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) this.note = active;
    this.contentEl.empty();
    this.contentEl.addClass('hb-panel');
    this.contentEl.createEl('h4', { text: '当前笔记重点' });
    const view = this.note;
    if (!view?.file) { this.contentEl.createEl('p', { text: '打开笔记后，在这里查看正文和代码重点。' }); return; }
    const text = view.editor.getValue();
    const items = collectItems(text);
    this.contentEl.createEl('p', { text: `${view.file.basename} · ${items.length} 条`, cls: 'hb-summary' });
    if (!items.length) this.contentEl.createEl('p', { text: '选中正文或代码，使用“标记为重点”开始。' });
    for (const item of items) this.card(view, item);
  }
  private card(view: MarkdownView, item: HighlightItem): void {
    const card = this.contentEl.createDiv({ cls: `hb-card hb-${item.color}` });
    if (item.semantic) card.dataset.hbSemantic = item.semantic;
    const jump = card.createEl('button', { text: item.quote || '空行', cls: item.kind === 'prose' ? 'hb-quote' : 'hb-quote hb-code-quote' });
    const info = item.kind === 'prose' ? '正文' : item.kind === 'inline-code' ? `行内代码 · 第 ${item.line} 行` : `${item.language || '代码'} · 第 ${item.line} 行`;
    card.createEl('small', { text: `${item.label} · ${info}${item.status === 'resolved' ? '' : ' · 待重新定位'}` });
    this.registerDomEvent(jump, 'click', () => {
      if (item.status !== 'resolved') { new Notice('原内容已变化，请重新选择目标。'); return; }
      void this.app.workspace.revealLeaf(view.leaf);
      const from = view.editor.offsetToPos(item.from), to = view.editor.offsetToPos(item.to);
      view.editor.setSelection(from, to);
      view.editor.scrollIntoView({ from, to }, true);
      view.editor.focus();
    });
    if (item.kind === 'code-line' || item.kind === 'code-range') {
      const rebind = card.createEl('button', { text: '绑定到当前选区', cls: 'hb-rebind' });
      rebind.title = '在该代码块中选择新的位置，再点击绑定。';
      this.registerDomEvent(rebind, 'click', () => this.plugin.rebind(view.editor, item));
    }
    const copy = card.createEl('button', { text: '复制摘录', cls: 'hb-copy-excerpt' });
    this.registerDomEvent(copy, 'click', () => {
      const quote = item.kind === 'prose' ? `> ${item.quote}` : item.kind === 'inline-code' ? inlineExcerpt(item.quote) : `\`\`\`${item.language}\n${item.quote}\n\`\`\``;
      void navigator.clipboard.writeText(`${quote}\n\n来源：[[${view.file!.path}]] · ${item.label}`);
    });
  }
}

class HighlightSettings extends PluginSettingTab {
  constructor(private plugin: HighlightBoost) { super(plugin.app, plugin); }
  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl).setName('语法着色').setDesc('选择宿主着色或内置 Shiki。更改后重新启用插件。').addDropdown(dropdown => dropdown
      .addOption('native', '宿主').addOption('shiki', '内置 Shiki')
      .setValue(this.plugin.settings.syntaxProvider).onChange(async value => {
        this.plugin.settings.syntaxProvider = value as 'native' | 'shiki';
        await this.plugin.saveSettings();
      }));
    new Setting(this.containerEl).setName('默认语义').setDesc('“标记所选代码行”使用的语义。').addDropdown(dropdown => {
      for (const preset of this.plugin.settings.presets) dropdown.addOption(preset.id, preset.name);
      dropdown.setValue(this.plugin.settings.defaultPreset).onChange(async value => {
        this.plugin.settings.defaultPreset = value;
        await this.plugin.saveSettings();
      });
    });
    this.containerEl.createEl('h3', { text: '语义预设' });
    this.containerEl.createEl('p', { text: '名称和颜色用于后续标注。已有标注保留创建时的语义名称。直接改色保留已有语义；正文颜色使用原生格式。' });
    for (const preset of this.plugin.settings.presets) {
      new Setting(this.containerEl).setName(preset.name).addText(text => text
        .setPlaceholder(preset.name).setValue(preset.name).onChange(async value => {
          this.plugin.getPreset(preset.id).name = value;
          await this.plugin.saveSettings();
        })).addDropdown(dropdown => {
          for (const color of colors) dropdown.addOption(color, colorLabels[color]);
          dropdown.setValue(preset.color).onChange(async value => {
            this.plugin.getPreset(preset.id).color = value as Color;
            await this.plugin.saveSettings();
          });
        });
    }
    new Setting(this.containerEl).setName('恢复默认预设').addButton(button => button.setButtonText('恢复默认').onClick(async () => {
      this.plugin.settings = normalizeSettings({ syntaxProvider: this.plugin.settings.syntaxProvider });
      await this.plugin.saveSettings();
      this.display();
    }));
    this.containerEl.createEl('p', { text: '在快捷键中为“标记为重点”“代码行：疑问”等命令配置按键。' });
  }
}

class ColorPicker extends SuggestModal<Color> {
  constructor(private plugin: HighlightBoost, private editor: Editor) {
    super(plugin.app);
    this.setPlaceholder('选择高亮颜色');
  }
  getSuggestions(query: string): Color[] { return colors.filter(color => colorLabels[color].includes(query) || color.includes(query.toLowerCase())); }
  renderSuggestion(color: Color, element: HTMLElement): void { element.createSpan({ text: colorLabels[color] }); }
  onChooseSuggestion(color: Color): void { this.plugin.apply(this.editor, colorPreset(color)); }
}
