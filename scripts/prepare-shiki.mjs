import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const version = process.argv[2] ?? '0.8.0';
const releases = {
  '0.8.0': {
  'main.js': '17172f4324e50c92c3becc67360a8a1a65c85e10b0d13ccf424b2cc043d266b2',
  'manifest.json': '516768fdf03357154274df492879610cbf27987b9c3cdfadec5744f35736adba',
  'styles.css': '0df4526fc7d7440c9fb021cd948db1813fb9dc61df1cb75a7de2cc1a79b7a85c',
  },
  '0.7.7': {
    'main.js': 'b82bfad0caa11b91abb9014c347b4a9faef9575bd63d75b129bb027aab5e60c0',
    'manifest.json': 'be23d7efe11afcd12f929b9c741c98b3ef335937cfcba1f762b43de6c77fd791',
    'styles.css': 'ccac7b68b996db9d53264cb789688579b142b4725142210af54f311e9b665525',
  },
};
const files = releases[version];
if (!files) throw new Error(`Unsupported test release: ${version}`);
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
