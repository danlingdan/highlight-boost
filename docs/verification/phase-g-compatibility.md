# 主题、外部插件与多窗口验收

2026-11-15，Windows，Obsidian 1.15.1，Electron 43.8.9。通过项目独立测试库运行实际宿主。

## 主题与插件

九组配置共 108 个视图单元、835 项检查通过，页面错误为零。每组覆盖中文 / 英文 × 深色 / 浅色 × Source / Live Preview / 阅读视图。检查正文、行内代码、C / Python / ASM 标注、批注、长行、折叠、纯代码复制及原文一致性。

| 配置 | 检查数 | 原始结果 |
| --- | ---: | --- |
| 默认主题，原生语法 | 89 | [JSON](compatibility/default-native.json) |
| 默认主题，内置 Shiki | 90 | [JSON](compatibility/default-internal.json) |
| Minimal，原生语法 | 94 | [JSON](compatibility/minimal-native.json) |
| Minimal，内置 Shiki | 94 | [JSON](compatibility/minimal-internal.json) |
| AnuPpuccin，原生语法 | 94 | [JSON](compatibility/anuppuccin-native.json) |
| AnuPpuccin，内置 Shiki | 94 | [JSON](compatibility/anuppuccin-internal.json) |
| Minimal + Style Settings + Code Styler | 95 | [JSON](compatibility/code-styler.json) |
| AnuPpuccin + Style Settings + Codeblock Customizer | 95 | [JSON](compatibility/customizer.json) |
| 默认主题 + 外部 Shiki 0.8.0 | 90 | [JSON](compatibility/external-shiki.json) |

主题加载检查直接核对实际 CSS；Style Settings 修改真实主题变量并核对计算样式变化。Code Styler 与 Customizer 的逻辑行、行号节点和原有事件被保留。三个主题各保存中英文深浅色截图，共六张，已逐张检查字符、布局、标注与批注。

版本与 SHA-256 固定在 [依赖清单](../../tests/compatibility-assets.json)，配置在 [场景清单](../../tests/compatibility-cases.json)。来源：[Minimal 9.1.4](https://github.com/kepano/obsidian-minimal/releases/tag/9.1.4)、[AnuPpuccin v1.5.0](https://github.com/AnubisNekhet/AnuPpuccin/releases/tag/v1.5.0)、[Style Settings 1.0.9](https://github.com/community-archive/obsidian-style-settings/releases/tag/1.0.9)、[Code Styler 1.1.7](https://github.com/mayurankv/Obsidian-Code-Styler/releases/tag/1.1.7)、[Codeblock Customizer 1.4.7](https://github.com/mugiwara85/CodeblockCustomizer/releases/tag/1.4.7)、[Shiki 0.8.0](https://github.com/mProjectsCode/obsidian-shiki-plugin/releases/tag/0.8.0)。

内置引擎另外验证首尾空行、行尾空白、制表符和空代码块，渲染文本与复制内容保持原样。外部 Shiki 使用其发布版本；共存矩阵检查共同样例，首尾空白测试归属内置引擎专项。

重跑：`pnpm build` → `node scripts/prepare-compatibility.mjs` → `node scripts/test-compatibility.mjs`。

## 多窗口

[38 项实际 Popout 检查](host-multiwindow-results.json)通过。原生与内置 Shiki 各创建正文窗口和工作台窗口，检查三种对象的标注、阅读渲染、Shiki 样式与 token、跨窗口跳转、关闭、重新打开与数据恢复。

同一文件同时保留主窗口副本，工作台操作优先使用对应来源视图。关闭弹出窗口后检查编辑器映射和 Shiki 文档运行时已释放。

重跑：`pnpm build` → `pnpm prepare:vault` → `node scripts/test-host.mjs --mode=multiwindow`。
