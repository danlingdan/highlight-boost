import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { bundledLanguagesInfo, bundledThemesInfo } from 'shiki';

const require = createRequire(import.meta.url);
const paths = require('./paths.cjs');
const commit = '5268557c6874439ef9fbf4a48e2ae223f54e09de';
const upstream = join(paths.research, `shiki-source-${commit}`);
const evidence = resolve(paths.root, 'docs/verification/1.1.0/phase-1');
const files = ['README.md', 'package.json', 'packages/obsidian/src/settings/Settings.ts', 'packages/obsidian/src/settings/SettingsTab.ts', 'packages/obsidian/src/Highlighter.ts', 'packages/obsidian/src/main.ts', 'packages/obsidian/src/PrismPlugin.ts', 'packages/obsidian/src/InlineCodeBlock.ts', 'packages/obsidian/src/codemirror/Cm6_ViewPlugin.ts', 'packages/obsidian/src/themes/ThemeMapper.ts', 'packages/ec-core/src/Config.ts'];
await mkdir(evidence, { recursive: true });
await mkdir(paths.design, { recursive: true });
const sources = [];
for (const file of files) {
  const target = join(upstream, file);
  let body;
  try { body = await readFile(target); }
  catch {
    const response = await fetch(`https://raw.githubusercontent.com/mProjectsCode/obsidian-shiki-plugin/${commit}/${file}`);
    if (!response.ok) throw new Error(`${file}: ${response.status}`);
    body = Buffer.from(await response.arrayBuffer());
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, body);
  }
  sources.push({ file, url: `https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/${commit}/${file}`, sha256: createHash('sha256').update(body).digest('hex') });
}
const engineModule = join(paths.design, 'baseline-engine.mjs');
await build({ entryPoints: [resolve(paths.root, 'src/syntax/engine.ts')], outfile: engineModule, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { SyntaxEngine } = await import(new URL(`file:///${engineModule.replaceAll('\\', '/')}`));
const { JSDOM } = await import('jsdom');
const document = new JSDOM('').window.document;
const engine = new SyntaxEngine();
await engine.initialize();
const catalogue = [];
for (const language of bundledLanguagesInfo) {
  const entries = [];
  for (const name of [language.id, ...(language.aliases ?? [])]) {
    const supported = engine.supports(name);
    const registered = engine.languages.includes(name) && /^[a-z0-9][a-z0-9-]*$/.test(name) && name !== 'mermaid';
    try { const tokens = await engine.tokens('value = "example"\n', name); entries.push({ name, supported, registered, tokens: tokens.length }); }
    catch (error) { entries.push({ name, supported, registered, error: String(error) }); }
  }
  catalogue.push({ id: language.id, aliases: language.aliases ?? [], entries });
}
const probes = [];
const cases = [
  ['plain', 'js', 'const value = 1;', ''],
  ['title-number-wrap', 'js', 'const value = 1;', 'title="demo.js" showLineNumbers startLineNumber=20 wrap'],
  ['line-markers', 'js', 'first();\nsecond();\nthird();', 'mark={1} ins={2} del={3}'],
  ['label-marker', 'js', 'first();\nsecond();', 'mark={"核对":2}'],
  ['text-marker', 'js', 'const value = 1;', '"value"'],
  ['regex-marker', 'js', 'const value = 1;', '/val\\w+/'],
  ['collapse', 'js', 'first();\nsecond();\nthird();', 'collapse={2-3}'],
  ['collapse-style', 'js', 'first();\nsecond();\nthird();', 'collapse={2-3} collapseStyle="collapsible-auto" collapsePreserveIndent=false'],
  ['frame-terminal', 'bash', '# keep this comment\necho hello', 'frame="terminal"'],
  ['frame-none', 'js', '// demo.js\nconst value = 1;', 'frame="none"'],
  ['diff', 'diff', '-old();\n+new();\n same();', 'lang="js"'],
  ['diff-syntax', 'js', '-old();\n+new();\n same();', 'useDiffSyntax'],
  ['whitespace-unicode', 'js', '\n\tconst 文本 = "😀";  \n\n', ''],
  ['ansi', 'ansi', '\u001b[31mred\u001b[0m', ''],
  ['plain-text', 'text', 'const value = 1;', ''],
];
for (const [id, language, code, meta] of cases) {
  try {
    const root = document.createElement('div'); root.append(await engine.render(code, language, meta, document, 'zh'));
    const codeElement = root.querySelector('pre > code');
    const copy = root.querySelector('.copy button');
    const html = root.innerHTML;
    probes.push({ id, language, meta, code, renderedText: codeElement?.textContent, copy: copy?.dataset.code?.replaceAll('\x7f', '\n'), lines: root.querySelectorAll('.ec-line').length, inlineMarkers: root.querySelectorAll('mark, ins, del').length, collapses: root.querySelectorAll('details, .ec-section').length, html });
  } catch (error) { probes.push({ id, language, meta, error: String(error) }); }
}
engine.dispose();
const settings = await readFile(join(upstream, 'packages/obsidian/src/settings/Settings.ts'), 'utf8');
const currentPackage = JSON.parse(await readFile(resolve(paths.root, 'package.json'), 'utf8'));
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: paths.root, encoding: 'utf8' }).trim();
const sourceFiles = [];
for (const file of ['src/syntax/engine.ts', 'src/syntax/service.ts', 'src/syntax/editor.ts', 'src/syntax/upstream/Config.ts', 'src/code-display.ts', 'src/code-options.ts', 'src/settings.ts']) {
  sourceFiles.push({ file, sha256: createHash('sha256').update(await readFile(resolve(paths.root, file))).digest('hex') });
}
await writeFile(join(evidence, 'sources.json'), JSON.stringify({ date: '2026-11-16', commit, files: sources, local: { shiki: currentPackage.dependencies.shiki, expressiveCode: currentPackage.dependencies['@expressive-code/core'] }, upstreamSettings: settings }, null, 2) + '\n');
await writeFile(join(evidence, 'code-baseline.json'), JSON.stringify({ sourceVersion: currentPackage.version, sourceRevision, sourceFiles, languages: catalogue, themes: bundledThemesInfo.map(({ id, type, displayName }) => ({ id, type, displayName })), probes }, null, 2) + '\n');
const probe = id => probes.find(value => value.id === id);
const checks = [
  { name: '全部规范语言和别名生成 token', passed: catalogue.every(language => language.entries.every(entry => entry.supported && !entry.error && entry.tokens > 0)) },
  { name: '全部渲染样例完成', passed: probes.every(value => !value.error) },
  { name: '普通代码与 Unicode 空白复制保留原文', passed: probes.filter(value => value.id !== 'ansi').every(value => value.copy === value.code) },
  { name: '行强调三种类型', passed: ['mark', 'ins', 'del'].every(kind => probe('line-markers').html.includes(`highlight ${kind}`)) },
  { name: '标签保留', passed: probe('label-marker').html.includes('核对') && probe('label-marker').html.includes('tm-label') },
  { name: '文本与正则精确标记', passed: ['text-marker', 'regex-marker'].every(id => probe(id).inlineMarkers === 1) },
  { name: '局部折叠与样式', passed: probe('collapse').collapses > 0 && probe('collapse-style').html.includes('collapsible-end') },
  { name: '终端框架', passed: probe('frame-terminal').html.includes('is-terminal') },
  { name: '标题和行号', passed: probe('title-number-wrap').html.includes('demo.js') && probe('title-number-wrap').html.includes('class="ln"') },
];
await writeFile(join(evidence, 'baseline-checks.json'), JSON.stringify({ date: '2026-11-16', checks, knownDifferences: [{ id: 'ansi-copy', current: probe('ansi').copy, source: probe('ansi').code, target: '统一复制服务从源代码读取，保留原始 ANSI 转义。' }], passed: checks.every(value => value.passed) }, null, 2) + '\n');
console.log(JSON.stringify({ sourceFiles: sources.length, canonicalLanguages: catalogue.length, aliases: catalogue.flatMap(x => x.aliases).length, themes: bundledThemesInfo.length, probeCount: probes.length, probeErrors: probes.filter(x => x.error).map(x => ({ id: x.id, error: x.error })), unregistered: catalogue.flatMap(x => x.entries).filter(x => !x.registered).map(x => x.name) }, null, 2));
if (checks.some(value => !value.passed)) { console.error(JSON.stringify(checks.filter(value => !value.passed))); process.exitCode = 1; }
