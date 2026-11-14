# 导入、预览与逐文件恢复

从命令面板执行“Highlight Boost：导入与迁移”，或在插件设置点击“导入与迁移”。

## 操作流程

1. 选择当前笔记、目录或全库范围。
2. 选择 Highlightr、Hilo；需要保存代码行强调时，开启“围栏行强调 → HB 标注”。
3. 点击“生成预览”，核对每个文件的转换结果。
4. 调整颜色映射后重新生成预览，勾选要转换的文件。
5. 点击“应用选中文件”。窗口列出应用数量和逐文件结果。

预览只读取笔记。摘要跟随文件选择更新；代码行预览显示目标行号、颜色与代码内容。应用使用当前预览的完整文件快照，记录与实际应用的标记数量对应。

## 格式映射

| 来源 | 输入 | 输出 |
| --- | --- | --- |
| Highlightr 内联样式 | `<mark style="background:#FF5582A6">text</mark>` | `==🔴text==` |
| Highlightr CSS 类 | `<mark class="hltr-blue">text</mark>` | `==🔵text==` |
| HTML 默认标记 | `<mark>text</mark>` | `==text==` |
| Hilo | `=={green}**text**==` | `==🟢**text**==` |
| 自定义色 | `=={soft-rose}text==` | 在预览中选择目标颜色，或保留原文 |
| 围栏行参数 | `hl:2`、`hl_lines=[2]`、`{2}`、`ins={2}`、`del={2}` | 围栏外 HB 行标注，原代码与参数保留 |

Highlightr 支持 `background` / `background-color`、大小写标签、短/长十六进制及逗号形式 RGB/RGBA。透明度不参与原生色类别选择。默认调色板映射到 HB 七种颜色；Pink → 紫色、Cyan → 蓝色、Grey → 默认色，其他同名色对应原生类别。预览中可覆盖每一项映射。

Hilo 按颜色名映射；自定义名称在窗口中单独选择。导入无需启用原插件。粗体、Wiki 链接和实体的源内容保留。正文导入使用原生颜色，不推断“重点/疑问”等语义。围栏行强调保存为对应颜色的独立 HB 标注，可从侧栏改为语义预设，参与查询与摘录。

围栏、行内代码、缩进代码、YAML、注释和 HTML 块中的示例保留。嵌套标记、多行正文、内部 `==`、附加 HTML 属性或其他样式会列为保留原文。扩展围栏参数也列入预览，原字段继续保留。

## 文件结果与恢复

应用先保存整批文件的原文和转换后快照，再逐文件写入。某个文件在预览后被修改时，该文件记为待处理，其余所选文件继续执行。重新预览可纳入新的内容。

“迁移记录与恢复”按批次显示文件状态。点击“恢复此文件”，只还原这一份文件。当前内容与迁移后快照相同时，恢复为迁移前的完整内容；当前已经是原文时，状态更新为已恢复。迁移后新增的编辑保留，窗口提示重新核对。

记录保存在实际插件目录下的 `migrations/`，默认路径为 `.obsidian/plugins/highlight-boost/migrations/`。原始快照 `<批次 ID>.json` 创建后保持不变；`.state.json` 只更新处理状态。状态写入中断时，按原始记录读取，仍可逐文件恢复。记录包含完整笔记内容，可与插件目录一起备份。文件按迁移时的路径关联，重启后继续读取。

重复扫描已经转换的正文和代码行不会新增标记。恢复后可重新导入。

## 上游格式来源

格式于 2026-11-15 根据 [Highlightr 默认设置](https://github.com/chetachiezikeuzor/Highlightr-Plugin/blob/master/src/settings/settingsData.ts)、[Hilo Token Format](https://github.com/opellen/Hilo#token-format) 与 [Hilo 调色板配置](https://github.com/opellen/Hilo/blob/main/src/settings/data.ts) 核对。迁移实现由 HB 编写，采用项目现有原生格式及 v1 代码元数据。
