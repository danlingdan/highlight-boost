import { spawnSync } from 'node:child_process';
for (const [version, mode] of [['0.7.7', '077'], ['0.8.0', '080']]) {
  for (const args of [['scripts/prepare-shiki.mjs', version], ['scripts/test-host.mjs', `--mode=shiki-live-${mode}`]]) {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
