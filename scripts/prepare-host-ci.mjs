import { readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { platform, release, cpus, totalmem } from 'node:os';
const directory = resolve('docs/verification');
for (const file of readdirSync(directory)) if (/^host(?:-.*)?-results\.json$/.test(file) || file === 'host-results.json') unlinkSync(join(directory, file));
const images = join(directory, 'images');
for (const file of readdirSync(images)) if (file.endsWith('.png')) unlinkSync(join(images, file));
writeFileSync(join(directory, 'host-environment.json'), JSON.stringify({ platform: platform(), release: release(), cpu: cpus()[0]?.model, ramBytes: totalmem(), node: process.version, revision: process.env.GITHUB_SHA }, null, 2) + '\n');
