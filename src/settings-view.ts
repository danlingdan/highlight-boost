import { PluginSettingTab, type Setting, type SettingDefinitionItem, type SettingDefinitionRender } from 'obsidian';
import type HighlightBoost from './main';
import { colors, type Color } from './domain';
import { normalizeSettings } from './settings';
import type { Language } from './i18n';
import { renderUnifiedCode } from './syntax/component';
import { parseDocument } from './parsing';
import { planHighlight, applyChanges } from './editing';
import { planNote } from './notes';
import { collectItems } from './anchors';
import type { ExcerptTemplate } from './excerpts';
import type { CodeDisplaySettings } from './code-options';
import { MigrationModal } from './migration-ui';
export class HighlightSettings extends PluginSettingTab {
  private preview?: HTMLElement;
  private revision = 0;
  async refreshPreview(): Promise<void> {
    const target = this.preview; if (!target?.isConnected || !this.plugin.syntax?.engine) return;
    const revision = ++this.revision;
    let text = '```typescript title="src/features/highlight-boost/settings/instant-preview-with-a-long-file-name.ts"\nconst count = 12;\nconsole.log(count);\n```';
    let from = text.indexOf('count');
    text = applyChanges(text, planHighlight(text, [{ from, to: from + 5 }], this.plugin.presetForAction('important')).changes);
    from = parseDocument(text).blocks[0]!.lines[1]!.from;
    text = applyChanges(text, planHighlight(text, [{ from, to: from + 18 }], this.plugin.presetForAction('question'), 'lines').changes);
    const item = collectItems(text)[0]!;
    text = applyChanges(text, planNote(text, item, this.plugin.t('annotationHint'), item.label).changes);
    const component = await renderUnifiedCode(this.plugin.syntax.engine, parseDocument(text).blocks[0]!, target.ownerDocument, this.plugin.locale, this.plugin.settings.codeDisplay, new Map(), 'settings-preview');
    for (const button of component.querySelectorAll<HTMLButtonElement>('.hb-code-mark-count, .hb-code-edit-note')) { button.disabled = true; button.title = this.plugin.t('livePreview'); }
    if (revision === this.revision && target === this.preview && target.isConnected) target.replaceChildren(component);
  }
  hide(): void { this.revision++; this.preview = undefined; super.hide(); }
  constructor(private plugin: HighlightBoost) { super(plugin.app, plugin); }
  getSettingDefinitions(): SettingDefinitionItem[] {
    const t = this.plugin.t.bind(this.plugin);
    const setting = (name: string, render: (row: Setting) => void, desc?: string): SettingDefinitionRender => ({ name, desc, render: row => { render(row); for (const control of row.controlEl.querySelectorAll('input,select,textarea')) if (!control.hasAttribute('aria-label')) control.setAttribute('aria-label', name); } });
    let defaults: HTMLSelectElement | undefined;
    const general = [
      setting(t('language'), row => { row.addDropdown(dropdown => {
        dropdown.selectEl.dataset.hbSetting = 'language'; dropdown.selectEl.setAttribute('aria-label', t('language'));
        dropdown.addOption('auto', t('autoLanguage')).addOption('zh', '中文').addOption('en', 'English')
          .setValue(this.plugin.settings.language).onChange(async value => {
            this.plugin.settings.language = value as Language; await this.plugin.saveSettings();
          });
      }); }, t('languageHint')),
      setting(t('selectionToolbar'), row => { row.addToggle(toggle => {
        toggle.toggleEl.dataset.hbSetting = 'selectionToolbar';
        toggle.setValue(this.plugin.settings.selectionToolbar).onChange(async value => {
          this.plugin.settings.selectionToolbar = value; await this.plugin.saveSettings();
        });
      }); }, t('selectionToolbarHint')),
    ];
    const code: SettingDefinitionRender[] = [

      ...([['showTitle', 'showCodeTitle'], ['showLineNumbers', 'showCodeNumbers'], ['collapsible', 'foldCode'], ['collapseByDefault', 'foldByDefault'], ['wrap', 'wrapCode'], ['diff', 'showDiff']] as const).map(([key, label]) =>
        setting(t(label), row => { row.addToggle(toggle => {
          toggle.toggleEl.dataset.hbCodeSetting = key;
          toggle.setValue(this.plugin.settings.codeDisplay[key]).onChange(async value => {
            this.plugin.settings.codeDisplay[key] = value; await this.plugin.saveSettings();
          });
        }); })),
      setting(t('startCodeLine'), row => { row.addText(text => {
        text.inputEl.type = 'number'; text.inputEl.min = '1'; text.inputEl.max = '1000000'; text.inputEl.step = '1';
        text.inputEl.dataset.hbCodeSetting = 'startLine'; text.inputEl.setAttribute('aria-label', t('startCodeLine'));
        text.setValue(String(this.plugin.settings.codeDisplay.startLine)).onChange(async value => {
          this.plugin.settings.codeDisplay.startLine = Number(value); await this.plugin.saveSettings();
        });
      }); }),
      setting(t('codeNumberFont'), row => { row.addDropdown(dropdown => {
        dropdown.selectEl.dataset.hbCodeSetting = 'numberFont'; dropdown.selectEl.setAttribute('aria-label', t('codeNumberFont'));
        dropdown.addOption('monospace', t('monospaceFont')).addOption('interface', t('interfaceFont'))
          .setValue(this.plugin.settings.codeDisplay.numberFont).onChange(async value => {
            this.plugin.settings.codeDisplay.numberFont = value as 'monospace' | 'interface'; await this.plugin.saveSettings();
          });
      }); }),
    ];

    code.push(setting(t('codeFrame'), row => { row.addDropdown(dropdown => {
      dropdown.selectEl.dataset.hbCodeSetting = 'frame'; dropdown.selectEl.setAttribute('aria-label', t('codeFrame'));
      for (const [value, key] of [['auto', 'frameAuto'], ['code', 'frameCode'], ['terminal', 'frameTerminal'], ['none', 'frameNone']] as const) dropdown.addOption(value, t(key));
      dropdown.setValue(this.plugin.settings.codeDisplay.frame).onChange(async value => { this.plugin.settings.codeDisplay.frame = value as CodeDisplaySettings['frame']; await this.plugin.saveSettings(); });
    }); }));
    for (const [key, label] of [['lightTheme', 'lightCodeTheme'], ['darkTheme', 'darkCodeTheme']] as const) code.push(setting(t(label), row => { row.addDropdown(dropdown => {
      dropdown.selectEl.dataset.hbSyntaxSetting = key; dropdown.selectEl.setAttribute('aria-label', t(label));
      for (const theme of this.plugin.syntax!.engine.themes) dropdown.addOption(theme.id, theme.label);
      dropdown.setValue(this.plugin.settings.codeSyntax[key]).onChange(async value => { this.plugin.settings.codeSyntax[key] = value; await this.plugin.saveSettings(); });
    }); }));
    for (const [key, label] of [['preferThemeColors', 'preferThemeColors'], ['inlineHighlighting', 'inlineSyntax']] as const) code.push(setting(t(label), row => { row.addToggle(toggle => {
      toggle.toggleEl.dataset.hbSyntaxSetting = key; toggle.toggleEl.setAttribute('aria-label', t(label));
      toggle.setValue(this.plugin.settings.codeSyntax[key]).onChange(async value => { this.plugin.settings.codeSyntax[key] = value; await this.plugin.saveSettings(); });
    }); }));
    for (const key of ['customThemeFolder', 'customLanguageFolder', 'disabledLanguages'] as const) code.push(setting(t(key), row => { row.addText(input => {
      input.inputEl.dataset.hbSyntaxSetting = key; input.inputEl.setAttribute('aria-label', t(key));
      const value = this.plugin.settings.codeSyntax[key]; input.setValue(Array.isArray(value) ? value.join(', ') : value);
      input.onChange(async value => { if (key === 'disabledLanguages') this.plugin.settings.codeSyntax[key] = value.split(/[,，]/).map(value => value.trim()).filter(Boolean); else this.plugin.settings.codeSyntax[key] = value; await this.plugin.saveSettings(); });
    }); }));
    code.push(setting(t('reloadCodeResources'), row => { row.addButton(button => button.setButtonText(t('reloadCodeResources')).onClick(async () => { button.setDisabled(true); try { await this.plugin.syntax!.reload(); await this.refreshPreview(); this.update(); } finally { button.setDisabled(false); } })); }));
    code.push(setting(t('livePreview'), row => {
      row.settingEl.addClass('hb-settings-preview-row'); this.preview = row.settingEl.createDiv({ cls: 'hb-settings-preview' });
      for (const error of this.plugin.syntax!.engine.issues) row.settingEl.createEl('p', { text: `${error.path}: ${error.message}`, cls: 'hb-resource-error' });
      row.settingEl.ownerDocument.defaultView!.requestAnimationFrame(() => { void this.refreshPreview(); });
    }));
    const presetItems: SettingDefinitionRender[] = [setting(t('defaultPreset'), row => { row.addDropdown(dropdown => {
      defaults = dropdown.selectEl; defaults.dataset.hbSetting = 'defaultPreset'; defaults.setAttribute('aria-label', t('defaultPreset'));
      for (const preset of this.plugin.settings.presets) dropdown.addOption(preset.id, this.plugin.presetLabel(preset));
      dropdown.setValue(this.plugin.settings.defaultPreset).onChange(async value => {
        this.plugin.settings.defaultPreset = value; await this.plugin.saveSettings();
      });
    }); }, t('defaultPresetHint'))];
    for (const preset of this.plugin.settings.presets) {
      const name = this.plugin.presetLabel(preset);
      const definition = setting(name, row => {
        row.addText(text => {
          text.inputEl.dataset.hbPreset = preset.id; text.inputEl.setAttribute('aria-label', t('presetName', { preset: name }));
          text.setPlaceholder(name).setValue(name).onChange(async value => {
            this.plugin.getPreset(preset.id).name = value; this.plugin.getPreset(preset.id).customName = true;
            await this.plugin.saveSettings();
            definition.name = this.plugin.presetLabel(this.plugin.getPreset(preset.id)); row.setName(definition.name);
            for (const option of defaults?.options ?? []) option.textContent = this.plugin.presetLabel(this.plugin.getPreset(option.value));
          });
        }).addDropdown(dropdown => {
          dropdown.selectEl.dataset.hbPresetColor = preset.id; dropdown.selectEl.setAttribute('aria-label', t('presetColor', { preset: name }));
          for (const color of colors) dropdown.addOption(color, this.plugin.colorLabel(color));
          dropdown.setValue(preset.color).onChange(async value => {
            this.plugin.getPreset(preset.id).color = value as Color; await this.plugin.saveSettings();
          });
        });
      }, t('presetsHint'));
      presetItems.push(definition);
    }
    presetItems.push(setting(t('resetPresets'), row => { row.addButton(button => button.setButtonText(t('reset')).onClick(async () => {
      this.plugin.settings = normalizeSettings({ ...this.plugin.settings, presets: undefined, defaultPreset: undefined });
      await this.plugin.saveSettings(); this.update();
    })); }));
    const excerpt = setting(t('exportTemplate'), row => { row.addDropdown(dropdown => {
      dropdown.selectEl.dataset.hbSetting = 'excerptTemplate'; dropdown.selectEl.setAttribute('aria-label', t('exportTemplate'));
      for (const [value, key] of [['markdown', 'templateMarkdown'], ['plain', 'templatePlain'], ['quote', 'templateQuote'], ['code', 'templateCode']] as const) dropdown.addOption(value, t(key));
      dropdown.setValue(this.plugin.settings.excerptTemplate).onChange(async value => { this.plugin.settings.excerptTemplate = value as ExcerptTemplate; await this.plugin.saveSettings(); });
    }); });
    return [{ type: 'group', heading: t('markToolbar'), items: [general[1]!, ...presetItems] },
      { type: 'group', heading: t('codeDisplay'), items: code },
      { type: 'group', heading: t('workbenchExcerpts'), items: [excerpt] },
      { type: 'group', heading: t('languageData'), items: [general[0]!, setting(t('migration'), row => { row.addButton(button => button.setButtonText(t('migration')).onClick(() => new MigrationModal(this.plugin).open())); }),
        setting(t('technicalCredits'), row => { row.settingEl.createEl('a', { text: t('technicalCredits'), href: 'https://github.com/danlingdan/highlight-boost/blob/main/THIRD_PARTY_NOTICES.md' }); })] },
      { name: t('shortcutsHint'), searchable: false }];
  }
}

