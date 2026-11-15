# PDF、键盘、可访问性与组合输入

2026-11-15，Windows，Obsidian 1.15.1，Electron 43.8.9。独立测试库运行 [30 项检查](host-accessibility-results.json)，页面错误为零。

| 专项 | 实际操作与结果 |
| --- | --- |
| 键盘 | CDP 原生按键执行 Home、End、方向键和 Escape；工具栏焦点移动，退出后恢复编辑器焦点 |
| 辅助名称 | Chromium Accessibility 树包含重点原文和复制动作，所有可见按钮均有名称 |
| 对比度 | 深浅主题各测七色代码标注、正文和行内代码，共 18 个样本；最低 4.7349:1 |
| 中文组合输入 | Chromium `Input.imeSetComposition` / `Input.insertText`，覆盖正文、行内代码和代码块；提交字符准确，三条标注元数据保留 |
| 组合期间交互 | 编辑器处于 composing 状态，浮动工具栏关闭，标注命令保持源文 |
| 连续布局变化 | 24 次交替改变阅读容器宽度及中英文重渲染；源文一致，没有 ResizeObserver 循环错误 |
| PDF | 执行 Obsidian 的导出为 PDF 命令，设置 A4，真实打印生成文件；代码标注样式、完整多行批注与中文输入保留，元数据隐藏 |

对比度以元素计算前景色与逐层合成背景色计算，相对亮度公式及 4.5:1 门槛来自 [WCAG 2.2 1.4.3](https://www.w3.org/TR/2023/REC-WCAG22-20231005/#contrast-minimum)。原始颜色和结果保存于 JSON。输入专项覆盖 Chromium 组合输入链路，测试通过 CDP 注入组合内容与提交文字。

本轮修复 Expressive Code 的通用样式重置覆盖 HB 背景、下划线和批注排版的问题。文本标注背景混合强度调整为 18%，保留语法前景色。打印样式展开代码批注内容。

[实际导出 PDF](pdf/highlight-boost-export.pdf)与[页面图](images/export-pdf.png)已检查：一页 A4，字符、代码标注、批注换行完整，无重叠或裁切。使用 PDFium / Poppler 渲染，并提取文本核对中文与完整批注。

重跑：`pnpm test:accessibility`。PDF 输出到 `output/pdf/`。测试通过宿主保存对话框接口指定项目产物路径，再调用实际打印流程。
