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
const resultFile = 'docs/verification/host-results.json';
if (existsSync(resultFile)) unlinkSync(resultFile);
const child = spawn(executable, ['scripts/host-main.cjs'], { stdio: 'inherit', windowsHide: true, env: environment });
child.on('exit', code => {
  if (!existsSync(resultFile)) { console.error('Host exited before producing test results.'); process.exitCode = 1; return; }
  const results = JSON.parse(readFileSync(resultFile, 'utf8'));
  console.log(JSON.stringify(results, null, 2));
  process.exitCode = code || (results.errors.length || !results.checks.length ? 1 : 0);
});
