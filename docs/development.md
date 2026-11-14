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

插件设置可调整四种语义的名称、颜色和默认语义，也可恢复默认。更改后命令名称即时更新，后续标注使用新配置。已有代码标注保留创建时的快照，正文采用原生颜色格式。插件配置为 schemaVersion 2，首次启用时迁移旧默认语义；笔记中的 HB 元数据仍为 v1。

## 自动化测试

- `pnpm lint`：代码规范。
- `pnpm typecheck`：类型检查。
- `pnpm test`：文档解析、纯编辑计划、锚定和 DOM 渲染断言。
- `pnpm build`：生成宿主加载的 CommonJS 插件。
- `pnpm test:host`：构建并依次运行六个独立 Electron 进程，验证基础操作、多选区与组合事件、语言对照、布局、设置和重启恢复。
- `pnpm test:shiki`：准备固定版本 Shiki Highlighter 0.8.0，在两个独立进程中验证协作行为和语言对照。

宿主测试优先使用 Electron JavaScript、[官方 CLI](https://obsidian.md/help/cli) 和 CDP。当前测试通过 `webContents.executeJavaScript` 操作项目样例，使用原生 Editor 和 WorkspaceLeaf 接口执行变更与切换视图。

## 隔离宿主

`test:host` 使用本机已安装的 Obsidian 运行包；Windows 默认资源路径为 `C:\Program Files\Obsidian\resources`，可通过 `OBSIDIAN_RESOURCES` 指定其他安装目录。

测试启动器：

1. 将 Obsidian 用户目录设为项目内 `.test-host-profile`。
2. 只登记项目内 `.test-vault`，加载当前构建的插件和合成样例。
3. 在独立 Electron 38.8.6 中加载本机 `obsidian.asar`，复用真实解析、编辑与阅读渲染代码。
4. 为测试 CLI 管道添加独立后缀，避免和日常应用争用同名管道。
5. 经路径校验后执行宿主断言，每个进程将结果写入 `docs/verification/host-*-results.json` 后退出。
6. 最后启动重启场景，读取基础场景保存的测试库与设置，写入 `host-restart-results.json`。

测试启动器保留既有系统协议注册，测试配置与输出均位于项目目录。

本机 Obsidian 程序包由安装位置读取，仓库包含测试启动器和自有代码。宿主测试记录 Obsidian 包版本与测试 Electron 版本；各桌面系统、最低支持版本和完整安装器环境在后续兼容阶段验证。

测试库与配置目录由 Git 忽略。`prepare:vault` 会重置项目样例和测试库插件清单，用于每次从相同输入运行测试。

基础宿主场景初始化测试插件的默认预设，设置场景验证改名、改色、连续写入、迁移、界面输入及恢复默认，并还原进入场景前的配置。组合测试使用模拟 DOM 组合事件与编辑器事务；系统输入法在阶段 G 验证。

Shiki 测试首次从其官方 Release 下载产物到 `.research-cache`，核对脚本内固定 SHA256 后复制到测试库；之后复用缓存。第三方产物由 Git 忽略。运行原生场景前，`prepare:vault` 将启用清单重置为 HB。语言矩阵保存于对应结果 JSON，详细解释见 [第三轮记录](verification/phase-a-iteration-3.md)。

## 构建与 CI

Obsidian 与 CodeMirror 模块由宿主提供，构建时保留 external。Markdown 结构解析依赖打包进入 main.js。

GitHub Actions 运行 `pnpm check` 并上传 `main.js`、`manifest.json`、`styles.css` 为构建产物。宿主测试使用本机安装的 Obsidian，单独执行。功能完成后，阶段 G 再建立统一性能基线和优化对照。
