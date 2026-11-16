(async () => {
  const checks = [], errors = [];
  window.__hbChecks = checks;
  window.addEventListener('error', event => errors.push(event.error?.stack ?? event.message));
  const assert = (name, value, details) => { if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`); checks.push({ name, passed: true }); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 120));
  const until = async predicate => { for (let i = 0; i < 40 && !predicate(); i++) await tick(); return predicate(); };
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost'], originalSettings = structuredClone(plugin.settings);
  plugin.settings.language = 'zh'; await plugin.saveSettings();
  const source = '# 阶段 D 验收\n\n## 正文\n\n正文 **核心观点** 与 `a==b`。\n\n## C 示例\n\n```c\nvoid copy(void) {\n\tmemcpy(dst, src, n);\n}\n```\n\n## Python 示例\n\n```python\ndef greet():\n    print("你好 😀")\n```\n\n## ASM 示例\n\n```asm\nmov ax, bx\nadd ax, 1\n```\n\n## 围栏字面量\n\n~~~~markdown\n```js\nconst sample = 1;\n```\n~~~~\n';
  const path = '阶段D验收.md', old = app.vault.getFileByPath(path);
  const file = old ? (await app.vault.modify(old, source), old) : await app.vault.create(path, source);
  const leaf = app.workspace.getLeaf(false); await leaf.openFile(file);
  app.workspace.setActiveLeaf(leaf, { focus: true });
  await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'source', source: true } });
  const view = leaf.view, editor = view.editor;
  const select = word => {
    const from = editor.getValue().lastIndexOf(word); editor.focus();
    editor.setSelection(editor.offsetToPos(from), editor.offsetToPos(from + word.length));
  };
  const mark = (word, id) => { select(word); app.commands.executeCommandById(`highlight-boost:${id}`); };
  const codes = () => [...editor.getValue().matchAll(/%%hb:(.+?)%%/g)].map(match => JSON.parse(match[1]));
  mark('**核心观点**', 'apply-important');
  assert('d-prose-inline-markdown-preserved', editor.getValue().includes('==🟡**核心观点**=='));
  select('a==b');
  const menuEvent = app.workspace.on('editor-menu', menu => menu.setUseNativeMenu(false));
  const rect = editor.cm.coordsAtPos(editor.cm.state.selection.main.head);
  editor.cm.contentDOM.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left, clientY: rect.top }));
  assert('d-context-menu-entry', await until(() => [...document.querySelectorAll('.menu-item-title')].some(item => item.textContent === '标记为疑问')));
  [...document.querySelectorAll('.menu-item-title')].find(item => item.textContent === '标记为疑问').closest('.menu-item').click();
  app.workspace.offref(menuEvent);
  assert('d-context-menu-applies-inline-semantic', await until(() => editor.getValue().includes('%%hbi:') && editor.getValue().includes('"semantic":"question"')));
  mark('src', 'apply-question'); mark('print', 'apply-reference'); mark('add ax', 'lines-action');
  const before = editor.getValue();
  mark('memcpy(dst, src, n)', 'apply-important');
  const overlapping = codes().find(metadata => metadata.marks.some(mark => mark.quote === 'src')).marks;
  assert('d-overlapping-code-identities', overlapping.length === 2 && overlapping[1].from < overlapping[0].from && overlapping[0].to < overlapping[1].to);
  editor.undo(); assert('d-single-undo', editor.getValue() === before);
  editor.redo(); assert('d-redo-restores-code', codes().some(metadata => metadata.marks.some(mark => mark.quote === 'memcpy(dst, src, n)')));
  mark('```js\nconst sample = 1;\n```', 'apply-reference');
  const saved = editor.getValue();
  await plugin.openPanel('note');
  const panel = () => document.querySelector('.hb-panel');
  const card = quote => [...panel().querySelectorAll('.hb-card')].find(card => card.querySelector('.hb-quote').textContent === quote);
  assert('d-current-note-all-object-types', panel().querySelectorAll('.hb-card').length === 7);
  assert('d-sidebar-heading-context', card('src').querySelector('.hb-heading-context').textContent === '阶段 D 验收 › C 示例');
  assert('d-sidebar-code-context', card('src').querySelector('.hb-card-context code').textContent === 'void copy(void) {\n\tmemcpy(dst, src, n);\n}');
  let copied = ''; const write = navigator.clipboard.writeText;
  navigator.clipboard.writeText = async value => { copied = value; };
  card('src').querySelector('.hb-copy-excerpt').click();
  assert('d-excerpt-heading-link', copied.includes('#C 示例') && copied.includes('阶段 D 验收 › C 示例'));
  assert('d-excerpt-exact-selection-and-context', copied.startsWith('```c\nsrc\n```') && copied.includes('代码上下文 · 第 1—3 行') && copied.includes('\tmemcpy(dst, src, n);'));
  card('```js\nconst sample = 1;\n```').querySelector('.hb-copy-excerpt').click();
  assert('d-excerpt-literal-fence-safe', copied.startsWith('````markdown\n```js\nconst sample = 1;\n```\n````'));
  select('print'); await plugin.copyCode(editor);
  assert('d-pure-code-copy-unicode-exact', copied === 'def greet():\n    print("你好 😀")');
  navigator.clipboard.writeText = write;
  for (const mode of ['source', 'live', 'reading']) {
    await leaf.setViewState({ type: 'markdown', state: { file: path, mode: mode === 'reading' ? 'preview' : 'source', source: mode === 'source' } });
    if (mode === 'reading') {
      assert('d-reading-prose-render', await until(() => [...view.containerEl.querySelectorAll('mark strong')].some(node => node.textContent === '核心观点')));
      assert('d-reading-inline-literal', await until(() => [...view.containerEl.querySelectorAll('code.hb-inline')].some(node => node.textContent === 'a==b')));
      for (const word of ['src', 'print', 'add ax, 1']) assert(`d-reading-${word}-decorated`, await until(() => [...view.containerEl.querySelectorAll('pre .hb-text, pre .hb-line')].some(node => node.textContent.includes(word))));
    } else {
      assert(`d-${mode}-code-render`, await until(() => [...view.containerEl.querySelectorAll('.hb-text')].some(node => node.textContent === 'src')));
      assert(`d-${mode}-inline-render`, await until(() => Boolean(view.containerEl.querySelector('.hb-inline'))));
    }
    await plugin.openPanel('note');
    if (mode !== 'source') {
      card('src').querySelector('details').open = true;
      await window.require('electron').ipcRenderer.invoke('hb-selection-capture', `phase-d-${mode}`);
    }
    for (const word of ['**核心观点**', 'a==b', 'src', 'print', 'add ax, 1']) {
      if (mode === 'reading') await leaf.setViewState({ type: 'markdown', state: { file: path, mode: 'preview' } });
      await plugin.openPanel('note'); card(word).querySelector('.hb-quote').click();
      assert(`d-${mode}-jump-${word}`, await until(() => view.getMode() === 'source' && editor.getSelection() === word));
    }
    assert(`d-${mode}-source-exact`, editor.getValue() === saved);
  }
  await plugin.openPanel('note');
  const oldRemove = window.__hbUI.menu(card('src').querySelector('.hb-card-more'), plugin.t('removeItem'));
  const otherPath = '阶段D另一篇.md', otherOld = app.vault.getFileByPath(otherPath);
  const other = otherOld ? (await app.vault.modify(otherOld, saved), otherOld) : await app.vault.create(otherPath, saved);
  await leaf.openFile(other); oldRemove.click();
  assert('d-old-card-keeps-other-note', editor.getValue() === saved);
  await leaf.openFile(file);
  await app.vault.modify(file, saved);
  await app.vault.adapter.write(`${app.vault.configDir}/hb-phase-d-expected.json`, JSON.stringify({ source: saved, originalSettings }));
  assert('d-note-persists', await app.vault.read(file) === saved);
  assert('d-no-page-errors', errors.length === 0, errors);
  return checks;
})()
