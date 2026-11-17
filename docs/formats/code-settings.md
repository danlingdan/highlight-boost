# 代码资源配置

插件配置使用 `schemaVersion: 3`。首次加载时自动移除旧 `syntaxProvider` 字段并启用代码着色。语义预设、集合和展示设置继续读取已有值，笔记标注与批注继续使用 v1 格式。

`codeDisplay` 通过 `showTitle`、`showLineNumbers`、`startLine`、`numberFont`、`collapsible`、`collapseByDefault`、`wrap`、`diff` 和 `frame` 保存展示设置。`frame` 的取值为 `auto`、`code`、`terminal` 和 `none`，默认为 `auto`。围栏 `frame` 可覆盖全局值。

`codeSyntax` 的默认配置如下。

```json
{
  "lightTheme": "obsidian-theme",
  "darkTheme": "obsidian-theme",
  "preferThemeColors": true,
  "inlineHighlighting": true,
  "customThemeFolder": "",
  "customLanguageFolder": "",
  "disabledLanguages": []
}
```

深浅主题分别使用内置主题 ID；`obsidian-theme` 跟随 Obsidian 配色。自定义主题使用 `custom:<库内相对 JSON 路径>` 作为稳定 ID，自定义语言使用 TextMate JSON 的 name、aliases、scopeName 与 patterns。

资源目录均相对于当前笔记库，读取其中的 JSON 文件。主题文件支持 colors、tokenColors 或 settings；语法保留嵌入依赖和别名。缺失依赖和无效文件显示对应路径，其余资源继续加载。编辑本地文件后执行“重新加载主题与语法”。

`inlineHighlighting` 控制 `{ts} code` 等显式语言声明的行内着色。源码保留声明，实时预览展示态与阅读视图只显示代码；已有整段标注和批注继续使用原范围。

`disabledLanguages` 按原始名称与规范语言匹配，`js` 与 `javascript` 具有相同归属。Mermaid、查询和其他专用块保留原处理器。未知的普通语言以纯文本代码展示。
