# 第三方围栏参数适配

HB 直接读取围栏中的通用展示参数，沿用原文。参数产生临时展示强调，HB 语义标注保存在围栏外，继续参与侧栏、检索和摘录。

## 参数对照

| 来源 | 原写法 | HB 行为 |
| --- | --- | --- |
| Code Styler / Codeblock Customizer | `title:"my file.js"`、`file:demo.js` | 文本标题，支持单/双引号与空格 |
| 两款 Obsidian 插件 | `ln:true`、`ln:false`、`ln:27` | 显示/隐藏行号，或从 27 开始显示 |
| 两款 Obsidian 插件 | `fold`、`fold:"更多代码"`、`unfold` | 默认收起/展开；有折叠文本时用作备用标题 |
| 两款 Obsidian 插件 | `hl:1,3-4` | 强调逻辑行，可组合多段范围 |
| 两款 Obsidian 插件 | `hl:target`、`hl:"target value"` | 强调包含文本的整行 |
| Codeblock Customizer | `hl:2-4\|target` | 指定逻辑行中包含文本的行 |
| Code Styler | `hl:/^target/` | 正则匹配整行，支持 `i`、`m`、`s`、`u` 标志 |
| Hugo | `{linenos=table linenostart=20 hl_lines=[1,"3-4"]}` | 行号、起始编号、行强调；支持属性间的逗号及大小写 |
| Hugo | `{hl_lines="1-2 4"}` | 空格分隔的行范围 |
| Expressive Code | `{1, 3-4}`、`mark={2}` | 普通行强调 |
| Expressive Code | `ins={2}`、`del={3}` | 新增/删除行背景 |
| Expressive Code | `ins={"说明":2-3}` | 读取带标签的行范围 |
| Expressive Code / HB | `title="..."`、`showLineNumbers`、`startLineNumber=20`、`wrap` | 沿用统一展示选项 |

Code Styler / Customizer 的键值分隔符可用 `:` 或 `=`。参数顺序自由；重复的同名展示参数使用首次出现的值。HB 的 `showLineNumbers`、`startLineNumber`、`hb-fold`、`hb-collapsed` 优先于别名；标题优先顺序为 `title` → `file` → `fold` 文本。

Hugo 的 `inline`、`table` 均映射为 HB 的逻辑行号。行选择始终从代码块第一行算起，与显示起始编号独立。`unfold` 在 HB 中表示单块默认展开。

## 示例

````markdown
```js file:"src/demo.js" ln:20 fold hl:1,3
first();
target();
last();
```

```js {linenos=table linenostart=20 hl_lines=[1,"3"]}
first();
target();
last();
```
````

阅读视图提供统一标题栏，编辑器原文显示行背景与逻辑编号。内置 Shiki 的 Live Preview 提供完整代码组件；Live Preview callout 中的代码也会接入展示层。同一代码多处出现时，通过源区段区分。

普通强调、增删强调与 HB 人工标注叠加显示。多个参数命中同一行时，普通强调 → 新增 → 删除依次覆盖参数背景；人工文本高亮继续保留。复制输出代码原文。

## 扩展字段

`ln:10:20` 行号跳转、自定义颜色名、`hlt` 精确文本指令、终端 prompt、分组、引用链接、R Markdown 围栏及 Hugo shortcode 保留原文。迁移预览将逐项列出这些字段。Expressive Code 的文本/正则标记与局部折叠继续由内置引擎提供；本适配层统一行范围。参数强调进入持久语义标注的操作归入后续导入迁移模块。

## 来源

适配规则依据 [Code Styler README](https://github.com/mayurankv/Obsidian-Code-Styler#codeblock-parameters)、[Codeblock Customizer README](https://github.com/mugiwara85/CodeblockCustomizer#parameters)、[Hugo 官方文档](https://gohugo.io/content-management/syntax-highlighting/) 与 [Expressive Code Text Markers](https://expressive-code.com/key-features/text-markers/)，于 2026-11-15 核对。解析及映射代码由 HB 实现；内置引擎来源和致谢见 [第三方声明](../../THIRD_PARTY_NOTICES.md)。
