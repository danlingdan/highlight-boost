# 开发与接口测试

## 本地开发

使用 Node.js 24 与 pnpm 11.25.0。依赖版本记录在 package.json 和 pnpm-lock.yaml。

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm prepare:vault
```

`pnpm dev` 监听源码并生成 `main.js`。重新构建后运行 `pnpm prepare:vault` 将产物复制到项目内 `.test-vault/.obsidian/plugins/highlight-boost/`。

功能命令包含“标记为重点/疑问/引用/行动”“代码行：重点/疑问/引用/行动”“高亮颜色：默认色/红色/橙色/黄色/绿色/蓝色/紫色”“选择高亮颜色”“移除所选标注”“复制当前代码块”和“打开当前笔记重点”。编辑器右键菜单提供同类操作。

Live Preview 中点击“代码标注”按钮展开元数据，键盘 Enter/空格同样可操作。代码原句变化后，在该代码块中选择新位置，再点击侧栏“绑定到当前选区”。

行内代码可用同一组语义、颜色和移除命令，选区或空光标作用于整段代码。Live Preview 点击“行内标注”展开注释，Source 显示原文。侧栏按行内代码类型定位和摘录；格式详见 [inline-v1](formats/inline-v1.md)。

插件设置可调整四种语义的名称、颜色和默认语义，也可恢复默认。更改后命令名称即时更新，后续操作使用新配置；已有标注保留名称快照。正文通过原生高亮及相邻 `hbp` 注释保存颜色和语义，局部编辑时按片段继承。三类对象直接改色保留已有语义。详见 [正文 v1](formats/prose-v1.md)。插件配置仍为 schemaVersion 2。

桌面选区面板默认在选中文本时出现，显示对象类型和选区数量；单一代码块显示块序号及逻辑行范围，可切换“文本 / 整行”。操作保留多选区，方向键、Home/End、Enter 和 Escape 可用于键盘操作。点击面板外部关闭；关闭自动显示后仍可执行“打开选区面板”命令。组合输入期间隐藏，阅读视图退出编辑面板。最近三种成功应用的颜色保存在配置 `recentColors`，`selectionToolbar` 保存自动显示开关；恢复默认预设保留这些选项。

当前笔记侧栏支持按原文、名称和代码语言搜索，类型与语义可组合筛选，显示结果计数和无匹配提示。筛选控件在刷新中保留。卡片可更改语义及移除单条标注；代码操作按标注 ID 修改，即使与其他标注重叠也只处理指定条目。旧卡片对应的内容变化时提示刷新。文件修改、改名和删除会更新侧栏。

侧栏显示标题链及可展开的前后一行代码上下文。卡片摘录优先使用已有块 ID 链接，再使用所在标题；链接通过宿主 `generateMarkdownLink` 生成。摘录代码围栏按实际内容选择长度，正文逐行引用，行内代码使用可往返的反引号长度。阅读状态跳转进入 Live Preview，Source 与 Live Preview 原状态保持；跳转后重新核对文件和条目身份。

工作台独立于插件入口实现于 `src/workbench.ts`。`HighlightIndex` 按路径保存源文与条目，使用读取版本处理异步变更；公开 `ready` 等待当前队列完成，`rebuild` 从源笔记重建。源适配器优先读取打开的 Markdown 编辑器，其余使用 Vault 读取。创建、修改、删除及目录改名由插件事件接入。查询和集合关联是可独立测试的纯模块。

配置增加 `collections` 与 `excerptTemplate`，沿用 schemaVersion 2；集合引用和导出标记见 [集合说明](formats/collections.md)。工作台范围及控件状态通过 ItemView 状态保存，命令入口重置查询条件，下拉框切换保留条件。源索引排除 frontmatter 中带 `highlight-boost-export: true` 的生成笔记。

`planNote` 生成批注 EditPlan：正文更新 `noteRef`、标准脚注引用和定义，代码更新元数据 `note`。同一位置的新增内容先合并为一个 change，再通过原有事务提交。脚注定义是正文说明的读取来源；解析时将 HB 定义排除于源标注之外。共享脚注清空时维护剩余片段的引用，保存前核对现有说明，旧对话框不会覆盖新保存的批注。字段和继承规则见 [批注格式](formats/annotations.md)。

“语法着色”可选择宿主或内置 Shiki，保存后重新启用 HB 生效。内置模块的主题、展示配置和样式来自 Shiki Highlighter 0.8.0 源码，宿主注册与编辑器生命周期在本项目实现，特别致谢见 [来源声明](../THIRD_PARTY_NOTICES.md)。

“界面语言”支持跟随 Obsidian、中文和 English，即时更新已打开的侧栏、颜色选择器、元数据按钮及内置代码组件。自动模式识别中文，其余语言使用英文。配置 schemaVersion 2 增加 `language: auto | zh | en`；预设可带 `customName: true`，记录用户明确编辑过的名称，包括与默认中文同名的自定义名称。内置默认名称随界面翻译，自定义名称和已有标注快照保持原文；新标注保存操作时显示的名称。恢复预设默认值保留界面语言与语法提供者。

迁移核心分为 `migration-plan.ts` 的纯转换计划、`migration-service.ts` 的逐文件执行与恢复、`migration-obsidian.ts` 的宿主存储，以及 `migration-ui.ts` 的预览窗口。应用复用预览快照；宿主使用 `Vault.process` 核对并更新源文，同时核对已打开编辑器。原始恢复记录独立保存，状态文件可从基础快照重新读取。格式和用户流程见 [迁移说明](formats/migration.md)。

## 自动化测试

- `pnpm lint`：代码规范。
- `pnpm typecheck`：类型检查。
- `pnpm test`：文档解析、纯编辑计划、锚定和 DOM 渲染断言。
- `pnpm build`：生成宿主加载的 CommonJS 插件。
- `pnpm test:host`：构建并依次运行二十五个独立 Electron 进程，覆盖已有标注闭环、工作台、批注、代码展示、diff、围栏参数、导入迁移和独立进程恢复。
- `pnpm test:migration`：通过真实窗口验证预览、颜色映射、文件选择、应用计数和逐文件恢复，并在新进程恢复原文。
- `pnpm test:parameters`：验证四类围栏参数、嵌套 callout、人工标注叠加、纯代码复制及卸载清理。
- `pnpm test:display`：运行代码展示与重启专项，验证设置控件、折叠跳转、逻辑行号、换行、两种 diff 复制及渲染清理。
- `pnpm test:notes`：运行批注和新进程恢复专项，归档阅读脚注与 Live Preview 摘要截图。
- `pnpm test:phase-e`：运行全库工作台及新进程集合恢复专项，归档中英文深浅主题画面。
- `pnpm test:phase-d`：运行同一笔记的正文 / 行内 / C / Python / ASM 三视图闭环及独立进程恢复，归档阅读与 Live Preview 截图。
- `pnpm test:selection`：运行选区面板、键盘操作、侧栏筛选和单条修改专项，归档深浅主题截图。
- `pnpm test:i18n`：运行界面语言切换及独立进程恢复验收。
- `pnpm test:prose`：运行正文语义宿主验收及独立进程恢复。
- `pnpm test:inline`：运行行内代码宿主验收及独立进程恢复。
- `pnpm test:embedded`：单独运行内置 Shiki 验收。
- `pnpm test:shiki`：准备固定版本 Shiki Highlighter 0.8.0，在两个独立进程中验证协作行为和语言对照。
- `pnpm test:shiki-live`：对照上游 0.7.7 与 0.8.0，记录冷打开、移动光标、滚动、输入和阅读路径。

宿主测试优先使用 Electron JavaScript、[官方 CLI](https://obsidian.md/help/cli) 和 CDP。当前测试通过 `webContents.executeJavaScript` 操作项目样例，使用原生 Editor 和 WorkspaceLeaf 接口执行变更与切换视图。

## 隔离宿主

`test:host` 使用本机已安装的 Obsidian 运行包；Windows 默认资源路径为 `C:\Program Files\Obsidian\resources`，可通过 `OBSIDIAN_RESOURCES` 指定其他安装目录。

测试启动器：

1. 将 Obsidian 用户目录设为项目内 `.test-host-profile`。
2. 只登记项目内 `.test-vault`，加载当前构建的插件和合成样例。
3. 在独立 Electron 38.8.6 中加载本机 `obsidian.asar`，复用真实解析、编辑与阅读渲染代码。
4. 为测试 CLI 管道添加独立后缀，避免和日常应用争用同名管道。
5. 经路径校验后执行宿主断言，每个进程将结果写入 `docs/verification/host-*-results.json` 后退出。
6. 重启场景读取基础场景保存的测试库与设置，写入 `host-restart-results.json`；随后内置场景切换语法提供者，完成后还原设置。

测试启动器保留既有系统协议注册，测试配置与输出均位于项目目录。

本机 Obsidian 程序包由安装位置读取，仓库包含测试启动器和自有代码。宿主测试记录 Obsidian 包版本与测试 Electron 版本；各桌面系统、最低支持版本和完整安装器环境在后续兼容阶段验证。

测试库与配置目录由 Git 忽略。`prepare:vault` 会重置项目样例和测试库插件清单，用于每次从相同输入运行测试。

基础宿主场景初始化测试插件的默认预设，设置场景验证改名、改色、连续写入、迁移、界面输入及恢复默认，并还原进入场景前的配置。组合测试使用模拟 DOM 组合事件与编辑器事务；系统输入法在阶段 G 验证。

Shiki 测试首次从其官方 Release 下载产物到 `.research-cache`，核对脚本内固定 SHA256 后复制到测试库；之后复用缓存。第三方产物由 Git 忽略。运行原生场景前，`prepare:vault` 将启用清单重置为 HB。语言矩阵保存于对应结果 JSON，详细解释见 [第三轮记录](verification/phase-a-iteration-3.md)。

内置场景仅启用 HB，通过 CDP 焦点模拟激活隐藏宿主中的编辑状态，检查冷打开组件、原生编辑按钮、纯代码复制和 HB 标记。上游版本对照是诊断记录，Live Preview 的组件和颜色差异保存在 observations 中；修复验收使用内置场景。详见 [第四轮记录](verification/phase-a-iteration-4.md)。

## 构建与 CI

阶段 G 的 `bench:core` 和 `bench:host` 分别运行 Node 核心和实际宿主性能样例；原始数组、样例大小及计时定义见 [性能记录](verification/phase-g-performance.md)。`verify-parsing.mjs --base=<revision>` 编译指定版本解析器，与当前版本运行固定种子的差分样例。`report-performance.mjs` 核对前后样例及环境后生成对照表。

索引在时间片之间使用 MessageChannel 让出线程，合并批量进度通知，最后发布完整状态。未变内容复用原条目，编辑仍通过版本号优先于旧读取。侧栏单次刷新按源文共享摘录解析；这些缓存与复用均随操作或索引生命周期更新。

Obsidian 与 CodeMirror 模块由宿主提供，构建时保留 external。Markdown 结构解析依赖打包进入 main.js。

GitHub Actions 在 Windows、macOS、Linux 的 Node 24 上运行 `pnpm check`，分别上传构建产物。宿主测试使用实际 Obsidian 运行包单独执行；Node 矩阵和宿主兼容矩阵分别记录。

内置展示交互脚本在构建时合入 JavaScript，主题 CSS 随模块加载。第三方 MIT 声明写入 `main.js`，构建产物同时包含 `THIRD_PARTY_NOTICES.md` 与 `licenses/`。
