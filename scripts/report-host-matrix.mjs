import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const run = process.argv.find(value => value.startsWith('--run='))?.slice(6);
if (!/^\d+$/.test(run ?? '')) throw new Error('Pass --run=<GitHub run ID>');
const root = resolve('.research-cache/ci', run), output = resolve('docs/verification/platforms');
const runtime = JSON.parse(await readFile('tests/runtime.json', 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(output, { recursive: true });
let sourceCommit;
for (const platform of ['windows', 'macos', 'ubuntu']) {
  const artifact = join(root, platform), directory = join(artifact, 'docs/verification');
  const environment = JSON.parse(await readFile(join(directory, 'host-environment.json'), 'utf8'));
  sourceCommit ??= environment.revision;
  if (sourceCommit !== environment.revision) throw new Error('Platform revisions differ');
  const files = (await readdir(directory)).filter(file => /^host.*results\.json$/.test(file) && file !== 'host-compatibility-results.json');
  for (const file of ['default-native.json', 'default-internal.json']) files.push(`compatibility/${file}`);
  const scenarios = [];
  for (const file of files.sort()) {
    const bytes = await readFile(join(directory, file)), result = JSON.parse(bytes);
    if (result.obsidian !== runtime.appVersion || result.electron !== runtime.electronVersion || !result.checks.length || result.errors.length || result.checks.some(check => check.passed !== true)) throw new Error(`Failed scene: ${platform}/${file}`);
    const scene = { file, sha256: digest(bytes), checks: result.checks.length };
    if (result.observations?.cells) scene.cells = result.observations.cells;
    scenarios.push(scene);
  }
  const version = JSON.parse(await readFile('manifest.json', 'utf8')).version;
  const candidateDirectory = join(artifact, 'dist', `highlight-boost-${version}-${sourceCommit.slice(0, 8)}`);
  const candidate = JSON.parse(await readFile(join(candidateDirectory, 'candidate.json'), 'utf8'));
  if (candidate.sourceCommit !== sourceCommit || digest(await readFile(join(candidateDirectory, 'highlight-boost.zip'))) !== candidate.archiveSha256) throw new Error(`Candidate hash differs: ${platform}`);
  const summary = { run, url: `https://github.com/danlingdan/highlight-boost/actions/runs/${run}`, sourceCommit, obsidian: runtime.appVersion, electron: runtime.electronVersion, environment, scenarioCount: scenarios.length, checks: scenarios.reduce((sum, scene) => sum + scene.checks, 0), errors: [], scenarios, candidate };
  await writeFile(join(output, `${platform}.json`), JSON.stringify(summary, null, 2) + '\n');
  console.log(`${platform}: ${summary.scenarioCount} scenarios, ${summary.checks} checks; candidate SHA256 verified`);
}
