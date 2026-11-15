import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const profilePath = process.argv.find(value => value.startsWith('--profile='))?.slice(10) ?? '.bench-cache/sidebar.cpuprofile';
const output = process.argv.find(value => value.startsWith('--output='))?.slice(9) ?? 'docs/verification/performance-round2/profile.json';
const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
const nodes = new Map(profile.nodes.map(node => [node.id, node])), parents = new Map();
for (const node of profile.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
const self = new Map(), callers = new Map(); let parseMs = 0;
for (let i = 0; i < profile.samples.length; i++) {
  const weight = profile.timeDeltas[i] / 1000, leaf = nodes.get(profile.samples[i]);
  const name = leaf.callFrame.functionName || '(anonymous)'; self.set(name, (self.get(name) ?? 0) + weight);
  for (let node = leaf; node; node = nodes.get(parents.get(node.id))) if (node.callFrame.functionName === 'parseDocument') {
    parseMs += weight; const chain = [];
    for (let parent = nodes.get(parents.get(node.id)); parent && chain.length < 6; parent = nodes.get(parents.get(parent.id))) chain.push(parent.callFrame.functionName || '(anonymous)');
    const key = chain.join(' ← '); callers.set(key, (callers.get(key) ?? 0) + weight); break;
  }
}
const sorted = map => [...map].map(([name, ms]) => ({ name, ms })).sort((a, b) => b.ms - a.ms);
const result = { durationMs: (profile.endTime - profile.startTime) / 1000, parseInclusiveMs: parseMs, parseCallers: sorted(callers), selfTop: sorted(self).slice(0, 30), method: 'CDP CPU samples, inclusive parse stacks; sampled time is not invocation count' };
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ durationMs: result.durationMs, parseInclusiveMs: parseMs, parseCallers: result.parseCallers.slice(0, 12) }, null, 2));
