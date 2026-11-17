// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { bundledLanguagesInfo, bundledThemesInfo } from 'shiki';
import { SyntaxEngine } from '../src/syntax/engine';
import { defaultCodeSyntax } from '../src/syntax/settings';
import { loadSyntaxResources } from '../src/syntax/resources';
import { resolveLanguage, resolveCodeOwner, inlineSourceOffsets, inlineLanguage } from '../src/syntax/languages';
import { normalizeSettings } from '../src/settings';
import { defaultCodeDisplay } from '../src/code-options';
import { unifiedCodeModel } from '../src/syntax/model';
import { renderUnifiedCode } from '../src/syntax/component';
import { parseDocument } from '../src/parsing';
import { renderedCodeText } from '../src/rendering';
import { fenceTokens } from '../src/fence-params';

const engines: SyntaxEngine[] = [];
afterEach(() => { for (const engine of engines.splice(0)) engine.dispose(); });
async function engine() { const result = new SyntaxEngine(); engines.push(result); await result.initialize(); return result; }

it('关闭预览所在文档时释放该文档主题，其他窗口继续着色', async () => {
  const syntax = await engine(), frame = document.createElement('iframe'); document.body.append(frame);
  const target = frame.contentDocument!;
  const unrelated = new target.defaultView!.CSSStyleSheet();
  target.adoptedStyleSheets.push(unrelated);
  await syntax.render('const preview = 1;', 'js', '', target);
  await syntax.render('const second = 2;', 'js', '', target);
  await syntax.render('const main = 2;', 'js', '', document);
  expect(target.adoptedStyleSheets).toHaveLength(2);
  expect(document.adoptedStyleSheets).toHaveLength(1);
  expect(target.adoptedStyleSheets[1]).not.toBe(document.adoptedStyleSheets[0]);
  frame.contentWindow!.dispatchEvent(new Event('pagehide'));
  expect(target.adoptedStyleSheets).toEqual([unrelated]);
  expect(document.adoptedStyleSheets).toHaveLength(1);
  expect((await syntax.tokens('const main = 3;', 'js')).length).toBeGreaterThan(0);
  syntax.dispose();
  expect(document.adoptedStyleSheets).toHaveLength(0);
  frame.remove();
});

it('两种旧提供者升级到相同 schema 3，保留所有旧展示开关并保持幂等', () => {
  const original = normalizeSettings({ presets: [{ id: 'important', customName: true, name: '考点', color: 'blue' }], defaultPreset: 'question', language: 'en', selectionToolbar: false, recentColors: ['red'], excerptTemplate: 'quote', codeDisplay: { showTitle: true, showLineNumbers: true, startLine: 37, numberFont: 'interface', collapsible: true, collapseByDefault: true, wrap: true, diff: false } });
  const first = normalizeSettings({ ...original, schemaVersion: 2, syntaxProvider: 'native' });
  const second = normalizeSettings({ ...original, schemaVersion: 2, syntaxProvider: 'shiki' });
  expect(first).toEqual(second); expect(first).toEqual(original); expect(first.schemaVersion).toBe(3);
  expect(first).not.toHaveProperty('syntaxProvider'); expect(normalizeSettings(first)).toEqual(first);
});

it.each([['C++', 'cpp'], ['C#', 'csharp'], ['F#', 'fsharp'], ['文言', 'wenyan'], ['JS', 'javascript'], ['PLAINTEXT', 'text']])('规范化语言名 %s', (name, expected) => {
  expect(resolveLanguage(name)).toBe(expected); expect(resolveCodeOwner(name)).toBe('hb');
});

it('按原始名称与别名判定专用块及排除语言', () => {
  for (const name of ['mermaid', 'dataview', 'dataviewjs', 'query', 'tasks', 'ad-note']) expect(resolveCodeOwner(name)).toBe('external');
  expect(resolveCodeOwner('JS', ['javascript'])).toBe('external');
  expect(resolveCodeOwner('javascript', ['js'])).toBe('external');
  expect(resolveCodeOwner('hb-unknown')).toBe('hb');
});

it.each(['前文 ` {ts} read(buffer) ` 后文', '前文 `{ts} read(\r\nbuffer)` 后文'])('行内代码空白规范化后仍对应源字符 %s', async source => {
  const syntax = await engine(), inline = parseDocument(source).inlines[0]!, declaration = inlineLanguage(inline.text)!;
  const offsets = inlineSourceOffsets(inline, source);
  for (const token of await syntax.tokens(declaration.code, declaration.language)) {
    const from = offsets[declaration.prefix + token.from]!, to = offsets[declaration.prefix + token.to]!;
    expect(source.slice(from, to).replaceAll('\r\n', ' ')).toBe(declaration.code.slice(token.from, token.to));
  }
});

it('所有内置语言和别名均可生成 token', async () => {
  const syntax = await engine();
  for (const language of bundledLanguagesInfo) for (const name of [language.id, ...(language.aliases ?? [])]) {
    expect(syntax.supports(name), name).toBe(true);
    expect((await syntax.tokens('value = "example"\n', name)).length, name).toBeGreaterThan(0);
  }
}, 30000);

it('全部内置主题可选并用于实际着色', async () => {
  for (const theme of bundledThemesInfo) {
    const syntax = new SyntaxEngine();
    try {
      await syntax.initialize({ settings: { ...defaultCodeSyntax, lightTheme: theme.id } });
      const tokens = await syntax.tokens('const value = 1;', 'js');
      expect(tokens.length, theme.id).toBeGreaterThan(0);
      expect(tokens.every(token => !!token.color), theme.id).toBe(true);
    } finally { syntax.dispose(); }
  }
}, 30000);

it('库内主题和自定义语言加载保留稳定 ID、别名与字体样式', async () => {
  const content: Record<string, string> = {
    'themes/demo.json': JSON.stringify({ name: 'demo', type: 'dark', tokenColors: [{ scope: 'keyword', settings: { foreground: '#ff0000', fontStyle: 'bold italic underline' } }] }),
    'langs/demo.json': JSON.stringify({ name: 'hb-demo', aliases: ['hbd'], scopeName: 'source.hb-demo', patterns: [{ match: '\\bHELLO\\b', name: 'keyword.control.demo' }] }),
  };
  const settings = { ...defaultCodeSyntax, customThemeFolder: 'themes', customLanguageFolder: 'langs', lightTheme: 'custom:themes/demo.json' };
  const resources = await loadSyntaxResources(settings, { list: async folder => ({ files: Object.keys(content).filter(path => path.startsWith(folder)) }), read: async path => content[path]! });
  expect(resources.errors).toEqual([]); expect(resources.themes[0]?.id).toBe('custom:themes/demo.json');
  const syntax = new SyntaxEngine(); engines.push(syntax); await syntax.initialize({ settings, resources });
  expect(syntax.themes.some(theme => theme.id === 'custom:themes/demo.json')).toBe(true);
  const tokens = await syntax.tokens('HELLO value', 'hbd');
  expect(tokens.find(token => token.from === 0)?.color.toLowerCase()).toBe('#ff0000');
  expect(tokens.find(token => token.from === 0)?.fontStyle).toBe(7);
});

it('自定义资源错误按文件保留，继续加载有效资源', async () => {
  const resources = await loadSyntaxResources({ ...defaultCodeSyntax, customLanguageFolder: 'langs', customThemeFolder: '../outside' }, {
    list: async () => ({ files: ['langs/bad.json', 'langs/valid.json'] }),
    read: async path => path.includes('bad') ? '{}' : '{"name":"demo","scopeName":"source.demo","patterns":[]}',
  });
  expect(resources.languages).toHaveLength(1); expect(resources.errors.map(value => value.path)).toEqual(['../outside', 'langs/bad.json']);
});

it('缺失嵌入依赖指向具体语法文件，其他语法继续加载', async () => {
  const resources = await loadSyntaxResources({ ...defaultCodeSyntax, customLanguageFolder: 'langs' }, {
    list: async () => ({ files: ['langs/bad.json', 'langs/valid.json'] }),
    read: async path => JSON.stringify({ name: path.includes('bad') ? 'bad' : 'good', scopeName: `source.${path}`, patterns: [], embeddedLangs: path.includes('bad') ? ['missing-example'] : [] }),
  });
  expect(resources.languages.map(value => value.name)).toEqual(['good']);
  expect(resources.errors[0]).toMatchObject({ path: 'langs/bad.json' });
  expect(resources.errors[0]?.message).toContain('missing-example');
});

it('未知语言和空语言进入统一纯文本组件', async () => {
  const syntax = await engine();
  for (const language of ['', 'hb-unknown', 'plain']) {
    const block = parseDocument(`\`\`\`${language}\nconst x = 1;\n\`\`\``).blocks[0]!;
    const root = await renderUnifiedCode(syntax, block, document, 'zh', defaultCodeDisplay, new Map(), language);
    expect(root.querySelectorAll('.hb-code-header')).toHaveLength(1);
    expect(renderedCodeText(root.querySelector('pre > code')!)).toBe(block.text);
  }
});

it('文本正则与局部折叠在统一组件中保留，显示参数使用同一优先级', async () => {
  const syntax = await engine();
  const block = parseDocument('```js file:"my file.js" ln:20 collapse={2-3} "value" /count\\w*/\nconst value = 1;\nconst count = value;\nconsole.log(count);\n```').blocks[0]!;
  const root = await renderUnifiedCode(syntax, block, document, 'zh', defaultCodeDisplay, new Map(), 'demo');
  expect(root.querySelector('.hb-code-title')?.textContent).toBe('my file.js');
  expect(root.querySelector('mark')).not.toBeNull(); expect(root.querySelector('.ec-section')).not.toBeNull();
  expect(root.querySelector('[data-hb-number="20"]')).not.toBeNull();
  expect(renderedCodeText(root.querySelector('code')!)).toBe(block.text);
});

it('正则空格和字符组不破坏 meta 拆分', () => {
  expect(fenceTokens('title="my file" /one [a/b] two/ ins="new value" collapse={2-3}')).toEqual(['title="my file"', '/one [a/b] two/', 'ins="new value"', 'collapse={2-3}']);
  expect(fenceTokens('file:/demo.js ln:20 /one [a/b] two/')).toEqual(['file:/demo.js', 'ln:20', '/one [a/b] two/']);
  const model = unifiedCodeModel(parseDocument('```ts ln:7 showLineNumbers=false startLineNumber=20 frame="terminal"\nconst x=1;\n```').blocks[0]!);
  expect(model.options.showLineNumbers).toBe(false); expect(model.options.startLine).toBe(20); expect(model.options.frame).toBe('terminal');
});

it('编辑器精确参数映射与多行混合语法 token 取源范围一致', async () => {
  const syntax = await engine();
  const code = 'const value = 1;\nconst countValue = value;';
  const markers = await syntax.markers(code, 'ts', '"value" /count\\w*/', document);
  expect(markers.map(mark => code.slice(mark.from, mark.to))).toEqual(['value', 'countValue', 'value']);
  const mixed = '<script>\nconst message = `value: ${1}`;\n</script>\n<style>button { color: red; }</style>';
  const tokens = await syntax.tokens(mixed, 'html');
  expect(tokens.map(token => mixed.slice(token.from, token.to)).join('')).toBe(mixed.replaceAll('\n', ''));
  expect(new Set(tokens.map(token => token.color)).size).toBeGreaterThan(2);
});

it.each(['github', 'collapsible-start', 'collapsible-end', 'collapsible-auto'])('局部折叠样式 %s 保留逻辑代码与复制', async style => {
  const syntax = await engine(), code = 'one();\n  two();\n  three();\nfour();';
  const root = document.createElement('div'); root.append(await syntax.render(code, 'js', `collapse={2-3} collapseStyle="${style}" collapsePreserveIndent=false`, document));
  expect(root.querySelector('.ec-section')).not.toBeNull();
  expect(renderedCodeText(root.querySelector('code')!)).toBe(code);
  expect(root.querySelector<HTMLButtonElement>('.copy button')?.dataset.code?.replaceAll('\x7f', '\n')).toBe(code);
});

it('ANSI 原文偏移与复制字符串保留转义，显示颜色和文字不变', async () => {
  const syntax = await engine(), code = '\u001b[31mred\u001b[0m tail\n\u001b[1;4mstrong\u001b[0m';
  const tokens = await syntax.tokens(code, 'ansi');
  expect(tokens.map(token => code.slice(token.from, token.to)).join('')).toBe('red tailstrong');
  const root = document.createElement('div'); root.append(await syntax.render(code, 'ansi', '', document));
  expect(renderedCodeText(root.querySelector('code')!)).toBe(code);
  expect(root.querySelector<HTMLButtonElement>('.copy button')?.dataset.code?.replaceAll('\x7f', '\n')).toBe(code);
  expect(root.querySelector('.hb-ansi-control[hidden]')).not.toBeNull();
});
