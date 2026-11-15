(async () => {
  const checks = [], errors = []; window.__hbChecks = checks;
  const assert = (name, value, details) => { if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`); checks.push({ name, passed: true }); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 100));
  const until = async predicate => { for (let i = 0; i < 60 && !predicate(); i++) await tick(); return predicate(); };
  const cdp = (method, parameters) => window.require('electron').ipcRenderer.invoke('hb-accessibility', method, parameters);
  const key = async (key, code, windowsVirtualKeyCode) => { await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode }); await tick(); };
  window.addEventListener('error', event => errors.push(event.message));
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  let plugin = app.plugins.plugins['highlight-boost']; const original = structuredClone(plugin.settings);
  plugin.settings.syntaxProvider = 'shiki'; plugin.settings.language = 'zh'; plugin.settings.selectionToolbar = true; await plugin.saveSettings();
  await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost'); plugin = app.plugins.plugins['highlight-boost'];
  const path = '辅助技术验收.md', source = '# 辅助技术验收\n\n键盘重点 alpha，正文内容。\n\n行内 `inline()`。\n\n```js\nconst value = 1;\nconsole.log(value);\n```\n\n输入：\n';
  for (const existing of app.workspace.getLeavesOfType('markdown')) if (existing.view.file?.path === path) { await existing.view.save(); existing.detach(); }
  const old = app.vault.getFileByPath(path), file = old ? (await app.vault.modify(old, source), old) : await app.vault.create(path, source);
  const leaf = app.workspace.getLeaf('tab'); await leaf.openFile(file); app.workspace.setActiveLeaf(leaf, { focus: true });
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false } });
  const editor = leaf.view.editor;
  const select = word => { const from = editor.getValue().lastIndexOf(word); editor.focus(); editor.setCursor(editor.offsetToPos(from)); editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(from + word.length)); editor.scrollIntoView({ from: editor.offsetToPos(from), to: editor.offsetToPos(from + word.length) }, true); };
  let toolbarVisible = false; for (let i = 0; i < 60 && !toolbarVisible; i++) { select('alpha'); await tick(); toolbarVisible = Boolean(document.querySelector('.hb-selection-toolbar')); }
  assert('keyboard-toolbar-visible', toolbarVisible, { enabled: plugin.settings.selectionToolbar, focus: editor.hasFocus(), cmFocus: editor.cm.hasFocus, connected: editor.cm.dom.isConnected, documentFocus: document.hasFocus(), selection: editor.getSelection(), toolbars: [...plugin.toolbars].map(toolbar => ({ matches: toolbar.matches(editor), dismissed: toolbar.dismissed, disposed: toolbar.disposed, generation: toolbar.generation, composing: toolbar.view?.composing, coords: toolbar.view?.coordsAtPos(toolbar.view.state.selection.main.head), focus: toolbar.view?.hasFocus, connected: toolbar.view?.dom.isConnected, owner: toolbar.view?.dom.ownerDocument === document })), bounds: editor.cm.scrollDOM.getBoundingClientRect().toJSON(), active: document.activeElement?.outerHTML.slice(0, 300) });
  const toolbar = () => document.querySelector('.hb-selection-toolbar');
  let toolbarFocused = false;
  for (let i = 0; i < 30 && !toolbarFocused; i++) {
    if (!toolbar()) { select('alpha'); await tick(); }
    toolbar()?.querySelector('button')?.focus(); await tick();
    toolbarFocused = Boolean(toolbar()?.contains(document.activeElement));
  }
  assert('keyboard-toolbar-focused', toolbarFocused);
  await key('End', 'End', 35); assert('keyboard-toolbar-end', document.activeElement.dataset.hbAction === 'close', { active: document.activeElement?.outerHTML.slice(0, 300), toolbar: Boolean(toolbar()) });
  await key('Home', 'Home', 36); assert('keyboard-toolbar-home', document.activeElement === toolbar().querySelector('button'));
  await key('ArrowRight', 'ArrowRight', 39); assert('keyboard-toolbar-arrow', document.activeElement === toolbar().querySelectorAll('button')[1]);
  await key('Escape', 'Escape', 27); assert('keyboard-toolbar-escape-restores-editor', await until(() => !document.querySelector('.hb-selection-toolbar') && editor.hasFocus()));
  select('alpha'); plugin.apply(editor, plugin.presetForAction('important'));
  select('inline()'); plugin.apply(editor, plugin.presetForAction('question'));
  select('value'); plugin.apply(editor, plugin.presetForAction('reference'));
  plugin.saveNote(editor, plugin.documentFor(editor).items.find(item => item.kind === 'code-range'), '代码批注：保留变量含义。\n第二行批注。');
  const marked = editor.getValue();
  editor.focus(); editor.setCursor(editor.offsetToPos(marked.length));
  await cdp('Input.imeSetComposition', { text: 'zhongwen', selectionStart: 8, selectionEnd: 8 });
  assert('ime-composition-active', await until(() => editor.cm.composing));
  const composing = editor.getValue();
  assert('ime-no-floating-toolbar', !document.querySelector('.hb-selection-toolbar'));
  assert('ime-mark-command-deferred', plugin.apply(editor, plugin.presetForAction('important')) === false && editor.getValue() === composing);
  await cdp('Input.insertText', { text: '中文输入' });
  assert('ime-chinese-committed', await until(() => editor.getValue() === marked + '中文输入'), editor.getValue());
  await until(() => !editor.cm.composing);
  let inputText = editor.getValue();
  for (const [kind, needle] of [['inline', 'inline()'], ['code', 'console.log(value);']]) {
    const offset = inputText.lastIndexOf(needle) + needle.length; editor.focus(); editor.setCursor(editor.offsetToPos(offset));
    await cdp('Input.imeSetComposition', { text: 'ceshi', selectionStart: 5, selectionEnd: 5 });
    assert(`ime-${kind}-composition-active`, await until(() => editor.cm.composing));
    await cdp('Input.insertText', { text: '测试' });
    inputText = inputText.slice(0, offset) + '测试' + inputText.slice(offset);
    assert(`ime-${kind}-committed-exact`, await until(() => editor.getValue() === inputText), editor.getValue());
    await until(() => !editor.cm.composing);
    assert(`ime-${kind}-metadata-preserved`, plugin.documentFor(editor).items.length === 3);
  }
  await app.vault.modify(file, inputText);
  await plugin.openPanel('note');
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
  assert('a11y-reading-ready', await until(() => leaf.view.containerEl.querySelector('pre .hb-text')));
  const tree = await cdp('Accessibility.getFullAXTree');
  const names = tree.nodes.filter(node => !node.ignored).map(node => ({ role: node.role?.value, name: node.name?.value }));
  assert('a11y-copy-button-named', names.some(node => node.role === 'button' && /复制|copy/i.test(node.name)), names);
  assert('a11y-highlight-text-exposed', names.some(node => node.name?.includes('alpha')));
  assert('a11y-all-buttons-named', names.filter(node => node.role === 'button').every(node => node.name));
  const contrast = [], preview = leaf.view.containerEl.querySelector('.markdown-preview-view');
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const paint = canvas.getContext('2d', { willReadFrequently: true });
  const ratio = element => {
    const chain = []; for (let node = element; node; node = node.parentElement) chain.unshift(node);
    paint.fillStyle = '#fff'; paint.fillRect(0, 0, 1, 1);
    for (const node of chain) { paint.fillStyle = getComputedStyle(node).backgroundColor; paint.fillRect(0, 0, 1, 1); }
    const background = [...paint.getImageData(0, 0, 1, 1).data];
    paint.fillStyle = getComputedStyle(element).color; paint.fillRect(0, 0, 1, 1);
    const foreground = [...paint.getImageData(0, 0, 1, 1).data];
    const luminance = color => color.slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const a = luminance(background), b = luminance(foreground);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  for (const appearance of ['dark', 'light']) {
    app.changeTheme(`obsidian${appearance === 'dark' ? '' : '-light'}`); await tick();
    assert(`a11y-${appearance}-code-mark-ready`, await until(() => preview.querySelector('pre .hb-text')));
    const codeMark = preview.querySelector('pre .hb-text'), originalClass = codeMark.className;
    assert(`a11y-${appearance}-code-underline-visible`, getComputedStyle(codeMark).textDecorationLine === 'underline');
    for (const color of ['default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple']) {
      codeMark.className = `hb-text hb-${color}`; const value = ratio(codeMark);
      contrast.push({ appearance, target: `code-${color}`, ratio: value, foreground: getComputedStyle(codeMark).color, theme: document.body.className });
    }
    codeMark.className = originalClass;
    for (const [target, selector] of [['prose', 'mark'], ['inline', 'code.hb-inline']]) {
      const value = ratio(preview.querySelector(selector)); contrast.push({ appearance, target, ratio: value });
    }
  }
  assert('contrast-all-marked-text-4_5', contrast.every(sample => sample.ratio >= 4.5), contrast);
  for (let i = 0; i < 24; i++) {
    preview.style.width = `${i % 2 ? 1000 : 350}px`;
    plugin.settings.language = i % 2 ? 'zh' : 'en'; await plugin.saveSettings();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  preview.style.removeProperty('width');
  assert('resize-24-rerenders-source-exact', editor.getValue() === inputText);
  assert('resize-no-observer-loop-errors', !errors.some(error => /ResizeObserver/i.test(error)), errors);
  await cdp('pdf-prepare'); app.workspace.setActiveLeaf(leaf, { focus: true }); app.commands.executeCommandById('workspace:export-pdf');
  assert('pdf-export-dialog', await until(() => document.querySelector('.modal .mod-cta')));
  const modal = document.querySelector('.modal');
  const size = modal.querySelector('select'); size.value = 'A4'; size.dispatchEvent(new Event('change', { bubbles: true }));
  modal.querySelector('.mod-cta').click();
  let pdf;
  for (let i = 0; i < 100 && !pdf; i++) { await tick(); pdf = await cdp('pdf-status'); }
  assert('pdf-actual-export', pdf?.bytes > 1000 && pdf.header === '%PDF-', pdf);
  assert('pdf-code-mark-style', pdf.rendering.codeMark === 'value' && pdf.rendering.decoration === 'underline' && pdf.rendering.background !== 'rgba(0, 0, 0, 0)', pdf.rendering);
  assert('pdf-full-code-annotation', pdf.rendering.noteVisible && pdf.rendering.note.includes('第二行批注。'), pdf.rendering);
  assert('pdf-metadata-hidden', !/%%hb/.test(pdf.rendering.text));
  window.__hbObservations = { errors, names, contrast, resizeIterations: 24, ime: 'Chromium Input.imeSetComposition + Input.insertText', pdf };
  assert('a11y-no-page-errors', errors.length === 0, errors);
  plugin.settings = original; await plugin.saveSettings();
  return checks;
})()
