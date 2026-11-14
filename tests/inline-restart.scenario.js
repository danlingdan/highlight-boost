(async () => {
  const checks = [];
  window.__hbChecks = checks;
  const assert = (name, value) => {
    if (!value) throw new Error(name);
    checks.push({ name, passed: true });
  };
  await app.plugins.loadManifests();
  await app.plugins.setEnable(true);
  await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost'];
  assert('inline-restart-plugin-loaded', Boolean(plugin));
  const expected = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/hb-inline-expected.json`));
  const file = app.vault.getFileByPath('行内验证.md');
  const text = await app.vault.read(file);
  assert('inline-restart-source-equal', text === expected.text);
  assert('inline-restart-metadata-identities', new Set([...text.matchAll(/%%hbi:(.+?)%%/g)].map(match => JSON.parse(match[1]).id)).size === 7);
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: false } });
  await plugin.openPanel();
  assert('inline-restart-sidebar', document.querySelectorAll('.hb-card').length === 7);
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'preview' } });
  const root = leaf.view.containerEl.querySelector('.markdown-preview-view');
  for (let i = 0; i < 40 && root.querySelectorAll('code.hb-inline').length !== 7; i++) await new Promise(resolve => setTimeout(resolve, 150));
  assert('inline-restart-reading-decorations', root.querySelectorAll('code.hb-inline').length === 7);
  assert('inline-restart-does-not-rewrite', await app.vault.read(file) === text);
  return checks;
})()
