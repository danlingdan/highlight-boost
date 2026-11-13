(async () => {
  const checks = [];
  window.__hbChecks = checks;
  const assert = (name, value, details) => {
    if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`);
    checks.push({ name, passed: true });
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 150));
  await app.plugins.loadManifests();
  await app.plugins.setEnable(true);
  await app.plugins.enablePlugin('highlight-boost');
  if (!app.plugins.plugins['highlight-boost']) await app.plugins.loadPlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost'];
  assert('plugin-load', Boolean(plugin));
  assert('desktop-only', plugin.manifest.isDesktopOnly === true);
  const file = app.vault.getFileByPath('原型验证.md');
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  const view = leaf.view;
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: false } });
  const editor = view.editor;
  const initial = editor.getValue();
  let from = initial.indexOf('beta');
  editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(from + 4));
  app.commands.executeCommandById('highlight-boost:apply-question');
  assert('prose-partial-recolor', editor.getValue().includes('==🟡alpha== ==🔴beta== ==🟡gamma=='));
  assert('prose-selection-preserved', editor.getSelection() === 'beta');
  editor.focus();
  editor.undo();
  assert('single-undo', editor.getValue() === initial);
  editor.redo();
  assert('redo', editor.getValue().includes('==🔴beta=='));

  from = editor.getValue().indexOf('memcpy(dst, src, n)') + 'memcpy(dst, '.length;
  editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(from + 3));
  app.commands.executeCommandById('highlight-boost:apply-question');
  assert('code-exact-text', editor.getValue().includes('%%hb:') && editor.getValue().includes('  memcpy(dst, src, n);'));
  await tick();
  assert('editor-code-decoration', view.containerEl.querySelector('.hb-text')?.textContent === 'src', view.containerEl.querySelector('.hb-text')?.textContent);
  const chip = view.containerEl.querySelector('.hb-metadata-chip');
  assert('live-preview-metadata-folded', Boolean(chip));
  chip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  assert('metadata-widget-expands', editor.getSelection().startsWith('%%hb:'));
  const sourcePosition = editor.getValue().lastIndexOf('memcpy(dst, src, n)') + 'memcpy(dst, '.length;
  editor.setSelection(editor.offsetToPos(sourcePosition), editor.offsetToPos(sourcePosition + 3));
  view.containerEl.querySelector('.hb-metadata-chip').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert('metadata-keyboard-expands', editor.getSelection().startsWith('%%hb:'));
  editor.setSelection(editor.offsetToPos(sourcePosition), editor.offsetToPos(sourcePosition + 3));
  const marked = editor.getValue();
  editor.transaction({ changes: [{ from: { line: 0, ch: 0 }, to: { line: 0, ch: 1 }, text: marked[0] }] }, 'input');
  editor.undo();
  assert('code-single-undo', !editor.getValue().includes('%%hb:'), { markedLength: marked.length, afterUndoLength: editor.getValue().length });
  editor.redo();
  assert('code-redo', editor.getValue() === marked);

  const line = editor.getValue().indexOf('add rax, 1');
  editor.setSelection(editor.offsetToPos(line), editor.offsetToPos(line + 3));
  app.commands.executeCommandById('highlight-boost:lines-important');
  assert('code-line-mark', editor.getValue().includes('"kind":"lines"'));

  const nested = editor.getValue().lastIndexOf('print("hello")');
  editor.setSelection(editor.offsetToPos(nested), editor.offsetToPos(nested + 5));
  app.commands.executeCommandById('highlight-boost:apply-question');
  assert('callout-code-mark', editor.getValue().includes('> %%hb:') && editor.getValue().includes('> print("hello")'));

  const listed = editor.getValue().lastIndexOf('console.log(value)');
  editor.setSelection(editor.offsetToPos(listed), editor.offsetToPos(listed + 7));
  app.commands.executeCommandById('highlight-boost:apply-reference');
  assert('list-code-mark', editor.getValue().includes('- %%hb:') && editor.getValue().includes('  console.log(value);'));

  await app.commands.executeCommandById('highlight-boost:open-highlights');
  await tick();
  assert('unified-sidebar', document.querySelectorAll('.hb-card').length >= 5, document.querySelectorAll('.hb-card').length);
  const jump = Array.from(document.querySelectorAll('.hb-quote')).find(button=>button.textContent === 'src');
  jump.click();
  assert('sidebar-source-jump', editor.getSelection() === 'src');

  editor.replaceSelection('source');
  plugin.refreshPanels();
  const rewritten = editor.getValue();
  const repair = Array.from(document.querySelectorAll('.hb-card')).find(card=>card.querySelector('.hb-quote')?.textContent === 'src');
  assert('rewritten-mark-pending', repair?.textContent.includes('待重新定位'));
  const sourceFrom = rewritten.lastIndexOf('memcpy(dst, source, n)') + 'memcpy(dst, '.length;
  editor.setSelection(editor.offsetToPos(sourceFrom), editor.offsetToPos(sourceFrom + 6));
  repair.querySelector('.hb-rebind').click();
  const rebound = editor.getValue();
  assert('sidebar-rebind', rebound.includes('"quote":"source"') && editor.getSelection() === 'source');
  editor.undo();
  assert('rebind-single-undo', editor.getValue() === rewritten);
  editor.redo();
  assert('rebind-redo', editor.getValue() === rebound);

  await app.vault.modify(file, editor.getValue());
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'preview' } });
  app.workspace.setActiveLeaf(leaf, { focus: true });
  const scroller = view.containerEl.querySelector('.markdown-preview-view');
  scroller.scrollTop = 0;
  scroller.dispatchEvent(new Event('scroll'));
  for (let i = 0; i < 40 && !view.containerEl.querySelector('pre .hb-text'); i++) await tick();
  assert('reading-code-decoration', Boolean(view.containerEl.querySelector('pre .hb-text')), { state: view.getState(), pre: view.containerEl.querySelectorAll('pre').length, text: view.containerEl.querySelector('pre')?.outerHTML, saved: (await app.vault.read(file)).includes('%%hb:') });
  const code = Array.from(view.containerEl.querySelectorAll('pre code')).find(code => code.textContent.includes('memcpy'));
  assert('reading-code-preserves-text', code.textContent === 'void copy(char *dst, const char *src, size_t n) {\n  memcpy(dst, source, n);\n}\n', code.textContent);
  assert('reading-token-preserved', Boolean(code.querySelector('.token')));

  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: true } });
  assert('source-mode', view.getState().source === true);
  assert('source-shows-metadata', !view.containerEl.querySelector('.hb-metadata-chip'));
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: false } });
  assert('live-preview-mode', view.getState().source === false);

  await app.plugins.disablePlugin('highlight-boost');
  assert('plugin-unload', !app.plugins.plugins['highlight-boost']);
  await app.plugins.enablePlugin('highlight-boost');
  assert('plugin-reload', Boolean(app.plugins.plugins['highlight-boost']));
  const persisted = await app.vault.read(file);
  assert('metadata-persisted', persisted.includes('%%hb:') && persisted.includes('"quote":"source"'));
  return checks;
})()
