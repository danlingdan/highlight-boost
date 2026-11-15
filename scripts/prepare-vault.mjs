import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const suite = process.argv.find(value => value.startsWith('--suite='))?.slice(8);
if (suite && !['accessibility', 'multiwindow', 'frames', 'install'].includes(suite)) throw new Error('Unknown test vault suite');
const vault = resolve(suite ? `.test-${suite}-vault` : '.test-vault');
const plugin = resolve(vault, '.obsidian/plugins/highlight-boost');
await mkdir(plugin, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) await copyFile(file, resolve(plugin, file));
await writeFile(resolve(vault, '.obsidian/community-plugins.json'), JSON.stringify(['highlight-boost']));
await writeFile(resolve(vault, '.obsidian/app.json'), JSON.stringify({ livePreview: true }));
await copyFile('tests/fixtures/原型验证.md', resolve(vault, '原型验证.md'));
console.log(`Test vault ready: ${vault}`);
