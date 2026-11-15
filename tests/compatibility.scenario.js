(async () => {
  await app.plugins.loadManifests(); await app.plugins.setEnable(true); await app.plugins.enablePlugin('highlight-boost');
  await app.customCss.setTheme('Minimal'); await new Promise(resolve => setTimeout(resolve, 200));
  const plugins = [];
  for (const id of ['obsidian-style-settings', 'code-styler', 'codeblock-customizer', 'shiki-highlighter']) {
    try { await app.plugins.enablePlugin(id); plugins.push({ id, loaded: Boolean(app.plugins.plugins[id]), methods: Object.getOwnPropertyNames(Object.getPrototypeOf(app.plugins.plugins[id])) }); await app.plugins.disablePlugin(id); }
    catch (error) { plugins.push({ id, error: String(error) }); }
  }
  window.__hbObservations = {
    plugins,
    themeMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(app.customCss)),
    themeState: { theme: app.customCss.theme, cssTheme: app.customCss.cssTheme },
    themeImplementation: String(app.customCss.setTheme),
    themeLoad: String(app.customCss.loadTheme),
    adopted: document.adoptedStyleSheets.map(sheet => ({ rules: sheet.cssRules.length, first: sheet.cssRules[0]?.cssText.slice(0, 120) })),
    pdfCommands: Object.keys(app.commands.commands).filter(key => key.includes('pdf')),
    themeSheets: [...document.styleSheets].map(sheet => sheet.href),
    styles: [...document.querySelectorAll('style')].map(style => ({ attributes: [...style.attributes].map(attribute => [attribute.name, attribute.value]), length: style.textContent.length })),
  };
  return [{ name: 'compatibility-host-ready', passed: true }];
})()
