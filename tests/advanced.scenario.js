(async () => {
  const checks = [];
  window.__hbChecks = checks;
  const assert = (name, value, details) => {
    if (!value) throw new Error(`${name}: ${JSON.stringify(details)}`);
    checks.push({ name, passed: true });
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 150));
  const visibleSource = value => value.replace(/%%hbp:.+?%%/g, '');
  await app.plugins.loadManifests();
  await app.plugins.setEnable(true);
  await app.plugins.enablePlugin('highlight-boost');
  const plugin = app.plugins.plugins['highlight-boost'];
  assert('advanced-plugin-load', Boolean(plugin));
  const source = [
    '# 边界验证', '', '==🟡one gap two==', '', '跨区域正文', '',
    '```js', 'same();', '```', '', '```js', 'same();', '```', '',
    '```js', 'first(value);', 'second(value);', 'const message = "";', '```', '',
    '| 字段 | 含义 |', '| --- | --- |', '| 表格字段 | **强调** |', '',
  ].join('\n');
  const old = app.vault.getFileByPath('边界验证.md');
  const file = old ? (await app.vault.modify(old, source), old) : await app.vault.create('边界验证.md', source);
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: false } });
  const view = leaf.view, editor = view.editor;
  const select = ranges => editor.setSelections(ranges.map(([from, to])=>({ anchor: editor.offsetToPos(from), head: editor.offsetToPos(to) })));

  const a = source.indexOf('one'), b = source.indexOf('two');
  select([[a, a + 3], [b, b + 3]]);
  app.commands.executeCommandById('highlight-boost:apply-question');
  assert('multi-prose-ranges', visibleSource(editor.getValue()).includes('==🔴one== ==🟡gap== ==🔴two=='));
  assert('multi-prose-selection', editor.listSelections().length === 2);
  editor.undo(); assert('multi-prose-undo', editor.getValue() === source);
  editor.redo();

  let at = editor.getValue().indexOf('same();');
  select([[at, at + 4]]);
  app.commands.executeCommandById('highlight-boost:apply-important');
  at = editor.getValue().lastIndexOf('same();');
  select([[at, at + 4]]);
  app.commands.executeCommandById('highlight-boost:apply-question');
  const code = editor.getValue();
  const value1 = code.indexOf('value'), value2 = code.lastIndexOf('value');
  select([[value1, value1 + 5], [value2, value2 + 5]]);
  app.commands.executeCommandById('highlight-boost:apply-reference');
  assert('multi-code-ranges', (editor.getValue().match(/"quote":"value"/g) ?? []).length === 2);
  editor.undo(); assert('multi-code-undo', editor.getValue() === code);
  editor.redo();

  const beforeMixed = editor.getValue();
  const prose = beforeMixed.indexOf('跨区域正文'), codeWord = beforeMixed.lastIndexOf('second');
  select([[prose, prose + '跨区域正文'.length], [codeWord, codeWord + 6]]);
  app.commands.executeCommandById('highlight-boost:apply-action');
  assert('mixed-disjoint-selection', editor.getValue().includes('==🟢跨区域正文==') && editor.getValue().includes('"quote":"second"'));
  editor.undo(); assert('mixed-selection-undo', editor.getValue() === beforeMixed);
  editor.redo();

  const beforeContinuous = editor.getValue();
  const start = beforeContinuous.indexOf('跨区域正文'), end = beforeContinuous.lastIndexOf('second(value);') + 'second(value);'.length;
  select([[start, end]]);
  app.commands.executeCommandById('highlight-boost:apply-reference');
  const continuous = editor.getValue();
  assert('mixed-continuous-selection', continuous.includes('==🔵跨区域正文==') && continuous.includes('"quote":"same();"'));
  assert('mixed-continuous-keeps-fences', (continuous.match(/^```js$/gm) ?? []).length === 3 && continuous.includes('first(value);\nsecond(value);\nconst message = "";'));
  assert('mixed-continuous-keeps-one-selection', editor.listSelections().length === 1);
  editor.undo(); assert('mixed-continuous-single-undo', editor.getValue() === beforeContinuous);
  editor.redo(); assert('mixed-continuous-redo', editor.getValue() === continuous);
  editor.undo();

  at = editor.getValue().indexOf('表格字段');
  select([[at, at + 4]]);
  app.commands.executeCommandById('highlight-boost:apply-important');
  assert('table-structure-preserved', visibleSource(editor.getValue()).includes('| ==🟡表格字段== | **强调** |'));

  const beforeInput = editor.getValue();
  at = beforeInput.lastIndexOf('const message = "') + 'const message = "'.length;
  select([[at, at]]);
  editor.scrollIntoView({ from: editor.offsetToPos(at), to: editor.offsetToPos(at) }, true);
  editor.focus();
  await tick();
  editor.cm.contentDOM.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  editor.transaction({ changes: [{ from: editor.offsetToPos(at), text: '中' }] }, 'input.type.compose.start');
  await tick();
  assert('composition-preedit-visible', editor.getValue().includes('message = "中"'));
  editor.transaction({ changes: [{ from: editor.offsetToPos(at), to: editor.offsetToPos(at + 1), text: '中文' }] }, 'input.type.compose');
  editor.cm.contentDOM.dispatchEvent(new CompositionEvent('compositionend', { data: '中文', bubbles: true }));
  await tick();
  const afterInput = editor.getValue();
  assert('composition-commit-once', afterInput.includes('message = "中文"') && !afterInput.includes('中文中文'));
  assert('composition-anchor-preserved', [...view.containerEl.querySelectorAll('.hb-text')].filter(element=>element.textContent === 'value').length === 2);
  editor.undo(); assert('composition-single-undo', editor.getValue() === beforeInput, { before: beforeInput.slice(-160), after: editor.getValue().slice(-160) });
  editor.redo(); assert('composition-redo', editor.getValue() === afterInput);
  assert('composition-metadata-preserved', (afterInput.match(/%%hb:/g) ?? []).length === 3);

  await app.vault.modify(file, editor.getValue());
  await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'preview' } });
  app.workspace.setActiveLeaf(leaf, { focus: true });
  const scroller = view.containerEl.querySelector('.markdown-preview-view');
  scroller.scrollTop = 0; scroller.dispatchEvent(new Event('scroll'));
  for (let i = 0; i < 40 && scroller.querySelectorAll('pre .hb-text').length < 2; i++) await tick();
  const duplicates = [...scroller.querySelectorAll('pre code')].filter(code=>code.textContent === 'same();\n');
  assert('duplicate-reading-block-count', duplicates.length === 2);
  assert('duplicate-first-color', Boolean(duplicates[0].querySelector('.hb-yellow')));
  assert('duplicate-second-color', Boolean(duplicates[1].querySelector('.hb-red')));
  assert('duplicate-text-preserved', duplicates.every(code=>code.textContent === 'same();\n'));
  return checks;
})()
