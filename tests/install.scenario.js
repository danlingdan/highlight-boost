(async () => {
  const checks = [], errors = []; window.__hbChecks = checks;
  const assert = (name, value, details) => { if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`); checks.push({ name, passed: true }); };
  window.addEventListener('error', event => errors.push(event.message));
  const tick = () => new Promise(resolve => setTimeout(resolve, 100));
  const until = async predicate => { for (let i = 0; i < 60 && !predicate(); i++) await tick(); return predicate(); };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  let plugin = app.plugins.plugins['highlight-boost'];
  const fs = window.require('fs'), path = window.require('path'), crypto = window.require('crypto'), base = app.vault.adapter.basePath;
  const candidate = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/candidate.json`));
  for (const [file, expected] of Object.entries(candidate.files)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(base, plugin.manifest.dir, file))).digest('hex');
    assert(`install-hash-${file}`, actual === expected);
  }
  assert('install-version-matches-candidate', plugin.manifest.version === candidate.version && plugin.manifest.minAppVersion === candidate.minAppVersion);
  const source = '# 候选安装\n\n重点 alpha 与 `inline()`。\n\n```js\nconst value = 1;\nconsole.log(value);\n```\n', filePath = '候选安装验收.md', restart = window.__hbHostMode === 'install-restart';
  let file = app.vault.getFileByPath(filePath);
  if (!restart) { assert('install-clean-note', !file); file = await app.vault.create(filePath, source); }
  else assert('install-restart-note-exists', Boolean(file));
  const leaf = app.workspace.getLeaf('tab'); await leaf.openFile(file); app.workspace.setActiveLeaf(leaf, { focus: true });
  await leaf.setViewState({ type: 'markdown', state: { file: filePath, mode: 'source', source: true } });
  const editor = leaf.view.editor;
  const select = word => { const from = editor.getValue().lastIndexOf(word); editor.focus(); editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(from + word.length)); };
  let expected;
  if (!restart) {
    assert('install-default-provider', plugin.settings.syntaxProvider === 'native');
    for (const [word, command] of [['alpha', 'apply-important'], ['inline()', 'apply-question'], ['value', 'apply-reference']]) {
      select(word); assert(`install-command-${word}`, app.commands.executeCommandById(`highlight-boost:${command}`));
    }
    const marked = editor.getValue(); editor.undo(); assert('install-single-undo', !/%%hb:/.test(editor.getValue())); editor.redo(); assert('install-single-redo', editor.getValue() === marked);
    plugin.saveNote(editor, plugin.documentFor(editor).items.find(item => item.kind === 'code-range'), '候选安装批注');
    expected = editor.getValue(); await leaf.view.save();
    assert('install-host-saved', await app.vault.read(file) === expected);
    await app.vault.adapter.write(`${app.vault.configDir}/install-expectation.json`, JSON.stringify({ text: expected, version: candidate.version }));
    select('value'); await plugin.copyCode(editor);
    assert('install-copy-pure-code', await navigator.clipboard.readText() === 'const value = 1;\nconsole.log(value);');
    plugin.settings.syntaxProvider = 'shiki'; plugin.settings.language = 'en'; await plugin.saveSettings();
    await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost'); plugin = app.plugins.plugins['highlight-boost'];
  } else {
    expected = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/install-expectation.json`)).text;
    assert('install-restart-settings', plugin.settings.syntaxProvider === 'shiki' && plugin.settings.language === 'en');
  }
  assert('install-source-persisted', editor.getValue() === expected);
  assert('install-three-object-types', plugin.documentFor(editor).items.length === 3);
  await plugin.openPanel('note'); assert('install-sidebar-three-cards', await until(() => document.querySelectorAll('.hb-card').length === 3));
  await leaf.setViewState({ type: 'markdown', state: { file: filePath, mode: 'preview' } });
  assert('install-reading-code-mark', await until(() => leaf.view.containerEl.querySelector('pre .hb-text')?.textContent === 'value'));
  assert('install-reading-prose-inline', Boolean(leaf.view.containerEl.querySelector('mark')) && Boolean(leaf.view.containerEl.querySelector('code.hb-inline')));
  assert('install-reading-annotation', leaf.view.containerEl.querySelector('.hb-note-text')?.textContent === '候选安装批注');
  assert('install-no-page-errors', errors.length === 0, errors);
  window.__hbObservations = { candidate, restart, errors }; return checks;
})()
