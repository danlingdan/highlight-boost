import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { gzipSync, strToU8 } from 'fflate';
import { dirname } from 'node:path';

export function packedShiki() {
  return { name: 'packed-shiki', setup(build) {
    build.onLoad({ filter: /[/\\]shiki[/\\]dist[/\\](langs|themes)\.mjs$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8'), require = createRequire(path);
      const imports = [...source.matchAll(/import\(['"](@shikijs\/(?:langs|themes)\/[^'"]+)['"]\)/g)];
      if (!imports.length) throw new Error(`Shiki data imports not found: ${path}`);
      let contents = source;
      const values = [], indexes = new Map();
      for (const [expression, specifier] of imports) {
        const data = (await import(pathToFileURL(require.resolve(specifier)).href)).default;
        const references = (Array.isArray(data) ? data : [data]).map(value => {
          const json = JSON.stringify(value);
          if (!indexes.has(json)) { indexes.set(json, values.length); values.push(Buffer.from(gzipSync(strToU8(json), { level: 9, mtime: 0 })).toString('base64')); }
          return indexes.get(json);
        });
        contents = contents.replace(expression, `unpackShiki(${JSON.stringify(references)},${Array.isArray(data)})`);
      }
      return { contents: `
        const packedShikiData = ${JSON.stringify(values)}, shikiDataCache = new Map();
        async function unpackShiki(indexes, array) {
          const values = await Promise.all(indexes.map(index => {
            if (!shikiDataCache.has(index)) shikiDataCache.set(index, (async () => {
              const bytes = Uint8Array.from(atob(packedShikiData[index]), character => character.charCodeAt(0));
              const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
              return JSON.parse(await new Response(stream).text());
            })());
            return shikiDataCache.get(index);
          }));
          return { default: array ? values : values[0] };
        }
        ${contents}`, loader: 'js', resolveDir: dirname(path),
      };
    });
  } };
}
