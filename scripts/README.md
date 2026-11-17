# 脚本导航

从项目根目录执行，公共本地路径由 `paths.cjs` 管理。

| 分组 | 入口 | 用途 |
| --- | --- | --- |
| 运行包 | `prepare-runtime.mjs`、`obsidian-runtime.cjs` | 下载、摘要核对并定位固定版本的实际 Obsidian |
| 测试库 | `prepare-vault.mjs`、`prepare-scale-vault.mjs` | 准备默认 / 专项测试库与规模样例 |
| 共存依赖 | `prepare-shiki.mjs`、`prepare-compatibility.mjs` | 准备固定版本第三方插件和主题 |
| 实际宿主 | `test-host.mjs`、`host-main.cjs` | 启动隔离 Electron，执行 `tests/*.scenario.js` |
| 界面融合 | `pnpm test:fusion` | 工具栏、批注冲突、集合、完整查询摘录、设置预览及 280 / 360 / 600 px 深浅布局 |
| 统一代码 | `pnpm test:unified` | schema 3 升级、全代码路径、断网加载、本地资源重载及容器 / 嵌入来源 |
| 键盘完整流程 | `pnpm test:journey` | Chromium 原生按键完成标注、批注、集合、检索定位、菜单取消与摘录 |
| 专项编排 | `test-shiki-live.mjs`、`test-compatibility.mjs` | 上游版本对照、主题与插件组合矩阵 |
| CI | `prepare-host-ci.mjs`、`report-host-matrix.mjs` | 清理本轮产物，汇总三平台证据和候选摘要 |
| 性能 | `benchmark-core.mjs`、`verify-parsing.mjs` | 核心性能样例、固定种子解析差分 |
| 分析 | `report-performance.mjs`、`report-memory.mjs`、`report-sidebar-profile.mjs` | 性能对照、堆快照和 CPU profile 报告 |
| 1.1.0 设计 | `inspect-phase-one.mjs`、`verify-phase-one.cjs` | 固定上游源码与代码能力基线、深浅主题样稿布局及交互检查 |
| 打包 | `package-candidate.mjs`、`zip-candidate.ps1` | 根据已提交源码生成候选 ZIP 并解压核对文件摘要 |
| 安装准备 | `prepare-install.mjs` | 将已核对候选复制到全新的安装测试库 |

常用命令在 `package.json` 和[开发说明](../docs/development.md)。候选包路径为 `dist/highlight-boost-<版本>-<提交>/`；发布日志按[发布维护](../docs/releases/README.md)独立编写。

实际桌面绘制验证设置 `HB_DESKTOP=1`；多窗口、键盘和 PDF 使用独立测试库。三平台新一轮证据使用 `node scripts/report-host-matrix.mjs --run=<运行ID> --phase-four` 归档到 `docs/verification/1.1.0/phase-4/platforms/`。
