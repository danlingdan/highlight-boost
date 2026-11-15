import { build as bundle, context } from 'esbuild';
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { packedShiki } from './scripts/packed-shiki.mjs';

await mkdir('.local/cache/build', { recursive: true });
const cssModule = resolve('.local/cache/build/syntax-styles.cjs');
await bundle({ entryPoints: ['src/syntax/styles.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: cssModule });
const { syntaxStyles } = (await import(pathToFileURL(cssModule).href)).default;
const [base, upstream, generated] = await Promise.all([
  readFile('src/styles.css', 'utf8'), readFile('src/syntax/upstream/styles.css', 'utf8'), syntaxStyles(),
]);
await writeFile('styles.css', `${generated.replaceAll('.expressive-code', '.expressive-code.hb-syntax-render').replaceAll('text-decoration:', 'text-decoration-line:')}\n${upstream}\n${base}`);

const licenseFiles = ['LICENSE', 'licenses/Shiki-Highlighter-MIT.txt', 'licenses/Shiki-MIT.txt', 'licenses/Expressive-Code-MIT.txt'];
const licenses = await Promise.all(licenseFiles.map(async path => (await readFile(path, 'utf8')).replaceAll('\r\n', '\n')));

const build = await context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: true,
  metafile: true,
  banner: { js: `/*!\n${licenses.join('\n\n')}\n*/` },
  plugins: [packedShiki(), nodeModulesPolyfillPlugin({ modules: { fs: 'empty', path: true, url: true } })],
  external: ['obsidian', '@codemirror/*', '@lezer/*'],
  format: 'cjs',
  target: 'es2022',
  outfile: 'main.js',
  sourcemap: process.argv.includes('--watch') ? 'inline' : false,
  logLevel: 'info',
});
if (process.argv.includes('--watch')) await build.watch();
else {
  const result = await build.rebuild();
  await writeFile('.local/cache/build/metafile.json', JSON.stringify(result.metafile));
  await build.dispose();
}
