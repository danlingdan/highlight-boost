(async () => {
  const checks = [];
  window.__hbChecks = checks;
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost'];
  const expected = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/hb-phase-d-expected.json`));
  const file = app.vault.getFileByPath('阶段D验收.md'), leaf = app.workspace.getLeaf(false);
  assert('d-restart-source-exact', await app.vault.read(file) === expected.source);
  await leaf.openFile(file); app.workspace.setActiveLeaf(leaf, { focus: true });
  await plugin.openPanel('note');
  const cards = [...document.querySelectorAll('.hb-card')];
  assert('d-restart-all-seven-marks', cards.length === 7);
  for (const word of ['核心观点', 'a==b', 'src', 'print', 'add ax, 1', 'memcpy', 'const sample']) assert(`d-restart-${word}`, cards.some(card => card.querySelector('.hb-quote').textContent.includes(word)));
  assert('d-restart-heading-and-code-context', cards.some(card => card.querySelector('.hb-heading-context')?.textContent.includes('C 示例') && card.querySelector('.hb-card-context code')?.textContent.includes('memcpy')));
  plugin.settings = expected.originalSettings; await plugin.saveSettings();
  assert('d-restart-restores-settings', JSON.stringify(plugin.settings) === JSON.stringify(expected.originalSettings));
  return checks;
})()
