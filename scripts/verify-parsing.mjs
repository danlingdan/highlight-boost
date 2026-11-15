import paths from './paths.cjs';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const base = process.argv.find(argument => argument.startsWith('--base='))?.slice(7);
if (!base) throw new Error('Pass --base=<revision> to compare parser behavior.');
mkdirSync(paths.bench, { recursive: true });
const original = execFileSync('git', ['show', `${base}:src/parsing.ts`], { encoding: 'utf8' });
await build({ stdin: { contents: original, resolveDir: resolve('src'), loader: 'ts' }, outfile: `${paths.bench}/parser-before.mjs`, bundle: true, platform: 'node', format: 'esm' });
await build({ entryPoints: ['src/parsing.ts'], outfile: `${paths.bench}/parser-after.mjs`, bundle: true, platform: 'node', format: 'esm' });
const before = (await import(pathToFileURL(resolve(`${paths.bench}/parser-before.mjs`)))).parseDocument;
const after = (await import(pathToFileURL(resolve(`${paths.bench}/parser-after.mjs`)))).parseDocument;
const parts = ['==one==', 'plain **bold** [[link]]', '`code ==literal==`', '%% ==hidden== `inside` %%', '> [!note] 标题\n> ==中文 😀==', '| A | B |\n| --- | --- |\n| ==cell== | `inline` |', '```js\n==literal==\n%% comment\n```', '    ==indented==', '<span>html</span> ==text==', '![alt](image.png)', '# ==heading==', '- item\n  - ==nested==', '[^hb-note]: ==footnote==', '~~~~text\n```literal\n~~~~'];
let state = 20261115;
for (let i = 0; i < 500; i++) {
  const chosen = [];
  for (let j = 0; j < 16; j++) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; chosen.push(parts[state % parts.length]); }
  let text = chosen.join('\n\n'); if (i % 3 === 0) text = text.replaceAll('\n', '\r\n');
  assert.deepEqual(after(text), before(text), `Parser mismatch in fixture ${i}`);
}
const result = { base: execFileSync('git', ['rev-parse', base], { encoding: 'utf8' }).trim(), seed: 20261115, cases: 500, passed: true, fields: 'all ParsedDocument fields including UTF-16 source spans' };
const output = process.argv.find(argument => argument.startsWith('--output='))?.slice(9) ?? 'docs/verification/performance/parsing-differential.json';
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log('500 parser differential fixtures passed.');
