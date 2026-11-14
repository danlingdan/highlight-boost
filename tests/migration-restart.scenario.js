(async () => {
  const checks = []; window.__hbChecks = checks;
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  const until = async predicate => { for (let i = 0; i < 60 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 100)); return predicate(); };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost']; await plugin.index.ready;
  const expected = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/hb-migration-expected.json`));
  assert('migration-restart-source-after', await app.vault.read(app.vault.getFileByPath(expected.path)) === expected.after);
  const run = (await plugin.migrations.history()).find(run => run.id === expected.id);
  assert('migration-restart-journal', run?.files[0].before === expected.originals[expected.path] && run.files[0].status === 'applied');
  app.commands.executeCommandById('highlight-boost:open-migration');
  const modal = () => document.querySelector('.hb-migration');
  assert('migration-restart-history-ui', await until(() => modal()?.querySelector(`[data-hb-import-run="${expected.id}"] button`)));
  modal().querySelector(`[data-hb-import-run="${expected.id}"] button`).click();
  assert('migration-restart-restore-exact', await until(() => modal().querySelector('[role="status"]').textContent.includes('File restored')));
  for (const [path, source] of Object.entries(expected.originals)) assert(`migration-restart-file-${path}`, await app.vault.read(app.vault.getFileByPath(path)) === source);
  assert('migration-restart-status-persisted', (await plugin.migrations.history()).find(run => run.id === expected.id).files[0].status === 'restored');
  modal().querySelector('[data-hb-import="close"]').click();
  plugin.settings = expected.originalSettings; await plugin.saveSettings(); await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost');
  assert('migration-restart-settings-restored', JSON.stringify(app.plugins.plugins['highlight-boost'].settings) === JSON.stringify(expected.originalSettings));
  return checks;
})()
