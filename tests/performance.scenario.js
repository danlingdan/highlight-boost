(async () => {
  const checks = [], errors = []; window.__hbChecks = checks;
  window.addEventListener('error', event => errors.push(event.error?.stack ?? event.message));
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const settled = async () => { await new Promise(resolve => setTimeout(resolve, 0)); document.body.getBoundingClientRect(); };
  const until = async predicate => { for (let i = 0; i < 200 && !predicate(); i++) await tick(); return predicate(); };
  const metrics = {}, measure = async (name, count, action, setup) => {
    const samplesMs = []; for (let i = 0; i < count; i++) { if (setup) await setup(); const start = performance.now(); await action(i); samplesMs.push(performance.now() - start); }
    const sorted = [...samplesMs].sort((a, b) => a - b); metrics[name] = { samplesMs, p50Ms: sorted[Math.ceil(count * .5) - 1], p95Ms: sorted[Math.ceil(count * .95) - 1] };
  };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  let plugin = app.plugins.plugins['highlight-boost']; const original = structuredClone(plugin.settings);
  const path = '性能验收.md', old = app.vault.getFileByPath(path), previous = old ? await app.vault.read(old) : undefined;
  const file = old ? (await app.vault.modify(old, '# Performance\n'), old) : await app.vault.create(path, '# Performance\n');
  const leaf = app.workspace.getLeaf(false); await leaf.openFile(file); app.workspace.setActiveLeaf(leaf, { focus: true });
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: true } });
  const view = leaf.view, editor = view.editor;
  for (const provider of ['native', 'shiki']) {
    plugin.settings.syntaxProvider = provider; await plugin.saveSettings();
    await measure(`${provider}-enable`, 3, async () => {
      await app.plugins.enablePlugin('highlight-boost'); plugin = app.plugins.plugins['highlight-boost']; await plugin.index.ready;
    }, () => app.plugins.disablePlugin('highlight-boost'));
  }
  plugin.settings.syntaxProvider = 'native'; plugin.settings.selectionToolbar = false; await plugin.saveSettings();
  await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost'); plugin = app.plugins.plugins['highlight-boost']; await plugin.index.ready;
  const prefix = '# Performance\n\nneedle and ==second==\n\n', paragraph = 'A paragraph with plain text and **formatting**.\n\n';
  const medium = prefix + paragraph.repeat(Math.ceil((200 * 1024 - prefix.length) / paragraph.length)).slice(0, 200 * 1024 - prefix.length);
  editor.setValue(medium); await plugin.index.ready; await plugin.openPanel(); await settled();
  if (window.__hbPerformanceProfile) await window.require('electron').ipcRenderer.invoke('hb-performance-profile', 'start');
  await measure('edit-to-sidebar-200KiB', 5, async i => {
    const from = editor.getValue().indexOf('needle'); editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(from + 6));
    const color = i % 2 ? 'blue' : 'yellow'; plugin.applyColor(editor, color);
    if (!await until(() => [...document.querySelectorAll(`.hb-card.hb-${color} .hb-quote`)].some(node => node.textContent === 'needle'))) throw new Error('Sidebar update missing');
    await settled();
  });
  if (window.__hbPerformanceProfile) await window.require('electron').ipcRenderer.invoke('hb-performance-profile', 'stop');
  assert('performance-medium-source', editor.getValue().includes('needle') && editor.getValue().length >= 200 * 1024);
  const code = '```js\n' + Array.from({ length: 500 }, (_, i) => `const value${i} = ${i};`).join('\n') + '\n```';
  editor.setValue(code); await plugin.index.ready;
  plugin.settings.codeDisplay.showLineNumbers = true; await plugin.saveSettings();
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
  const root = view.containerEl.querySelector('.markdown-preview-view');
  assert('performance-code-500-rows', await until(() => root.querySelectorAll('[data-hb-number]').length === 500));
  await measure('render-500-code-lines', 7, async i => {
    plugin.settings.codeDisplay.startLine = i + 10; await plugin.saveSettings();
    if (!await until(() => root.querySelector(`[data-hb-number="${i + 10}"]`))) throw new Error('Code rows missing'); await settled();
  });
  assert('performance-code-source-exact', editor.getValue() === code);
  const largeCode = '```js\n' + Array.from({ length: 5000 }, (_, i) => `const value${i} = ${i}; // ${'x'.repeat(180)}`).join('\n') + '\n```';
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: true } }); editor.setValue(largeCode); await plugin.index.ready;
  await measure('selection-transaction-5000-lines', 5, async i => { const line = i % 2 ? 2 : 4999; editor.setSelection({ line, ch: 6 }, { line, ch: 12 }); editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 12 } }, true); await settled(); });
  assert('performance-large-code-source-exact', editor.getValue() === largeCode);
  const fs = window.require('fs'), nodePath = window.require('path');
  const buildSha256 = window.require('crypto').createHash('sha256').update(fs.readFileSync(nodePath.join(app.vault.adapter.basePath, plugin.manifest.dir, 'main.js'))).digest('hex');
  const observations = { metrics, errors, buildSha256, timing: 'DOM-ready with forced layout; no animation-frame wait', fixtures: { mediumBytes: new TextEncoder().encode(medium).length, codeLines: 500, largeCodeLines: 5000, largeCodeBytes: new TextEncoder().encode(largeCode).length }, rendererHeap: window.require('v8').getHeapStatistics(), indexNotes: plugin.index.notes.size };
  window.__hbObservations = observations;
  const label = window.__hbPerformanceLabel ?? 'current';
  await app.vault.adapter.write(`${app.vault.configDir}/hb-performance-${label}.json`, JSON.stringify(observations));
  editor.setValue(previous ?? '# Performance complete\n'); await new Promise(resolve => setTimeout(resolve, 200));
  if (previous === undefined) await app.vault.delete(file); else await app.vault.modify(file, previous);
  plugin.settings = original; await plugin.saveSettings(); await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost');
  assert('performance-settings-restored', JSON.stringify(app.plugins.plugins['highlight-boost'].settings) === JSON.stringify(original));
  return checks;
})()
