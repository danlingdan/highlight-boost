import { ExpressiveCodeEngine } from '@expressive-code/core';
import { toDom } from 'hast-util-to-dom';
import { bundledLanguages, createHighlighter, type BundledLanguage, type Highlighter } from 'shiki';
import { createCssVariableThemeBundle, createEcEngineConfig, EC_VIRTUAL_SETTINGS } from './upstream/Config';
import { OBSIDIAN_THEME } from './upstream/ObsidianTheme';

export class SyntaxEngine {
  private shiki!: Highlighter;
  private ec!: ExpressiveCodeEngine;
  private restore = (value: string) => value;
  private disposed = false;

  get languages(): string[] { return Object.keys(bundledLanguages); }
  supports(language: string): boolean { return Object.hasOwn(bundledLanguages, language.toLowerCase()); }

  async initialize(): Promise<string> {
    const mapped = createCssVariableThemeBundle(OBSIDIAN_THEME);
    this.restore = mapped.restoreCssVariables;
    this.shiki = await createHighlighter({ themes: [mapped.theme], langs: [] });
    this.ec = new ExpressiveCodeEngine(createEcEngineConfig({
      theme: mapped.theme, customLanguages: [], settings: EC_VIRTUAL_SETTINGS, usingObsidianTheme: true,
    }));
    return this.restore(`${await this.ec.getBaseStyles()}\n${await this.ec.getThemeStyles()}`);
  }

  async tokens(code: string, language: string) {
    const lang = language.toLowerCase() as BundledLanguage;
    if (this.disposed || !this.supports(lang)) return [];
    if (!this.shiki.getLoadedLanguages().includes(lang)) await this.shiki.loadLanguage(lang);
    if (this.disposed) return [];
    return this.shiki.codeToTokens(code, { lang, theme: OBSIDIAN_THEME.name }).tokens.flat().map(token => ({
      from: token.offset, to: token.offset + token.content.length,
      color: this.restore(token.color ?? ''), fontStyle: token.fontStyle ?? 0,
    }));
  }

  async render(code: string, language: string, meta: string, document: Document): Promise<Node> {
    const result = await this.ec.render({ code, language, meta });
    const element = toDom(result.renderedGroupAst, { document });
    if (element.nodeType === 1) {
      const root = element as HTMLElement;
      for (const styled of [root, ...root.querySelectorAll<HTMLElement>('[style]')]) {
        const style = styled.getAttribute('style');
        if (style) styled.setAttribute('style', this.restore(style));
      }
      root.classList.add('hb-syntax-render');
    }
    return element;
  }

  dispose(): void { this.disposed = true; this.shiki?.dispose(); }
}
