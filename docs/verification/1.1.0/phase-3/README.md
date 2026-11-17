# 1.1.0 第三阶段：组件与流程融合

日期：2026-11-17。

结果：工程检查通过，34 个测试文件 / 225 项测试通过；33 组宿主场景 / 1014 项检查通过，功能检查全部通过。原生布局通知另行记录。融合专项为 50 项。

## 实现与核对

| 要求 | 实现 | 验证入口 |
| --- | --- | --- |
| 共享视觉 | 主题变量、间距、图标、按钮、焦点与容器布局 | `fusion` 的 280 / 360 / 600 px 深浅主题检查与截图 |
| 统一工作台 | 四种范围导航、来源、搜索、折叠筛选、可移除条件、分组、分页与空状态 | `fusion`、`phase-e`、`pagination` |
| 条目动作 | 定位、批注、复制常驻；语义、颜色、集合、移除与重新绑定进入更多菜单 | `selection`、`phase-d`、`notes`、`phase-e` |
| 选区后续操作 | 语义与颜色状态、折叠色板、批注和集合入口；重叠标注明确选择目标 | `selection`、`fusion` |
| 共享批注 | 原文与来源、多行草稿、保存 / 取消、冲突时保留输入并刷新目标 | `notes`、`fusion`、`multiwindow` |
| 集合 | 工具栏与卡片共用选择和创建；集合范围内管理与检索 | `fusion`、`phase-e`、`phase-e-restart` |
| 完整结果摘录 | 完整查询快照、条件与数量、四种模板、预览、复制和生成后打开；来源变化时刷新或保留快照 | `fusion`、`phase-e`、`pagination` |
| 代码组件衔接 | 一个复制主按钮和 diff 菜单；标注数量进入当前块结果，代码批注进入共享编辑器 | `display`、`unified`、`fusion` |
| 设置 | 四组入口；完整主题、自定义主题 / 语法、排除语言、框架与即时真实预览 | `settings`、`fusion`、`unified` |
| 迁移结果 | 按本次成功文件临时查看，不创建持久集合 | `migration`、`migration-restart` |
| 交互状态 | 保留输入、插入点、展开、查询和滚动；返回触发位置；窗口各自保留来源与查询 | `fusion`、`multiwindow`、`multiwindow-restart`、`multiwindow-actions` |
| 生命周期 | 关闭弹窗、窗口和插件时释放界面引用、监听器与预览定时器 | `lifecycle`、`lifecycle-shiki`、`multiwindow` |

工作台卡片、共享动作、摘录面板和设置分别拆到 `src/workbench-card.ts`、`src/item-actions.ts`、`src/excerpt-modal.ts`、`src/settings-view.ts`，公共按钮、菜单和弹窗焦点在 `src/ui.ts`。

## 验证材料

[摘要](summary.json)记录工程检查、宿主报告、源码和构建摘要；[完成核对](completion-audit.json)逐项关联本阶段要求与证据。原始宿主 JSON 和实际 Obsidian 截图在本目录。

工程检查：`pnpm check`。融合专项：`pnpm test:fusion`。完整宿主回归：`node scripts/test-host.mjs`。独立窗口使用 `multiwindow` 测试库，依次运行 `--mode=multiwindow`、`--mode=multiwindow-restart`、`--mode=multiwindow-actions`。

宿主为 Obsidian 1.15.1 / Electron 43.8.9。单元测试继续覆盖全部内置语言、别名与主题，统一代码专项保留 176 项检查。

第一阶段样稿保持原样。版本号与发布文件在后续发布准备阶段更新。

## 原生分栏对照

无界面测试运行包在“主区新建分栏后关闭多个窗口”的组合操作中触发 `ResizeObserver` 通知错误。禁用插件后同样复现，原始失败报告与复现脚本单独保存在 [diagnostics](diagnostics/)。组合工作台、批注撤销与窗口关闭的快速操作也出现同类通知，失败报告和脚本一并保留。独立窗口批注、撤销 / 重做与关闭另有专项验证；该专项的原生布局通知保存在报告的 `observations.nativeLayoutNotifications`，其余异常继续按失败处理。诊断不计入通过场景；这些组合操作在第四阶段做真实桌面复核。

第四阶段继续完成平台、主题 / 插件共存、完整键盘与 PDF 矩阵；第五阶段集中测试和优化性能。
