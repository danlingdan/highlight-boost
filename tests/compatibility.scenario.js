(async () => {
  const checks = [], errors = []; window.__hbChecks = checks;
  window.addEventListener('error', event => errors.push(event.error?.stack ?? event.message));
  const assert = (name, value, details) => { if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`); checks.push({ name, passed: true }); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 100));
  const until = async predicate => { for (let i = 0; i < 60 && !predicate(); i++) await tick(); return predicate(); };
  const fs = window.require('fs'), nodePath = window.require('path'), root = nodePath.dirname(app.vault.adapter.basePath);
  const cases = JSON.parse(fs.readFileSync(nodePath.join(root, 'tests/compatibility-cases.json'), 'utf8'));
  const test = cases.find(test => test.id === window.__hbCompatibilityCase);
  const observations = { case: test, cells: [], errors }; window.__hbObservations = observations;
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  let plugin = app.plugins.plugins['highlight-boost'];
  plugin.settings.syntaxProvider = test.provider; plugin.settings.language = 'zh'; await plugin.saveSettings();
  await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost'); plugin = app.plugins.plugins['highlight-boost'];
  await app.customCss.setTheme(test.theme); await app.customCss.loadTheme();
  assert('compat-theme-css-loaded', test.theme ? app.customCss.styleEl.textContent.includes(test.theme === 'Minimal' ? 'Minimal Theme for Obsidian' : 'AnuPpuccin') : !app.customCss.styleEl.textContent.trim());
  for (const id of test.plugins) { await app.plugins.enablePlugin(id); assert(`compat-plugin-${id}-loaded`, Boolean(app.plugins.plugins[id])); }
  const customizer = app.plugins.plugins['codeblock-customizer'];
  if (customizer) { customizer.settings.pluginSettings.codeblock.enableLineNumbers = true; customizer.settings.pluginSettings.common.enableInSourceMode = true; await customizer.saveSettings(); }
  observations.dependencies = Object.fromEntries(test.plugins.map(id => [id, app.plugins.plugins[id].manifest.version]));
  const source = '# Compatibility\n\nprose target and `inline_target()`\n\n## C\n\n```c\nvoid copy(void) {\n    memcpy(dst, src, n);\n}\n```\n\n## Python\n\n```python\ndef greet():\n    print("hello")\n```\n\n## ASM\n\n```asm\nMOV AX, BX\nADD AX, 1\n```\n';
  const longSource = source.replace('    memcpy(dst, src, n);', `    memcpy(dst, src, n); // ${'long-code-content '.repeat(25).trimEnd()}`);
  const expectedCopy = longSource.match(/```c\n([\s\S]*?)\n```/)[1];
  const path = '兼容验收.md', old = app.vault.getFileByPath(path), file = old ? (await app.vault.modify(old, longSource), old) : await app.vault.create(path, longSource);
  const leaf = app.workspace.getLeaf(false); await leaf.openFile(file); app.workspace.setActiveLeaf(leaf, { focus: true });
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: true } });
  const view = leaf.view, editor = view.editor;
  const select = word => { const from = editor.getValue().lastIndexOf(word); editor.focus(); editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(from + word.length)); editor.scrollIntoView({ from: editor.offsetToPos(from), to: editor.offsetToPos(from + word.length) }, true); };
  for (const [word, semantic, mode] of [['prose target', 'important', 'text'], ['inline_target', 'question', 'text'], ['memcpy', 'reference', 'text'], ['print', 'important', 'lines'], ['MOV AX', 'action', 'text']]) {
    select(word); assert(`compat-mark-${word}`, plugin.apply(editor, plugin.presetForAction(semantic), mode));
  }
  await plugin.index.ready;
  for (const quote of ['prose target', 'memcpy']) {
    const hit = plugin.index.all().find(hit => hit.path === path && hit.item.quote === quote);
    await plugin.editNoteHit(hit, `Compatibility note: ${quote}`); await plugin.index.ready;
  }
  plugin.settings.codeDisplay.collapsible = true; await plugin.saveSettings();
  const marked = editor.getValue(); await app.vault.modify(file, marked); await plugin.index.ready;
  await plugin.openPanel(); assert('compat-five-object-results', document.querySelectorAll('.hb-panel .hb-card').length === 5);
  const settings = app.plugins.plugins['obsidian-style-settings'];
  if (settings && test.theme) {
    assert('compat-style-settings-theme-parsed', await until(() => settings.settingsList.length > 0));
    const candidates = settings.settingsList.flatMap(section => section.settings.filter(setting => setting.type === 'variable-number').map(setting => ({ section: section.id, ...setting })));
    assert('compat-style-settings-variable-available', candidates.length > 0);
    const setting = candidates[0], manager = settings.settingsManager, previous = manager.getSetting(setting.section, setting.id);
    const before = getComputedStyle(document.body).getPropertyValue(`--${setting.id}`);
    manager.setSetting(setting.section, setting.id, Number(setting.default) + 1);
    assert('compat-style-settings-variable-applied', await until(() => getComputedStyle(document.body).getPropertyValue(`--${setting.id}`) !== before));
    observations.styleSetting = { section: setting.section, id: setting.id, before, after: getComputedStyle(document.body).getPropertyValue(`--${setting.id}`) };
    if (previous === undefined) manager.clearSetting(setting.section, setting.id); else manager.setSetting(setting.section, setting.id, previous);
    assert('compat-style-settings-variable-restored', await until(() => getComputedStyle(document.body).getPropertyValue(`--${setting.id}`) === before));
  }
  for (const language of ['zh', 'en']) for (const appearance of ['dark', 'light']) {
    document.body.classList.remove('theme-dark', 'theme-light'); document.body.classList.add(`theme-${appearance}`);
    plugin.settings.language = language; await plugin.saveSettings(); await tick();
    for (const mode of ['source', 'live', 'reading']) {
      await leaf.setViewState({ type: 'markdown', state: { file: path, mode: mode === 'reading' ? 'preview' : 'source', source: mode === 'source' } });
      const prefix = `compat-${language}-${appearance}-${mode}`;
      if (mode === 'reading') {
        const preview = view.containerEl.querySelector('.markdown-preview-view'); preview.scrollTop = 0;
        assert(`${prefix}-prose`, await until(() => [...preview.querySelectorAll('mark')].some(node => node.textContent.includes('prose target'))));
        assert(`${prefix}-inline`, await until(() => Boolean(preview.querySelector('code.hb-inline'))));
        for (const word of ['memcpy', 'print', 'MOV AX']) assert(`${prefix}-${word}`, await until(() => {
          if ([...preview.querySelectorAll('pre > code')].some(code => [...code.querySelectorAll('.hb-text, .hb-line')].map(node => node.textContent).join('').includes(word))) return true;
          preview.scrollTop = preview.scrollTop + preview.clientHeight / 2 >= preview.scrollHeight ? 0 : preview.scrollTop + preview.clientHeight / 2; preview.dispatchEvent(new Event('scroll')); return false;
        }), [...preview.querySelectorAll('pre > code')].map(code => ({ text: code.textContent, html: code.innerHTML.slice(0, 1300) })));
        preview.scrollTop = 0; preview.dispatchEvent(new Event('scroll'));
        assert(`${prefix}-annotation`, await until(() => [...preview.querySelectorAll('.hb-code-notes .hb-note-text')].some(node => node.textContent === 'Compatibility note: memcpy')), { sourceNote: marked.includes('"note":"Compatibility note: memcpy"'), notes: [...preview.querySelectorAll('.hb-note-text')].map(node => node.textContent) });
        const pre = [...preview.querySelectorAll('pre')].find(pre => pre.textContent.includes('memcpy'));
        const bounds = pre.getBoundingClientRect();
        assert(`${prefix}-long-line-bounds`, bounds.width > 0 && bounds.width <= view.containerEl.clientWidth + 2, { width: bounds.width, viewWidth: view.containerEl.clientWidth });
        const wrapper = pre.closest('.hb-code-display'), toggle = wrapper.querySelector('[data-hb-display-action="toggle"]'), body = wrapper.querySelector('.hb-code-body');
        toggle.click(); assert(`${prefix}-fold`, body.hidden); wrapper.querySelector('[data-hb-display-action="toggle"]').click(); assert(`${prefix}-unfold`, !body.hidden);
        if (['default-native', 'minimal-native', 'anuppuccin-native'].includes(test.id) && (language === 'zh' && appearance === 'dark' || language === 'en' && appearance === 'light')) {
          for (const details of preview.querySelectorAll('.hb-code-notes details')) details.open = true;
          await window.require('electron').ipcRenderer.invoke('hb-selection-capture', `compat-${test.id.split('-')[0]}-${appearance}-${language}`);
        }
      } else {
        select('inline_target'); assert(`${prefix}-inline`, await until(() => Boolean(editor.cm.dom.querySelector('.hb-inline'))));
        for (const word of ['memcpy', 'print', 'MOV AX']) { select(word); assert(`${prefix}-${word}`, await until(() => [...editor.cm.dom.querySelectorAll('.cm-line')].some(line => (line.matches('.hb-line') ? line.textContent : [...line.querySelectorAll('.hb-text, .hb-line')].map(node => node.textContent).join('')).includes(word)))); }
      }
      assert(`${prefix}-source-exact`, editor.getValue() === marked);
      observations.cells.push({ language, appearance, mode, passed: true });
    }
  }
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: true } }); select('memcpy');
  await navigator.clipboard.writeText('pending'); app.commands.executeCommandById('highlight-boost:copy-code');
  let copied = ''; for (let i = 0; i < 40 && copied === ''; i++) { await tick(); const current = await navigator.clipboard.readText(); if (current !== 'pending') copied = current; }
  assert('compat-copy-pure-code', copied === expectedCopy, copied);
  assert('compat-no-page-errors', errors.length === 0, errors);
  return checks;
})()
