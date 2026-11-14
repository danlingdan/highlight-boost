import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const version = '0.8.0';
const files = {
  'main.js': '17172f4324e50c92c3becc67360a8a1a65c85e10b0d13ccf424b2cc043d266b2',
  'manifest.json': '516768fdf03357154274df492879610cbf27987b9c3cdfadec5744f35736adba',
  'styles.css': '0df4526fc7d7440c9fb021cd948db1813fb9dc61df1cb75a7de2cc1a79b7a85c',
};
const cache = resolve(`.research-cache/shiki-${version}`);
const target = resolve('.test-vault/.obsidian/plugins/shiki-highlighter');
await mkdir(cache, { recursive: true });
await mkdir(target, { recursive: true });
for (const [name, expected] of Object.entries(files)) {
  const cached = resolve(cache, name);
  let data;
  try { data = await readFile(cached); } catch {
    const response = await fetch(`https://github.com/mProjectsCode/obsidian-shiki-plugin/releases/download/${version}/${name}`);
    if (!response.ok) throw new Error(`Download failed: ${name} (${response.status})`);
    data = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(data).digest('hex') !== expected) throw new Error(`Checksum mismatch: ${name}`);
  await writeFile(cached, data);
  await copyFile(cached, resolve(target, name));
}
console.log(`Prepared Shiki Highlighter ${version} in the project test vault.`);
