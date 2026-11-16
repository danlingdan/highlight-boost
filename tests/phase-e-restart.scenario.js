(async () => {
  const checks = []; window.__hbChecks = checks;
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost']; await plugin.index.ready;
  const expected = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/hb-phase-e-expected.json`));
  const collection = plugin.settings.collections.find(collection => collection.id === expected.collectionId);
  assert('e-restart-collection-and-paths', collection?.entries.length === 3 && collection.entries.every(entry => entry.path.startsWith('阶段E改名/')));
  assert('e-restart-source-exact', plugin.index.notes.get(expected.path)?.text === expected.source);
  assert('e-restart-export-excluded', !plugin.index.notes.has(expected.exported));
  assert('e-restart-deleted-file-absent', !plugin.index.notes.has(expected.gone));
  await plugin.openPanel('collection');
  const panel = document.querySelector('.hb-panel'), select = panel.querySelector('.hb-collection'); select.value = expected.collectionId; select.dispatchEvent(new Event('change', { bubbles: true }));
  assert('e-restart-three-collection-cards', panel.querySelectorAll('.hb-card').length === 3);
  const missing = [...panel.querySelectorAll('.hb-card')].find(card => card.querySelector('.hb-quote').textContent === 'beta');
  assert('e-restart-missing-snapshot', missing.textContent.includes('Needs relocation'));
  window.__hbUI.menu(missing.querySelector('.hb-card-more'), plugin.t('removeCollectionEntry')).click(); await plugin.settingsWrites;
  assert('e-remove-entry-keeps-source', plugin.settings.collections.find(collection => collection.id === expected.collectionId).entries.length === 2 && await app.vault.read(app.vault.getFileByPath(expected.path)) === expected.source);
  const saved = await plugin.loadData(); assert('e-collection-write-restores-consistently', saved.collections.find(collection => collection.id === expected.collectionId).entries.length === 2);
  const remove = window.__hbUI.menu(panel.querySelector('.hb-panel-header button'), plugin.t('deleteCollection')); remove.click(); await plugin.settingsWrites;
  assert('e-delete-collection-keeps-source', !plugin.settings.collections.some(collection => collection.id === expected.collectionId) && await app.vault.read(app.vault.getFileByPath(expected.path)) === expected.source);
  plugin.settings = expected.originalSettings; await plugin.saveSettings();
  assert('e-restart-settings-restored', JSON.stringify(plugin.settings) === JSON.stringify(expected.originalSettings));
  return checks;
})()
