import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = 'docs/verification/performance/';
const read = name => JSON.parse(readFileSync(root + name + '.json', 'utf8'));
const before = read('core-before'), after = read('core-after'), hostBefore = read('host-before'), hostAfter = read('host-after');
assert.deepEqual(before.fixtures, after.fixtures);
assert.deepEqual(hostBefore.observations.fixtures, hostAfter.observations.fixtures);
assert.equal(before.environment.cpu, after.environment.cpu);
assert.equal(before.environment.node, after.environment.node);
assert.equal(hostBefore.obsidian, hostAfter.obsidian);
assert.equal(hostBefore.electron, hostAfter.electron);
const compare = (before, after) => Object.entries(before).map(([name, value]) => {
  assert(after[name], `Missing metric ${name}`);
  return { name, before: value, after: after[name], p50ChangePercent: (after[name].p50Ms / value.p50Ms - 1) * 100 };
});
const result = { core: compare(before.metrics, after.metrics), host: compare(hostBefore.observations.metrics, hostAfter.observations.metrics),
  coldIndex: { before: before.coldIndex, after: after.coldIndex }, environment: before.environment };
writeFileSync(root + 'comparison.json', JSON.stringify(result, null, 2) + '\n');
let markdown = '# 性能对照数据\n\n单位为毫秒；p95 使用最近秩法。3 次样本的 p95 为最大样本。原始数组见相邻 JSON。\n\n';
for (const [title, rows] of [['Node 核心', result.core], ['Obsidian 宿主', result.host]]) {
  markdown += `## ${title}\n\n| 场景 | 优化前 p50 / p95 | 优化后 p50 / p95 | p50 变化 |\n| --- | ---: | ---: | ---: |\n`;
  for (const row of rows) markdown += `| ${row.name} | ${row.before.p50Ms.toFixed(2)} / ${row.before.p95Ms.toFixed(2)} | ${row.after.p50Ms.toFixed(2)} / ${row.after.p95Ms.toFixed(2)} | ${row.p50ChangePercent.toFixed(1)}% |\n`;
  markdown += '\n';
}
markdown += `冷索引最大定时器间隔：${Math.max(...before.coldIndex.longestTimerGapMs).toFixed(2)} → ${Math.max(...after.coldIndex.longestTimerGapMs).toFixed(2)} ms。\n\n`;
markdown += `冷索引通知次数：${before.coldIndex.changeNotifications.join(', ')} → ${after.coldIndex.changeNotifications.join(', ')}。\n`;
writeFileSync(root + 'comparison.md', markdown);
console.log(markdown);
