import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const vault = resolve('.test-vault');
const plugin = resolve(vault, '.obsidian/plugins/highlight-boost');
await mkdir(plugin, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) await copyFile(file, resolve(plugin, file));
await writeFile(resolve(vault, '.obsidian/community-plugins.json'), JSON.stringify(['highlight-boost']));
await writeFile(resolve(vault, '.obsidian/app.json'), JSON.stringify({ livePreview: true }));
await copyFile('tests/fixtures/原型验证.md', resolve(vault, '原型验证.md'));
console.log(`Test vault ready: ${vault}`);
