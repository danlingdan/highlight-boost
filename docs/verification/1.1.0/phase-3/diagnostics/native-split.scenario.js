(async () => {
  const checks = [], errors = []; window.__hbChecks = checks;
  await app.plugins.disablePlugin('highlight-boost');
  const tick = () => new Promise(resolve => setTimeout(resolve, 100));
  const until = async predicate => { for(let i=0;i<80&&!predicate();i++)await tick();return predicate(); };
  const assert = (name, value) => { if(!value)throw new Error(name);checks.push({name,passed:true}); };
  const observe = targetWindow => targetWindow.addEventListener('error', event => errors.push({message:event.message,time:performance.now()}));
  observe(window);
  const path = '原生窗口基线.md', text = '# Windows\n\n==window prose== and `inline_window()`\n\n```js\nconst value = 1;\nconsole.log(value);\n```\n';
  let file=app.vault.getFileByPath(path);if(file)await app.vault.modify(file,text);else file=await app.vault.create(path,text);
  for(let i=0;i<2;i++){
    const leaf=app.workspace.getLeaf('tab');await leaf.openFile(file);app.workspace.setActiveLeaf(leaf,{focus:true});
    await leaf.setViewState({type:'markdown',state:{file:path,mode:'source',source:true}});
    const popup=app.workspace.moveLeafToPopout(leaf,{width:1000,height:800});
    assert('baseline-source-window',await until(()=>popup.doc?.body&&popup.win.__hbPopoutReady));observe(popup.win);
    await leaf.setViewState({type:'markdown',state:{file:path,mode:'preview'}});await tick();
    await leaf.setViewState({type:'markdown',state:{file:path,mode:'source',source:true}});
    const second=app.workspace.getRightLeaf(false);await second.openFile(file);
    const panel=app.workspace.moveLeafToPopout(second,{width:500,height:800});
    assert('baseline-second-window',await until(()=>panel.doc?.body&&panel.win.__hbPopoutReady));observe(panel.win);
    const main=app.workspace.getLeaf('tab');await main.openFile(file);
    const split=app.workspace.createLeafBySplit(main,'vertical');await split.openFile(file);await tick();split.detach();
    const panelWindow=panel.win,sourceWindow=popup.win;panelWindow.close();sourceWindow.close();
    assert('baseline-windows-closed',await until(()=>panelWindow.closed&&sourceWindow.closed));
  }
  const before=errors.length;await new Promise(resolve=>setTimeout(resolve,1000));
  window.__hbObservations={pluginEnabled:Boolean(app.plugins.plugins['highlight-boost']),errors,afterQuietPeriod:errors.length-before};
  assert('baseline-plugin-disabled',!app.plugins.plugins['highlight-boost']);
  assert('baseline-no-layout-errors',errors.length===0);await app.workspace.requestSaveLayout.run();return checks;
})()
