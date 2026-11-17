# 代码体验固定样例

每项编号对应[能力矩阵](code-capabilities.md)。代码块表示后续测试输入；操作和预期在第二、四阶段转入实际宿主场景。第一阶段已有引擎探测见验证记录，不将设计预期记作功能通过。

## C01 全语言目录

读取 `code-baseline.json` 的 languages，以全部 235 个规范 ID 和 97 个别名逐个创建围栏，输入 `value = "example"`，核对解析结果、注册路径和 token 生成。Mermaid 用 C26 验证图表归属。主题目录同文件逐个加载，不以常用子集替代完整目录。

## C02 语言名称

````markdown
```C++
std::vector<int> values{1, 2};
```
```C#
var value = "text";
```
```F#
let value = "text"
```
```文言
吾有一數。曰三。名之曰「甲」。
```
````

分别与 cpp、csharp、fsharp、wenyan 结果比较；补充 JS / javascript 大小写与别名。

## C03 特殊语言

创建无语言、`text`、`txt`、`plain`、`plaintext` 与未知 `hb-unknown` 围栏，内容为 `const value = 1;`。ANSI 输入用字符串 `\u001b[31mred\u001b[0m`，以及粗体、下划线、背景和删除线 SGR。渲染文字与样式对应，复制保留原字符串，显示字符到原偏移映射可标注。

## C04 token 与偏移

````markdown
```ts
/* 跨行
   注释 */
const 文本 = "😀";
const message = `value: ${文本}`;
```
````

使用 C08 的自定义主题将变量设为粗体、字符串斜体、函数下划线；逐字符比对源偏移与显示文本，修改首行后检查后续状态。

## C05 混合语法

````markdown
```vue
<script setup lang="ts">
const count: number = 1;
</script>
<template><button>{{ count }}</button></template>
<style scoped>button { color: red; }</style>
```
````

另以 HTML 内 `<script>` 和 `<style>` 验证；多行模板字符串中插入表达式后着色状态连续。

## C06 自定义语言

将以下 JSON 放入配置的自定义语法目录，以 `hb-demo` 与别名 `hbd` 创建代码块；语言 name、scopeName、patterns 均参与解析。

```json
{"name":"hb-demo","scopeName":"source.hb-demo","aliases":["hbd"],"patterns":[{"match":"\\b(?:HELLO|WORLD)\\b","name":"keyword.control.hb-demo"}]}
```

输入 `HELLO value WORLD`，修改关键字为 TEST 后重新加载；另准备含嵌入 / 注入引用的语法及缺失依赖文件，验证引用加载和错误文件定位。

## C07 全主题与深浅选择

遍历 65 个内置主题，渲染 C04；为 light / dark 分别选择主题，切换 Obsidian 深浅配色；验证变量背景、独立主题背景和预设高亮叠加。

## C08 自定义主题

```json
{"name":"hb-demo-theme","type":"dark","colors":{"editor.background":"#20202a","editor.foreground":"#eeeeee"},"tokenColors":[{"scope":"variable","settings":{"foreground":"#e5b567","fontStyle":"bold"}},{"scope":"string","settings":{"foreground":"#8fc99b","fontStyle":"italic"}},{"scope":"entity.name.function","settings":{"foreground":"#8ebdf0","fontStyle":"underline"}}]}
```

写入主题目录后可选；修改颜色重新加载；改名或删除后检查稳定 ID、提示与 Obsidian 配色恢复。

## C09 配色层

默认、Minimal、AnuPpuccin 深浅主题分别检查 C04 和 C24；切换“优先使用代码主题颜色”，确认代码底色、token、参数强调与人工标注保持可读。

## C10 行内着色与语义

```markdown
函数调用 `{ts} readBuffer(buffer, count)`，普通代码 `buffer.length`。
```

源码显示完整声明；展示态隐藏 `{ts} ` 并着色，选中编辑时恢复；开关关闭后显示字面内容。对整段标记疑问、添加批注、加入集合、复制摘录与重新定位，源范围一致。

## C11 排除语言

将 js 加入排除列表，javascript 别名同步按规范语言处理；开启另一代码处理插件，确认只有一个展示组件；移除排除项后即时恢复 HB 展示。Mermaid 的专用归属独立于用户列表。

## C12 框架

将 `frame="code"`、`frame="terminal"`、`frame="none"`、`frame="auto"` 分别应用到 js 与 bash；有 / 无标题都检查。终端保留 `# explanation` 注释；复制、标注与折叠入口不重复。

## C13 标题

````markdown
```ts title="src/services/read-buffer-with-bounds-validation-and-detailed-resource-lifecycle.ts" file:"ignored.ts" fold:"备用标题"
const count = 1;
```
````

280 px 下换行；标题改成 `<img src=x>` 时显示字面文字。重复 title 使用首个有效值。

## C14 行号

````markdown
```ts showLineNumbers startLineNumber=20 ln:7
const first = 1;
const second = 2;
```
````

显示 20、21，`mark={2}` 标记第二行。再测试 linenos=inline / table、ln:false、行号字体和空行。

## C15 长行

生成含 200 个字符路径的字符串、Tab 缩进和尾随空格。分别在 280 / 360 / 600 px 下开关 wrap，检查代码内滚动、同一逻辑行号与准确选区。

## C16 行强调和标签

````markdown
```ts mark={"检查":1} ins={2} del={3}
first();
second();
third();
```
````

再加入 `{1,3}` 和 HB 人工标注，确认标签和类型不被适配层丢弃。

## C17 精确文本与正则

````markdown
```ts "value" /count\w*/ ins="newCall" del=/oldCall/
const value = count;
oldCall(value);
newCall(countValue);
```
````

检查逐次匹配、类型与偏移；包括引号内空格、正则转义、重复 selector 和未命中。

## C18 第三方参数

````markdown
```ts file:"my file.ts" ln:20 fold hl:1,3
first();
target();
last();
```
```ts {linenos=table linenostart=20 hl_lines=[1,"3"]}
first();
target();
last();
```
````

另测试 `hl:2-4|target`、`hl:/^target/i`、`hl:"target value"` 和显式 HB 参数覆盖。

## C19 整块折叠

围栏使用 `hb-fold hb-collapsed`、`fold`、`unfold`；验证默认状态、手动展开、切换视图、跳转、重绘、重启与 PDF。关闭折叠时复制仍使用完整代码。

## C20 局部折叠

8 行代码使用 `collapse={2-3,5-6}`，分别应用 github、collapsible-start、collapsible-end、collapsible-auto；切换 `collapsePreserveIndent=false`。为隐藏行添加语义和批注，从工作台跳转后只展开所需区段，原行号不变。

## C21 diff 展示

````markdown
```diff lang="ts"
--- a/demo.ts
+++ b/demo.ts
@@ -1,2 +1,2 @@
-oldCall();
+newCall();
 shared();
```
```ts useDiffSyntax
-oldCall();
+newCall();
 shared();
```
````

两种输入均检查语法、增删背景与字符偏移；`useDiffSyntax=false` 时不推断前缀。

## C22 diff 复制

对 C21 执行原始复制与变更片段复制；后者仅输出 `newCall();\nshared();`。检查补丁头、多个 hunk、`No newline` 说明、空上下文和未折叠 / 已折叠状态。

## C23 原始字符串

使用 JSON 字符串表示输入：`"\n\tconst 文本 = \"😀\";  \n\n"`、`"// demo.ts\nconst value = 1;"`、`"# keep\necho hello"` 与 C03 ANSI。原始复制逐字符相等；普通代码和终端注释均保留。

## C24 重叠标注与批注

对 `Math.min(count, buffer.length)` 标记疑问，再对所在整行标记重点；两条各写批注。逐条改色、改语义、移除、撤销、复制、加入集合和生成摘录，另一条保持原样。

## C25 容器与重复代码

相同代码块分别置于正文、列表、引用、Callout 和嵌入笔记。同一笔记重复两次同样代码，分别标注不同字符。各自的路径、区段、逻辑行号与批注独立。

## C26 处理器归属

准备无语言、未知语言、Mermaid、query、dataview、dataviewjs、tasks 与一个自定义语言处理器。验证普通块进入 HB，专用块保持其输出；禁用专用插件后仍按归属规则呈现原内容。frontmatter 与数学节点不接管。

## C27 重载与更新

编辑围栏 meta、切换标题、主题、目录和排除语言，编辑自定义 JSON 后重新加载。快速连续变化时最终显示最后一次设置；旧异步结果不能覆盖新配置。

## C28 多窗口生命周期

两个窗口打开同文件与不同工作台，从各自卡片定位、复制、折叠、保存批注。关闭来源视图、关闭弹出窗口、重载和停用插件，确认对应文档监听、timer、observer 与引擎引用释放。

## C29 离线

禁用网络，读取固定语言目录与全部主题，加载自定义 JSON，并执行 C05 / C10 / C20。加载过程不依赖远程资源，重新启动后仍可使用。

## C30 键盘、语言与打印

中文 / English 下用键盘完成工具栏、菜单、批注、集合和摘录。中文组合输入时执行标注无源文改写。C24 含批注与 C20 隐藏行导出 PDF：代码全部展开、批注完整，元数据、复制按钮和菜单隐藏。
