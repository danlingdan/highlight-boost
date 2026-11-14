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
const profile = path.join(root, '.test-host-profile');
const vault = path.join(root, '.test-vault');
const resources = process.env.OBSIDIAN_RESOURCES || 'C:\\Program Files\\Obsidian\\resources';
const source = path.join(resources, 'obsidian.asar');
const scenarios = { functional: ['host.scenario.js', 'host-results.json'], advanced: ['advanced.scenario.js', 'host-advanced-results.json'], restart: ['restart.scenario.js', 'host-restart-results.json'], shiki: ['shiki.scenario.js', 'host-shiki-results.json'], languages: ['languages.scenario.js', 'host-languages-results.json'], 'languages-shiki': ['languages.scenario.js', 'host-languages-shiki-results.json'], layout: ['layout.scenario.js', 'host-layout-results.json'] };
const mode = process.env.HB_HOST_MODE in scenarios ? process.env.HB_HOST_MODE : 'functional';
const [scenarioName, resultName] = scenarios[mode];
const version = require(path.join(source, 'package.json')).version;
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

app.on('browser-window-created', (_event, window) => {
  window.on('show', () => window.hide());
  window.setSize(1400, 1000);
  const contents = window.webContents;
  contents.setBackgroundThrottling(false);
  contents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') console.log(event.message);
  });
  contents.on('did-finish-load', async () => {
    if (!contents.getURL().includes('index.html')) return;
    try {
      const deadline = Date.now() + 30000;
      while (!await contents.executeJavaScript('Boolean(window.app?.workspace?.layoutReady) && !document.body.classList.contains("in-progress")')) {
        if (Date.now() > deadline) throw new Error('Test vault did not finish loading');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const actualPath = await contents.executeJavaScript('app.vault.adapter.basePath');
      if (path.resolve(actualPath) !== vault) throw new Error('Unexpected test vault');
      const script = fs.readFileSync(path.join(root, 'tests', scenarioName), 'utf8');
      await contents.executeJavaScript(`window.__hbHostMode = ${JSON.stringify(mode)}`);
      const outcome = await contents.executeJavaScript(script);
      results.checks.push(...outcome);
      const matrix = await contents.executeJavaScript('window.__hbLanguageMatrix ?? null');
      if (matrix) results.languageMatrix = matrix;
      finish();
    } catch (error) {
      try { results.checks.push(...await contents.executeJavaScript('window.__hbChecks ?? []')); } catch { /* The renderer may have exited. */ }
      finish(error);
    }
  });
});
setTimeout(() => finish(new Error('Host test timed out')), 60000);
require(path.join(source, 'main.js'))(source, new EventEmitter());
