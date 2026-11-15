# P0 / P1 完成映射

需求编号对应 [产品范围](../plan/02-产品范围与需求.md)。每项列出实现入口、行为验证和用户说明；统一宿主回归由 Desktop host 工作流执行。

| 编号 | 实现入口 | 验证入口 | 用户说明 |
| --- | --- | --- | --- |
| P01 正文颜色 | `editing.ts` | [正文验收](prose-semantic.md)、`core.test.ts` | [正文格式](../formats/prose-v1.md) |
| P02 精确选区、多选区 | `editing.ts`、`item-editing.ts`、`history.ts` | `mixed-selection.test.ts`、`history.test.ts`、[桌面编辑](phase-d.md) | [操作说明](../usage.md) |
| P03 代码整行 | `editing.ts`、`rendering.ts` | `core.test.ts`、`host.scenario.js`、`advanced.scenario.js` | [代码展示](../formats/code-display.md) |
| P04 代码文本范围 | `anchors.ts`、`rendering.ts` | `rendering.test.ts`、`item-editing.test.ts`、`advanced.scenario.js` | [格式入口](../formats/README.md) |
| P05 语法协作 | `syntax/`、`code-rows.ts` | [内置语法验收](phase-a-iteration-4.md)、[共存矩阵](phase-g-compatibility.md)、`frames.scenario.js` | [操作说明](../usage.md)、[第三方致谢](../../THIRD_PARTY_NOTICES.md) |
| P06 语义预设 | `settings.ts`、`domain.ts` | `settings.test.ts`、`settings.scenario.js`、[正文语义](prose-semantic.md) | [操作说明](../usage.md) |
| P07 当前笔记与跳转 | `workbench.ts`、`main.ts` | [桌面编辑](phase-d.md)、[多窗口](phase-g-compatibility.md)、`multiwindow.scenario.js` | [操作说明](../usage.md) |
| P08 摘录、复制 | `excerpts.ts`、`code-display.ts` | `excerpts.test.ts`、[工作台验收](phase-e.md)、`embedded-syntax.scenario.js` | [操作说明](../usage.md) |
| P09 桌面入口 | `main.ts`、`selection-toolbar.ts` | [选区面板](selection-toolbar.md)、[键盘专项](phase-g-accessibility.md) | [操作说明](../usage.md) |
| P10 批注、脚注 | `notes.ts`、`metadata-folding.ts`、`rendering.ts` | [批注验收](annotations.md)、[PDF 专项](phase-g-accessibility.md)、`notes-restart.scenario.js` | [操作说明](../usage.md) |
| P11 增量索引、集合 | `vault-index.ts`、`query.ts`、`collections.ts` | [工作台验收](phase-e.md)、[规模测试](phase-g-performance-round3.md)、[启停回收](phase-g-performance-round4.md) | [操作说明](../usage.md) |
| P12 迁移 | `migration-plan.ts`、`migration-service.ts`、`migration-ui.ts` | [迁移验收](migration.md)、`migration-service.test.ts`、`migration-restart.scenario.js` | [迁移说明](../formats/migration.md) |
| P13 行号、标题、折叠 | `code-options.ts`、`code-display.ts` | [展示验收](code-display.md)、[参数验收](fence-parameters.md)、`code-display.scenario.js` | [代码展示](../formats/code-display.md)、[围栏参数](../formats/fence-parameters.md) |
| P14 diff 与增删 | `code-options.ts`、`fence-params.ts`、`code-display.ts` | `code-options.test.ts`、[展示验收](code-display.md)、[参数验收](fence-parameters.md) | [代码展示](../formats/code-display.md) |

实现路径相对于 `src/`，测试路径相对于 `tests/`。

P01—P14 均已实现并进入回归。P15—P18 保留在扩展池；内置 Shiki 已作为 P05 的语法协作路线实现。桌面范围和最新稳定版策略见 [兼容矩阵](phase-g-matrix.md)。
