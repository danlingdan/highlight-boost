import { Component, MarkdownRenderChild, type MarkdownPostProcessorContext, type Plugin } from 'obsidian';
import { SyntaxEngine } from './engine';
import { syntaxEditor } from './editor';
import baseStyles from './upstream/styles.css';
import 'hb:ec-runtime';

class SyntaxBlock extends MarkdownRenderChild {
  private generation = 0;
  constructor(element: HTMLElement, private engine: SyntaxEngine, private code: string, private language: string, private context: MarkdownPostProcessorContext, private decorate: (element: HTMLElement, context: MarkdownPostProcessorContext) => MarkdownRenderChild) { super(element); }
  onload(): void { void this.render().catch(error => console.error('HB 代码渲染失败', error)); }
  private async render(): Promise<void> {
    const generation = ++this.generation;
    const section = this.context.getSectionInfo(this.containerEl);
    const opening = section?.text.split('\n')[section.lineStart] ?? '';
    const meta = opening.match(/(?:`{3,}|~{3,})\S*\s+(.*)$/)?.[1] ?? '';
    const rendered = await this.engine.render(this.code, this.language, meta, this.containerEl.ownerDocument);
    if (generation !== this.generation) return;
    this.containerEl.replaceChildren(rendered);
    this.addChild(this.decorate(this.containerEl, this.context));
  }
  onunload(): void { this.generation++; }
}

export class SyntaxService extends Component {
  readonly engine = new SyntaxEngine();
  readonly editorExtension = syntaxEditor(this.engine);
  constructor(private plugin: Plugin, private decorate: (element: HTMLElement, context: MarkdownPostProcessorContext) => MarkdownRenderChild) { super(); }
  async initialize(): Promise<void> {
    const css = await this.engine.initialize();
    const style = document.createElement('style');
    style.dataset.hbSyntax = '';
    style.textContent = `${baseStyles}\n${css}`;
    document.head.append(style);
    this.register(() => { style.remove(); this.engine.dispose(); });
    this.plugin.registerEditorExtension(this.editorExtension);
    for (const language of this.engine.languages.filter(language => /^[a-z0-9][a-z0-9-]*$/.test(language) && language !== 'mermaid')) {
      this.plugin.registerMarkdownCodeBlockProcessor(language, (source, element, context) => {
        if (element.closest('.mod-frontmatter')) return;
        context.addChild(new SyntaxBlock(element, this.engine, source, language, context, this.decorate));
      }, 100);
    }
  }
}
