# 项目目录

## 受 Git 管理的内容

| 路径 | 用途 |
| --- | --- |
| `src/` | 插件功能源码；`src/syntax/` 为内置语法接入，`upstream/` 保留合入来源 |
| `tests/` | 逻辑 / DOM 测试、实际宿主场景、样例与固定运行包 / 共存依赖配置 |
| `benchmarks/` | 核心性能样例 |
| `scripts/` | 构建辅助、测试库准备、宿主启动、性能报告和候选打包 |
| `docs/` | [统一导航](README.md)：用户说明、格式、开发、计划、验证和发布 |
| `docs/releases/` | 按版本维护的完整发布日志与准备状态 |
| `docs/verification/` | 已归档报告、原始 JSON、截图与 PDF；历史记录保留当时路径和版本 |
| `licenses/` | 合入源码和引擎依赖许可，随安装包保留 |
| `.github/` | 工程与实际宿主 CI、问题模板 |
| 根目录配置 | manifest、版本映射、依赖锁、构建与规范配置 |

## 本地产物

所有本地测试状态集中在 `.local/`，由 Git 忽略：

```text
.local/
  vaults/       default、compat、multiwindow、accessibility、frames、install、scale、responsive
  profiles/     对应测试库的隔离 Obsidian 用户配置
  cache/
    research/   固定运行包、第三方共存插件及下载的 CI 证据
    bench/      核心性能构建、CPU profile 与堆快照
  exports/pdf/  实际宿主 PDF 导出
dist/           按版本与源码提交划分的候选包
main.js         Obsidian 加载的构建入口，生成文件
```

路径集中定义在 `scripts/paths.cjs`，测试库准备和宿主启动共用同一配置。`node_modules/` 存放本地依赖。对外提交的是源码、配置与已归档证据；临时日志和本地测试状态留在 `.local/`。

目录整理保留了既有测试库与缓存，并迁移到上述位置。早期独立配置保存在 `.local/profiles/legacy/`，当前测试使用 `profiles/default/`。重新准备和启动时会写入当前测试库绝对路径。

根目录保留 Obsidian 发布所需的 `manifest.json`、`versions.json` 和构建入口配置。候选安装 ZIP、解压目录及 `candidate.json` 统一位于 `dist/highlight-boost-<版本>-<提交>/`。
