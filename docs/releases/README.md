# 发布维护

## 1.1.1 发布与审核修复

2026-11-18 发布 [1.1.1](https://github.com/danlingdan/highlight-boost/releases/tag/1.1.1)，正式标签指向预审通过的提交 `a74e708`。三个附件均核对了 SHA-256 和 GitHub 来源证明。`main.js` 与已安装候选逐字节一致，`manifest.json` 和 `styles.css` 仅换行符有差异。[发布构建](https://github.com/danlingdan/highlight-boost/actions/runs/44195750540) · [正式附件摘要](../verification/1.1.1/release-proof.json)

1.1.0 的社区目录审核拒绝了禁用 `obsidianmd/no-forbidden-elements` 的源码例外。1.1.1 通过各窗口自身的 CSSOM 样式表加载自定义代码主题，移除了该例外。卸载插件、替换主题或关闭窗口时释放对应的样式表。

首轮候选 `9003154` 通过 225 项单测及 369 项 Obsidian 1.15.1 宿主断言，覆盖主题重载、阅读、实时预览、行内代码、多窗口释放、安装与重启。社区目录预审为 **Completed**，报告列出 HTML 元素辅助函数和 CSS 警告。

当前候选为 `dist/highlight-boost-1.1.1-a74e708e/highlight-boost.zip`，源码提交为 `a74e708`，ZIP SHA-256 为 `4dc10389cc3a3edd3e12d8d09abc8b6424a508a70380d27062edc171013ff6e1`。沿用 Obsidian 的文档片段辅助方法，移除三处 `!important` 和打印样式的 `:has()`。回归验证了隐藏控件、终端标题栏、PDF 标题与批注、分页、统一代码、全新安装和重启，共 385 项宿主断言。原始结果在隔离工作树的 `.local/cache/review/1.1.1/warnings/`。[发布正文](1.1.1.md)

社区目录对 `a74e708` 的预审为 **Completed**。仅余一组 `text-decoration` 兼容性提示，涉及三处代码下划线样式，提示对应 Obsidian 1.11.4。候选最低版本为 1.15.1，已在该版本验证下划线和 PDF 输出。[社区审核](https://community.obsidian.md/account/plugins/highlight-boost)

## 1.1.0 发布记录

2026-11-18 发布 [1.1.0](https://github.com/danlingdan/highlight-boost/releases/tag/1.1.0)，标签对应提交 `0e68661`。三个附件的 SHA-256 和 GitHub 来源证明均已核对。[发布正文](1.1.0.md) · [构建运行](https://github.com/danlingdan/highlight-boost/actions/runs/44190381244) · [正式附件摘要](../verification/1.1.0/phase-5/reports/release-proof.json)

本机候选完成解压核对、全新安装及独立进程重启。性能、宿主结果和发布前 Linux 窗口复测见[第五阶段验证记录](../verification/1.1.0/phase-5/README.md)。

## 1.0.1 发布与审核

[1.0.1](https://github.com/danlingdan/highlight-boost/releases/tag/1.0.1) 已于 2026-11-16 发布，源码标签为 `ac8dd6e`，由 [CI](https://github.com/danlingdan/highlight-boost/actions/runs/43752974351) 构建。

本版本处理 1.0.0 的官方自动审核。源码改动、对应警告和验证范围见 [1.0.1 验证记录](../verification/1.0.1/README.md)，用户发布说明见 [1.0.1](1.0.1.md)。

正式附件由 `Release` 工作流从版本标签构建，附带 GitHub artifact attestation。Release 只上传 `main.js`、`manifest.json`、`styles.css`；构建摘要与来源信息保存在 CI 产物中。

## 1.0.0 发布记录

首发版本为 **1.0.0**，插件 ID 为 `highlight-boost`。维护者于 2026-11-16 确认直接发布，本次完成英文同步、构建与产物摘要核对，不追加测试。社区目录由维护者于 2026-11-15 告知已提交，管理入口为[插件提交页](https://community.obsidian.md/account/plugins/highlight-boost)。审核状态以该账户页面为准。

| 项目 | 状态 |
| --- | --- |
| 版本声明 | package.json、manifest.json、versions.json 已同步为 1.0.0 |
| 公开文档 | 维护者已审阅中文文档，English README 已同步 |
| 阶段 G 功能验收 | 已归档，见[验收矩阵](../verification/phase-g-matrix.md) |
| 本次工程检查 | lint、类型检查、33 文件 / 200 项测试及构建通过；集中路径后基础宿主 46 项、窗口 47 项与独立进程恢复 12 项通过，页面错误为零 |
| 完整宿主 CI 复核 | 窗口专项间歇出现 ResizeObserver 通知，仍待定位；观察器追踪已记录原生工作区与 CodeMirror 目标，见下方运行记录 |
| 1.0.0 下载与安装测试 | 由维护者执行，本次发布不追加安装测试 |
| 社区目录 | 已提交，等待官方审核 |
| tag 与 GitHub Release | `1.0.0`，2026-11-16，[发布入口](https://github.com/danlingdan/highlight-boost/releases/tag/1.0.0) |

本机窗口检查已通过；[完整上下文诊断](https://github.com/danlingdan/highlight-boost/actions/runs/43723313269)在 macOS 捕获了布局通知，[独立窗口诊断](https://github.com/danlingdan/highlight-boost/actions/runs/43722824864)通过。两种运行结果分别保留。固定工具栏宽度的尝试没有消除通知，已恢复原有样式。布局通知列入后续维护，保留上述原始记录。

## 历史候选与维护者安装检查

本机候选：`dist/highlight-boost-1.0.0-e668b55d/highlight-boost.zip`，源码为 `e668b55dad56f055bc4109282a4e4a83a9b69b27`，ZIP SHA-256 为 `0008ae9489fa1b81c44df6c7d6dbbdaaef6088909e34ed07a14dc7492cfac22f`。该包已完成构建、解压与逐文件摘要核对。

下载安装由维护者执行，可从候选 CI 产物或正式 Release 取得同一版本文件。建议检查：

1. 最新 Obsidian 桌面版中新建笔记库，安装后显示版本 1.0.0，插件正常启用。
2. 正文、行内代码、代码块精确范围与整行标注，以及一次撤销 / 重做。
3. Live Preview 与阅读视图显示；宿主 / 内置 Shiki 切换并重新启用。
4. 工作台来源跳转、批注、纯代码复制和摘录；重启后保留设置与笔记数据。
5. 日常使用的主题与代码插件组合，记录实际观察到的问题和触发步骤。

## 每次发布日志怎么写

README、用户手册和 Release 正文只写使用者需要的功能、操作、安装与升级信息。文档审阅进度、阶段编号、候选编号、构建摘要和测试统计保存在本页或验证记录中。中英文 README 保持相同章节与功能分组。

1. 先确定比较范围：后续版本使用上一个正式 tag 到候选提交的差异；首发按实际交付功能编写。
2. 逐条说明变化的触发场景、现在的行为和对使用者的影响。修复项说明具体问题；升级涉及设置、数据格式或操作变化时，写出对应步骤。
3. 功能陈述与实现、使用说明对应，验证依据保存在维护记录中。公开日志涉及性能数字时，附环境、样例规模和对照来源。
4. 区分“已验证”“维护者待执行”和“已提交审核”。历史阶段 G 数据保留其源码提交，不改写为新版本重新运行的结果。
5. Release 正文中的链接使用完整 GitHub 地址，保证从发布页面直接访问。将最终正文保存为 `docs/releases/<版本>.md`，同时更新 `CHANGELOG.md` 入口。GitHub Release 使用该文件作为 `--body-file`，逐条审阅，不用提交标题堆砌发布说明。
6. 发布日期、源码提交、产物摘要和维护者安装结果在执行后记录。发布后发现遗漏，明确补充说明；已发布行为变更通过下一版本记录。

发布日志建议按实际变更选用“新增”“改进”“修复”“升级与数据”“验证范围”章节。首发以完整功能介绍为主；没有发生的变更无需填充栏目。

## 发布步骤

1. 核对最新 Obsidian 桌面稳定版、SDK 与运行包；同步 manifest、package、versions 及运行包配置。
2. 完成版本日志和公开文档检查，运行 `pnpm check` 与适合改动范围的验证。
3. 提交源码后运行 `pnpm package:candidate`，核对 `candidate.json` 中的提交、文件和 ZIP 摘要。
4. 将候选包与 CI 构建入口交给维护者进行下载、全新安装与使用检查，按实际执行情况记录结果；本次由维护者执行。
5. 推送与 manifest 完全一致的 tag，再运行 `Release` 工作流。CI 构建和生成来源证明，创建仅含三个插件文件的草稿，正文使用本版本日志。核对产物摘要后公开发布。
6. 更新 README 和 CHANGELOG 的“发布准备中”状态、实际日期、发布链接。社区目录沿用已有提交，记录后续审核结果。

Obsidian 官方说明：[使用 GitHub Actions 发布插件](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Release%20your%20plugin%20with%20GitHub%20Actions.md)。发布正文使用对应版本日志，构建摘要保存在 CI 产物中。
