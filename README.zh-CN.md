# Highlight Boost

用于 Obsidian 桌面端的标注插件，支持正文、行内代码与代码块高亮、批注、跨笔记检索和摘录导出。

[English](README.md) · [使用说明](docs/usage.md) · [更新日志](CHANGELOG.md)

支持 Windows、macOS 和 Linux，面向最新 Obsidian 桌面稳定版，当前为 **1.15.1**。

## 主要功能

- **正文与代码标注**：正文支持原生颜色和局部改色，行内代码按整段标记，代码块可标记整行或精确字符范围。支持多选区操作和单步撤销。
- **语义预设与批注**：重点、疑问、引用、行动四种预设可改名改色；批注随笔记保存，参与搜索和摘录。
- **高亮工作台**：查询当前笔记、目录、全库或集合，组合类型、语义、颜色、代码语言和路径筛选，点击卡片定位原文。
- **摘录导出**：预览并复制完整筛选结果，或生成带来源链接的摘录笔记。可选保留格式、纯文本、引用块和代码围栏。
- **代码展示**：代码块与声明了语言的行内代码支持离线着色。可选深浅配色、加载本地语法，使用行号、终端框、折叠及 diff 复制。
- **导入迁移**：预览并导入 Highlightr、Hilo 和围栏行强调，支持逐文件应用与恢复。

## 安装

通过插件目录安装（推荐）：
可在“设置 → 第三方插件”中搜索 **Highlight Boost** 安装。

手动安装：

1. 从 [GitHub Releases](https://github.com/danlingdan/highlight-boost/releases) 下载同一版本的 `main.js`、`manifest.json` 和 `styles.css`。
2. 将这三个文件放入笔记库的 `.obsidian/plugins/highlight-boost/` 目录。
3. 在“设置 → 第三方插件”中启用 **Highlight Boost**。

## 基本用法

1. 选中正文或代码，在选区面板中选择“重点”“疑问”“引用”或“行动”。命令面板和右键菜单提供同类操作。
2. 标记代码整行时，将面板切换为“整行”，或执行“代码行”命令。
3. 打开“当前笔记重点”或“高亮工作台”，浏览上下文、编辑批注、加入集合或生成摘录笔记。

快捷键、多窗口、PDF 导出及迁移步骤见[使用说明](docs/usage.md)。

## 升级到 1.1.0

更新后自动启用代码着色，继续使用已有笔记、批注、预设和集合。在“设置 → Highlight Boost → 代码展示”中选择代码主题和默认展示方式。[更新日志](CHANGELOG.md)

## 数据存储

正文颜色使用 Obsidian 原生高亮格式，正文批注使用 Markdown 脚注。语义、行内代码和代码块标注保存在笔记的 `%%…%%` 隐藏注释中；代码块标注位于围栏外，代码原文保持不变。预设与集合保存在插件配置中。

详细格式见[格式说明](docs/formats/README.md)。

全库检索枚举当前笔记库中的 Markdown 笔记，并在本机建立索引。复制操作将所选代码或摘录写入系统剪贴板；插件不读取剪贴板。内置语法数据随插件提供，着色时无需下载。

## 特别感谢

特别感谢 **Moritz Jung（mProjectsCode）与 Shiki Highlighter 贡献者**。内置语法模块直接合入其主题映射、展示配置和样式，并在本项目维护编辑器接入与生命周期。

感谢 **Pine Wu、Anthony Fu 与 Shiki 贡献者**，以及 **Tibor Schiemann（hippotastic）与 Expressive Code 贡献者**。完整来源和许可见[第三方声明](THIRD_PARTY_NOTICES.md)。

## 本地开发

需要 Node.js 24 与 pnpm 11.25.0：

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm prepare:vault
```

构建、实际宿主测试和目录约定见[开发说明](docs/development.md)、[项目目录](docs/structure.md)和[贡献说明](CONTRIBUTING.md)。

[反馈问题](https://github.com/danlingdan/highlight-boost/issues) · [文档导航](docs/README.md) · [MIT License](LICENSE)
