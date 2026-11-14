(async () => {
  const checks = [], matrix = [];
  window.__hbChecks = checks;
  window.__hbLanguageMatrix = matrix;
  const assert = (name, value, details) => {
    if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`);
    checks.push({ name, passed: true });
  };
  const tick = () => new Promise(resolve=>setTimeout(resolve, 150));
  const useShiki = window.__hbHostMode === 'languages-shiki';
  await app.plugins.loadManifests();
  await app.plugins.setEnable(true);
  await app.plugins.enablePlugin('highlight-boost');
  if (useShiki) await app.plugins.enablePlugin('shiki-highlighter');
  const shiki = app.plugins.plugins['shiki-highlighter'];
  const assembly = 'mov rax, 7\nadd rax, 1\nret';
  const cases = [
    { language: 'c', code: 'int target = 7;\nreturn target;', word: 'target' },
    { language: 'python', code: 'target = 7\nprint(target)', word: 'target' },
    { language: 'js', code: 'const target = 7;\nconsole.log(target);', word: 'target' },
    ...['asm', 'nasm', 'x86asm'].map(language=>({ language, code: assembly, word: 'rax' })),
    { language: 'hb-unknown', code: 'target = 7', word: 'target' },
  ];
  const leaf = app.workspace.getLeaf(false);
  for (const entry of cases) {
    const path = `${useShiki ? 'Shiki' : '宿主'}语言-${entry.language}.md`;
    const source = `# ${entry.language}\n\n\`\`\`${entry.language}\n${entry.code}\n\`\`\`\n`;
    const old = app.vault.getFileByPath(path);
    const file = old ? (await app.vault.modify(old, source), old) : await app.vault.create(path, source);
    await leaf.openFile(file);
    await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: true } });
    const view = leaf.view, editor = view.editor;
    const at = source.indexOf(entry.word);
    editor.setSelection(editor.offsetToPos(at), editor.offsetToPos(at + entry.word.length));
    app.commands.executeCommandById('highlight-boost:apply-important');
    const saved = editor.getValue();
    const record = { language: entry.language, provider: useShiki ? 'shiki-0.8.0' : 'native', syntax: {}, editorRendering: {} };
    for (const live of [false, true]) {
      await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: !live } });
      await tick();
      const root = view.containerEl.querySelector('.markdown-source-view');
      const name = live ? 'live-preview' : 'source';
      assert(`${entry.language}-${name}-mark`, [...root.querySelectorAll('.hb-text')].some(mark=>mark.textContent === entry.word));
      const nativeTokens = () => root.querySelectorAll('.HyperMD-codeblock .cm-keyword, .HyperMD-codeblock .cm-number, .HyperMD-codeblock .cm-type, .HyperMD-codeblock .cm-string, .HyperMD-codeblock .cm-variable, .HyperMD-codeblock .cm-operator').length > 0;
      const shikiColors = () => [...root.querySelectorAll('.HyperMD-codeblock span[style]')].some(span => span.style.color);
      if (useShiki && shiki.highlighter.supportedLanguages.includes(entry.language)) {
        for (let i = 0; i < 30 && !shikiColors(); i++) await tick();
      }
      record.editorRendering[name] = {
        nativeTokens: nativeTokens(), shikiInlineColors: shikiColors(),
        expressiveCode: Boolean(root.querySelector('.expressive-code')),
        expressiveCopyButton: Boolean(root.querySelector('.expressive-code .copy button')),
      };
      record.syntax[name] = nativeTokens() || shikiColors();
    }
    await app.vault.modify(file, saved);
    await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'preview' } });
    const root = view.containerEl.querySelector('.markdown-preview-view');
    for (let i = 0; i < 50 && ![...root.querySelectorAll('.hb-text')].some(mark=>mark.textContent === entry.word); i++) await tick();
    const code = root.querySelector('pre > code');
    assert(`${entry.language}-reading-mark`, [...root.querySelectorAll('pre .hb-text')].some(mark=>mark.textContent === entry.word));
    const rows = [...code.querySelectorAll(':scope > .ec-line > .code')];
    const actual = rows.length ? rows.map(row=>row.textContent).join('\n') : code.textContent.replace(/\n$/, '');
    assert(`${entry.language}-code-preserved`, actual === entry.code, actual);
    record.syntax.reading = Boolean(code.querySelector('.token, [style*="--0"]'));
    record.readingRenderer = rows.length ? 'expressive-code' : 'native';
    matrix.push(record);
  }
  return checks;
})()
