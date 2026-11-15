(async () => {
  const checks = [], errors = []; window.__hbChecks = checks;
  window.addEventListener('error', event => errors.push(event.error?.stack ?? event.message));
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const settled = async () => { await tick(); document.body.getBoundingClientRect(); };
  const metrics = {}, measure = async (name, count, action) => {
    const samplesMs = [];
    for (let i = 0; i < count; i++) { const start = performance.now(); await action(i); samplesMs.push(performance.now() - start); }
    const sorted = [...samplesMs].sort((a, b) => a - b);
    metrics[name] = { samplesMs, p50Ms: sorted[Math.ceil(count * .5) - 1], p95Ms: sorted[Math.ceil(count * .95) - 1] };
  };
  const fixture = JSON.parse(await app.vault.adapter.read('.obsidian/hb-scale-fixture.json'));
  const files = app.vault.getMarkdownFiles().filter(file => file.path.startsWith('notes/'));
  assert('scale-real-files', files.length === fixture.count && files.reduce((sum, file) => sum + file.stat.size, 0) === fixture.totalBytes);
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost']; await plugin.index.ready;
  const Index = plugin.index.constructor; plugin.index.dispose();
  const gaps = [], notifications = [], reads = [], heaps = [], os = window.require('os'), v8 = window.require('v8');
  await measure('disk-cold-index-10000', 3, async () => {
    let readCount = 0, changes = 0, last = performance.now(), gap = 0;
    const timer = setInterval(() => { const now = performance.now(); gap = Math.max(gap, now - last); last = now; }, 10);
    plugin.index = new Index({ paths: () => files.map(file => file.path), read: async path => { readCount++; return app.vault.read(app.vault.getFileByPath(path)); } }, () => { changes++; });
    await plugin.index.rebuild(); await tick(); clearInterval(timer);
    assert('scale-cold-index-complete', plugin.index.notes.size === fixture.count && plugin.index.all().length === fixture.count && plugin.index.errors.size === 0);
    gaps.push(gap); notifications.push(changes); reads.push(readCount); heaps.push(v8.getHeapStatistics().used_heap_size);
    if (reads.length < 3) plugin.index.dispose();
    console.warn(`scale cold sample ${reads.length}: ${readCount} reads, ${gap.toFixed(1)} ms max timer gap`);
  });
  const item = plugin.index.notes.get('notes/000/00000.md').items;
  await measure('disk-warm-rebuild-10000', 3, () => plugin.index.rebuild());
  assert('scale-warm-items-reused', plugin.index.notes.get('notes/000/00000.md').items === item);
  const changed = app.vault.getFileByPath('notes/050/05000.md'), original = await app.vault.read(changed);
  await measure('disk-incremental-one-note', 3, async i => {
    await app.vault.modify(changed, original.replace('needle-05000', `updated-${i}`)); await plugin.index.enqueue(changed.path);
    assert('scale-incremental-current', plugin.index.notes.get(changed.path).items[0].quote === `updated-${i}`);
  });
  await app.vault.modify(changed, original); await plugin.index.enqueue(changed.path);
  await plugin.openPanel('note');
  const workbench = app.workspace.getLeavesOfType('highlight-boost')[0].view, panel = workbench.contentEl;
  const set = (key, value) => { const input = panel.querySelector(`.hb-${key}`); input.value = value; input.dispatchEvent(new Event(input.tagName === 'INPUT' ? 'input' : 'change', { bubbles: true })); };
  set('path-filter', 'notes/00'); await workbench.setScope('vault'); await settled();
  await measure('render-1000-results', 3, async () => { workbench.refresh(); await settled(); });
  assert('scale-query-total', workbench.hits.length === 1000);
  const displayed = panel.querySelectorAll('.hb-card').length;
  await measure('filter-1000-results', 3, async i => { set('search', `needle-0000${i}`); await settled(); assert('scale-filter-exact', panel.querySelectorAll('.hb-card').length === 1); });
  set('search', '');
  const observations = { metrics, errors, fixture, coldIndex: { longestTimerGapMs: gaps, changeNotifications: notifications, diskReadCalls: reads, usedHeapBytes: heaps }, displayedCards: displayed,
    method: 'Fresh HighlightIndex over real Vault.read for cold samples; unchanged index for warm samples. OS file cache retained. UI timings include forced layout, without animation-frame wait.',
    environment: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model, ramBytes: os.totalmem(), heapLimitBytes: v8.getHeapStatistics().heap_size_limit } };
  if (panel.querySelector('.hb-pagination')) {
    set('path-filter', ''); await settled();
    await measure('render-10000-results', 3, async () => { workbench.refresh(); await settled(); });
    assert('scale-full-query-bounded-dom', workbench.hits.length === fixture.count && panel.querySelectorAll('.hb-card').length <= 50);
    observations.fullDisplayedCards = panel.querySelectorAll('.hb-card').length;
  }
  observations.buildSha256 = window.require('crypto').createHash('sha256').update(window.require('fs').readFileSync(window.require('path').join(app.vault.adapter.basePath, plugin.manifest.dir, 'main.js'))).digest('hex');
  window.__hbObservations = observations;
  assert('scale-no-page-errors', errors.length === 0);
  await app.plugins.disablePlugin('highlight-boost');
  assert('scale-unload-clears-index', plugin.index.notes.size === 0 && !document.querySelector('.hb-panel .hb-card'));
  return checks;
})()
