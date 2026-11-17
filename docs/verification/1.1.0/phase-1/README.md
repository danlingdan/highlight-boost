# 1.1.0 第一阶段验证记录

日期：2026-11-16。范围：交互与视觉定稿、能力对照及接入合同。

## 交付核对

| 计划要求 | 交付与证据 | 结果 |
| --- | --- | --- |
| 工具栏样稿 | [预览](../../../design/1.1.0/index.html)的选区工具栏，含正文、行内代码、代码与混合选区 | 已完成 |
| 工作台窄版 / 宽版 | 侧栏场景和正文并排场景，280 / 360 / 600 / 1080 px | 已完成 |
| 代码组件 | 代码框、终端框、diff、复制菜单、整块和局部折叠、批注摘要 | 已完成 |
| 批注与摘录 | 原文摘要、保存 / 取消、模板切换、来源预览 | 已完成 |
| 设置预览 | 语义编辑、行号 / 换行即时预览、框架、主题与自定义资源入口 | 已完成 |
| 深浅色与组件状态 | 八类场景各两张截图；空状态、待定位、失败、处理中与键盘焦点规则 | 已完成 |
| 长标题 / 路径 / 代码 | 使用真实结构的长路径和长文件名，代码独立滚动；50 组布局检查 | 已完成 |
| 主题变量、入口和状态 | [界面规范](../../../design/1.1.0/interface.md) | 已完成 |
| 普通 / 专用块接管 | [代码接入规范](../../../design/1.1.0/code-integration.md)第 1、2 节 | 已完成 |
| 展示参数与升级表 | 同规范第 3、4 节，明确 schema 3 和逐字段保留 | 已完成 |
| Shiki 能力矩阵与样例 | [30 项能力矩阵](../../../design/1.1.0/code-capabilities.md)、[C01—C30 样例](../../../design/1.1.0/code-fixtures.md) | 已完成 |

## 代码基线

运行 `node scripts/inspect-phase-one.mjs`，从固定上游提交读取 11 个源文件，缓存于 `paths.research`。首次运行下载源码，后续直接使用缓存。直接调用当前 `SyntaxEngine`，没有启动或改动用户笔记库。

- [sources.json](sources.json)：固定提交、源 URL、SHA-256、上游完整设置和本地引擎版本。
- [code-baseline.json](code-baseline.json)：当前源码提交与文件摘要、235 个规范语言、97 个别名、65 个主题，以及 15 组实际渲染 DOM、文本和复制值。
- [baseline-checks.json](baseline-checks.json)：9 项基线断言全部通过。

全部 332 个语言名已生成 token；15 个渲染样例无异常。基线断言覆盖普通代码 / Unicode / 空白复制、三种行标记、标签、文本与正则、局部折叠、终端框和行号标题。

差距已进入实施合同：主题选择、自定义主题 / 语言、行内语法、排除语言需要补齐；特殊字符与中文语言名改用普通代码后处理；ANSI 复制改为保留原始转义。基线没有将目录枚举等同于全部语法语义通过，语义、视图与共存验证按 C01—C30 在后续阶段执行。

## 样稿检查

运行隐藏 Electron 与 CDP，加载本地设计页面，无外部网页、字体或脚本依赖。

```powershell
$env:ELECTRON_RUN_AS_NODE=$null
node_modules/.bin/electron.cmd scripts/verify-phase-one.cjs
```

[design-checks.json](design-checks.json)记录运行包版本、布局、可读控件名称、交互结果和截图索引。检查包括八类场景 × 深浅主题 × 三种宽度，以及两组 1080 px 宽工作台；额外检查展开筛选、筛选标签同步、各类选区、批注、语义、集合、折叠、设置、模板、键盘和七种状态。

截图通过 CDP 捕获完整组件，并核对实际图片尺寸，避免长设置页截断。50 组布局、39 项交互与状态检查全部通过，页面错误为零。50 张完整布局图位于 `paths.design/screenshots`，16 张代表图归档到本目录。

人工查看了宽工作台、深色设置、工具栏、代码、批注和摘录截图，检查文字换行、长路径、语义对比、预览边界及底部完整性。代码内容在内部区域滚动，不撑开工作台。

这些结果对应设计样稿和 1.0.1 引擎基线。插件统一代码能力、schema 3 迁移和完整流程在第二、三阶段实现，实际宿主与 PDF 在第四阶段验收。

## 样稿截图

| 场景 | 浅色 | 深色 |
| --- | --- | --- |
| 工作台侧栏 | [360 px](images/workbench-light-360.png) | [360 px](images/workbench-dark-360.png) |
| 宽工作台 | [1080 px](images/workspace-light-1080.png) | [1080 px](images/workspace-dark-1080.png) |
| 工具栏 | [360 px](images/toolbar-light-360.png) | [360 px](images/toolbar-dark-360.png) |
| 代码组件 | [600 px](images/code-light-600.png) | [600 px](images/code-dark-600.png) |
| 批注面板 | [360 px](images/annotation-light-360.png) | [360 px](images/annotation-dark-360.png) |
| 摘录面板 | [360 px](images/excerpt-light-360.png) | [360 px](images/excerpt-dark-360.png) |
| 设置预览 | [600 px](images/settings-light-600.png) | [600 px](images/settings-dark-600.png) |
| 组件状态 | [360 px](images/states-light-360.png) | [360 px](images/states-dark-360.png) |
