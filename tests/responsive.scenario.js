(async () => {
  const checks = [], errors = []; window.__hbChecks = checks;
  window.addEventListener('error', event => errors.push(event.error?.stack ?? event.message));
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push({ name, passed: true }); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost']; await plugin.index.ready;
  const files = app.vault.getMarkdownFiles().filter(file => file.path.startsWith('notes/00')).sort((a, b) => a.path.localeCompare(b.path));
  assert('responsive-real-files', files.length === 1000 && files.reduce((sum, file) => sum + file.stat.size, 0) === 10486000);
  const Index = plugin.index.constructor; plugin.index.dispose();
  plugin.index = new Index({ paths: () => [], read: async () => '' }, () => {});
  await plugin.openPanel('vault');
  const workbench = app.workspace.getLeavesOfType('highlight-boost')[0].view, panel = workbench.contentEl;
  const search = panel.querySelector('.hb-search'), samples = [];
  for (let i = 0; i < 3; i++) {
    plugin.index.dispose(); search.value = ''; let changes = 0;
    plugin.index = new Index({ paths: () => files.map(file => file.path), read: path => app.vault.read(app.vault.getFileByPath(path)) }, () => { changes++; plugin.refreshPanels(); });
    workbench.refresh();
    let last = performance.now(), longestGapMs = 0, probe, focused, card, probeError;
    const timer = setInterval(() => {
      const now = performance.now(); longestGapMs = Math.max(longestGapMs, now - last); last = now;
      if (plugin.index.notes.size < 100 || probe) return;
      try {
        const start = performance.now(); search.focus(); search.value = 'needle-00000'; search.dispatchEvent(new Event('input', { bubbles: true })); panel.getBoundingClientRect();
        probe = { inputMs: performance.now() - start, exact: panel.querySelectorAll('.hb-card').length === 1 && panel.querySelector('.hb-quote')?.textContent === 'needle-00000' };
        search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true }));
        focused = panel.querySelector('[data-hb-page="next"]'); focused?.focus(); card = panel.querySelector('.hb-card');
      } catch (error) { probeError = String(error); probe = { inputMs: 0, exact: false }; }
    }, 10);
    const start = performance.now(); await plugin.index.rebuild(); await tick(); clearInterval(timer); panel.getBoundingClientRect();
    const sample = { elapsedMs: performance.now() - start, longestGapMs, notifications: changes, ...probe, probeError, focusRetained: document.activeElement === focused, cardRetained: card === panel.querySelector('.hb-card') };
    samples.push(sample);
    assert('responsive-search-during-rebuild', probe?.exact && !probeError);
    assert('responsive-final-results', workbench.hits.length === 1000 && panel.querySelectorAll('.hb-card').length === 50 && plugin.index.errors.size === 0);
    console.warn(`responsive sample ${i + 1}: ${sample.elapsedMs.toFixed(1)} ms, ${longestGapMs.toFixed(1)} ms max gap, card retained=${sample.cardRetained}`);
  }
  const fs = window.require('fs'), path = window.require('path');
  window.__hbObservations = { samples, errors, fixture: { notes: files.length, bytes: 10486000, visibleCards: 50 },
    method: 'Fresh HighlightIndex over actual Vault.read, production refreshPanels callback, workbench open throughout, search and focus probe after 100 indexed notes; 10 ms timer; OS file cache retained.',
    buildSha256: window.require('crypto').createHash('sha256').update(fs.readFileSync(path.join(app.vault.adapter.basePath, plugin.manifest.dir, 'main.js'))).digest('hex') };
  assert('responsive-no-page-errors', errors.length === 0);
  await app.plugins.disablePlugin('highlight-boost');
  return checks;
})()
