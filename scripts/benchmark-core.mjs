import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
mkdirSync('.bench-cache', { recursive: true });
await build({ entryPoints: ['benchmarks/core.ts'], bundle: true, platform: 'node', format: 'esm', outfile: '.bench-cache/core.mjs' });
const child = spawn(process.execPath, ['--expose-gc', '.bench-cache/core.mjs', ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true });
child.once('exit', code => { process.exitCode = code ?? 1; });
child.once('error', error => { throw error; });
