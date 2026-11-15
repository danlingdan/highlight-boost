import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const record = process.argv.includes('--record'), configFile = 'tests/compatibility-assets.json';
const assets = JSON.parse(await readFile(configFile, 'utf8')), vault = resolve('.test-compat-vault');
const digest = value => createHash('sha256').update(value).digest('hex');
for (const asset of assets) {
  const cache = resolve('.research-cache/compatibility', asset.repo, asset.tag); await mkdir(cache, { recursive: true });
  for (const [name, expected] of Object.entries(asset.files)) {
    let bytes; try { bytes = await readFile(resolve(cache, name)); } catch { /* 首次运行下载固定发布资产。 */ }
    if (!bytes || expected && digest(bytes) !== expected) {
      const response = await fetch(`https://github.com/${asset.repo}/releases/download/${asset.tag}/${name}`);
      if (!response.ok) throw new Error(`${asset.name} ${name}: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    const sha = digest(bytes);
    if (expected && sha !== expected) throw new Error(`${asset.name} ${name}: SHA256 mismatch`);
    if (!expected && !record) throw new Error(`${asset.name} ${name}: record SHA256 first`);
    asset.files[name] = sha; await writeFile(resolve(cache, name), bytes);
  }
  const manifest = JSON.parse(await readFile(resolve(cache, 'manifest.json'), 'utf8')); asset.version = manifest.version;
  if (asset.kind === 'plugin' && !/^[a-z0-9-]+$/.test(manifest.id)) throw new Error('Unexpected plugin id');
  const target = resolve(vault, '.obsidian', asset.kind === 'theme' ? `themes/${asset.name}` : `plugins/${manifest.id}`);
  await mkdir(target, { recursive: true });
  for (const name of Object.keys(asset.files)) await copyFile(resolve(cache, name), resolve(target, name));
  console.log(`${asset.name} ${asset.version} ready`);
}
if (record) await writeFile(configFile, JSON.stringify(assets, null, 2) + '\n');
const plugin = resolve(vault, '.obsidian/plugins/highlight-boost'); await mkdir(plugin, { recursive: true });
for (const name of ['main.js', 'manifest.json', 'styles.css']) await copyFile(name, resolve(plugin, name));
await writeFile(resolve(vault, '.obsidian/community-plugins.json'), JSON.stringify(['highlight-boost']));
await writeFile(resolve(vault, '.obsidian/app.json'), JSON.stringify({ livePreview: true }));
