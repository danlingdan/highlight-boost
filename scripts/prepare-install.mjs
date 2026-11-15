import { resolve, join, sep } from 'node:path';
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
let argument = process.argv.find(value => value.startsWith('--candidate='))?.slice(12);
if (!argument && process.argv.includes('--current')) {
  const version = JSON.parse(await readFile('manifest.json', 'utf8')).version;
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim().slice(0, 8);
  argument = `dist/highlight-boost-${version}-${revision}/candidate.json`;
}
if (!argument) throw new Error('Pass --candidate=dist/.../candidate.json');
const candidate = JSON.parse(await readFile(argument, 'utf8')), source = resolve(candidate.extractedPlugin), dist = resolve('dist');
if (!source.startsWith(dist + sep)) throw new Error('Candidate must be extracted inside project dist');
const vault = resolve('.test-install-vault'), config = join(vault, '.obsidian'), plugin = join(config, 'plugins/highlight-boost');
try { await access(config); throw new Error('Use a fresh install vault'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const [file, expected] of Object.entries(candidate.files)) {
  const actual = createHash('sha256').update(await readFile(join(source, file))).digest('hex');
  if (actual !== expected) throw new Error(`Candidate file hash differs: ${file}`);
}
await mkdir(plugin, { recursive: true }); await cp(source, plugin, { recursive: true });
await writeFile(join(config, 'community-plugins.json'), JSON.stringify(['highlight-boost']));
await writeFile(join(config, 'app.json'), JSON.stringify({ livePreview: true }));
await writeFile(join(config, 'candidate.json'), JSON.stringify(candidate, null, 2));
await cp('tests/fixtures/原型验证.md', join(vault, '原型验证.md'));
console.log(`Clean candidate install: ${vault}`);
