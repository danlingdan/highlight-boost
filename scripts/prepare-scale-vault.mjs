import paths from './paths.cjs';
import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const responsive = process.argv.includes('--responsive');
const root = paths.vault(responsive ? 'responsive' : 'scale'), plugin = resolve(root, '.obsidian/plugins/highlight-boost');
await mkdir(plugin, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) await copyFile(file, resolve(plugin, file));
await writeFile(resolve(root, '.obsidian/community-plugins.json'), '[]');
await writeFile(resolve(root, '.obsidian/app.json'), JSON.stringify({ livePreview: true }));
await rm(resolve(root, '.obsidian/workspace.json'), { force: true });
const count = responsive ? 1000 : 10000, bytesPerNote = 10486;
for (let batch = 0; batch < count; batch += 100) {
  const directory = resolve(root, `notes/${String(batch / 100).padStart(3, '0')}`);
  await mkdir(directory, { recursive: true });
  await Promise.all(Array.from({ length: 100 }, async (_, offset) => {
    const id = String(batch + offset).padStart(5, '0');
    const prefix = `# Note ${id}\n\n==needle-${id}==\n\n`, paragraph = 'Plain paragraph for a repeatable desktop index measurement.\n\n';
    const text = prefix + paragraph.repeat(Math.ceil((bytesPerNote - prefix.length) / paragraph.length)).slice(0, bytesPerNote - prefix.length);
    await writeFile(resolve(directory, `${id}.md`), text);
  }));
}
await writeFile(resolve(root, '.obsidian/hb-scale-fixture.json'), JSON.stringify({ count, bytesPerNote, totalBytes: count * bytesPerNote }));
console.log(`Scale vault ready: ${count} notes, ${count * bytesPerNote} bytes, ${root}`);
