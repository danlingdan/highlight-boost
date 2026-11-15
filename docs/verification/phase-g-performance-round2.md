# 阶段 G：共享编辑器文档与最新稳定版验收

日期：2026-11-15。版本策略调整为仅承诺最新 Obsidian 桌面稳定版，本轮使用 **Obsidian 1.15.1 / Electron 43.8.9**。

## 版本策略

[官方插件提交要求](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)要求设置合适的 `minAppVersion`，并明确允许使用最新稳定版版本号。官方没有要求插件支持旧版本。根据[官方更新记录](https://obsidian.md/changelog/)，当前最新桌面稳定版为 1.15.1，发布于 2026-11-12。

`manifest.json` 与 `versions.json` 同步声明 1.15.1；项目约定和验收矩阵采用同一基线。SDK 独立按 npm 发布核验，当前最新为 1.14.4。新实现直接使用当前 API，删除旧版兼容验收任务。

`pnpm prepare:runtime` 下载官方固定版本运行包并校验 SHA256，配置见 [runtime.json](../../tests/runtime.json)。运行包保存在项目缓存中；启动器核对实际应用和 Electron 版本。当前资产 SHA256：`3f6808c14204063349d5a7a59b9f2f637958063fa85eeebe767e13e06d314c0f`。

## 定位与实现

CDP CPU 采样显示，标注操作会从索引通知、事务提交、编辑器变更和配置保存四条路径刷新侧栏，分别重复构建摘录上下文。编辑器装饰、标注计划与索引也各自解析相同源文。

本轮新增按不可变 CodeMirror 文档对象保存的 `DocumentSnapshot`，按需生成结构、条目和摘录上下文。装饰、元数据折叠、选区面板、内置着色、标注计划、索引与侧栏共享结果。选区移动和重配置复用快照，内容变化产生新快照；缓存采用 WeakMap，插件卸载时清空。

普通笔记摘录复用已有 GFM AST；表格继续使用既有块 ID 解析规则。未打开笔记的摘录上下文仍按单次刷新创建。

## 同环境前后对照

前测使用上一轮插件构建，后测使用本轮构建；两者均在 1.15.1 / 43.8.9 上运行相同合成样例。第一轮 1.15.0 的历史数据独立保留。

| 指标 | 前测 p50 / p95 | 后测 p50 / p95 |
| --- | --- | --- |
| 200 KiB 标注至侧栏更新，5 次 | 1749 / 1946 ms | 218 / 294 ms |
| 5000 行代码选区事务，5 次 | 11.5 / 13.2 ms | 6.8 / 10.1 ms |
| 500 行代码阅读渲染，7 次 | 28 / 283 ms | 34 / 324 ms |
| 切换宿主着色，3 次 | 123 / 137 ms | 133 / 159 ms |
| 切换内置 Shiki，3 次 | 178 / 189 ms | 243 / 256 ms |

标注至侧栏中位耗时减少约 **87.6%**，p95 减少约 **84.9%**。首个样本为 294 ms，其余为 214—227 ms，250 ms 的 p95 目标尚未完成。代码阅读与着色切换的尾延迟继续纳入后续测量。本轮样本保留冷启动影响，p95 使用排序后最近秩；小样本结果按原始数组解读。

前测 CPU 采样中的解析累计占用约 6175 ms / 9389 ms。采样用于定位调用栈，开启 Profiler 的运行与正式计时分开保存。

- [正式前测](performance-round2/host-before.json) · [正式后测](performance-round2/host-after.json)
- [共享快照中间测量](performance-round2/host-first-pass.json)
- [前测 CPU 摘要](performance-round2/profile-before.json) · [开启采样的宿主结果](performance-round2/host-profile-before.json)
- [500 组解析差分](performance-round2/parsing-differential.json)

## 正确性与后续

188 项逻辑、DOM 与引擎测试通过；500 组解析差分与上一轮所有 `ParsedDocument` 字段一致。Obsidian 1.15.1 上二十五组宿主场景、638 项功能检查全部通过；性能场景另有 5 项正确性检查通过，页面错误为空。截图场景使用软件离屏窗口和 CDP，选区画面已核对；性能场景使用普通隐藏窗口。完整回归记录见[桌面验收矩阵](phase-g-matrix.md)。

下一步继续处理标注尾延迟、真实磁盘索引与大量结果展示，完成主题和插件共存、多窗口、PDF 与可访问性验收。阶段 G 按完整矩阵推进。
