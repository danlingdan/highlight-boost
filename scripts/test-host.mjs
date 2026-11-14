import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const executable = require('electron');
const resources = process.env.OBSIDIAN_RESOURCES || 'C:\\Program Files\\Obsidian\\resources';
if (!existsSync(join(resources, 'obsidian.asar'))) {
  throw new Error('Set OBSIDIAN_RESOURCES to the installed Obsidian resources directory.');
}
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const single = process.argv.find(argument => argument.startsWith('--mode='))?.slice(7);
const available = ['functional', 'advanced', 'languages', 'layout', 'settings', 'restart', 'shiki', 'languages-shiki', 'shiki-live-077', 'shiki-live-080', 'embedded', 'inline', 'inline-restart'];
if (single && !available.includes(single)) throw new Error(`Unknown host scenario: ${single}`);
const modes = single ? [single] : process.argv.includes('--shiki') ? ['shiki', 'languages-shiki'] : process.argv.includes('--languages-shiki') ? ['languages-shiki'] : process.argv.includes('--advanced') ? ['advanced'] : process.argv.includes('--languages') ? ['languages'] : process.argv.includes('--layout') ? ['layout'] : process.argv.includes('--settings') ? ['settings'] : ['functional', 'advanced', 'languages', 'layout', 'settings', 'restart', 'embedded'];
for (const mode of modes) {
  const resultFile = `docs/verification/${mode === 'functional' ? 'host-results' : `host-${mode}-results`}.json`;
  if (existsSync(resultFile)) unlinkSync(resultFile);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(executable, ['scripts/host-main.cjs'], {
      stdio: 'inherit', windowsHide: true, env: { ...environment, HB_HOST_MODE: mode },
    });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Host process did not exit.')); }, 75000);
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
