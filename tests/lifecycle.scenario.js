(async () => {
  const checks = []; window.__hbChecks = checks;
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 120));
  const collect = () => window.require('electron').ipcRenderer.invoke('hb-collect-garbage');
  await app.plugins.loadManifests(); await app.plugins.setEnable(true);
  await app.plugins.disablePlugin('highlight-boost');
  app.workspace.updateOptions(); await tick();
  const settingsPath = '.obsidian/plugins/highlight-boost/data.json';
  const originalSettings = await app.vault.adapter.exists(settingsPath) ? await app.vault.adapter.read(settingsPath) : undefined;
  const settings = JSON.parse(originalSettings ?? '{}'); if (settings.schemaVersion !== 3) settings.syntaxProvider = 'shiki';
  await app.vault.adapter.write(settingsPath, JSON.stringify(settings));
  const name = '资源回收.md', text = '# Lifecycle\n\n' + Array.from({ length: 100 }, (_, i) => `==item-${i}==`).join('\n\n');
  const existing = app.vault.getFileByPath(name), previous = existing ? await app.vault.read(existing) : undefined;
  const file = existing ? (await app.vault.modify(existing, text), existing) : await app.vault.create(name, text);
  const leaf = app.workspace.getLeaf(false); await leaf.openFile(file); app.workspace.setActiveLeaf(leaf, { focus: true });
  await leaf.setViewState({ type: 'markdown', state: { file: name, mode: 'source', source: true } });
  const samples = [await collect()], released = [];
  const cycle = async () => {
    await app.plugins.enablePlugin('highlight-boost');
    const plugin = app.plugins.plugins['highlight-boost']; await plugin.index.ready; await plugin.openPanel('note');
    const panelLeaf = app.workspace.getLeavesOfType('highlight-boost')[0], view = panelLeaf.view;
    const parent = panelLeaf.parent;
    released.push({ plugin: new WeakRef(plugin), view: new WeakRef(view) });
    assert('lifecycle-view-loaded', view.contentEl.querySelectorAll('.hb-card').length === 50 && plugin.index.notes.size > 0 && view.excerptContexts.size <= 50);
    leaf.view.editor.focus(); leaf.view.editor.setSelection({ line: 2, ch: 2 }, { line: 2, ch: 8 }); await tick();
    await app.plugins.disablePlugin('highlight-boost'); app.workspace.updateOptions(); await tick();
    assert('lifecycle-leaf-location-preserved', app.workspace.getLeafById(panelLeaf.id) === panelLeaf && panelLeaf.parent === parent);
    assert('lifecycle-view-unloaded', panelLeaf.view !== view && !document.querySelector('.hb-pagination'));
    assert('lifecycle-index-released', plugin.index.notes.size === 0 && plugin.index.errors.size === 0);
    assert('lifecycle-render-references-released', view.hits.length === 0 && view.rendered.length === 0 && view.excerptContexts.size === 0 && view.contentEl.childElementCount === 0);
    view.refresh(); assert('lifecycle-closed-refresh-stays-empty', view.contentEl.childElementCount === 0 && view.hits.length === 0);
    assert('lifecycle-editor-resources-released', plugin.toolbars.size === 0 && plugin.editorViews.size === 0 && plugin.codeDisplaySessions.size === 0 && plugin.readingChildren.size === 0);
    assert('lifecycle-syntax-runtime-released', !plugin.syntax || plugin.syntax.runtime.documents.size === 0);
  };
  for (let i = 0; i < 3; i++) {
    await cycle(); await tick(); let sample;
    for (let attempt = 0; attempt < 10; attempt++) {
      sample = await collect(); sample.retained = { plugins: released.filter(reference => reference.plugin.deref()).length, views: released.filter(reference => reference.view.deref()).length };
      if (!sample.retained.plugins && !sample.retained.views) break; await tick();
    }
    assert('lifecycle-objects-collected', !sample.retained.plugins && !sample.retained.views); samples.push(sample);
  }
  await tick();
  if (window.__hbMemoryProfile) await window.require('electron').ipcRenderer.invoke('hb-memory-snapshot');
  if (previous === undefined) await app.vault.delete(file); else await app.vault.modify(file, previous);
  if (originalSettings === undefined) await app.vault.adapter.remove(settingsPath); else await app.vault.adapter.write(settingsPath, originalSettings);
  await app.plugins.enablePlugin('highlight-boost'); await app.plugins.plugins['highlight-boost'].index.ready;
  assert('lifecycle-reenable-works', Boolean(app.plugins.plugins['highlight-boost']));
  window.__hbObservations = { samples, method: 'Baseline and three complete enable/open/select/disable cycles, CDP HeapProfiler.collectGarbage followed by Runtime.getHeapUsage and Memory.getDOMCounters; plugin and view references leave the cycle scope before collection.' };
  return checks;
})()
