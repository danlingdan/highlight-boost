import { Component, MarkdownRenderChild, type MarkdownPostProcessorContext, type Plugin } from 'obsidian';
import { SyntaxEngine } from './engine';
import { syntaxEditor } from './editor';
import { SyntaxRuntime } from './runtime';
import type { Locale } from '../i18n';
import { EditorView } from '@codemirror/view';

class SyntaxBlock extends MarkdownRenderChild {
  private generation = 0;
  private highlights?: MarkdownRenderChild;
  constructor(element: HTMLElement, private engine: SyntaxEngine, private code: string, private language: string, private context: MarkdownPostProcessorContext, private decorate: (element: HTMLElement, context: MarkdownPostProcessorContext) => MarkdownRenderChild, private getLocale: () => Locale, private dispose: () => void) { super(element); }
  onload(): void { void this.render().catch(error => console.error('HB 代码渲染失败', error)); }
  async render(): Promise<void> {
    const generation = ++this.generation;
    const section = this.context.getSectionInfo(this.containerEl);
    const opening = section?.text.split('\n')[section.lineStart] ?? '';
    const meta = opening.match(/(?:`{3,}|~{3,})\S*\s+(.*)$/)?.[1] ?? '';
    const rendered = await this.engine.render(this.code, this.language, meta, this.containerEl.ownerDocument, this.getLocale());
    if (generation !== this.generation) return;
    if (this.highlights) this.removeChild(this.highlights);
    this.containerEl.replaceChildren(rendered);
    this.highlights = this.addChild(this.decorate(this.containerEl, this.context));
  }
  onunload(): void { this.generation++; this.dispose(); }
}

export class SyntaxService extends Component {
  readonly runtime = this.addChild(new SyntaxRuntime(() => this.getLocale()));
  readonly engine = new SyntaxEngine(document => this.runtime.attach(document));
  readonly editorExtension = syntaxEditor(this.engine);
  private blocks = new Set<SyntaxBlock>();
  constructor(private plugin: Plugin, private decorate: (element: HTMLElement, context: MarkdownPostProcessorContext) => MarkdownRenderChild, private getLocale: () => Locale) { super(); }
  async refresh(): Promise<void> { await Promise.all([...this.blocks].map(block => block.render())); }
  onunload(): void { for (const block of this.blocks) block.unload(); }
  async initialize(): Promise<void> {
    this.runtime.attach(document);
    this.registerEvent(this.plugin.app.workspace.on('window-close', (_workspaceWindow, window) => this.runtime.detach(window.document)));
    await this.engine.initialize();
    this.register(() => this.engine.dispose());
    this.plugin.registerEditorExtension([this.editorExtension, EditorView.editorAttributes.of({ class: 'hb-syntax-editor' })]);
    for (const language of this.engine.languages.filter(language => /^[a-z0-9][a-z0-9-]*$/.test(language) && language !== 'mermaid')) {
      this.plugin.registerMarkdownCodeBlockProcessor(language, (source, element, context) => {
        if (element.closest('.mod-frontmatter')) return;
        const block = new SyntaxBlock(element, this.engine, source, language, context, this.decorate, this.getLocale, () => this.blocks.delete(block));
        this.blocks.add(block);
        context.addChild(block);
      }, 100);
    }
  }
}
