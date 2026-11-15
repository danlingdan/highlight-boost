# 阶段 G：桌面兼容与发布验收矩阵

完成日期：2026-11-15。验收源码为 `dc9941b4fffad2146eb0aa500c8fb859e8e292a0`，实际宿主为 Obsidian **1.15.1 / Electron 43.8.9**，SDK 为 **1.14.4**，见[版本核验](version-check.json)。

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| Windows / macOS / Linux 实际宿主 | 三平台均通过，每平台 36 个场景、1112 项检查，错误为零 | [最终 CI](https://github.com/danlingdan/highlight-boost/actions/runs/43718754693)、[Windows](platforms/windows.json)、[macOS](platforms/macos.json)、[Linux](platforms/ubuntu.json) |
| 三视图及编辑、索引、迁移回归 | Source / Live Preview / 阅读覆盖正文、行内代码、代码块；基础回归每平台 719 项 | 平台摘要逐场景列出结果摘要与 SHA-256 |
| 工程检查 | 200 项逻辑 / DOM / 引擎测试、500 组解析差分，lint、类型检查和构建通过；Check 工作流覆盖三平台 | [Check 工作流](https://github.com/danlingdan/highlight-boost/actions/workflows/check.yml) |
| 默认 / Minimal / AnuPpuccin | 中英文、深浅色、三视图的扩展共存矩阵共 120 个单元、970 项检查通过 | [主题与插件矩阵](phase-g-compatibility.md) |
| 外部 Shiki、Code Styler、Codeblock Customizer、Style Settings、Highlight Extractor | 固定版本实际安装，标注、复制、展示、摘录及原文检查通过 | [共存版本及原始结果](phase-g-compatibility.md) |
| 多窗口 | 原生 / 内置 Shiki 的实际窗口创建、移动、关闭、恢复及复制通过，47 项；宿主独立进程恢复 12 项 | [布局与生命周期](phase-g-layout.md) |
| PDF、键盘、AX、对比度、组合输入 | 专项 34 项通过，实际 PDF 已渲染检查 | [辅助技术与 PDF](phase-g-accessibility.md) |
| ResizeObserver | 工具栏统一测量并分离布局读写；最终三平台保留全部错误收集，通知为零 | [布局专项](phase-g-layout.md) |
| 性能与回收 | 五轮统一测量完成，含解析、启用、渲染、索引、侧栏、内存及实际绘制帧 | [第一轮](phase-g-performance.md) · [第二轮](phase-g-performance-round2.md) · [第三轮](phase-g-performance-round3.md) · [第四轮](phase-g-performance-round4.md) · [第五轮](phase-g-performance-round5.md) |
| 发布候选与全新安装 | 每平台 ZIP 摘要通过；全新安装 25 项、独立进程重启 18 项通过 | [候选与安装](phase-g-candidate.md)及各平台摘要 |
| P0 / P1 | P01—P14 实现、验证及用户说明逐项对应 | [需求映射](phase-g-requirements.md)、[桌面操作说明](../usage.md) |

三平台 CI 均运行完整基础回归，以及窗口、辅助技术、绘制帧、候选安装和默认主题原生 / 内置着色共存专项。Minimal、AnuPpuccin 和其余第三方组合的 120 单元扩展矩阵在 Windows 实际宿主运行；具体组合与版本见共存报告。

阶段 G 的 G01—G09 均已完成，见[收尾清单](../plan/10-阶段G收尾清单.md)。阶段 H 负责正式 tag、GitHub Release 和社区提交。支持范围为最新 Obsidian 桌面稳定版；正式版发布前不承诺移动端支持。
