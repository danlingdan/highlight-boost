import { Component, Notice, type Plugin } from 'obsidian';
import { SyntaxEngine } from './engine';
import { syntaxEditor, refreshSyntax } from './editor';
import { SyntaxRuntime } from './runtime';
import { loadSyntaxResources, type SyntaxResources } from './resources';
import type { CodeSyntaxSettings } from './settings';
import type { Locale } from '../i18n';
import { syntaxCodeWidgets } from './widgets';
import { EditorView, ViewPlugin } from '@codemirror/view';

export class SyntaxService extends Component {
  readonly runtime = this.addChild(new SyntaxRuntime(() => this.getLocale()));
  engine!: SyntaxEngine;
  readonly editorExtension = syntaxEditor(() => this.engine);
  resources: SyntaxResources = { themes: [], languages: [], errors: [] };
  private queue: Promise<void> = Promise.resolve();
  private editors = new Set<EditorView>();
  private stopped = false;
  constructor(private plugin: Plugin, private getSettings: () => CodeSyntaxSettings, private getLocale: () => Locale, private sessions: Map<string, boolean>, private refreshReading: () => void) { super(); }
  async reload(): Promise<void> {
    const task = this.queue.catch(() => {}).then(async () => {
      if (this.stopped) return;
      const settings = structuredClone(this.getSettings());
      const resources = await loadSyntaxResources(settings, this.plugin.app.vault.adapter);
      const next = new SyntaxEngine(document => this.runtime.attach(document));
      try { await next.initialize({ settings, resources, dark: this.plugin.app.isDarkMode() }); }
      catch (error) { next.dispose(); new Notice(String(error)); throw error; }
      if (this.stopped) { next.dispose(); return; }
      const previous = this.engine;
      this.engine = next; this.resources = resources;
      for (const view of this.editors) view.dispatch({ effects: refreshSyntax.of(next.revision) });
      this.refreshReading();
      previous?.dispose();
      for (const issue of next.issues) new Notice(`${issue.path}: ${issue.message}`);
    });
    this.queue = task;
    return task;
  }
  async initialize(): Promise<void> {
    await this.reload();
    this.runtime.attach(document);
    this.registerEvent(this.plugin.app.workspace.on('window-close', (_workspaceWindow, window) => { this.runtime.detach(window.document); this.engine.detach(window.document); }));
    this.registerEvent(this.plugin.app.workspace.on('css-change', () => { void this.reload().catch(error => console.error('HB 主题更新失败', error)); }));
    this.plugin.registerEditorExtension([
      this.editorExtension, syntaxCodeWidgets(() => this.engine, this.sessions),
      EditorView.editorAttributes.of({ class: 'hb-syntax-editor' }),
      ViewPlugin.define(view => { this.editors.add(view); return { destroy: () => { this.editors.delete(view); } }; }),
    ]);
  }
  onunload(): void { this.stopped = true; this.editors.clear(); this.engine?.dispose(); }
}
