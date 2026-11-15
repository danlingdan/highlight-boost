import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, cp, readdir, access } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const execute = promisify(execFile), root = process.cwd();
const { stdout: dirty } = await execute('git', ['diff', '--name-only', 'HEAD', '--', 'src', 'styles.css', 'manifest.json', 'versions.json', 'package.json', 'pnpm-lock.yaml', 'esbuild.config.mjs', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses']);
if (dirty.trim()) throw new Error(`Commit product changes before packaging: ${dirty}`);
const manifest = JSON.parse(await readFile('manifest.json', 'utf8')), pkg = JSON.parse(await readFile('package.json', 'utf8')), versions = JSON.parse(await readFile('versions.json', 'utf8'));
if (manifest.version !== pkg.version || versions[manifest.version] !== manifest.minAppVersion || !manifest.isDesktopOnly) throw new Error('Candidate version declarations differ');
const sourceCommit = (await execute('git', ['rev-parse', 'HEAD'])).stdout.trim();
const directory = resolve('dist', `highlight-boost-${manifest.version}-${sourceCommit.slice(0, 8)}`), plugin = join(directory, 'highlight-boost');
await mkdir(plugin, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses']) await cp(resolve(file), join(plugin, file), { recursive: true });
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const files = {};
async function collect(directory) { for (const item of await readdir(directory, { withFileTypes: true })) { const file = join(directory, item.name); if (item.isDirectory()) await collect(file); else files[relative(plugin, file).replaceAll('\\', '/')] = await hash(file); } }
await collect(plugin);
const archive = join(directory, 'highlight-boost.zip'), unpacked = join(directory, 'unpacked');
if (process.platform === 'win32') {
  const script = resolve('scripts/zip-candidate.ps1');
  await execute('powershell', ['-NoProfile', '-File', script, '-SourcePath', plugin, '-ArchivePath', archive]);
  await execute('powershell', ['-NoProfile', '-File', script, '-SourcePath', archive, '-ArchivePath', unpacked, '-Extract']);
} else {
  await execute('zip', ['-r', '-q', archive, 'highlight-boost'], { cwd: directory });
  await execute('unzip', ['-o', '-q', archive, '-d', unpacked]);
}
for (const [file, expected] of Object.entries(files)) if (await hash(join(unpacked, 'highlight-boost', file)) !== expected) throw new Error(`Archive hash differs: ${file}`);
await access(join(unpacked, 'highlight-boost/main.js'));
const candidate = { version: manifest.version, minAppVersion: manifest.minAppVersion, sourceCommit, files, archiveSha256: await hash(archive), archive: relative(root, archive).replaceAll('\\', '/'), extractedPlugin: relative(root, join(unpacked, 'highlight-boost')).replaceAll('\\', '/') };
await writeFile(join(directory, 'candidate.json'), JSON.stringify(candidate, null, 2) + '\n');
console.log(JSON.stringify(candidate, null, 2));
