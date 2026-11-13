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
for (const restart of [false, true]) {
  const resultFile = `docs/verification/${restart ? 'host-restart-results.json' : 'host-results.json'}`;
  if (existsSync(resultFile)) unlinkSync(resultFile);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(executable, ['scripts/host-main.cjs'], {
      stdio: 'inherit', windowsHide: true, env: { ...environment, HB_HOST_RESTART: restart ? '1' : '0' },
    });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Host process did not exit.')); }, 75000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); resolve(code); });
  });
  if (!existsSync(resultFile)) throw new Error('Host exited before producing test results.');
  const results = JSON.parse(readFileSync(resultFile, 'utf8'));
  console.log(`${restart ? 'Restart' : 'Functional'} host: ${results.checks.length} checks, ${results.errors.length} errors.`);
  if (code || results.errors.length || !results.checks.length) {
    console.error(results.errors.join('\n'));
    process.exitCode = 1;
    break;
  }
}
