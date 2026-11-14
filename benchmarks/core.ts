import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { cpus, totalmem, platform, release } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseDocument } from '../src/parsing';
import { collectItems } from '../src/anchors';
import { planHighlight } from '../src/editing';
import { presets } from '../src/domain';
import { HighlightIndex } from '../src/vault-index';

const paragraph = 'A paragraph with ==highlight==, **formatting**, `inline code` and a link [source](target.md).\n\n';
const sized = (bytes: number) => (paragraph.repeat(Math.ceil(bytes / paragraph.length))).slice(0, bytes);
const medium = sized(200 * 1024), large = sized(1024 * 1024);
const code = '```js hl:250\n' + Array.from({ length: 5000 }, (_, i) => `const value${i} = ${i};`).join('\n') + '\n```';
const fixture = (i: number) => (`# Note ${i}\n\n` + paragraph.repeat(5)).padEnd(10486, 'x');
const paths = Array.from({ length: 10000 }, (_, i) => `${i}.md`);
const metrics: Record<string, unknown> = {};
const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]!;
async function measure(name: string, count: number, work: () => unknown | Promise<unknown>, warm = true) {
  if (warm) await work();
  const samples = [];
  for (let i = 0; i < count; i++) { const start = performance.now(); await work(); samples.push(performance.now() - start); }
  metrics[name] = { samplesMs: samples, p50Ms: percentile(samples, .5), p95Ms: percentile(samples, .95) };
  process.stdout.write(`${name}: p50=${percentile(samples, .5).toFixed(1)}ms p95=${percentile(samples, .95).toFixed(1)}ms\n`);
}
await measure('parse-200KiB', 9, () => parseDocument(medium));
await measure('collect-200KiB', 9, () => collectItems(medium));
await measure('edit-plan-200KiB', 9, () => planHighlight(medium, [{ from: 2, to: 11 }], presets[0]!));
await measure('parse-1MiB', 5, () => parseDocument(large));
await measure('parse-code-5000-lines', 9, () => parseDocument(code));
let index: HighlightIndex;
let notifications = 0;
const makeIndex = () => new HighlightIndex({ paths: () => paths, read: async path => fixture(Number.parseInt(path)) }, () => { notifications++; });
const gaps: number[] = [], heaps: number[] = [], notifyCounts: number[] = [];
await measure('cold-index-10000-notes', 3, async () => {
  globalThis.gc?.(); const before = process.memoryUsage().heapUsed;
  let last = performance.now(), maxGap = 0; notifications = 0;
  const timer = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; }, 10);
  const cold = makeIndex(); await cold.rebuild();
  await new Promise(resolve => setTimeout(resolve, 0)); clearInterval(timer);
  if (cold.notes.size !== 10000 || cold.all().length !== 50000) throw new Error('Index fixture mismatch');
  globalThis.gc?.(); gaps.push(maxGap); heaps.push(process.memoryUsage().heapUsed - before); notifyCounts.push(notifications);
  cold.dispose();
}, false);
index = makeIndex(); await index.rebuild();
await measure('warm-rebuild-10000-notes', 3, () => index.rebuild(), false);
await measure('incremental-one-note', 9, () => index.enqueue('50.md'));
await measure('query-all-50000-items', 9, () => index.all());
const output = process.argv.find(argument => argument.startsWith('--output='))?.slice(9) ?? 'docs/verification/performance/core.json';
const result = {
  schema: 1, created: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDiffSha256: createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--', 'src/'])).digest('hex'),
  environment: { platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, ramBytes: totalmem(), node: process.version, mainBytes: statSync('main.js').size },
  fixtures: { mediumBytes: Buffer.byteLength(medium), largeBytes: Buffer.byteLength(large), codeLines: 5000, indexNotes: 10000, indexBytes: paths.reduce((sum, _, i) => sum + Buffer.byteLength(fixture(i)), 0), indexItems: 50000 },
  metrics, coldIndex: { longestTimerGapMs: gaps, retainedHeapDeltaBytes: heaps, changeNotifications: notifyCounts },
};
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2) + '\n'); index.dispose();
