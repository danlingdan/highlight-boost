// @vitest-environment jsdom
import { afterAll, beforeAll, expect, it } from 'vitest';
import { SyntaxEngine } from '../src/syntax/engine';
import { renderCode, renderedCodeText } from '../src/rendering';
import { applyChanges, planHighlight } from '../src/editing';
import { parseDocument } from '../src/parsing';
import { presets } from '../src/domain';
import { syntaxStyles } from '../src/syntax/styles';

const engine = new SyntaxEngine();
let css = '';
beforeAll(async () => { await engine.initialize(); css = await syntaxStyles(); });
afterAll(() => engine.dispose());

it.each(['\n  const value = 1;  \n\n', '\t \n  \t', 'const value = 1;\t\n\n', ''])('内置渲染及复制保留首尾空行和行尾空白 %j', async code => {
  const element = await engine.render(code, 'js', '', document) as HTMLElement;
  expect(renderedCodeText(element.querySelector('code')!)).toBe(code);
  expect(element.querySelector<HTMLButtonElement>('.copy button')!.dataset.code!.replaceAll('\x7f', '\n')).toBe(code);
});

it('内置代码复制与折叠提示按指定语言生成，复制内容保持原样', async () => {
  const code = 'const a = 1;\nconst b = 2;\nconsole.log(a + b);';
  const render = async (locale: 'zh' | 'en') => {
    const root = document.createElement('div');
    root.append(await engine.render(code, 'js', 'collapse={2-3}', document, locale));
    return root;
  };
  const chinese = await render('zh'), english = await render('en');
  expect(chinese.querySelector('button')?.title).toBe('复制到剪贴板');
  expect(english.querySelector('button')?.title).toBe('Copy to clipboard');
  expect(chinese.textContent).toContain('已折叠 2 行');
  expect(english.textContent).toContain('2 collapsed lines');
  expect((chinese.querySelector('.copy button') as HTMLElement).dataset.code).toBe((english.querySelector('.copy button') as HTMLElement).dataset.code);
});

it('在未编辑的代码上生成可映射的 token，并恢复主题 CSS 变量', async () => {
  const code = 'mov rax, 7\nadd rax, 1\nret';
  const tokens = await engine.tokens(code, 'asm');
  expect(tokens.length).toBeGreaterThan(3);
  expect(tokens.map(token => code.slice(token.from, token.to)).join('')).toBe(code.replaceAll('\n', ''));
  expect(tokens.some(token => token.color.startsWith('var(--shiki-'))).toBe(true);
  expect(css).toContain('var(--shiki-code-background)');
});

it('阅读容器与复制数据保持代码字符和空行', async () => {
  const code = 'const 文本 = "😀";\n\nconsole.log(文本);';
  const node = await engine.render(code, 'js', 'showLineNumbers', document);
  const container = document.createElement('div');
  container.append(node);
  expect(container.querySelector('.expressive-code')).not.toBeNull();
  expect(renderedCodeText(container.querySelector('pre > code') as HTMLElement)).toBe(code);
  expect((container.querySelector('.copy button') as HTMLElement).dataset.code?.replaceAll('\x7f', '\n')).toBe(code);
  const source = `\`\`\`js\n${code}\n\`\`\``;
  const from = source.lastIndexOf('文本');
  const marked = applyChanges(source, planHighlight(source, [{ from, to: from + 2 }], presets[0]!).changes);
  const codeElement = container.querySelector('pre > code') as HTMLElement;
  renderCode(codeElement, parseDocument(marked).blocks[0]!);
  expect(codeElement.querySelector('.hb-text')?.textContent).toBe('文本');
  expect(codeElement.querySelectorAll('.ec-line')[2]!.querySelector('.hb-text')).not.toBeNull();
  expect(renderedCodeText(codeElement)).toBe(code);
});

it('未知语言保留原生路径，释放后不再生成 token', async () => {
  expect(engine.supports('hb-unknown')).toBe(false);
  expect(await engine.tokens('unknown()', 'hb-unknown')).toEqual([]);
  const disposed = new SyntaxEngine();
  await disposed.initialize();
  disposed.dispose();
  expect(await disposed.tokens('const value = 1;', 'js')).toEqual([]);
});

it('内置 diff 和文件名注释保留原始字符，复制终端代码包含注释', async () => {
  for (const [language, code, meta] of [['diff', '-old();\n+new();\n same();', 'lang="js"'], ['js', '// src/example.js\nconst value = 1;', ''], ['bash', '# explanation\necho hello', '']] as const) {
    const root = document.createElement('div'); root.append(await engine.render(code, language, meta, document));
    expect(renderedCodeText(root.querySelector('pre > code') as HTMLElement)).toBe(code);
    expect((root.querySelector('.copy button') as HTMLElement).dataset.code?.replaceAll('\x7f', '\n')).toBe(code);
  }
});
