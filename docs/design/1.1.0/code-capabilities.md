# 代码能力矩阵

## 基线与来源

核对日期：2026-11-16。HB 基线为工作区 1.0.1，Shiki 为 3.23.0、Expressive Code 为 0.41.7；Shiki Highlighter 对照提交为 `5268557c6874439ef9fbf4a48e2ae223f54e09de`，与项目已采用的来源一致。采用固定源码和依赖清单建立可复现基线。

来源代号：

- **S1**：[上游设置](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/5268557c6874439ef9fbf4a48e2ae223f54e09de/packages/obsidian/src/settings/Settings.ts) 与 [设置界面](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/5268557c6874439ef9fbf4a48e2ae223f54e09de/packages/obsidian/src/settings/SettingsTab.ts)。
- **S2**：[上游引擎](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/5268557c6874439ef9fbf4a48e2ae223f54e09de/packages/obsidian/src/Highlighter.ts)、[行内代码说明](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/5268557c6874439ef9fbf4a48e2ae223f54e09de/README.md)、[主题映射](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/5268557c6874439ef9fbf4a48e2ae223f54e09de/packages/obsidian/src/themes/ThemeMapper.ts)。
- **S3**：[EC 框架](https://expressive-code.com/key-features/frames/)、[文本与行标记](https://expressive-code.com/key-features/text-markers/)、[局部折叠](https://expressive-code.com/plugins/collapsible-sections/)。语法合同同时对照项目安装的同版包实现。
- **S4**：[Shiki 语言](https://shiki.style/languages)、[自定义语言](https://shiki.style/guide/load-lang)；实际目录以安装版本导出的 `bundledLanguagesInfo`、`bundledLanguages`、`bundledThemesInfo` 为准。
- **S5**：本项目 `src/syntax/`、`src/code-display.ts`、`src/code-options.ts`、`src/fence-params.ts`、`src/inline-rendering.ts`、`src/reading-view.ts` 和现有宿主场景。

上游源码缓存通过 `scripts/paths.cjs` 定位；11 个源文件的 URL 和 SHA-256 见 [sources.json](../../verification/1.1.0/phase-1/sources.json)。[code-baseline.json](../../verification/1.1.0/phase-1/code-baseline.json) 包含完整语言 / 别名 / 主题目录及 15 个实际渲染探测，保留生成的 DOM 与复制字符串。

当前目录有 235 个规范语言 ID、97 个别名、65 个内置主题。332 个语言名均已调用当前引擎生成 token；这证明加载入口可用，语义质量通过下列混合语言与多行样例另行验证。旧阅读注册筛选排除了 `c++`、`c#`、`f#`、`文言` 和 Mermaid；Mermaid 按专用图表归属保留，其余四个名称由新的源区段路径接入。当前 HB 引擎只选择 Obsidian 配色，没有提供完整主题选择器。

## 必达矩阵

视图：E = 源码与实时预览编辑态，L = 实时预览展示态，R = 阅读，P = PDF。视图差异按[接入规范](code-integration.md)执行。

第一阶段结果表示能力已核对并确定接入合同；“待实现”指第二、三阶段功能，不代表第一阶段缺项。固定输入与操作步骤见[样例集](code-fixtures.md)。

| ID / 来源 | 能力与 1.0.1 当前情况 | 1.1.0 实现入口 | 视图 | 样例 / 第一阶段证据 | 实现验收 |
| --- | --- | --- | --- | --- | --- |
| K01 · S2/S4 | 235 种语言、97 个别名；引擎支持但阅读注册过滤部分名称 | `syntax/engine.ts` 语言解析与普通代码后处理 | E/L/R/P | C01；完整目录已探测 | 332 个名称均正确解析，专用 Mermaid 按归属处理 |
| K02 · S4/S5 | 大写调用可归一化，特殊字符和中文名称不能依靠当前注册路径 | `resolveLanguage` 保留源名称，内部规范化 | E/L/R/P | C02；五个注册例外已列出 | JS、C++、C#、F#、文言显示与规范 ID 对应 |
| K03 · S2/S4 | 文本模式与 ANSI 可由 EC 渲染，HB token 路径未纳入特殊语言 | `syntax/engine.ts` 特殊语言分支 | E/L/R/P | C03；plain-text / ansi 探测 | 纯文本不误着色，ANSI 前景 / 背景 / 字体与原文映射正确 |
| K04 · S2/S5 | token 保留前景与字体位，编辑器已有斜体 / 粗体 / 下划线 | 统一 token 模型与装饰 | E/L/R/P | C04；源码核对 | 多行状态、Unicode、字体样式及 ANSI 删除线保留 |
| K05 · S4/S5 | 使用 Shiki 语法依赖加载 | `syntax/engine.ts` 嵌入语法加载 | E/L/R/P | C05；源与包接口核对 | Vue、HTML 内 JS/CSS、模板字符串和多行注释不丢状态 |
| K06 · S1/S2 | 上游支持自定义 TextMate JSON，HB 当前未接入 | `codeSyntax.customLanguageFolder`、资源加载服务 | E/L/R/P | C06；上游加载源码核对 | 自定义名、别名、注入 / 嵌入依赖生效，重新加载更新 |
| K07 · S1/S4 | 安装包含 65 个主题，当前仅 Obsidian 映射 | `codeSyntax.lightTheme/darkTheme`、主题选择器 | E/L/R/P | C07；完整目录已归档 | 全部内置主题可选，切换深浅色对应独立主题 |
| K08 · S1/S2 | 上游支持自定义 VS Code JSON，HB 未接入 | `customThemeFolder`、主题加载与稳定 ID | E/L/R/P | C08；上游设置与映射源码 | 自定义主题可选且编辑后可重载，颜色与字体样式保留 |
| K09 · S1/S2 | Obsidian CSS 映射已有；优先主题色为内部固定值 | `preferThemeColors` 与主题解析 | E/L/R/P | C09；主题变量源码核对 | 跟随主题与独立配色都可配置，背景和强调层可读 |
| K10 · S1/S2 | 上游 `{lang} code` 行内着色，HB 仅有整段语义标注 | 行内解析、`syntax/editor.ts`、`inline-rendering.ts` | E/L/R/P | C10；README 与行内实现核对 | 显式语言着色、声明显隐、开关、批注和整段标注融合 |
| K11 · S1/S2 | 上游可排除语言，HB 当前只有 Mermaid 固定例外 | `disabledLanguages` 与 `resolveCodeOwner` | E/L/R | C11；上游设置已核对 | 排除 / 恢复即时生效，其他处理器输出保持原样 |
| K12 · S3/S5 | EC 提供四种框架，HB 通用层未表达 frame | 展示模型 `frame`、统一代码组件 | L/R/P | C12；frame-terminal / frame-none | code / terminal / none / auto 均可用，无重复头栏 |
| K13 · S3/S5 | title/file/fold 文本与路径已有 | `resolveCodeOptions`、统一标题栏 | L/R/P | C13；title-number-wrap | 长标题断行，优先级一致，文字不作为 HTML |
| K14 · S1/S3/S5 | 行号、起始编号、字体与别名适配已有 | `code-options.ts` 与共享逻辑行模型 | E/L/R/P | C14；title-number-wrap | 同一逻辑行编号，显示起点不改变标记范围 |
| K15 · S1/S3/S5 | wrap 与长行滚动已有 | 统一组件与编辑布局设置 | E/L/R/P | C15；源码与样稿窄宽检查 | 280 px 下容器不溢出，行内滚动 / 换行正确 |
| K16 · S3/S5 | mark/ins/del 行范围、标签由 EC 与适配层提供 | 保留 EC 选择器，输出共享范围模型 | E/L/R/P | C16；line-markers / label-marker | 范围、标签、增删类别均保留并与人工标注叠加 |
| K17 · S3/S5 | 文本 / 正则标记在 EC 路径可用，通用层未完整表达 | meta 结构解析与文本标记映射 | E/L/R/P | C17；text-marker / regex-marker | 引号、正则、重复匹配和类型标记可用 |
| K18 · S5 | Code Styler、Customizer、Hugo 通用参数已有 | `fence-params.ts` 规范化到模型 | E/L/R/P | C18；既有参数测试与合同对照 | 已发布别名、优先级、大小写与带空格标题保持一致 |
| K19 · S5 | 整块折叠、默认状态与会话记忆已有 | 共享折叠状态与导航服务 | E/L/R/P | C19；代码样稿操作 | 重绘保持状态，跳转展开，PDF 展开 |
| K20 · S3/S5 | 局部折叠、四种样式和缩进由 EC 提供 | 区段模型、EC 局部折叠与展开映射 | L/R/P；E 原生 | C20；collapse / collapse-style | 各样式、多个区段、保留缩进、跳转和复制通过 |
| K21 · S3/S5 | 原 diff 复制与 HB 背景已有；关闭 EC 预处理后需显式承接 useDiffSyntax | 保留源前缀的 diff 模型、`lang` 与 `useDiffSyntax` | E/L/R/P | C21；diff / diff-syntax 原文探测 | 两种 diff 输入着色、语法、行号和标注共同正确 |
| K22 · S5 | HB 原始 diff / 变更片段复制已有 | 一个复制服务、二级选项 | E/L/R | C22；原字符串与 `diffAfter` | 补丁头、删除行和上下文处理正确 |
| K23 · S2/S5 | 普通代码空白、注释、Unicode 保留；EC ANSI 复制剥离转义 | 复制从源模型读取，绕开 DOM 和 EC 拷贝数据 | E/L/R | C23；whitespace-unicode / ansi | 字符串按字节等价；ANSI 复制保留原始转义 |
| K24 · S5 | 重叠精确 / 整行标注、批注与关联元数据已有 | 条目动作与渲染映射复用 | E/L/R/P | C24；样稿与现有条目服务 | 单条修改不影响重叠条目，复制仍只含代码 |
| K25 · S5 | Callout、引用、嵌入与重复块已有映射逻辑 | `readingTargets`、源路径与区段 | E/L/R/P | C25；已有映射源码核对 | 相同文本的多个块各自定位、编号与批注正确 |
| K26 · S2/S5 | 未知语言回到普通路径；专用块归属需统一 | `resolveCodeOwner` 与普通代码后处理 | E/L/R/P | C26；接管表已定稿 | 未知 / 无语言可标注；专用块输出不变 |
| K27 · S1/S2/S5 | 设置 / CSS 更新与资源重载在两条路径中分散 | 串行引擎重建与刷新服务 | E/L/R | C27；上游 reload 源码与本地服务 | 配置、围栏 meta、JSON 修改后更新，无过期异步结果 |
| K28 · S5 | 窗口事件、复制和资源释放已有 | 所属 document 的共享组件生命周期 | E/L/R | C28；当前 runtime 源码 | 弹出窗口交互正确，关闭 / 停用后资源归零 |
| K29 · S5 | 源数据离线打包、按需解压已有 | 保留压缩目录和懒加载 | E/L/R | C29；打包源码与语言探测 | 无网络加载语言、主题与自定义资源 |
| K30 · S5 | 中英文、键盘、PDF、批注展开已有 | 统一组件、翻译键与打印样式 | E/L/R/P | C30；八类样稿与状态检查 | 中英文即时切换、键盘可操作、PDF 无元数据 |

## 覆盖边界

这里的广度同时覆盖语言引擎、上游 Obsidian 插件的用户能力和已集成 EC 展示能力。Shiki 的网站框架适配器与独立开发 API 不作为插件界面入口；其语言、主题、语法精度和可用于桌面代码展示的功能按上表承接。

既有第三方围栏参数的适配合同继续有效；完整列表见[代码接入规范](code-integration.md)。

## 阶段落实

- 第二阶段：K01—K23、K25—K29 的引擎、代码模型、处理归属、参数和配置；保留现有 K24 / K30 核心行为。
- 第三阶段：K07—K11 设置入口，K12—K24 统一组件交互，K30 界面与流程融合。
- 第四阶段：全矩阵功能与宿主验证，包括各视图、主题、共存、升级和导出。
- 第五阶段：功能完成后统一性能对照与资源优化。
