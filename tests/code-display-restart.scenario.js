(async () => {
  const checks = []; window.__hbChecks = checks;
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost']; await plugin.index.ready;
  const expected = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/hb-display-expected.json`));
  assert('display-restart-options', JSON.stringify(plugin.settings.codeDisplay) === JSON.stringify(expected.display));
  assert('display-restart-source-exact', plugin.index.notes.get(expected.path)?.text === expected.source);
  assert('display-restart-note-preserved', plugin.index.notes.get(expected.path).items.some(item => item.note === 'diff 人工批注'));
  assert('display-restart-session-starts-fresh', plugin.codeDisplaySessions.size === 0);
  const file = app.vault.getFileByPath(expected.path), leaf = app.workspace.getLeaf(false); await leaf.openFile(file);
  await leaf.setViewState({ type: 'markdown', state: { file: expected.path, mode: 'preview' } });
  const root = leaf.view.containerEl.querySelector('.markdown-preview-view');
  for (let i = 0; i < 45 && root.querySelectorAll('.hb-code-display').length !== 4; i++) await new Promise(resolve => setTimeout(resolve, 100));
  const components = [...root.querySelectorAll('.hb-code-display')];
  assert('display-restart-components', components.length === 4);
  assert('display-restart-default-folding', components.every(block => block.querySelector('.hb-code-body').hidden));
  assert('display-restart-start-number', components.some(block => block.querySelector('[data-hb-number="20"]')));
  plugin.settings = expected.originalSettings; await plugin.saveSettings();
  await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost');
  assert('display-restart-settings-restored', JSON.stringify(app.plugins.plugins['highlight-boost'].settings) === JSON.stringify(expected.originalSettings));
  return checks;
})()
