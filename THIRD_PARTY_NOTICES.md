# 第三方来源与特别致谢

特别感谢 **Moritz Jung（mProjectsCode）** 及 [Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin) 的贡献者。HB 的内置语法模块在其 Obsidian 主题映射、Expressive Code 配置和展示样式基础上开发，并将编辑器着色与 HB 的文档解析、选区和组合输入生命周期整合。

特别感谢 **Pine Wu、Anthony Fu** 及 [Shiki](https://github.com/shikijs/shiki) 的贡献者提供语法着色引擎；感谢 **Tibor Schiemann（hippotastic）** 及 [Expressive Code](https://github.com/expressive-code/expressive-code) 的贡献者提供代码展示、复制和标记能力。

## 直接合入的源码

- 来源：`mProjectsCode/obsidian-shiki-plugin`，0.8.0，提交 `5268557c6874439ef9fbf4a48e2ae223f54e09de`。
- 目录：`src/syntax/upstream/`。
- 文件：`Config.ts`、`ECTheme.ts`、`ObsidianTheme.ts`、`styles.css`。
- 许可证：MIT；原作者版权声明保存在 [Shiki-Highlighter-MIT.txt](licenses/Shiki-Highlighter-MIT.txt)。
- 本地改动：移除重复副作用导入、调整主题占位颜色恢复；保留文件名注释、diff 前缀和终端复制注释，展示状态由 HB 管理。其余接入与生命周期实现位于 `src/syntax/`。

## 引擎依赖

- Shiki 3.23.0，MIT，[许可证](licenses/Shiki-MIT.txt)。
- Expressive Code 0.41.7 及同版展示插件，MIT，[许可证](licenses/Expressive-Code-MIT.txt)。

完整依赖版本由 `package.json` 与 `pnpm-lock.yaml` 记录。HB 的 MIT 许可证与上述来源的版权及许可证共同保留。
