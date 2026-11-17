(async () => {
  const checks = [], errors = []; window.__hbChecks = checks;
  const assert = (name, value, details) => { if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`); checks.push({ name, passed: true }); };
  window.addEventListener('error', event => errors.push(event.message));
  const tick = () => new Promise(resolve => setTimeout(resolve, 10));
  const until = async predicate => { for (let i = 0; i < 200 && !predicate(); i++) await tick(); return predicate(); };
  const frame = async (name, element) => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const bounds = element.getBoundingClientRect();
    const rectangle = { x: Math.max(0, Math.floor(bounds.x)), y: Math.max(0, Math.floor(bounds.y)), width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) };
    const result = await window.require('electron').ipcRenderer.invoke('hb-frame-capture', name, rectangle);
    assert(`${name}-painted`, !result.empty && result.bytes > 100, result); return result;
  };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  let plugin = app.plugins.plugins['highlight-boost']; const original = structuredClone(plugin.settings), metrics = {};
  const legacy = plugin.settings.schemaVersion !== 3;
  if (legacy) plugin.settings.syntaxProvider = 'shiki';
  plugin.settings.selectionToolbar = false; await plugin.saveSettings();
  await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost'); plugin = app.plugins.plugins['highlight-boost'];
  const path = '帧与滚动验收.md', prefix = '# Frames\n\nneedle and plain text.\n\n', source = prefix + 'A paragraph with plain text and **formatting**.\n\n'.repeat(4360).slice(0, 200 * 1024 - prefix.length);
  for (const existing of app.workspace.getLeavesOfType('markdown')) if (existing.view.file?.path === path) existing.detach();
  const old = app.vault.getFileByPath(path), file = old ? (await app.vault.modify(old, source), old) : await app.vault.create(path, source);
  const leaf = app.workspace.getLeaf('tab'); await leaf.openFile(file); app.workspace.setActiveLeaf(leaf, { focus: true });
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: true } });
  const editor = leaf.view.editor; await plugin.openPanel('note');
  assert('frame-sidebar-inside-viewport', await until(() => { const panel=document.querySelector('.hb-panel'); if(!panel)return false; const bounds=panel.getBoundingClientRect(); return bounds.width>0&&bounds.left>=0&&bounds.right<=innerWidth&&bounds.top<innerHeight; }));
  const measure = async (name, count, action) => { const samplesMs = []; for (let i = 0; i < count; i++) { const start = performance.now(); await action(i); samplesMs.push(performance.now() - start); } const sorted = [...samplesMs].sort((a, b) => a - b); metrics[name] = { samplesMs, p50Ms: sorted[Math.ceil(count * .5) - 1], p95Ms: sorted[Math.ceil(count * .95) - 1] }; };
  await measure('edit-to-sidebar-frame-200KiB', 7, async i => {
    const from = editor.getValue().indexOf('needle'); editor.focus(); editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(from + 6));
    const color = i % 2 ? 'blue' : 'yellow'; plugin.applyColor(editor, color);
    assert('frame-sidebar-current-color', await until(() => document.querySelector(`.hb-card.hb-${color} .hb-quote`)?.textContent === 'needle'));
    await frame('frame-sidebar', document.querySelector('.hb-card'));
  });
  const code = '```js\n' + Array.from({ length: 5000 }, (_, i) => `const value${i} = ${i}; // ${'x'.repeat(180)}`).join('\n') + '\n```\n';
  editor.setValue(code); await leaf.view.save();
  for (const provider of legacy ? ['native', 'shiki'] : ['unified']) {
    if (legacy) plugin.settings.syntaxProvider = provider; await plugin.saveSettings(); await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost'); plugin = app.plugins.plugins['highlight-boost'];
    let tokenizations = 0;
    if (provider !== 'native') {
      const engine = plugin.syntax.engine, tokenize = engine.tokens.bind(engine);
      engine.tokens = (...arguments_) => { tokenizations++; return tokenize(...arguments_); };
      assert(`${provider}-initial-tokens-ready`, await until(() => editor.cm.dom.querySelector('.hb-syntax-token')));
    }
    const initialTokenizations = tokenizations;
    await measure(`${provider}-scroll-to-frame-5000-lines`, 6, async i => {
      const line = i % 2 ? 3 : 4999, word = `value${line - 1}`;
      editor.focus(); editor.setSelection({ line, ch: 6 }, { line, ch: 6 + word.length }); editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 20 } }, true);
      const cm = editor.cm;
      assert(`${provider}-scroll-target-mounted`, await until(() => [...cm.dom.querySelectorAll('.cm-line')].some(node => node.textContent.includes(word))));
      const row = [...cm.dom.querySelectorAll('.cm-line')].find(node => node.textContent.includes(word)), box = row.getBoundingClientRect(), viewport = cm.scrollDOM.getBoundingClientRect();
      assert(`${provider}-scroll-target-visible`, box.top >= viewport.top - 2 && box.bottom <= viewport.bottom + 2, { box: box.toJSON(), viewport: viewport.toJSON() });
      assert(`${provider}-scroll-selection-exact`, editor.getSelection() === word);
      await frame('frame-scroll', cm.scrollDOM);
    });
    if (provider !== 'native') {
      const reused = tokenizations === initialTokenizations;
      assert(`${provider}-scroll-reuses-document-tokens`, reused, { tokenizations, initialTokenizations });
      editor.replaceRange('let', { line: 1, ch: 0 }, { line: 1, ch: 5 });
      assert(`${provider}-edit-rebuilds-tokens`, await until(() => tokenizations > initialTokenizations && [...editor.cm.dom.querySelectorAll('.hb-syntax-token')].some(node => node.textContent === 'let')));
      editor.undo(); assert(`${provider}-edit-undo-source-exact`, editor.getValue() === code);
    }
    assert(`${provider}-scroll-source-exact`, editor.getValue() === code);
  }
  const fs = window.require('fs'), nodePath = window.require('path'), crypto = window.require('crypto');
  const buildSha256 = crypto.createHash('sha256').update(fs.readFileSync(nodePath.join(app.vault.adapter.basePath, plugin.manifest.dir, 'main.js'))).digest('hex');
  window.__hbObservations = { metrics, errors, buildSha256, viewport: { width: innerWidth, height: innerHeight }, rendering: 'Electron offscreen software rendering; two animation frames followed by native capturePage', mediumBytes: new TextEncoder().encode(source).length, largeCodeBytes: new TextEncoder().encode(code).length };
  plugin.settings = original; await plugin.saveSettings();
  assert('frames-no-page-errors', errors.length === 0, errors);
  return checks;
})()
