# 贡献说明

## 报告问题

在 [Issues](https://github.com/danlingdan/highlight-boost/issues) 提供插件版本、Obsidian 桌面版本、操作系统、语法提供者，以及使用中的主题和相关插件。写出最小复现笔记、操作步骤、预期和实际结果；截图可补充选区、代码外框或窗口状态。

反馈代码显示问题时，注明 Source、Live Preview 或阅读视图，并保留复现所需的围栏参数和标注注释。分享前替换笔记中的个人内容。

## 本地开发

使用 Node.js 24 与 pnpm 11.25.0：

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm prepare:runtime
pnpm prepare:vault
```

源码在 `src/`，测试在 `tests/`；本地测试库与缓存统一放在 `.local/`。功能和接口说明见[开发文档](docs/development.md)，路径分工见[项目目录](docs/structure.md)。

## 提交修改

- 一次提交表达一个清晰改动，说明触发场景、结果和验证方式。
- 提交信息使用中文，格式为 `类型(范围): 描述`，例如 `fix(代码标注): 保留首尾空行`。
- 代码注释、文档和交互文案直接说明行为。新增界面文本同时提供中文与 English。
- 支持最新 Obsidian 桌面稳定版，采用当前 API；SDK 与实际宿主版本分别核验。
- 修改标注格式时同步更新格式说明，并验证旧数据的读取与迁移。
- 运行适合改动范围的测试；涉及真实编辑器、窗口或渲染的修改，通过隔离宿主验证。

## 发布说明

每个正式版本维护独立发布日志，记录实际功能变化、使用影响和验证来源。日志写法与发布流程见[发布维护](docs/releases/README.md)。第三方来源与许可随相关修改更新，详见[特别感谢与来源](THIRD_PARTY_NOTICES.md)。
