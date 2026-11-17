import { ExpressiveCodeBlock, ExpressiveCodeEngine } from '@expressive-code/core';
import { toDom } from 'hast-util-to-dom';
import { bundledLanguages, bundledThemes, bundledThemesInfo, createHighlighter, type BundledLanguage, type BundledTheme, type Highlighter, type LanguageRegistration, type ThemeRegistration } from 'shiki';
import { createCssVariableThemeBundle, createEcEngineConfig, EC_VIRTUAL_SETTINGS } from './upstream/Config';
import { OBSIDIAN_THEME } from './upstream/ObsidianTheme';
import { pluginFramesTexts } from '@expressive-code/plugin-frames';
import { pluginCollapsibleSectionsTexts } from '@expressive-code/plugin-collapsible-sections';
import type { Locale } from '../i18n';
import { defaultCodeSyntax, type CodeSyntaxSettings } from './settings';
import { resolveLanguage, knownLanguage, resolveCodeOwner } from './languages';
import type { SyntaxResources, CustomTheme } from './resources';
import { fenceParameters, parameterValue } from '../fence-params';
import { structuredRows, rowText } from '../code-rows';
import { detachedEl } from '../dom';

pluginFramesTexts.addLocale('zh', { terminalWindowFallbackTitle: '终端窗口', copyButtonTooltip: '复制到剪贴板', copyButtonCopied: '已复制！' });
pluginCollapsibleSectionsTexts.addLocale('zh', { collapsedLines: '已折叠 {lineCount} 行' });

export interface SyntaxToken { from: number; to: number; color: string; background?: string; fontStyle: number }
export interface EngineOptions { settings?: CodeSyntaxSettings; resources?: SyntaxResources; dark?: boolean }

export class SyntaxEngine {
  constructor(private attachRuntime?: (document: Document) => void) {}
  private shiki!: Highlighter;
  private ec!: ExpressiveCodeEngine;
  private restore = (value: string) => value;
  private disposed = false;
  private themeName = OBSIDIAN_THEME.name;
  private themeCss = '';
  private styles = new Map<Document, { sheet: CSSStyleSheet; release: () => void }>();
  private custom: LanguageRegistration[] = [];
  private customThemes: CustomTheme[] = [];
  private settings = defaultCodeSyntax;
  readonly id = `hb-theme-${crypto.randomUUID()}`;
  issues: { path: string; message: string }[] = [];
  background = 'var(--code-background)';
  foreground = 'var(--text-normal)';

  get languages(): string[] { return [...Object.keys(bundledLanguages), 'text', 'txt', 'plain', 'plaintext', 'ansi', ...this.custom.flatMap(value => [value.name, ...(value.aliases ?? [])])]; }
  get themes(): { id: string; label: string }[] { return [{ id: 'obsidian-theme', label: 'Obsidian' }, ...bundledThemesInfo.map(theme => ({ id: theme.id, label: theme.displayName })), ...this.customThemes.map(theme => ({ id: theme.id, label: theme.label }))]; }
  supports(language: string): boolean { return knownLanguage(language, this.custom); }
  owns(language: string): boolean { return resolveCodeOwner(language, this.settings.disabledLanguages, this.custom) === 'hb'; }
  language(language: string): string { return resolveLanguage(language, this.custom); }
  get inlineHighlighting(): boolean { return this.settings.inlineHighlighting; }
  get revision(): string { return this.id; }

  async initialize(options: EngineOptions = {}): Promise<void> {
    this.settings = options.settings ?? defaultCodeSyntax;
    this.custom = options.resources?.languages ?? [];
    this.customThemes = options.resources?.themes ?? [];
    this.issues = [...(options.resources?.errors ?? [])];
    const selected = options.dark ? this.settings.darkTheme : this.settings.lightTheme;
    let theme: ThemeRegistration = OBSIDIAN_THEME;
    if (selected !== OBSIDIAN_THEME.name) {
      const custom = options.resources?.themes.find(value => value.id === selected);
      if (custom) theme = custom.theme;
      else if (Object.hasOwn(bundledThemes, selected)) theme = (await bundledThemes[selected as BundledTheme]()).default;
      else this.issues.push({ path: selected, message: '代码主题未找到，已使用 Obsidian 配色。' });
    }
    const mapped = createCssVariableThemeBundle(theme);
    this.themeName = mapped.theme.name ?? OBSIDIAN_THEME.name;
    this.restore = mapped.restoreCssVariables;
    this.shiki = await createHighlighter({ themes: [mapped.theme], langs: [] });
    if (this.settings.preferThemeColors && theme.name !== OBSIDIAN_THEME.name) {
      const resolved = this.shiki.getTheme(this.themeName);
      this.background = this.restore(resolved.bg); this.foreground = this.restore(resolved.fg);
    }
    if (this.custom.length) {
      const dependencies = [...new Set(this.custom.flatMap(language => [...(language.embeddedLangs ?? []), ...(language.embeddedLangsLazy ?? [])]))].filter(name => Object.hasOwn(bundledLanguages, name));
      if (dependencies.length) await this.shiki.loadLanguage(...dependencies as BundledLanguage[]);
      try { await this.shiki.loadLanguage(...this.custom); }
      catch {
        const registrations = this.custom, accepted: LanguageRegistration[] = [];
        this.shiki.dispose();
        this.shiki = await createHighlighter({ themes: [mapped.theme], langs: dependencies });
        for (const language of registrations) {
          const group = new Map<string, LanguageRegistration>();
          const collect = (entry: LanguageRegistration) => {
            if (group.has(entry.name)) return; group.set(entry.name, entry);
            for (const dependency of entry.embeddedLangs ?? []) { const embedded = registrations.find(candidate => candidate.name === dependency); if (embedded) collect(embedded); }
          };
          collect(language);
          try {
            await this.shiki.loadLanguage(...group.values());
            for (const entry of group.values()) if (!accepted.some(value => value.name === entry.name)) accepted.push(entry);
          } catch (error) {
            this.issues.push({ path: options.resources?.languagePaths?.[language.name] ?? language.name, message: String(error) });
            this.shiki.dispose(); this.shiki = await createHighlighter({ themes: [mapped.theme], langs: [...dependencies as BundledLanguage[], ...accepted] });
          }
        }
        this.custom = accepted;
      }
    }
    const config = createEcEngineConfig({ theme: mapped.theme, customLanguages: this.custom, settings: { ...EC_VIRTUAL_SETTINGS, preferThemeColors: this.settings.preferThemeColors }, usingObsidianTheme: theme.name === OBSIDIAN_THEME.name });
    config.themeCssRoot = `div.expressive-code[data-hb-theme="${this.id}"]`;
    this.ec = new ExpressiveCodeEngine(config);
    this.themeCss = mapped.restoreCssVariables(await this.ec.getThemeStyles());
  }

  private codeLanguage(language: string, meta = ''): string {
    const underlying = parameterValue(fenceParameters(meta), 'lang');
    const name = this.language(language.toLowerCase() === 'diff' && underlying ? underlying : language);
    return this.supports(name) ? name : 'text';
  }

  async tokens(code: string, language: string, meta = ''): Promise<SyntaxToken[]> {
    if (this.disposed || !this.supports(language) && language.toLowerCase() !== 'diff') return [];
    const lang = this.codeLanguage(language, meta);
    if (lang !== 'text' && lang !== 'ansi' && !this.shiki.getLoadedLanguages().includes(lang)) await this.shiki.loadLanguage(lang as BundledLanguage);
    if (this.disposed) return [];
    const tokens = this.shiki.codeToTokens(code, { lang: lang as BundledLanguage, theme: this.themeName }).tokens;
    let cursor = 0;
    return tokens.flatMap((line, index) => {
      if (lang === 'ansi' && index) cursor = code.indexOf('\n', cursor) + 1;
      return line.map(token => {
        const from = lang === 'ansi' ? code.indexOf(token.content, cursor) : token.offset;
        const to = from + token.content.length; cursor = to;
        return { from, to, color: this.restore(token.color ?? ''), background: token.bgColor, fontStyle: token.fontStyle ?? 0 };
      });
    });
  }

  async render(code: string, language: string, meta: string, document: Document, locale: Locale = 'en'): Promise<Node> {
    this.attachRuntime?.(document);
    if (!this.styles.has(document)) {
      const window = document.defaultView!;
      const sheet = new window.CSSStyleSheet();
      sheet.replaceSync(this.themeCss);
      document.adoptedStyleSheets.push(sheet);
      const release = () => this.detach(document);
      this.styles.set(document, { sheet, release });
      window.addEventListener('pagehide', release, { once: true });
    }
    const block = new ExpressiveCodeBlock({ code: '', language: this.codeLanguage(language, meta), meta, locale });
    block.insertLines(0, code.split(/\r?\n/));
    const result = await this.ec.render(block);
    const element = toDom(result.renderedGroupAst, { document });
    if (element.nodeType === 1) {
      const root = element as HTMLElement;
      root.dataset.hbSyntaxRoot = ''; root.dataset.hbTheme = this.id;
      for (const styled of [root, ...root.querySelectorAll<HTMLElement>('[style]')]) {
        const style = styled.getAttribute('style');
        if (style) styled.setAttribute('style', this.restore(style));
      }
      root.classList.add('hb-syntax-render');
      if (this.codeLanguage(language, meta) === 'ansi') {
        const target = root.querySelector('pre > code');
        if (target) {
          const tokens = await this.tokens(code, 'ansi');
          const fragment = document.createDocumentFragment();
          let offset = 0;
          for (const [index, line] of code.split('\n').entries()) {
            const row = detachedEl(document, 'div'); row.className = 'ec-line';
            const content = row.createSpan(); content.className = 'code';
            let cursor = offset;
            for (const token of tokens.filter(token => offset <= token.from && token.from <= offset + line.length)) {
              if (cursor < token.from) { const control = content.createSpan(); control.className = 'hb-ansi-control'; control.hidden = true; control.textContent = code.slice(cursor, token.from); }
              const span = content.createSpan(); span.textContent = code.slice(token.from, token.to);
              span.style.color = token.color; if (token.background) span.style.backgroundColor = token.background;
              if (token.fontStyle & 1) span.classList.add('shiki-italic'); if (token.fontStyle & 2) span.classList.add('shiki-bold');
              span.style.textDecoration = [token.fontStyle & 4 ? 'underline' : '', token.fontStyle & 8 ? 'line-through' : ''].filter(Boolean).join(' ');
              cursor = token.to;
            }
            if (cursor < offset + line.length) { const control = content.createSpan(); control.hidden = true; control.className = 'hb-ansi-control'; control.textContent = code.slice(cursor, offset + line.length); }
            if (index) fragment.append(document.createTextNode('\n')); fragment.append(row); offset += line.length + 1;
          }
          target.replaceChildren(fragment);
        }
      }
      for (const button of root.querySelectorAll<HTMLButtonElement>('.copy button')) button.dataset.code = code.replaceAll('\n', '\x7f');
    }
    return element;
  }

  async markers(code: string, language: string, meta: string, document: Document): Promise<{ from: number; to: number; kind: string; label: string; line?: boolean }[]> {
    if (!meta || this.disposed) return [];
    const root = detachedEl(document, 'div'); root.append(await this.render(code, language, meta, document));
    const target = root.querySelector<HTMLElement>('pre > code'); if (!target) return [];
    const result: { from: number; to: number; kind: string; label: string; line?: boolean }[] = []; let offset = 0;
    for (const row of structuredRows(target)) {
      const label = row.parentElement?.style.getPropertyValue('--tmLabel').replace(/^['"]|['"]$/g, '') ?? '';
      if (label) result.push({ from: offset, to: offset + rowText(row).length, kind: 'mark', label, line: true });
      const walker = document.createTreeWalker(row, 4); let position = offset;
      while (walker.nextNode()) {
        const node = walker.currentNode as Text, marker = node.parentElement?.closest('mark, ins, del');
        if (marker) result.push({ from: position, to: position + node.length, kind: marker.tagName.toLowerCase(), label: marker.getAttribute('title') ?? '' });
        position += node.length;
      }
      offset += rowText(row).length + 1;
    }
    return result;
  }

  detach(document: Document): void {
    const style = this.styles.get(document);
    if (!style) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== style.sheet);
    document.defaultView?.removeEventListener('pagehide', style.release);
    this.styles.delete(document);
  }
  dispose(): void { this.disposed = true; this.shiki?.dispose(); for (const document of this.styles.keys()) this.detach(document); }
}
