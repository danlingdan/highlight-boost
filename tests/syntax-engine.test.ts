// @vitest-environment jsdom
import { afterAll, beforeAll, expect, it } from 'vitest';
import { SyntaxEngine } from '../src/syntax/engine';
import { renderCode, renderedCodeText } from '../src/rendering';
import { applyChanges, planHighlight } from '../src/editing';
import { parseDocument } from '../src/parsing';
import { presets } from '../src/domain';

const engine = new SyntaxEngine();
let css = '';
beforeAll(async () => { css = await engine.initialize(); });
afterAll(() => engine.dispose());

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
