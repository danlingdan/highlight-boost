# 统一代码接入与配置规范

## 1. 代码块归属

使用公开 Markdown 后处理器处理源区段对应的普通 `pre > code`，不再为每种语言注册替换处理器。通过现有 `DocumentSnapshot`、`readingTargets` 和源区段确定围栏、原文与逻辑行，统一构建展示模型。`c++`、`c#`、`f#`、中文别名和未知语言都走源区段映射，避开语言名注册限制。

后处理器仅处理满足以下条件的节点：对应当前源围栏、原始代码一致、位于普通代码输出中。插件自己的节点通过 owner 标记复用；其他插件已生成的组件保持原样。标题、行号、折叠占位和代码说明均不参与代码字符串匹配。

| 输入 / 输出 | 归属 | 具体规则 |
| --- | --- | --- |
| 已知普通语言、别名 | HB | 先归一化大小写和别名，再加载语言；源语言名保留供展示与回写 |
| `c++` / `c#` / `f#` / `文言` | HB | 分别映射 cpp / csharp / fsharp / wenyan，不注册特殊字符语言处理器 |
| 空语言、未知语言 | HB | 使用同一展示模型，以纯文本着色，保留标注和代码操作 |
| `text` / `txt` / `plain` / `plaintext` | HB | 显式纯文本；统一复制和语义标注 |
| `ansi` | HB | 呈现 ANSI 颜色与样式；标注锚点以原文偏移映射，复制原始字符串 |
| `mermaid` | Obsidian 图表 | 源码仍保留编辑能力；阅读 / 展示保持原图表，HB 不替换图形 |
| `query`、`dataview`、`dataviewjs`、`tasks`、`chart`、`charts`、`tracker`、`button`、`buttons`、`ad-*` | 对应专用处理器 | 默认保留其语言归属，前缀 `ad-` 视为专用块；不对其展示输出套代码框 |
| 用户排除语言 | 对应处理器 / Obsidian | 按原始名称与规范名称匹配，源码继续可标注；展示区不替换、不叠加 HB 标注 |
| 其他插件的组件输出 | 原处理器 | 跳过 `.expressive-code` 外部组件、已知第三方代码组件与非普通代码 DOM；不嵌套另一套标题栏 |
| frontmatter、数学、属性、HTML 内嵌代码 | Obsidian | 围栏映射未命中时不接管 |
| Callout、引用、列表、嵌入笔记中的普通代码 | HB | 通过源路径和区段映射，不以文本唯一性判断块身份 |

语言排除列表用于声明额外处理器的归属；插件不读取私有处理器注册表。与其他代码美化插件共存时，每块代码只有一个展示组件。原始 `pre` 上存在第三方装饰的语言通过排除列表交给对应插件，设置即时更新已打开视图。

运行时集中使用 `resolveCodeOwner` 和 `resolveCodeOptions`，编辑、阅读、嵌入和打印复用归属判定。旧的每语言处理器注册在第二阶段移除。

## 2. 视图规则

| 能力 | 源码 / 正在编辑的实时预览 | 未编辑的实时预览 / 阅读 | PDF |
| --- | --- | --- | --- |
| 语法 | CodeMirror token，保留原文 | 统一语法引擎生成组件 | 使用同一主题快照 |
| 标注 / diff / 参数强调 | 原文范围装饰，不改代码 | 行模型与精确偏移装饰 | 保留颜色与文字 |
| 标题 / 框架 | 编辑原文，保留围栏 | 统一代码 / 终端 / 无框组件 | 静态标题，隐藏交互按钮 |
| 行号 / 换行 | 逻辑行号与编辑区布局 | 同一编号、围栏覆盖和逻辑行 | 保留编号并允许分页 |
| 整块 / 局部折叠 | 编辑器原生折叠，不隐藏正在编辑字符 | 统一状态，导航时展开目标区段 | 全部展开 |
| 批注 | 标注与元数据摘要 | 组件下展开说明 | 全部展开 |
| 复制 | 通过源围栏读原代码 | 同一个复制服务，diff 使用二级选项 | 无交互 |
| 行内 `{lang} code` | 原文可编辑，保留偏移 | 隐藏语言声明，仅显示着色后的代码 | 显示着色内容 |

行内着色关闭时完整显示字面内容；打开时仅对 `{有效语言} ` 前缀识别语法，普通代码不猜语言。HB 的整段行内标注、批注和复制保留同一原始条目标识；选区进入编辑时显示完整原文。

### 统一展示模型

模型包含源路径、源围栏偏移、逻辑行列表、原语言与规范语言、原始代码、显示行号、框架、标题、换行、整块状态、局部折叠区段、参数标记、语义标注、批注与主题。

源代码只读，所有展示行和文本范围记录原始偏移。diff 前缀、文件名注释、终端注释、空行、Unicode 和 ANSI 转义不被展示预处理改写。参数强调 → diff 背景 → 人工标注共同呈现；人工标注使用边条、透明底色和下划线避免覆盖语法结构。

主题、设置和本地主题 / 语法重新加载采用串行重建，旧视图收到新模型后更新；状态以文档标识保存，不因新 DOM 丢失。代码框架保留 EC 的结构能力，统一层合并标题栏并关闭重复复制按钮。

## 3. 展示参数

以下为 1.1.0 参数合同。数值行范围从代码第一行起算；显示起始行号不改变选择范围。参数作用于展示，不自动生成持久语义标注。

| 能力 | 写法 | 规则 |
| --- | --- | --- |
| 标题 | `title="src/demo.ts"`、`title:'...'`、`file:demo.ts`、`fold:"更多代码"` | title → file → fold 文本，标题按普通文字输出 |
| 行号 | `showLineNumbers`、`showLineNumbers=false`、`ln:true/false/20`、`linenos=table/inline` | 统一为逻辑行号；HB 显式键优先于别名 |
| 起始行号 | `startLineNumber=20`、`linenostart=20`、`ln:20` | 优先顺序按左列；范围 1—1,000,000 |
| 换行 | `wrap`、`wrap=false` | 覆盖全局；一个逻辑行可显示多行 |
| 框架 | `frame="code/terminal/none/auto"` | 保留 EC 四种框架；auto 按语言与标题判断 |
| 整块折叠 | `hb-fold`、`hb-fold=false`、`hb-collapsed`、`fold`、`unfold` | 显式 HB 键优先；unfold 优先于 fold 的默认收起 |
| 局部折叠 | `collapse={2-4,8-10}`、`collapseStyle="github/collapsible-start/collapsible-end/collapsible-auto"`、`collapsePreserveIndent=false` | 保留 EC 区段及样式；点击定位展开目标所在区段 |
| 普通行强调 | `{1,3-4}`、`mark={2}`、`mark={"说明":2-3}` | 保留范围和标签 |
| 增删行强调 | `ins={2}`、`del={3}`、`ins={"新增":2}` | 保留标记类型和标签 |
| 精确文本 / 正则 | `"target"`、`/target\w+/`、`mark="target"`、`ins=/target/`、`del="old"` | 保留 EC 原始文本选择表达式；HB 解析器不得将正则转换成行选择 |
| 第三方行强调 | `hl:1,3-4`、`hl:"target value"`、`hl:2-4\|target`、`hl:/^target/i` | 沿用已有适配；与 EC 文本 / 正则参数分别解析 |
| Hugo 属性组 | `{linenos=table linenostart=20 hl_lines=[1,"3-4"]}`、`{hl_lines="1-2 4"}` | 属性组支持逗号分隔与大小写，转入同一模型 |
| diff | `diff lang="ts"`、`ts useDiffSyntax`、`useDiffSyntax=false` | 语法语言与 diff 背景独立；保留原始前缀 |

处理顺序：全局默认 → 第三方别名 → 显式标准键。相同键重复时沿用首个有效值；可重复的 mark / ins / del 选择器合并。完整原始 meta 传给 EC，各功能只消费自己的字段；标题、引号和正则按结构拆分，不按空格截断。

现有第三方扩展中尚未实现的 `ln:10:20`、自定义颜色名、`hlt`、prompt、分组、引用链接、R Markdown 与 shortcode 沿用迁移预览中的原文记录规则，不改变已发布合同。Shiki / EC 原有的文本、框架、折叠和主题能力按能力矩阵在本版完整接入。

## 4. 配置迁移

1.1.0 配置 `schemaVersion` 为 3。`normalizeSettings` 负责加载与迁移；插件启用时先完成配置归一化，再初始化引擎。只保存插件配置，不扫描改写笔记，不读取或迁移其他插件的私有配置。

| 1.0.x 字段 | 1.1.0 字段 / 行为 |
| --- | --- |
| `schemaVersion: 2` 或缺省 | 写入 3；重复加载结果不变 |
| `syntaxProvider: native/shiki` | 移除字段，两者均启用统一着色 |
| `defaultPreset`、`presets`、`customName` | 保留有效值与自定义名称，不替换快照名称 |
| `language`、`selectionToolbar`、`recentColors` | 保留；最近颜色仍最多三种 |
| `collections`、条目快照与批注 | 保留已有 schema 及引用，不重建集合 |
| `excerptTemplate` | 保留 markdown / plain / quote / code |
| `codeDisplay` 的全部八个字段 | 原值保留：showTitle、showLineNumbers、startLine、numberFont、collapsible、collapseByDefault、wrap、diff |
| 新 `codeDisplay.frame` | 默认 auto；其余展示开关保留旧值 |
| 新 `codeSyntax.lightTheme/darkTheme` | 默认 obsidian-theme，选择器提供全部内置与自定义主题 |
| 新 `codeSyntax.preferThemeColors` | 默认 true；Obsidian 配色仍使用主题变量 |
| 新 `codeSyntax.inlineHighlighting` | 默认 true，只识别显式语言声明 |
| 新 `codeSyntax.customThemeFolder/customLanguageFolder` | 默认空字符串，使用库内目录；JSON 文件与主题 / 语言列表关联 |
| 新 `codeSyntax.disabledLanguages` | 默认空列表，叠加专用块默认归属；按规范语言和原名称匹配 |

代码主题选择保存稳定 ID：内置沿用主题 ID，自定义使用 `custom:<库内相对文件路径>`。自定义语法保留 TextMate name、aliases、scopeName、patterns、repository 与嵌入依赖。缺少被引用依赖时显示具体文件与语言，修正后通过“重新加载主题与语法”恢复；主题消失时使用 Obsidian 配色并显示所需文件位置。

加载自定义文件后按需构建，引擎不下载语法或主题。目录路径只定位当前库内资源；预览与错误信息显示相对路径。设置更新自动应用，编辑 JSON 后使用重新加载命令。

## 5. 第二阶段升级检查样例

1. `native` 与 `shiki` 两份完整旧配置分别升级，结果除历史取值外完全一致。
2. 标题、行号、折叠和换行的 true / false 均逐字段保留；自定义预设、批注与集合深比较一致。
3. 连续加载两次 schema 3，结果相同；源 Markdown、脚注和隐藏注释按字节比较不变。
4. 两窗口同时打开，改深浅主题、目录或排除语言后两个窗口更新；关闭窗口释放资源。
5. 加载全部内置语言与主题，验证特殊别名和自定义语法；图表、查询和未知普通代码各自按归属表处理。

第一阶段确定以上合同；配置转换、代码接管和宿主运行结果在第二阶段实现并验证。
