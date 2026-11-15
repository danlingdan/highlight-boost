import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const config = JSON.parse(await readFile('tests/runtime.json', 'utf8'));
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
if (manifest.minAppVersion !== config.appVersion) throw new Error('Manifest and test runtime versions differ.');
const directory = resolve('.research-cache', `obsidian-${config.appVersion}`), compressed = resolve(directory, 'obsidian.asar.gz');
await mkdir(resolve(directory, 'resources'), { recursive: true });
let bytes;
try { bytes = await readFile(compressed); } catch { /* 首次运行下载官方资产。 */ }
const digest = value => createHash('sha256').update(value).digest('hex');
if (!bytes || digest(bytes) !== config.sha256) {
  const response = await fetch(config.assetUrl);
  if (!response.ok) throw new Error(`Runtime download failed: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== config.sha256) throw new Error('Runtime SHA256 mismatch.');
  await writeFile(compressed, bytes);
}
await writeFile(resolve(directory, 'resources/obsidian.asar'), gunzipSync(bytes));
console.log(`Obsidian ${config.appVersion} runtime ready; SHA256 ${config.sha256}`);
