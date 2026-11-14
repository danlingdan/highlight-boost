# 第三轮原型与配置验证

日期：2026-11-14。原型版本 0.1.0。宿主为本机 Obsidian 1.15.0 运行包，测试进程使用 Electron 38.8.6。

后续补充：本轮语言表在编辑后统计“原生 token 或 Shiki inline color”。冷打开与 Live Preview 组件的专项对照、源码合入及修复验收见 [第四轮记录](phase-a-iteration-4.md)。

## 本轮实现

- 阅读视图按来源范围区分重复代码块；文件修改、异步替换代码 DOM 后重新装饰。
- 代码原句附近修改后，结合原有重复次数及上下文重新定位。
- 高亮命令拥有独立撤销边界；组合事件期间映射已有装饰，结束后重建。
- 适配 Shiki Highlighter 0.8.0 的 Expressive Code 行结构，保留语法 token、原生行容器和复制内容；停用 HB 时清除自己的装饰。
- 配置升级至 schemaVersion 2，迁移旧默认语义，校验名称、颜色和默认项；四种预设可改名改色，命令和右键菜单读取当前配置。
- 配置写入按顺序执行，连续修改保留最终值。设置页提供恢复默认。

预设 ID 保持稳定。修改预设作用于后续标注；已有代码标注保存创建时的名称、颜色与语义 ID。正文使用原生颜色格式，持久语义记录在阶段 C 继续实现。

## 验证结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| lint / typecheck / build | 通过 | `pnpm check` |
| 逻辑与 DOM | 41 项通过 | 9 个测试文件 |
| 基础宿主功能 | 46 项通过 | [结果](host-results.json) |
| 多选区、重复块和组合事件 | 19 项通过 | [结果](host-advanced-results.json) |
| 原生多语言 | 28 项通过 | [结果及矩阵](host-languages-results.json) |
| 长行布局 | 7 项通过 | [结果](host-layout-results.json) |
| 配置迁移与设置界面 | 15 项通过 | [结果](host-settings-results.json) |
| 独立进程重启 | 9 项通过 | [结果](host-restart-results.json) |
| Shiki 协作 | 14 项通过 | [结果](host-shiki-results.json) |
| Shiki 多语言 | 28 项通过 | [结果及矩阵](host-languages-shiki-results.json) |

宿主共 166 项检查。所有操作通过项目隔离测试库和 Electron JavaScript 执行。

长行测试核对编辑器整行覆盖、阅读视图整行宽度、软换行高度、文本跨行矩形、空行及完整代码字符。组合输入测试发送模拟 CompositionEvent 和编辑器组合事务，核对装饰、元数据、单次撤销与重做；操作系统输入法实测纳入阶段 G。

## 语言对照

下表顺序为 Source / Live Preview / 阅读视图，表示样例是否出现语法着色 token。各语言的 HB 手动标注均通过三视图检查。

| 围栏语言 | 原生着色 | 启用 Shiki 0.8.0 | Shiki 下阅读容器 |
| --- | --- | --- | --- |
| c | 是 / 是 / 是 | 是 / 是 / 是 | Expressive Code |
| python | 是 / 是 / 是 | 是 / 是 / 是 | Expressive Code |
| js | 是 / 是 / 是 | 是 / 是 / 是 | Expressive Code |
| asm | 否 / 否 / 否 | 是 / 是 / 是 | Expressive Code |
| nasm | 否 / 否 / 是 | 否 / 否 / 是 | 原生 |
| x86asm | 否 / 否 / 否 | 否 / 否 / 否 | 原生 |
| hb-unknown | 否 / 否 / 否 | 否 / 否 / 否 | 原生 |

汇编示例采用 `mov rax, 7`、`add rax, 1`、`ret`。语言名由着色提供者解释，HB 保留原围栏名。此结果用于选择语法提供者与准备后续别名适配。

测试脚本从 [Shiki Highlighter 0.8.0 官方 Release](https://github.com/mProjectsCode/obsidian-shiki-plugin/releases/tag/0.8.0) 准备第三方产物，按固定 SHA256 校验后仅放入项目测试库；清单在 `scripts/prepare-shiki.mjs`。加载顺序、重新渲染、卸载清理和复制内容均有独立断言。

## 阶段推进

阶段 A 的编辑、锚定、原生与 Shiki 渲染路线已有可复现结果，截图归档与格式冻结继续收尾。阶段 B 已建立工程检查、CI、隔离宿主和配置迁移，中英文文案继续接入。阶段 C 接下来处理行内代码、连续跨正文/代码选区和正文语义记录；阶段 D 完善选区入口与侧栏。

当前只验证功能正确性。性能测试与优化仍在计划功能完成后的阶段 G 统一开展。
