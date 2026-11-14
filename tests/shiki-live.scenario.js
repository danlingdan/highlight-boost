(async () => {
  const checks = [], observations = [];
  window.__hbChecks = checks;
  window.__hbObservations = observations;
  const assert = (name, condition) => {
    if (!condition) throw new Error(name);
    checks.push({ name, passed: true });
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 300));
  await app.plugins.loadManifests();
  await app.plugins.setEnable(true);
  await app.plugins.disablePlugin('highlight-boost');
  await app.plugins.enablePlugin('shiki-highlighter');
  const shiki = app.plugins.plugins['shiki-highlighter'];
  const version = window.__hbHostMode.endsWith('077') ? '0.7.7' : '0.8.0';
  assert('fixed-shiki-version', shiki.manifest.version === version);
  assert('no-other-code-plugins', Object.keys(app.plugins.plugins).every(id => ['highlight-boost', 'shiki-highlighter'].includes(id)));
  const tokenRequests = [];
  const original = shiki.highlighter.getHighlightTokens.bind(shiki.highlighter);
  shiki.highlighter.getHighlightTokens = async (...args) => {
    tokenRequests.push({ language: args[1], length: args[0].length });
    return original(...args);
  };
  const leaf = app.workspace.getLeaf(false);
  const samples = [
    { language: 'sql', code: 'SELECT id FROM users WHERE id = 7;' },
    { language: 'abap', code: "DATA value TYPE i.\nWRITE: / 'Hello'." },
    { language: 'asm', code: 'mov rax, 7\nadd rax, 1\nret' },
  ];
  for (const hb of [false, true]) {
    if (hb) await app.plugins.enablePlugin('highlight-boost');
    for (const sample of samples) {
      const path = `Shiki路径-${version}-${hb ? 'HB' : '独立'}-${sample.language}.md`;
      const source = `# 路径验证\n\n\`\`\`${sample.language} showLineNumbers\n${sample.code}\n\`\`\`\n\n末尾\n`;
      const old = app.vault.getFileByPath(path);
      const file = old ? (await app.vault.modify(old, source), old) : await app.vault.create(path, source);
      tokenRequests.length = 0;
      await leaf.openFile(file);
      app.workspace.setActiveLeaf(leaf, { focus: true });
      await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false } });
      const view = leaf.view, editor = view.editor;
      const capture = phase => {
        const root = view.containerEl.querySelector('.markdown-source-view');
        observations.push({ version, hb, language: sample.language, phase,
          nativeTokens: root.querySelectorAll('.HyperMD-codeblock [class*="cm-"]').length,
          shikiInlineColors: [...root.querySelectorAll('.HyperMD-codeblock span[style]')].filter(span => span.style.color).length,
          expressiveCode: root.querySelectorAll('.expressive-code').length,
          expressiveCopyButtons: root.querySelectorAll('.expressive-code .copy button').length,
          editButtons: root.querySelectorAll('.edit-block-button').length,
          tokenRequests: tokenRequests.length,
        });
      };
      await tick(); await tick();
      capture('open-without-edit');
      editor.setCursor({ line: 0, ch: 2 });
      await tick(); capture('cursor-only');
      const at = source.indexOf(sample.code);
      editor.scrollIntoView({ from: editor.offsetToPos(at), to: editor.offsetToPos(at + sample.code.length) }, true);
      await tick(); capture('scroll-only');
      assert(`${hb}-${sample.language}-navigation-keeps-source`, editor.getValue() === source);
      editor.setCursor(editor.offsetToPos(at));
      editor.replaceRange(' ', editor.offsetToPos(at));
      await tick(); await tick(); capture('document-edit');
      assert(`${hb}-${sample.language}-edit-applies`, editor.getValue() === source.slice(0, at) + ' ' + source.slice(at));
      editor.undo();
      await tick();
      assert(`${hb}-${sample.language}-undo-restores-source`, editor.getValue() === source);
      await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
      for (let i = 0; i < 20 && !view.containerEl.querySelector('.markdown-preview-view .expressive-code'); i++) await tick();
      const reading = view.containerEl.querySelector('.markdown-preview-view .expressive-code');
      assert(`${hb}-${sample.language}-reading-widget`, Boolean(reading));
      assert(`${hb}-${sample.language}-reading-copy`, Boolean(reading.querySelector('.copy button')));
      observations.push({ version, hb, language: sample.language, phase: 'reading', expressiveCode: 1, expressiveCopyButtons: reading.querySelectorAll('.copy button').length });
      await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false } });
      await tick(); capture('return-to-live');
    }
  }
  return checks;
})()
