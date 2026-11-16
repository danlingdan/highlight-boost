(async () => {
  const checks = []; window.__hbChecks = checks;
  const assert = (name, value, details) => { if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`); checks.push({ name, passed: true }); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 100));
  const clipboard = (action, text) => window.require('electron').ipcRenderer.invoke('hb-window-clipboard', action, text);
  const until = async predicate => { for (let i = 0; i < 60; i++) { if (predicate()) return true; await tick(); } return false; };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  let plugin = app.plugins.plugins['highlight-boost'];
  const original = structuredClone(plugin.settings);
  const baseline = structuredClone(original);
  baseline.codeSyntax.disabledLanguages = [];
  baseline.codeSyntax.inlineHighlighting = true;
  baseline.codeSyntax.customThemeFolder = ''; baseline.codeSyntax.customLanguageFolder = '';
  baseline.codeSyntax.lightTheme = 'obsidian-theme'; baseline.codeSyntax.darkTheme = 'obsidian-theme';
  const leaf = app.workspace.getLeaf(false);
  const path = '统一代码阶段二.md';
  let file = app.vault.getFileByPath(path);
  if (!file) file = await app.vault.create(path, '# 统一代码\n');
  const beforeUpgrade = await app.vault.read(file);
  await window.require('electron').ipcRenderer.invoke('hb-unified-network', true);
  const readCode = root => [...root.querySelectorAll('pre > code .ec-line > .code')].filter(row => !row.closest('summary')).map(row => row.textContent === '\n' ? '' : row.textContent).join('\n');
  for (const provider of ['native', 'shiki']) {
    await plugin.saveData({ ...baseline, schemaVersion: 2, syntaxProvider: provider });
    await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost');
    plugin = app.plugins.plugins['highlight-boost'];
    assert(`${provider}-migrates-schema-3`, plugin.settings.schemaVersion === 3 && !('syntaxProvider' in plugin.settings));
    assert(`${provider}-unified-engine-enabled`, Boolean(plugin.syntax.engine));
    const saved = await plugin.loadData();
    assert(`${provider}-migration-persisted`, saved.schemaVersion === 3 && !('syntaxProvider' in saved));
    assert(`${provider}-migration-keeps-display`, JSON.stringify(saved.codeDisplay) === JSON.stringify(baseline.codeDisplay));
    assert(`${provider}-migration-keeps-collections`, JSON.stringify(saved.collections) === JSON.stringify(baseline.collections));
    assert(`${provider}-migration-keeps-note`, await app.vault.read(file) === beforeUpgrade);
  }
  const cases = [
    { id: 'cpp', language: 'C++', code: 'std::vector<int> values{1, 2};', word: 'values' },
    { id: 'csharp', language: 'C#', code: 'var value = "text";', word: 'value' },
    { id: 'fsharp', language: 'F#', code: 'let value = "text"', word: 'value' },
    { id: 'wenyan', language: '文言', code: '吾有一數。曰三。名之曰「甲」。', word: '甲' },
    { id: 'unknown', language: 'hb-unknown', code: 'unknown(value);', word: 'value' },
    { id: 'plain', language: '', code: 'plain(value);', word: 'value' },
    { id: 'markers', language: 'js', meta: 'file:"demo.js" ln:20 "value" /count\\w*/ collapse={2-3} hb-fold hb-collapsed', code: 'const value = 1;\nconst count = value;\nconsole.log(count);', word: 'value' },
    { id: 'terminal', language: 'bash', meta: 'frame="terminal"', code: '# explanation\necho hello', word: 'hello' },
    { id: 'ansi', language: 'ansi', code: '\u001b[31mred\u001b[0m tail', word: 'red' },
    { id: 'diff', language: 'diff', meta: 'lang="ts"', code: '-oldCall();\n+newCall();\n shared();', word: 'newCall' },
    { id: 'diff-syntax', language: 'ts', meta: 'useDiffSyntax', code: '-oldCall();\n+newCall();\n shared();', word: 'newCall' },
  ];
  for (const sample of cases) {
    const source = `# 统一代码\n\n\`\`\`${sample.language} ${sample.meta ?? ''}\n${sample.code}\n\`\`\`\n\n末尾\n`;
    await app.vault.modify(file, source); await leaf.openFile(file);
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false } });
    const view = leaf.view, editor = view.editor;
    assert(`${sample.id}-editor-loads-source`, await until(() => editor.getValue() === source));
    editor.setCursor({ line: 0, ch: 0 });
    const live = () => view.containerEl.querySelector('.markdown-source-view');
    assert(`${sample.id}-live-component`, await until(() => [...live().querySelectorAll('.hb-unified-code')].some(node => node.dataset.hbSourceCode === sample.code && node.querySelector('.hb-code-header'))), { state: view.getState(), selection: editor.listSelections(), content: live()?.innerText, widgets: live()?.querySelectorAll('.hb-code-widget').length });
    assert(`${sample.id}-live-source-text`, readCode(live()) === sample.code, readCode(live()));
    const start = editor.getValue().indexOf(sample.word, editor.getValue().indexOf(sample.code));
    editor.setSelection(editor.offsetToPos(start), editor.offsetToPos(start + sample.word.length));
    assert(`${sample.id}-edit-removes-widget`, await until(() => !live().querySelector('.hb-code-widget')));
    if (sample.language && !['hb-unknown', 'ansi'].includes(sample.language)) assert(`${sample.id}-editor-syntax`, await until(() => Boolean(live().querySelector('.hb-syntax-token'))));
    if (sample.id === 'markers') assert('parameter-text-mark-in-editor', await until(() => [...live().querySelectorAll('.hb-param-inline')].some(node => node.textContent === 'value')));
    plugin.apply(editor, plugin.presetForAction('question'));
    const marked = editor.getValue();
    assert(`${sample.id}-annotation-keeps-code`, marked.includes(sample.code) && marked.includes('%%hb:'));
    editor.undo(); assert(`${sample.id}-one-undo`, editor.getValue() === source); editor.redo();
    editor.setCursor({ line: 0, ch: 0 });
    assert(`${sample.id}-live-mark`, await until(() => Boolean(live().querySelector('.hb-unified-code .hb-text'))));
    await app.vault.modify(file, marked);
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
    const reading = () => view.containerEl.querySelector('.markdown-preview-view');
    assert(`${sample.id}-reading-component`, await until(() => reading().querySelectorAll('pre > code').length === 1 && [...reading().querySelectorAll('.hb-unified-code')].some(node => node.dataset.hbSourceCode === sample.code && node.querySelector('.hb-text'))), reading()?.innerHTML.slice(0, 800));
    assert(`${sample.id}-reading-source-text`, readCode(reading()) === sample.code, readCode(reading()));
    assert(`${sample.id}-one-visible-copy`, [...reading().querySelectorAll('[data-hb-display-action="copy"], .copy button')].filter(node => node.getClientRects().length).length === 1);
    await clipboard('write', 'pending'); reading().querySelector('[data-hb-display-action="copy"]').click();
    let copied;
    for (let attempt = 0; attempt < 30; attempt++) { await tick(); copied = await clipboard('read'); if (copied !== 'pending') break; }
    assert(`${sample.id}-copy-original-code`, copied === sample.code, copied);
    if (sample.id === 'markers') {
      const component = () => reading().querySelector('.hb-unified-code');
      assert('fold-whole-block-default-collapsed', component().querySelector('.hb-code-body').hidden);
      component().querySelector('[data-hb-display-action="toggle"]').click();
      assert('fold-whole-block-expands', !component().querySelector('.hb-code-body').hidden);
      component().querySelector('.ec-section summary').click(); await tick();
      assert('fold-local-section-expands', component().querySelector('details.ec-section').open);
      const previousTheme = component().querySelector('[data-hb-theme]').dataset.hbTheme;
      await plugin.syntax.reload();
      assert('fold-rerender-completes', await until(() => component()?.querySelector('[data-hb-theme]')?.dataset.hbTheme !== previousTheme));
      assert('fold-rerender-keeps-whole-state', !component().querySelector('.hb-code-body').hidden);
      assert('fold-rerender-keeps-local-state', component().querySelector('details.ec-section').open);
    }
    assert(`${sample.id}-source-unchanged-after-reading`, await app.vault.read(file) === marked);
  }
  plugin.settings.codeSyntax.disabledLanguages = ['js']; await plugin.saveSettings();
  await app.vault.modify(file, '# 排除\n\n```javascript\nconst value = 1;\n```\n');
  await leaf.openFile(file); await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
  await tick(); assert('excluded-alias-no-component', !leaf.view.containerEl.querySelector('.markdown-preview-view .hb-unified-code'));
  plugin.settings.codeSyntax.disabledLanguages = []; await plugin.saveSettings();
  assert('restore-alias-without-restart', await until(() => Boolean(leaf.view.containerEl.querySelector('.markdown-preview-view .hb-unified-code'))));
  await app.vault.modify(file, '# 行内\n\n表达式 `{ts} readBuffer(buffer, count)`。\n');
  await leaf.openFile(file); await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
  assert('inline-language-render', await until(() => leaf.view.containerEl.querySelector('code[data-hb-inline-source]')?.textContent === 'readBuffer(buffer, count)'));
  plugin.settings.codeSyntax.inlineHighlighting = false; await plugin.saveSettings();
  assert('inline-disable-restores-literal', await until(() => [...leaf.view.containerEl.querySelectorAll('code')].some(code => code.textContent === '{ts} readBuffer(buffer, count)')));
  const folder = '阶段二自定义资源';
  if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
  for (const child of ['themes', 'languages']) if (!app.vault.getAbstractFileByPath(`${folder}/${child}`)) await app.vault.createFolder(`${folder}/${child}`);
  const write = async (name, value) => {
    const target = `${folder}/${name === 'syntax.json' ? 'languages' : 'themes'}/${name}`, json = JSON.stringify(value);
    const existing = app.vault.getFileByPath(target);
    if (existing) await app.vault.modify(existing, json); else await app.vault.create(target, json);
  };
  await write('syntax.json', { name: 'hb-demo', aliases: ['hbd'], scopeName: 'source.hb-demo', patterns: [{ match: '\\bHELLO\\b', name: 'keyword.control.demo' }] });
  await write('theme.json', { name: 'demo', type: 'dark', tokenColors: [{ scope: 'keyword', settings: { foreground: '#ff0000' } }] });
  plugin.settings.codeSyntax.customLanguageFolder = `${folder}/languages`;
  plugin.settings.codeSyntax.customThemeFolder = `${folder}/themes`;
  plugin.settings.codeSyntax.lightTheme = `custom:${folder}/themes/theme.json`;
  plugin.settings.codeSyntax.darkTheme = `custom:${folder}/themes/theme.json`;
  await plugin.saveSettings();
  const custom = '# 自定义语法\n\n```hbd\nHELLO value\n```\n';
  await app.vault.modify(file, custom); await leaf.openFile(file);
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
  const customToken = () => [...leaf.view.containerEl.querySelectorAll('.markdown-preview-view .hb-unified-code .ec-line > .code span')].find(span => span.textContent === 'HELLO');
  assert('custom-language-and-theme-in-reading', await until(() => Boolean(customToken())));
  assert('custom-theme-color-applied', getComputedStyle(customToken()).color === 'rgb(255, 0, 0)', { style: customToken().style.cssText, color: getComputedStyle(customToken()).color });
  await write('theme.json', { name: 'demo', type: 'dark', tokenColors: [{ scope: 'keyword', settings: { foreground: '#00ff00' } }] });
  await plugin.syntax.reload();
  assert('custom-resource-reload-updates-reading', await until(() => customToken() && getComputedStyle(customToken()).color === 'rgb(0, 255, 0)'));
  assert('resource-reload-keeps-note', await app.vault.read(file) === custom);
  await app.vault.modify(file, '# 图表\n\n```mermaid\ngraph LR\n A --> B\n```\n');
  await leaf.openFile(file); await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
  assert('dedicated-mermaid-keeps-renderer', await until(() => Boolean(leaf.view.containerEl.querySelector('.markdown-preview-view .mermaid'))));
  assert('dedicated-mermaid-not-wrapped', !leaf.view.containerEl.querySelector('.markdown-preview-view .hb-unified-code'));
  const containers = '# 重复与容器\n\n```js\ndemo();\n```\n\n```js\ndemo();\n```\n\n> [!note] 引用说明\n> ```js\n> demo();\n> ```\n\n- 列表内容\n\n  ```js\n  demo();\n  ```\n\n> ```js\n> demo();\n> ```\n\n末尾\n';
  await app.vault.modify(file, containers); await leaf.openFile(file);
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
  assert('containers-reading-five-independent-components', await until(() => leaf.view.containerEl.querySelectorAll('.markdown-preview-view .hb-unified-code').length === 5));
  assert('containers-reading-distinct-source-ranges', new Set([...leaf.view.containerEl.querySelectorAll('.markdown-preview-view .hb-unified-code')].map(node => node.dataset.hbFence)).size === 5);
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false } });
  await until(() => leaf.view.editor.getValue() === containers); leaf.view.editor.setCursor({ line: 0, ch: 0 });
  assert('containers-live-components', await until(() => leaf.view.containerEl.querySelectorAll('.markdown-source-view .hb-unified-code').length === 5), leaf.view.containerEl.querySelector('.markdown-source-view').innerText);
  assert('containers-source-unchanged', leaf.view.editor.getValue() === containers && await app.vault.read(file) === containers);
  const embeddedPath = '阶段二嵌入来源.md', embeddedSource = '# 嵌入来源\n\n```js\nembeddedOnly();\n```\n';
  const embeddedFile = app.vault.getFileByPath(embeddedPath);
  if (embeddedFile) await app.vault.modify(embeddedFile, embeddedSource); else await app.vault.create(embeddedPath, embeddedSource);
  const embedNote = '# 嵌入验收\n\n```js\nmainOnly();\n```\n\n![[阶段二嵌入来源]]\n';
  await app.vault.modify(file, embedNote); await leaf.openFile(file);
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
  const embedCodes = () => [...leaf.view.containerEl.querySelectorAll('.markdown-preview-view .hb-unified-code')].map(node => node.dataset.hbSourceCode);
  assert('embed-reading-separate-sources', await until(() => embedCodes().includes('mainOnly();') && embedCodes().includes('embeddedOnly();')));
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false } });
  await until(() => leaf.view.editor.getValue() === embedNote); leaf.view.editor.setCursor({ line: 0, ch: 0 });
  assert('embed-live-source-component', await until(() => [...leaf.view.containerEl.querySelectorAll('.markdown-source-view .hb-unified-code')].some(node => node.dataset.hbSourceCode === 'embeddedOnly();')));
  assert('embed-source-files-unchanged', await app.vault.read(file) === embedNote && await app.vault.read(app.vault.getFileByPath(embeddedPath)) === embeddedSource);
  plugin.settings = original; await plugin.saveSettings();
  await window.require('electron').ipcRenderer.invoke('hb-unified-network', false);
  return checks;
})();
