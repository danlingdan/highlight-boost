(async () => {
  const checks = []; window.__hbChecks = checks;
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost']; await plugin.index.ready;
  const expected = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/hb-notes-expected.json`));
  const note = plugin.index.notes.get(expected.path);
  assert('notes-restart-source-exact', note.text === expected.source);
  assert('notes-restart-five-notes', note.items.length === 5 && note.items.every(item => item.note));
  assert('notes-restart-rebound-code-note', note.items.some(item => item.quote === 'total = 2' && item.note.includes('代码检索词')));
  assert('notes-restart-prose-footnote', note.items.some(item => item.quote === '核心概念' && item.note === '另一处已保存'));
  assert('notes-restart-inline-special-characters', note.items.some(item => item.quote === 'a==b' && item.note.includes('%% `tick` <b>原文</b>')));
  assert('notes-restart-collection-snapshot', plugin.settings.collections.find(collection => collection.id === expected.collectionId).entries[0].note.includes('代码检索词'));
  assert('notes-restart-export-keeps-comments', (await app.vault.read(app.vault.getFileByPath(expected.exported))).includes('批注\n\n代码检索词'));
  assert('notes-restart-export-excluded', !plugin.index.notes.has(expected.exported));
  plugin.settings = expected.originalSettings; await plugin.saveSettings();
  await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost');
  assert('notes-restart-settings-restored', JSON.stringify(app.plugins.plugins['highlight-boost'].settings) === JSON.stringify(expected.originalSettings));
  return checks;
})()
