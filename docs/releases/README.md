# 发布维护

## 1.0.0 准备状态

首发版本确定为 **1.0.0**，插件 ID 为 `highlight-boost`。社区目录由维护者于 2026-11-15 告知已提交，管理入口为[插件提交页](https://community.obsidian.md/account/plugins/highlight-boost)。审核状态以该账户页面为准。

| 项目 | 状态 |
| --- | --- |
| 版本声明 | package.json、manifest.json、versions.json 已同步为 1.0.0 |
| 公开文档 | 中文 / English README、桌面操作、贡献说明及发布日志已成稿，等待维护者检查 |
| 阶段 G 功能验收 | 已归档，见[验收矩阵](../verification/phase-g-matrix.md) |
| 本次工程检查 | lint、类型检查、33 文件 / 200 项测试及构建通过；集中路径后基础宿主 46 项、窗口 47 项与独立进程恢复 12 项通过，页面错误为零 |
| 1.0.0 下载与安装测试 | 由维护者执行，结果待记录 |
| 社区目录 | 已提交，等待官方审核 |
| tag 与 GitHub Release | 待文档检查和维护者安装确认后执行 |

## 每次发布日志怎么写

1. 先确定比较范围：后续版本使用上一个正式 tag 到候选提交的差异；首发按实际交付功能编写。
2. 逐条说明变化的触发场景、现在的行为和对使用者的影响。修复项说明具体问题；升级涉及设置、数据格式或操作变化时，写出对应步骤。
3. 功能陈述与实现、使用说明对应，验证结论链接到实际运行记录。性能数字必须附环境、样例规模和对照来源。
4. 区分“已验证”“维护者待执行”和“已提交审核”。历史阶段 G 数据保留其源码提交，不改写为新版本重新运行的结果。
5. Release 正文中的链接使用完整 GitHub 地址，保证从发布页面直接访问。将最终正文保存为 `docs/releases/<版本>.md`，同时更新 `CHANGELOG.md` 入口。GitHub Release 使用该文件作为 `--body-file`，逐条审阅，不用提交标题堆砌发布说明。
6. 发布日期、源码提交、产物摘要和维护者安装结果在执行后记录。发布后发现遗漏，明确补充说明；已发布行为变更通过下一版本记录。

发布日志建议按实际变更选用“新增”“改进”“修复”“升级与数据”“验证范围”章节。首发以完整功能介绍为主；没有发生的变更无需填充栏目。

## 发布步骤

1. 核对最新 Obsidian 桌面稳定版、SDK 与运行包；同步 manifest、package、versions 及运行包配置。
2. 完成版本日志和公开文档检查，运行 `pnpm check` 与适合改动范围的验证。
3. 提交源码后运行 `pnpm package:candidate`，核对 `candidate.json` 中的提交、文件和 ZIP 摘要。
4. 维护者进行下载、全新安装与使用检查，将实际结果记录到本页；本次由维护者执行。
5. 使用与 manifest 完全一致的 tag，例如 `1.0.0`。创建 GitHub Release，上传 `main.js`、`manifest.json`、`styles.css`、安装 ZIP 和摘要清单，正文使用本版本日志。
6. 更新 README 和 CHANGELOG 的“发布准备中”状态、实际日期、发布链接。社区目录沿用已有提交，记录后续审核结果。

Obsidian 官方说明：[使用 GitHub Actions 发布插件](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Release%20your%20plugin%20with%20GitHub%20Actions.md)。当前项目先完成文档审阅与维护者安装确认，再执行正式发布。
