(async () => {
  const checks = [];
  window.__hbChecks = checks;
  const assert = (name, condition) => {
    if (!condition) throw new Error(name);
    checks.push({ name, passed: true });
  };
  await app.plugins.loadManifests();
  await app.plugins.setEnable(true);
  await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost'];
  assert('plugin-loaded-in-new-process', Boolean(plugin));
  assert('settings-survive-restart', plugin.settings.defaultPreset === 'question');
  const expected = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/hb-restart-expected.json`));
  const file = app.vault.getFileByPath('原型验证.md');
  const text = await app.vault.read(file);
  assert('document-survives-restart', text === expected.text);
  const metadata = Array.from(text.matchAll(/%%hb:(.+)%%/g), match=>JSON.parse(match[1]));
  assert('four-code-blocks-restored', metadata.length === 4);
  assert('code-anchors-restored', metadata.some(block=>block.marks.some(mark=>mark.quote === 'source')));
  assert('block-identities-restored', new Set(metadata.map(block=>block.blockId)).size === metadata.length);

  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: false } });
  await plugin.openPanel('note');
  const quotes = Array.from(document.querySelectorAll('.hb-quote')).map(element=>element.textContent);
  assert('sidebar-restored', quotes.includes('source') && quotes.includes('console'));
  const editor = leaf.view.editor;
  const from = text.lastIndexOf('memcpy(dst, source, n)') + 'memcpy(dst, '.length;
  editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(from + 6));
  editor.scrollIntoView({ from: editor.offsetToPos(from), to: editor.offsetToPos(from + 6) }, true);
  await new Promise(resolve=>setTimeout(resolve, 150));
  assert('code-decoration-restored', Array.from(leaf.view.containerEl.querySelectorAll('.hb-text')).some(element=>element.textContent === 'source'));
  assert('reading-does-not-rewrite-metadata', await app.vault.read(file) === text);
  return checks;
})()
