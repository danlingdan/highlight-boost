import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const versions = JSON.parse(await readFile('versions.json', 'utf8'));
const version = process.env.RELEASE_VERSION;
if (!/^\d+\.\d+\.\d+$/.test(version ?? '') || manifest.version !== version || pkg.version !== version || versions[version] !== manifest.minAppVersion) throw new Error('Release versions differ');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const tag = execFileSync('git', ['rev-parse', `${version}^{commit}`], { encoding: 'utf8' }).trim();
if (revision !== tag) throw new Error('Release source differs from its tag');
const files = {};
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  const bytes = await readFile(name);
  if (!bytes.length || name === 'main.js' && bytes.length > 5_000_000) throw new Error(`Release file size: ${name}`);
  files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await mkdir('.local', { recursive: true });
await writeFile('.local/release-proof.json', JSON.stringify({ version, revision, node: process.version, files }, null, 2) + '\n');
console.log(JSON.stringify({ version, revision, files }, null, 2));
