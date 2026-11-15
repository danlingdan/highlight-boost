const paths = require('./paths.cjs');
const { app, protocol } = require('electron');
const electron = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const net = require('node:net');

const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (typeof args[0] === 'string' && args[0].includes('obsidian-cli-')) args[0] += '-highlight-boost-test';
  return listen.apply(this, args);
};

const root = path.resolve(__dirname, '..');
const scale = ['scale', 'responsive'].includes(process.env.HB_HOST_MODE);
const suite = { responsive: 'responsive', scale: 'scale', compatibility: 'compat', accessibility: 'accessibility', multiwindow: 'multiwindow', 'multiwindow-restart': 'multiwindow', frames: 'frames', install: 'install', 'install-restart': 'install' }[process.env.HB_HOST_MODE];
const profile = paths.profile(suite);
const vault = paths.vault(suite);
const runtime = require('./obsidian-runtime.cjs')(root);
const source = runtime.source;
const scenarios = { functional: ['host.scenario.js', 'host-results.json'], advanced: ['advanced.scenario.js', 'host-advanced-results.json'], restart: ['restart.scenario.js', 'host-restart-results.json'], shiki: ['shiki.scenario.js', 'host-shiki-results.json'], languages: ['languages.scenario.js', 'host-languages-results.json'], 'languages-shiki': ['languages.scenario.js', 'host-languages-shiki-results.json'], layout: ['layout.scenario.js', 'host-layout-results.json'] };
scenarios.settings = ['settings.scenario.js', 'host-settings-results.json'];
scenarios.embedded = ['embedded-syntax.scenario.js', 'host-embedded-results.json'];
scenarios.inline = ['inline.scenario.js', 'host-inline-results.json'];
scenarios.prose = ['prose.scenario.js', 'host-prose-results.json'];
scenarios.i18n = ['i18n.scenario.js', 'host-i18n-results.json'];
scenarios.selection = ['selection-toolbar.scenario.js', 'host-selection-results.json'];
scenarios['phase-d'] = ['phase-d.scenario.js', 'host-phase-d-results.json'];
scenarios['phase-d-restart'] = ['phase-d-restart.scenario.js', 'host-phase-d-restart-results.json'];
scenarios['phase-e'] = ['phase-e.scenario.js', 'host-phase-e-results.json'];
scenarios['phase-e-restart'] = ['phase-e-restart.scenario.js', 'host-phase-e-restart-results.json'];
scenarios.notes = ['notes.scenario.js', 'host-notes-results.json'];
scenarios['notes-restart'] = ['notes-restart.scenario.js', 'host-notes-restart-results.json'];
scenarios.display = ['code-display.scenario.js', 'host-display-results.json'];
scenarios['display-restart'] = ['code-display-restart.scenario.js', 'host-display-restart-results.json'];
scenarios.performance = ['performance.scenario.js', 'host-performance-results.json'];
scenarios.scale = ['scale.scenario.js', 'host-scale-results.json'];
scenarios.responsive = ['responsive.scenario.js', 'host-responsive-results.json'];
scenarios.lifecycle = ['lifecycle.scenario.js', 'host-lifecycle-results.json'];
scenarios['lifecycle-shiki'] = ['lifecycle.scenario.js', 'host-lifecycle-shiki-results.json'];
scenarios.pagination = ['pagination.scenario.js', 'host-pagination-results.json'];
scenarios.compatibility = ['compatibility.scenario.js', 'host-compatibility-results.json'];
scenarios.multiwindow = ['multiwindow.scenario.js', 'host-multiwindow-results.json'];
scenarios['multiwindow-restart'] = ['multiwindow-restart.scenario.js', 'host-multiwindow-restart-results.json'];
scenarios['multiwindow-baseline'] = ['multiwindow-baseline.scenario.js', 'host-multiwindow-baseline-results.json'];
scenarios.accessibility = ['accessibility.scenario.js', 'host-accessibility-results.json'];
scenarios.frames = ['frames.scenario.js', 'host-frames-results.json'];
scenarios.install = ['install.scenario.js', 'host-install-results.json'];
scenarios['install-restart'] = ['install.scenario.js', 'host-install-restart-results.json'];
scenarios.migration = ['migration.scenario.js', 'host-migration-results.json'];
scenarios['migration-restart'] = ['migration-restart.scenario.js', 'host-migration-restart-results.json'];
scenarios.parameters = ['fence-params.scenario.js', 'host-parameters-results.json'];
scenarios['i18n-restart'] = ['i18n-restart.scenario.js', 'host-i18n-restart-results.json'];
scenarios['prose-restart'] = ['prose-restart.scenario.js', 'host-prose-restart-results.json'];
scenarios['inline-restart'] = ['inline-restart.scenario.js', 'host-inline-restart-results.json'];
scenarios['shiki-live-077'] = ['shiki-live.scenario.js', 'host-shiki-live-077-results.json'];
scenarios['shiki-live-080'] = ['shiki-live.scenario.js', 'host-shiki-live-080-results.json'];
const mode = process.env.HB_HOST_MODE in scenarios ? process.env.HB_HOST_MODE : 'functional';
const lifecycle = mode === 'lifecycle' || mode === 'lifecycle-shiki';
const captureModes = ['selection', 'phase-d', 'phase-e', 'notes', 'display', 'parameters', 'migration', 'pagination', 'compatibility'];
let pdfRendering;
if (mode.startsWith('multiwindow')) electron.ipcMain.handle('hb-window-clipboard', (_event, action, text) => {
  if (action === 'read') return electron.clipboard.readText();
  if (action === 'write' && typeof text === 'string') { electron.clipboard.writeText(text); return; }
  throw new Error('Unknown clipboard action');
});
if (mode === 'frames') electron.ipcMain.handle('hb-frame-capture', async (event, name, rectangle) => {
  if (!['frame-sidebar', 'frame-scroll'].includes(name)) throw new Error('Unknown frame');
  if (![rectangle.x, rectangle.y, rectangle.width, rectangle.height].every(Number.isFinite) || rectangle.width <= 0 || rectangle.height <= 0 || rectangle.width * rectangle.height > 1400000) throw new Error('Invalid frame rectangle');
  let bitmap;
  try { bitmap = await event.sender.capturePage(rectangle); }
  catch (error) { throw new Error(`${error.message}: ${JSON.stringify(rectangle)}`); }
  const png = bitmap.toPNG(), directory = path.join(root, 'docs/verification/images'); fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${name}.png`), png);
  return { empty: bitmap.isEmpty(), bytes: png.length, size: bitmap.getSize(), sha256: require('node:crypto').createHash('sha256').update(png).digest('hex') };
});
if (mode === 'accessibility') electron.ipcMain.handle('hb-accessibility', async (event, method, parameters) => {
  const pdfPath = path.join(paths.pdf, 'highlight-boost-export.pdf');
  if (method === 'pdf-prepare') {
    fs.mkdirSync(path.dirname(pdfPath), { recursive: true }); if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    electron.dialog.showSaveDialog = async () => ({ canceled: false, filePath: pdfPath });
    electron.dialog.showSaveDialogSync = () => pdfPath;
    electron.shell.openPath = async () => '';
    return pdfPath;
  }
  if (method === 'pdf-status') return fs.existsSync(pdfPath) ? { bytes: fs.statSync(pdfPath).size, header: fs.readFileSync(pdfPath).subarray(0, 5).toString(), rendering: pdfRendering } : null;
  if (!['Accessibility.getFullAXTree', 'Input.dispatchKeyEvent', 'Input.insertText', 'Input.imeSetComposition'].includes(method)) throw new Error('Unknown accessibility command');
  return event.sender.debugger.sendCommand(method, parameters ?? {});
});
if (!['performance', 'scale', 'responsive'].includes(mode)) {
  app.disableHardwareAcceleration();
  const BrowserWindow = electron.BrowserWindow;
  const offscreenElectron = Object.create(electron);
  Object.defineProperty(offscreenElectron, 'BrowserWindow', { value: class extends BrowserWindow {
    constructor(options) { super({ ...options, show: false, webPreferences: { ...options?.webPreferences, offscreen: true } }); }
  } });
  const Module = require('node:module'), load = Module._load;
  Module._load = function (request, ...arguments_) {
    if (request === 'electron' || request === 'electron/main') return offscreenElectron;
    return load.call(this, request, ...arguments_);
  };
}
if (mode === 'performance' && process.env.HB_PERF_PROFILE === '1') electron.ipcMain.handle('hb-performance-profile', async (event, action) => {
  const debuggerClient = event.sender.debugger;
  if (action === 'start') { await debuggerClient.sendCommand('Profiler.enable'); await debuggerClient.sendCommand('Profiler.start'); }
  else if (action === 'stop') {
    const { profile } = await debuggerClient.sendCommand('Profiler.stop');
    fs.mkdirSync(paths.bench, { recursive: true });
    fs.writeFileSync(path.join(paths.bench, 'sidebar.cpuprofile'), JSON.stringify(profile));
  }
});
if (lifecycle) electron.ipcMain.handle('hb-collect-garbage', async event => {
  await event.sender.debugger.sendCommand('HeapProfiler.collectGarbage');
  return { heap: await event.sender.debugger.sendCommand('Runtime.getHeapUsage'), dom: await event.sender.debugger.sendCommand('Memory.getDOMCounters') };
});
if (lifecycle && process.env.HB_MEMORY_PROFILE === '1') electron.ipcMain.handle('hb-memory-snapshot', async event => {
  const directory = paths.bench; fs.mkdirSync(directory, { recursive: true });
  const output = path.join(directory, 'lifecycle.heapsnapshot'); fs.writeFileSync(output, '');
  const chunk = (_event, method, parameters) => { if (method === 'HeapProfiler.addHeapSnapshotChunk') fs.appendFileSync(output, parameters.chunk); };
  event.sender.debugger.on('message', chunk);
  try { await event.sender.debugger.sendCommand('HeapProfiler.takeHeapSnapshot', { reportProgress: false }); }
  finally { event.sender.debugger.removeListener('message', chunk); }
});
if (captureModes.includes(mode) || mode === 'performance') electron.ipcMain.handle('hb-selection-capture', async (event, name) => {
  if (!['selection-dark-zh', 'selection-light-en', 'phase-d-live', 'phase-d-reading', 'phase-e-collection', 'phase-e-light', 'notes-reading', 'notes-live', 'display-native', 'display-builtin', 'parameters', 'migration-preview', 'workbench-pagination'].includes(name) && !/^compat-(default|minimal|anuppuccin)-(dark|light)-(zh|en)$/.test(name)) throw new Error('Unknown screenshot');
  const { data } = await event.sender.debugger.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const directory = path.join(root, 'docs', 'verification', 'images');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${name}.png`), Buffer.from(data, 'base64'));
});
const [scenarioName, resultName] = scenarios[mode];
const version = require(path.join(source, 'package.json')).version;
if (version !== runtime.appVersion) throw new Error(`Expected Obsidian ${runtime.appVersion}, found ${version}`);
if (process.versions.electron !== runtime.electronVersion) throw new Error(`Expected Electron ${runtime.electronVersion}`);
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(path.join(profile, 'obsidian.json'), JSON.stringify({
  vaults: { 'abcd1234abcd1234': { path: vault, ts: Date.now(), open: true } },
}));
app.setName('Highlight Boost Test');
app.setPath('userData', profile);
app.getVersion = () => version;
app.setAsDefaultProtocolClient = () => false;
electron.remote = require('@electron/remote/main');
electron.remote.initialize();
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true, corsEnabled: true } },
]);

const results = { obsidian: version, electron: process.versions.electron, checks: [], errors: [] };
let completed = false;
function finish(error) {
  if (completed) return;
  completed = true;
  if (error) results.errors.push(String(error.stack || error));
  fs.mkdirSync(path.join(root, 'docs/verification'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/verification', resultName), JSON.stringify(results, null, 2) + '\n');
  app.exit(error ? 1 : 0);
}

const resizeTraceSource = `(() => {
  if(window.__hbResizeTraceInstalled)return; window.__hbResizeTraceInstalled=true;
  const NativeResizeObserver=window.ResizeObserver, calls=[]; let errors=0;
  window.ResizeObserver=class extends NativeResizeObserver { constructor(callback) { const stack=new Error().stack; super((entries,observer)=>{ calls.push({stack,targets:entries.map(entry=>({class:entry.target.className,width:entry.contentRect.width,height:entry.contentRect.height}))}); if(calls.length>12)calls.shift(); callback(entries,observer); }); } };
  window.addEventListener('error', event=>{ if(/ResizeObserver/.test(event.message)&&errors++<2)console.warn('HB resize trace: '+JSON.stringify(calls)); });
})();`;
app.on('browser-window-created', (_event, window) => {
  window.on('show', () => window.hide());
  window.setSize(1400, 1000);
  const contents = window.webContents;
  if (mode === 'multiwindow' && process.env.HB_RO_TRACE === '1') {
    contents.debugger.attach('1.3');
    void contents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: resizeTraceSource });
  }
  if (mode === 'accessibility') {
    const print = contents.printToPDF.bind(contents);
    contents.printToPDF = async options => {
      if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
      await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
      pdfRendering = await contents.executeJavaScript(`(() => { const root=document.querySelector('.print'), mark=root.querySelector('pre .hb-text'), note=root.querySelector('.hb-note-text'), style=getComputedStyle(mark); return { text:root.innerText, codeMark:mark.textContent, background:style.backgroundColor, decoration:style.textDecorationLine, noteVisible:note.getBoundingClientRect().height>0, note:note.innerText }; })()`);
      return print(options);
    };
  }
  contents.setBackgroundThrottling(false);
  contents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') console.log(event.message);
  });
  contents.on('did-finish-load', async () => {
    if (mode.startsWith('multiwindow') && process.env.HB_RO_TRACE === '1') await contents.executeJavaScript(resizeTraceSource);
    if (!contents.getURL().includes('index.html')) {
      if (mode.startsWith('multiwindow')) {
        if (!contents.debugger.isAttached()) contents.debugger.attach('1.3'); await contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
        await contents.executeJavaScript('window.__hbPopoutReady = true');
      }
      return;
    }
    try {
      const deadline = Date.now() + (scale ? 180000 : 30000);
      while (!await contents.executeJavaScript('Boolean(window.app?.workspace?.layoutReady) && !document.body.classList.contains("in-progress")')) {
        if (Date.now() > deadline) throw new Error('Test vault did not finish loading');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const actualPath = await contents.executeJavaScript('app.vault.adapter.basePath');
      if (path.resolve(actualPath) !== vault) throw new Error('Unexpected test vault');
      results.testVaultTrustAccepted = await contents.executeJavaScript(`(async () => {
        let accepted=false;
        for(let i=0;i<10;i++) {
          const modal=[...document.querySelectorAll('.modal')].find(element=>/Browse vault in Restricted Mode|受限模式|安全模式/.test(element.textContent));
          const button=modal?.querySelector('button:not(.mod-cancel)');
          if(button&&!accepted) { accepted=true; button.click(); }
          await new Promise(resolve=>setTimeout(resolve,100));
        }
        if(accepted) for(let i=0;i<200&&!app.commands.commands['highlight-boost:open-highlights'];i++) await new Promise(resolve=>setTimeout(resolve,50));
        return accepted;
      })()`);
      if (mode === 'embedded' || mode === 'inline' || mode === 'prose' || mode === 'i18n' || captureModes.includes(mode) || mode === 'performance' || mode === 'responsive' || mode === 'multiwindow' || mode === 'accessibility' || mode === 'frames' || mode.startsWith('install') || lifecycle) {
        if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
        await contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
      }
      const script = fs.readFileSync(path.join(root, 'tests', scenarioName), 'utf8');
      if (process.env.HB_TRACE === '1') await contents.executeJavaScript(`Object.defineProperty(window, '__hbChecks', { configurable: true, set(checks) { this.__hbTraceChecks = checks; const push = checks.push; Object.defineProperty(checks, 'push', { configurable: true, value(...items) { for (const item of items) console.warn('HB check: ' + item.name); return push.apply(this, items); } }); }, get() { return this.__hbTraceChecks; } }); void 0;`);
      await contents.executeJavaScript(`window.__hbHostMode = ${JSON.stringify(mode)}`);
      await contents.executeJavaScript(`window.__hbPerformanceProfile = ${process.env.HB_PERF_PROFILE === '1'}`);
      await contents.executeJavaScript(`window.__hbFrameBaseline = ${process.env.HB_FRAME_BASELINE === '1'}`);
      await contents.executeJavaScript(`window.__hbMemoryProfile = ${process.env.HB_MEMORY_PROFILE === '1'}`);
      await contents.executeJavaScript(`window.__hbCompatibilityCase = ${JSON.stringify(process.env.HB_COMPAT_CASE ?? 'default-native')}`);
      const outcome = await contents.executeJavaScript(script);
      results.checks.push(...outcome);
      const matrix = await contents.executeJavaScript('window.__hbLanguageMatrix ?? null');
      if (matrix) results.languageMatrix = matrix;
      const observations = await contents.executeJavaScript('window.__hbObservations ?? null');
      if (observations) results.observations = observations;
      finish();
    } catch (error) {
      try { results.checks.push(...await contents.executeJavaScript('window.__hbChecks ?? []')); } catch { /* The renderer may have exited. */ }
      finish(error);
    }
  });
});
setTimeout(() => finish(new Error('Host test timed out')), mode === 'responsive' ? 600000 : mode === 'performance' || scale ? 300000 : 60000);
require(path.join(source, 'main.js'))(source, new EventEmitter());
