const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const paths = require('./paths.cjs');
const output = path.join(paths.root, 'docs/verification/1.1.0/phase-1');
app.setPath('userData', path.join(paths.design, 'electron-profile'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');

app.whenReady().then(async () => {
  const errors = [];
  const checks = [];
  const layouts = [];
  const images = [];
  const window = new BrowserWindow({ show: false, width: 1280, height: 2400, useContentSize: true, webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  window.webContents.on('render-process-gone', (_event, details) => errors.push(details));
  const run = expression => window.webContents.executeJavaScript(expression);
  const assert = async (name, expression) => {
    const value = await run(expression); checks.push({ name, passed: value === true, actual: value });
  };
  await fs.mkdir(path.join(paths.design, 'screenshots'), { recursive: true });
  await fs.mkdir(path.join(output, 'images'), { recursive: true });
  await window.loadFile(path.join(paths.root, 'docs/design/1.1.0/index.html'));
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: 1280, height: 2400, deviceScaleFactor: 1, mobile: false });
  await run('window.addEventListener("error", e => { (window.__designErrors ??= []).push(e.message); });');
  const scenes = await run('window.designPreview.scenes');
  for (const theme of ['light', 'dark']) {
    for (const scene of scenes) {
      for (const width of [280, 360, 600, ...(scene === 'workspace' ? [1080] : [])]) {
        await run(`window.designPreview.set(${JSON.stringify({ theme, scene, width, search: '', filters: false })})`);
        await run('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const layout = await run(`(() => {
          const stage = document.getElementById('stage'), root = stage.getBoundingClientRect();
          const overflows = [...stage.querySelectorAll('*')].filter(el => {
            if (!el.getClientRects().length || el.closest('pre') && el.tagName !== 'PRE') return false;
            const r = el.getBoundingClientRect();
            return r.right > root.right + 1 || r.left < root.left - 1;
          }).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent.slice(0, 60) }));
          const unlabeled = [...stage.querySelectorAll('button, input, select, textarea')].filter(el => !el.disabled && !el.textContent.trim() && !el.getAttribute('aria-label') && !el.closest('label') && !document.querySelector('label[for="'+el.id+'"]')).map(el => el.outerHTML);
          return { overflows, unlabeled, rect: { x: Math.round(root.x), y: Math.round(root.y), width: Math.round(root.width), height: Math.ceil(root.height) } };
        })()`);
        layouts.push({ theme, scene, width, ...layout, passed: !layout.overflows.length && !layout.unlabeled.length });
        const name = `${scene}-${theme}-${width}.png`;
        const screenshot = await window.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...layout.rect, scale: 1 } });
        const buffer = Buffer.from(screenshot.data, 'base64');
        const size = nativeImage.createFromBuffer(buffer).getSize();
        if (size.width !== layout.rect.width || size.height !== layout.rect.height) errors.push({ scene, theme, width, expected: layout.rect, captured: size });
        await fs.writeFile(path.join(paths.design, 'screenshots', name), buffer);
        if (width === (scene === 'workspace' ? 1080 : scene === 'settings' || scene === 'code' ? 600 : 360)) {
          await fs.writeFile(path.join(output, 'images', name), buffer); images.push(name);
        }
      }
    }
  }
  for (const theme of ['light', 'dark']) {
    await run(`window.designPreview.set(${JSON.stringify({ theme, scene: 'workbench', width: 280, filters: true })})`);
    await assert(`${theme} · 展开筛选布局`, 'document.querySelector(".filters").scrollWidth <= document.querySelector(".filters").clientWidth + 1');
    await run('document.querySelector("[data-filter=语义]").value="疑问";document.querySelector("[data-filter=语义]").dispatchEvent(new Event("change",{bubbles:true}))');
    await assert(`${theme} · 筛选与标签同步`, 'document.getElementById("result-count").textContent === "1 条重点" && document.querySelector(".chip").textContent.includes("疑问")');
    await run('document.querySelector("[data-action=clear-filter]").click()');
    await assert(`${theme} · 清除筛选恢复结果`, 'document.getElementById("result-count").textContent === "2 条重点"');
    for (const toolbarKind of ['正文', '行内代码', '混合选区']) {
      await run(`window.designPreview.set(${JSON.stringify({ theme, scene: 'toolbar', width: 280, toolbarKind })})`);
      await assert(`${theme} · ${toolbarKind}工具栏`, 'document.querySelector(".toolbar").scrollWidth <= document.querySelector(".toolbar").clientWidth + 1 && !document.querySelector("[data-action=line-mode]")');
    }
  }
  await run('window.designPreview.set({scene:"workbench",width:360,search:"",filters:false});document.querySelector("[data-action=toggle-filters]").click()');
  await assert('展开筛选', 'document.querySelector(".filters") !== null');
  await run('document.querySelector(".search-box input").value="count";document.querySelector(".search-box input").dispatchEvent(new Event("input",{bubbles:true}))');
  await assert('搜索更新结果', 'document.getElementById("result-count").textContent === "1 条重点"');
  await run('document.querySelector("[data-action=annotate]").click();document.getElementById("annotation-input").value="阶段一批注示例";document.getElementById("annotation-input").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("[data-action=save-note]").click()');
  await assert('批注保存更新卡片', 'document.querySelector(".annotation-summary").textContent === "阶段一批注示例"');
  await run('document.querySelector("[data-action=annotate]").click();document.getElementById("annotation-input").value="取消的草稿";document.getElementById("annotation-input").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("[data-action=cancel-note]").click()');
  await assert('取消保留原批注', 'window.designPreview.get().savedNote === "阶段一批注示例"');
  await run('window.designPreview.set({scene:"toolbar",toolbarKind:"代码"});document.querySelector("[data-semantic=行动]").click()');
  await assert('语义操作更新当前标注', 'document.getElementById("current-semantic").textContent === "行动"');
  await run('document.querySelector("[data-action=line-mode]").click()');
  await assert('代码粒度切换', 'document.querySelector("[data-action=line-mode]").getAttribute("aria-pressed") === "true"');
  await run('document.querySelector("[data-action=collection-menu]").click();document.querySelector("[data-action=join-collection]").click()');
  await assert('加入集合反馈', 'window.designPreview.get().collection === true');
  await run('window.designPreview.set({scene:"code"});document.querySelector("[data-action=collapse-code]").click()');
  await assert('代码整块折叠', 'document.querySelector(".code-content").hidden === true');
  await run('document.querySelector(".local-collapse").open = true');
  await assert('代码局部展开', 'document.querySelector(".local-collapse").open === true');
  await run('window.designPreview.set({scene:"settings",numbers:true});document.getElementById("setting-numbers").click()');
  await assert('设置即时更新行号预览', 'document.getElementById("settings-preview").classList.contains("no-numbers")');
  await run('document.getElementById("setting-wrap").click()');
  await assert('设置即时更新换行预览', 'document.getElementById("settings-preview").classList.contains("wrapped")');
  await run('window.designPreview.set({scene:"excerpt",template:"markdown"});document.getElementById("template").value="quote";document.getElementById("template").dispatchEvent(new Event("change",{bubbles:true}))');
  await assert('摘录模板更新预览', 'document.getElementById("export-preview").textContent.startsWith("> ")');
  await run('window.designPreview.set({scene:"toolbar"});document.querySelector("[role=toolbar] button").focus();document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"End",bubbles:true}))');
  await assert('工具栏键盘导航', 'document.activeElement === [...document.querySelectorAll("[role=toolbar] button")].at(-1)');
  for (const theme of ['light', 'dark']) for (const empty of ['尚无标注', '无匹配', '空集合', '未打开笔记', '待定位', '读取失败', '处理中']) {
    await run(`window.designPreview.set(${JSON.stringify({ theme, scene: 'states', empty, width: 280 })})`);
    await assert(`${theme} · ${empty}`, 'Boolean(document.querySelector(".empty h3").textContent) && document.querySelector(".empty").scrollWidth <= document.querySelector(".empty").clientWidth + 1');
  }
  errors.push(...await run('window.__designErrors ?? []'));
  const report = { date: '2026-11-16', scope: '第一阶段设计样稿，未验证插件实现', runtime: { electron: process.versions.electron, chromium: process.versions.chrome }, layouts, checks, errors, images, passed: !errors.length && layouts.every(x => x.passed) && checks.every(x => x.passed) };
  await fs.writeFile(path.join(output, 'design-checks.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, layouts: layouts.length, checks: checks.length, images: images.length, failures: [...layouts.filter(x => !x.passed), ...checks.filter(x => !x.passed)], errors }, null, 2));
  window.destroy(); app.exit(report.passed ? 0 : 1);
}).catch(error => { console.error(error); app.exit(1); });
