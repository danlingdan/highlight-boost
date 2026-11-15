import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
const executable = require('electron');
require('./obsidian-runtime.cjs')(process.cwd());
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const modeIndex = process.argv.indexOf('--mode');
const single = process.argv.find(argument => argument.startsWith('--mode='))?.slice(7) ?? (modeIndex >= 0 ? process.argv[modeIndex + 1] : undefined);
if (modeIndex >= 0 && !single) throw new Error('Missing host scenario');
const available = ['functional', 'advanced', 'languages', 'layout', 'settings', 'restart', 'shiki', 'languages-shiki', 'shiki-live-077', 'shiki-live-080', 'embedded', 'inline', 'inline-restart', 'prose', 'prose-restart', 'i18n', 'i18n-restart', 'selection', 'phase-d', 'phase-d-restart', 'phase-e', 'phase-e-restart', 'notes', 'notes-restart', 'display', 'display-restart', 'parameters', 'migration', 'migration-restart', 'performance', 'scale', 'pagination', 'responsive', 'lifecycle', 'lifecycle-shiki', 'compatibility', 'multiwindow', 'multiwindow-restart', 'multiwindow-baseline', 'accessibility', 'frames', 'install', 'install-restart'];
if (single && !available.includes(single)) throw new Error(`Unknown host scenario: ${single}`);
const modes = single ? [single] : process.argv.includes('--shiki') ? ['shiki', 'languages-shiki'] : process.argv.includes('--languages-shiki') ? ['languages-shiki'] : process.argv.includes('--advanced') ? ['advanced'] : process.argv.includes('--languages') ? ['languages'] : process.argv.includes('--layout') ? ['layout'] : process.argv.includes('--settings') ? ['settings'] : ['functional', 'advanced', 'languages', 'layout', 'settings', 'restart', 'embedded', 'inline', 'inline-restart', 'prose', 'prose-restart', 'i18n', 'i18n-restart', 'selection', 'phase-d', 'phase-d-restart', 'phase-e', 'phase-e-restart', 'notes', 'notes-restart', 'display', 'display-restart', 'parameters', 'migration', 'migration-restart', 'pagination', 'lifecycle', 'lifecycle-shiki'];
for (const mode of modes) {
  const resultFile = `docs/verification/${mode === 'functional' ? 'host-results' : `host-${mode}-results`}.json`;
  if (existsSync(resultFile)) unlinkSync(resultFile);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(executable, [...(process.env.CI && process.platform === 'linux' ? ['--no-sandbox'] : []), 'scripts/host-main.cjs'], {
      stdio: 'inherit', windowsHide: true, env: { ...environment, HB_HOST_MODE: mode },
    });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Host process did not exit.')); }, mode === 'responsive' ? 620000 : (mode === 'performance' || mode === 'scale') ? 320000 : 75000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); resolve(code); });
  });
  if (!existsSync(resultFile)) throw new Error('Host exited before producing test results.');
  const results = JSON.parse(readFileSync(resultFile, 'utf8'));
  console.log(`${mode} host: ${results.checks.length} checks, ${results.errors.length} errors.`);
  if (code || results.errors.length || !results.checks.length) {
    console.error(results.errors.join('\n'));
    process.exitCode = 1;
    break;
  }
}
