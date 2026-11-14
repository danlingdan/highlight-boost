(async () => {
  const checks = [], errors = []; window.__hbChecks = checks;
  window.addEventListener('error', event => errors.push(event.error?.stack ?? event.message));
  const assert = (name, value, details) => { if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`); checks.push({ name, passed: true }); };
  const until = async predicate => { for (let i = 0; i < 50 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 100)); return predicate(); };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  let plugin = app.plugins.plugins['highlight-boost']; const original = structuredClone(plugin.settings);
  const useProvider = async provider => {
    plugin.settings.syntaxProvider = provider; await plugin.saveSettings();
    await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost'); plugin = app.plugins.plugins['highlight-boost'];
  };
  await useProvider('native');
  const source = '# 参数适配\n\n```js title:"Styler <file>.js" ln:27 fold hl:1,3\nfirst();\ntarget();\nlast();\n```\n\n```js file:"Customizer.js" ln:false unfold hl:2|target\nfirst();\ntarget();\nlast();\n```\n\n> [!note] Hugo\n> ```js {lineNos=table,lineNoStart=20,hl_lines=[1,"3"]}\n> first();\n> target();\n> last();\n> ```\n\n```js title="Expressive.js" showLineNumbers startLineNumber=7 {1} ins={2} del={3}\nfirst();\ntarget();\nlast();\n```\n';
  const path = '围栏参数适配.md', old = app.vault.getFileByPath(path), file = old ? (await app.vault.modify(old, source), old) : await app.vault.create(path, source);
  const leaf = app.workspace.getLeaf(false); await leaf.openFile(file); app.workspace.setActiveLeaf(leaf, { focus: true });
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: true } });
  const view = leaf.view, editor = view.editor;
  const target = editor.getValue().lastIndexOf('target'); editor.setSelection(editor.offsetToPos(target), editor.offsetToPos(target + 6));
  app.commands.executeCommandById('highlight-boost:apply-question'); const saved = editor.getValue();
  for (const provider of ['native', 'shiki']) {
    if (provider === 'shiki') await useProvider(provider);
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: true } }); editor.setCursor({ line: 0, ch: 0 });
    let root = view.containerEl.querySelector('.markdown-source-view');
    assert(`${provider}-parameter-source-mark`, await until(() => root.querySelector('.hb-editor-code-line[data-hb-param="mark"]')));
    assert(`${provider}-parameter-source-ins-del`, root.querySelector('[data-hb-param="insert"]') && root.querySelector('[data-hb-param="delete"]'));
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
    root = view.containerEl.querySelector('.markdown-preview-view');
    assert(`${provider}-parameter-four-components`, await until(() => root.querySelectorAll('.hb-code-display').length === 4));
    const component = title => [...root.querySelectorAll('.hb-code-display')].find(node => node.querySelector('.hb-code-title')?.textContent === title);
    const styler = component('Styler <file>.js'), customizer = component('Customizer.js'), expressive = component('Expressive.js');
    assert(`${provider}-parameter-title-text`, styler && !styler.querySelector('file'));
    assert(`${provider}-parameter-fold`, styler.querySelector('.hb-code-body').hidden);
    assert(`${provider}-parameter-unfold`, !customizer.querySelector('.hb-code-body')?.hidden);
    assert(`${provider}-parameter-number-offset`, styler.querySelector('[data-hb-number="27"]'));
    assert(`${provider}-parameter-number-off`, !customizer.querySelector('[data-hb-number]'));
    assert(`${provider}-parameter-restricted-text`, customizer.querySelectorAll('[data-hb-param="mark"]').length === 1 && customizer.querySelector('[data-hb-param="mark"]').textContent.includes('target'));
    const hugo = [...root.querySelectorAll('.hb-code-display')].find(node => node.closest('.callout'));
    assert(`${provider}-parameter-hugo-callout`, hugo?.querySelector('[data-hb-number="20"]') && hugo.querySelectorAll('[data-hb-param="mark"]').length === 2);
    assert(`${provider}-parameter-ec-kinds`, ['mark', 'insert', 'delete'].every(kind => expressive.querySelector(`[data-hb-param="${kind}"]`)));
    assert(`${provider}-parameter-manual-mark`, expressive.querySelector('[data-hb-param="insert"] .hb-text')?.textContent === 'target');
    assert(`${provider}-parameter-source-exact`, editor.getValue() === saved && await app.vault.read(file) === saved);
    const write = navigator.clipboard.writeText; let copied = ''; navigator.clipboard.writeText = async text => { copied = text; };
    styler.querySelector('[data-hb-display-action="copy"]').click();
    assert(`${provider}-parameter-collapsed-copy`, await until(() => copied === 'first();\ntarget();\nlast();')); navigator.clipboard.writeText = write;
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: false } }); editor.setCursor({ line: 0, ch: 0 });
    root = view.containerEl.querySelector('.markdown-source-view');
    assert(`${provider}-parameter-live-callout`, await until(() => root.querySelector('.callout [data-hb-number="20"]') && root.querySelectorAll('.callout [data-hb-param="mark"]').length === 2));
    if (provider === 'shiki') {
      assert('shiki-parameter-live-components', await until(() => root.querySelectorAll('.hb-code-display .expressive-code').length === 4));
      assert('shiki-parameter-live-ins', root.querySelector('.expressive-code [data-hb-param="insert"] .hb-text')?.textContent === 'target');
      await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
      await window.require('electron').ipcRenderer.invoke('hb-selection-capture', 'parameters');
    }
    await app.plugins.disablePlugin('highlight-boost');
    assert(`${provider}-parameter-unload-clean`, !view.containerEl.querySelector('[data-hb-param], [data-hb-live-callout]'));
    await app.plugins.enablePlugin('highlight-boost'); plugin = app.plugins.plugins['highlight-boost'];
  }
  plugin.settings = original; await plugin.saveSettings(); await app.plugins.disablePlugin('highlight-boost'); await app.plugins.enablePlugin('highlight-boost');
  assert('parameter-settings-restored', JSON.stringify(app.plugins.plugins['highlight-boost'].settings) === JSON.stringify(original));
  assert('parameter-no-page-errors', errors.length === 0, errors);
  return checks;
})()
