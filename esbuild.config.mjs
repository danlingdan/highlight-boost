import { context } from 'esbuild';
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';
import { ExpressiveCodeEngine } from '@expressive-code/core';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { readFile } from 'node:fs/promises';

const runtime = new ExpressiveCodeEngine({ plugins: [pluginFrames(), pluginCollapsibleSections()] });
const ecRuntime = (await runtime.getJsModules()).join('\n');
const licenseFiles = ['LICENSE', 'licenses/Shiki-Highlighter-MIT.txt', 'licenses/Shiki-MIT.txt', 'licenses/Expressive-Code-MIT.txt'];
const licenses = await Promise.all(licenseFiles.map(path => readFile(path, 'utf8')));

const build = await context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  banner: { js: `/*!\n${licenses.join('\n\n')}\n*/` },
  loader: { '.css': 'text' },
  plugins: [nodeModulesPolyfillPlugin({ modules: { fs: 'empty', path: true, url: true } }), {
    name: 'hb-expressive-runtime',
    setup(build) {
      build.onResolve({ filter: /^hb:ec-runtime$/ }, () => ({ path: 'runtime', namespace: 'hb-runtime' }));
      build.onLoad({ filter: /.*/, namespace: 'hb-runtime' }, () => ({ contents: ecRuntime, loader: 'js' }));
    },
  }],
  external: ['obsidian', '@codemirror/*', '@lezer/*'],
  format: 'cjs',
  target: 'es2022',
  outfile: 'main.js',
  sourcemap: process.argv.includes('--watch') ? 'inline' : false,
  logLevel: 'info',
});
if (process.argv.includes('--watch')) await build.watch();
else { await build.rebuild(); await build.dispose(); }
