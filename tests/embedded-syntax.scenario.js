(async () => {
  const checks = [];
  window.__hbChecks = checks;
  const assert = (name, condition, details) => {
    if (!condition) throw new Error(`${name}: ${JSON.stringify(details)}`);
    checks.push({ name, passed: true });
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 150));
  const until = async predicate => {
    for (let i = 0; i < 60 && !predicate(); i++) await tick();
    return predicate();
  };
  await app.plugins.loadManifests();
  await app.plugins.setEnable(true);
  await app.plugins.enablePlugin('highlight-boost');
  let plugin = app.plugins.plugins['highlight-boost'];
  const original = structuredClone(plugin.settings);
  original.syntaxProvider = 'native';
  plugin.settings.syntaxProvider = 'shiki';
  await plugin.saveSettings();
  await app.plugins.disablePlugin('highlight-boost');
  await app.plugins.enablePlugin('highlight-boost');
  plugin = app.plugins.plugins['highlight-boost'];
  assert('builtin-engine-loaded', Boolean(plugin.syntax));
  assert('no-external-shiki-plugin', !app.plugins.plugins['shiki-highlighter']);
  const samples = [
    { language: 'sql', code: 'SELECT id FROM users WHERE id = 7;', word: 'users' },
    { language: 'abap', code: "DATA value TYPE i.\nWRITE: / 'Hello'.", word: 'value' },
    { language: 'asm', code: 'mov rax, 7\nadd rax, 1\nret', word: 'rax' },
  ];
  const leaf = app.workspace.getLeaf(false);
  for (const sample of samples) {
    const path = `内置语法-${sample.language}.md`;
    const source = `# 内置语法\n\n\`\`\`${sample.language} showLineNumbers\n${sample.code}\n\`\`\`\n\n末尾\n`;
    const old = app.vault.getFileByPath(path);
    const file = old ? (await app.vault.modify(old, source), old) : await app.vault.create(path, source);
    await leaf.openFile(file);
    app.workspace.setActiveLeaf(leaf, { focus: true });
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false } });
    const view = leaf.view, editor = view.editor;
    editor.setCursor({ line: 0, ch: 0 });
    const live = () => view.containerEl.querySelector('.markdown-source-view');
    assert(`${sample.language}-cold-live-widget`, await until(() => Boolean(live().querySelector('.expressive-code'))));
    assert(`${sample.language}-live-copy-button`, Boolean(live().querySelector('.expressive-code .copy button')));
    const at = source.indexOf(sample.code), word = source.indexOf(sample.word, at);
    const edit = live().querySelector('.edit-block-button');
    assert(`${sample.language}-live-edit-button`, Boolean(edit));
    edit.click();
    editor.focus();
    const hasTokens = await until(() => Boolean(live().querySelector('.hb-syntax-token')));
    const extension = editor.cm.plugin(plugin.syntax.editorExtension);
    assert(`${sample.language}-edit-without-changing-source-has-tokens`, hasTokens, {
      extension: Boolean(extension), decorations: extension?.decorations.size,
      engineTokens: (await plugin.syntax.engine.tokens(sample.code, sample.language)).length,
      composing: editor.cm.composing, compositionStarted: editor.cm.compositionStarted,
      source: live().innerText.slice(0, 800),
      button: edit.outerHTML, selection: editor.cm.state.selection.toJSON(),
      focus: editor.cm.hasFocus, documentFocus: document.hasFocus(),
    });
    assert(`${sample.language}-navigation-keeps-source`, editor.getValue() === source);
    editor.setSelection(editor.offsetToPos(word), editor.offsetToPos(word + sample.word.length));
    app.commands.executeCommandById('highlight-boost:apply-question');
    const marked = editor.getValue();
    assert(`${sample.language}-highlight-keeps-code`, marked.includes(sample.code) && marked.includes(`"quote":"${sample.word}"`));
    assert(`${sample.language}-editor-highlight-and-syntax`, await until(() => Boolean(live().querySelector('.hb-text')) && Boolean(live().querySelector('.hb-syntax-token'))));
    editor.undo(); assert(`${sample.language}-highlight-single-undo`, editor.getValue() === source);
    editor.redo();
    editor.setCursor({ line: 0, ch: 0 });
    assert(`${sample.language}-preview-restores-after-edit`, await until(() => Boolean(live().querySelector('.expressive-code'))));
    assert(`${sample.language}-live-highlight`, await until(() => Boolean(live().querySelector('.expressive-code .hb-text'))));
    await app.vault.modify(file, marked);
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
    const reading = () => view.containerEl.querySelector('.markdown-preview-view');
    assert(`${sample.language}-reading-highlight`, await until(() => Boolean(reading().querySelector('.expressive-code .hb-text'))));
    const copy = reading().querySelector('.expressive-code .copy button');
    assert(`${sample.language}-copy-keeps-code`, copy.dataset.code.replaceAll('\x7f', '\n') === sample.code);
    assert(`${sample.language}-source-keeps-code`, await app.vault.read(file) === marked);
  }
  const view = leaf.view;
  await leaf.setViewState({ type: 'markdown', state: { file: view.file.path, mode: 'source', source: true } });
  const editor = view.editor;
  assert('source-mode-has-syntax', await until(() => Boolean(view.containerEl.querySelector('.hb-syntax-token'))));
  const beforeComposition = editor.getValue();
  const position = beforeComposition.lastIndexOf('mov rax') + 3;
  editor.setCursor(editor.offsetToPos(position));
  editor.focus();
  editor.cm.contentDOM.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  editor.transaction({ changes: [{ from: editor.offsetToPos(position), text: '中' }] }, 'input.type.compose.start');
  await tick();
  editor.transaction({ changes: [{ from: editor.offsetToPos(position), to: editor.offsetToPos(position + 1), text: '中文' }] }, 'input.type.compose');
  editor.cm.contentDOM.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文' }));
  const composed = editor.getValue();
  assert('composition-keeps-one-commit', composed === beforeComposition.slice(0, position) + '中文' + beforeComposition.slice(position));
  assert('composition-restores-syntax', await until(() => Boolean(view.containerEl.querySelector('.hb-syntax-token'))));
  editor.undo(); assert('composition-single-undo', editor.getValue() === beforeComposition);
  editor.redo(); assert('composition-redo', editor.getValue() === composed);
  editor.undo();

  const longPath = '内置语法-视口.md';
  const longSource = `${'解析前文\n\n'.repeat(1200)}\`\`\`asm\nmov rax, 7\nret\n\`\`\`\n`;
  const previous = app.vault.getFileByPath(longPath);
  const longFile = previous ? (await app.vault.modify(previous, longSource), previous) : await app.vault.create(longPath, longSource);
  await leaf.openFile(longFile);
  await leaf.setViewState({ type: 'markdown', state: { file: longPath, mode: 'source', source: true } });
  const distant = leaf.view.editor, target = longSource.lastIndexOf('mov');
  distant.scrollIntoView({ from: distant.offsetToPos(target), to: distant.offsetToPos(target + 10) }, true);
  assert('distant-block-scroll-without-edit-has-syntax', await until(() => [...leaf.view.containerEl.querySelectorAll('.hb-syntax-token')].some(token => token.textContent === 'mov')));
  assert('distant-block-keeps-source', distant.getValue() === longSource);
  plugin.settings = original;
  await plugin.saveSettings();
  await app.plugins.disablePlugin('highlight-boost');
  assert('builtin-style-cleanup', !document.querySelector('style[data-hb-syntax]'));
  await app.plugins.enablePlugin('highlight-boost');
  assert('native-provider-restored', !app.plugins.plugins['highlight-boost'].syntax);
  return checks;
})()
