import paths from './paths.cjs';
import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const suite = process.argv.find(value => value.startsWith('--suite='))?.slice(8);
if (suite && !['accessibility', 'performance', 'journey', 'multiwindow', 'frames', 'compat', 'install'].includes(suite)) throw new Error('Unknown test vault suite');
const vault = paths.vault(suite);
const plugin = resolve(vault, '.obsidian/plugins/highlight-boost');
await mkdir(plugin, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) await copyFile(file, resolve(plugin, file));
await writeFile(resolve(vault, '.obsidian/community-plugins.json'), JSON.stringify(suite === 'performance' ? [] : ['highlight-boost']));
await writeFile(resolve(vault, '.obsidian/app.json'), JSON.stringify({ livePreview: true }));
await copyFile('tests/fixtures/原型验证.md', resolve(vault, '原型验证.md'));
if (suite === 'performance') await rm(resolve(vault, '.obsidian/workspace.json'), { force: true });
console.log(`Test vault ready: ${vault}`);
