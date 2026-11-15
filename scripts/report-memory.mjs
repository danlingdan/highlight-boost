import paths from './paths.cjs';
import { readFileSync, writeFileSync } from 'node:fs';
const snapshot = JSON.parse(readFileSync(`${paths.bench}/lifecycle.heapsnapshot`, 'utf8'));
const { nodes, edges, strings } = snapshot, fields = snapshot.snapshot.meta.node_fields, edgeFields = snapshot.snapshot.meta.edge_fields;
const stride = fields.length, edgeStride = edgeFields.length, count = nodes.length / stride;
const nameAt = fields.indexOf('name'), typeAt = fields.indexOf('type'), edgeCountAt = fields.indexOf('edge_count');
const toAt = edgeFields.indexOf('to_node'), edgeNameAt = edgeFields.indexOf('name_or_index'), edgeTypeAt = edgeFields.indexOf('type');
const types = snapshot.snapshot.meta.node_types[typeAt], edgeTypes = snapshot.snapshot.meta.edge_types[edgeTypeAt];
const starts = new Uint32Array(count + 1); let offset = 0;
for (let i = 0; i < count; i++) { starts[i] = offset; offset += nodes[i * stride + edgeCountAt] * edgeStride; } starts[count] = offset;
const parent = new Int32Array(count).fill(-1), via = new Uint32Array(count), queue = new Uint32Array(count);
let head = 0, tail = 1; queue[0] = 0; parent[0] = 0;
while (head < tail) {
  const node = queue[head++];
  for (let e = starts[node]; e < starts[node + 1]; e += edgeStride) {
    if (edgeTypes[edges[e + edgeTypeAt]] === 'weak') continue;
    const child = edges[e + toAt] / stride;
    if (parent[child] >= 0) continue;
    parent[child] = node; via[child] = e; queue[tail++] = child;
  }
}
const targets = [];
for (let i = 0; i < count; i++) {
  const name = strings[nodes[i * stride + nameAt]];
  if (!['object', 'closure'].includes(types[nodes[i * stride + typeAt]]) || !['HighlightBoost', 'HighlightsView'].includes(name)) continue;
  const path = []; let node = i;
  for (let depth = 0; node && parent[node] >= 0 && depth < 45; depth++) {
    const e = via[node], kind = edgeTypes[edges[e + edgeTypeAt]], key = edges[e + edgeNameAt];
    path.push({ object: strings[nodes[node * stride + nameAt]], via: kind === 'element' || kind === 'hidden' ? key : strings[key], kind }); node = parent[node];
  }
  targets.push({ name, reachable: parent[i] >= 0, path: path.reverse() });
}
writeFileSync(`${paths.bench}/memory-retainers.json`, JSON.stringify({ nodes: count, targets }, null, 2));
console.log(JSON.stringify(targets, null, 2));
