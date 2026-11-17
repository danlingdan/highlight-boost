# 代码展示与 diff

设置中的“代码展示”管理标题、逻辑行号、起始行号、行号字体、长行换行和整块折叠。设置即时生效。默认关闭标题、行号、换行和折叠，起始行号为 1，字体为等宽；diff 背景默认开启。

阅读视图与实时预览使用统一代码组件，提供标题栏、折叠与复制。源码模式及正在编辑的代码提供行号、语法着色与 diff 背景，代码折叠使用编辑器原生命令。

## 单块设置

围栏参数覆盖全局默认值：

````markdown
```js title="src/demo.js" showLineNumbers startLineNumber=20 wrap hb-fold hb-collapsed
const message = "hello";
console.log(message);
```
````

- `title="..."`：显示标题，内容按文本展示。
- `showLineNumbers` / `showLineNumbers=false`：开启或关闭行号。
- `startLineNumber=20`：第一条逻辑行的编号。
- `wrap` / `wrap=false`：开启或关闭长行换行。
- `frame=auto|code|terminal|none`：自动识别、使用代码框、使用终端框或关闭边框。
- `hb-fold` / `hb-fold=false`：开启或关闭整块折叠。
- `hb-collapsed`：首次显示时收起，同时开启整块折叠。

折行沿用同一个逻辑行号，行号和批注不进入复制内容。整块展开状态在当前插件会话内保留，切换视图后继续使用；重新启用插件或重启应用后使用默认设置。侧栏跳转会展开对应代码块和编辑器折叠区域。代码组件支持 Expressive Code 的 `collapse={2-3}` 局部折叠。

## diff 与复制

````markdown
```diff title="change.patch" lang="js"
-oldCall();
+newCall();
 shared();
```
````

增删行有独立背景，人工语义标注和批注叠加显示。支持简写 diff 和包含文件头、hunk 的 unified diff；原始 `+`、`-` 和上下文前缀保留。

“复制原始 diff”取得原围栏代码。“复制变更片段”移除删除行、文件头、hunk 和说明行，保留新增行与上下文，去掉一字符前缀；输出是补丁包含的片段。命令面板也提供“复制 diff 变更片段”，光标位于 diff 代码块时执行。

普通代码的复制保留文件名注释、shell 注释及原始空白。代码标注元数据和说明存放在围栏之外。

## 实现来源

内置展示继承 Shiki Highlighter 与 Expressive Code 的能力，特别感谢原作者和贡献者。HB 将 diff 前缀及首行注释保留在渲染和复制数据中，用于原文映射。版权、许可与本地修改见 [第三方致谢](../../THIRD_PARTY_NOTICES.md)。参数资料：[Frames](https://expressive-code.com/key-features/frames/)、[Line Numbers](https://expressive-code.com/plugins/line-numbers/)、[Text Markers](https://expressive-code.com/key-features/text-markers/)。
