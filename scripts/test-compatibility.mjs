import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const cases = JSON.parse(await readFile('tests/compatibility-cases.json', 'utf8'));
const selected = process.argv.find(value => value.startsWith('--case='))?.slice(7);
if (selected && !cases.some(test => test.id === selected)) throw new Error('Unknown compatibility case');
await mkdir('docs/verification/compatibility', { recursive: true });
for (const test of cases.filter(test => !selected || test.id === selected)) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/test-host.mjs', '--mode=compatibility'], { stdio: 'inherit', windowsHide: true, env: { ...process.env, HB_COMPAT_CASE: test.id } });
    child.once('error', reject); child.once('exit', resolve);
  });
  await copyFile('docs/verification/host-compatibility-results.json', `docs/verification/compatibility/${test.id}.json`);
  if (code) { process.exitCode = 1; break; }
}
