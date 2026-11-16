(async () => {
  const checks = [];
  window.__hbChecks = checks;
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  await app.plugins.loadManifests();
  await app.plugins.setEnable(true);
  await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost'];
  const expected = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/hb-prose-expected.json`));
  const file = app.vault.getFileByPath('正文语义.md'), text = await app.vault.read(file);
  assert('prose-restart-source-exact', text === expected.text);
  const metadata = [...text.matchAll(/%%hbp:(.+?)%%/g)].map(match => JSON.parse(match[1]));
  assert('prose-restart-identities-exact', JSON.stringify(metadata.map(item => item.id)) === JSON.stringify(expected.ids));
  assert('prose-restart-semantic-snapshots', metadata.map(item => item.semantic).join(',') === 'action,important,question,important' && metadata[1].label === '核心观点');
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: false } });
  await plugin.openPanel('note');
  assert('prose-restart-sidebar', document.querySelectorAll('.hb-card[data-hb-semantic]').length === 4);
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'preview' } });
  const root = leaf.view.containerEl.querySelector('.markdown-preview-view');
  for (let i = 0; i < 40 && root.querySelectorAll('mark').length !== 4; i++) await new Promise(resolve => setTimeout(resolve, 150));
  assert('prose-restart-reading', root.querySelectorAll('mark').length === 4 && !root.textContent.includes('%%hbp:'));
  assert('prose-restart-reading-keeps-source', await app.vault.read(file) === text);
  return checks;
})()
