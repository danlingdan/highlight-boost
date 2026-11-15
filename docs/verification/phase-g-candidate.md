# 候选包与全新安装

2026-11-15，候选版本 **0.1.0**，最低宿主 **1.15.1**，桌面端。发布前再次核对[官方更新记录](https://obsidian.md/changelog/)，最新桌面稳定版为 1.15.1。

候选包从已提交的产品源码构建，包含 `main.js`、`manifest.json`、`styles.css`、项目 LICENSE、第三方声明和三份上游许可。打包前检查产品文件已提交，版本声明一致；ZIP 解压后逐文件核对 SHA-256。

## 本机候选

源码：`989b2c71f0939b56dfaf1a26cd78ef30138a2968`。

- ZIP：`dist/highlight-boost-0.1.0-989b2c71/highlight-boost.zip`
- ZIP SHA-256：`495d94f8acba67fceab4436bd59b01b1d8b0f5fc8800c58bb6b4c2f664595c06`
- main.js SHA-256：`24587cc5e79de111eba95e7f654a6cb605a576fe184ffdc67c59bab95e9fa6af`
- styles.css SHA-256：`cc60335a7bbbd1870f7fee4141a598e6b6bd67f349fe5f84f5bba8cec21d31c3`

从 ZIP 解压目录复制到全新 `.test-install-vault`。没有旧插件配置和笔记状态。首次运行 [25 项检查](host-install-results.json)、独立进程重启后 [18 项检查](host-install-restart-results.json)通过，页面错误为零。

检查涵盖全部文件摘要、版本、默认设置、正文 / 行内代码 / 代码块命令、单步撤销重做、代码批注、宿主保存、纯代码复制、内置 Shiki 切换、三条工作台卡片、阅读显示和重启恢复。

## CI 与复现

Desktop host 工作流在 Windows、macOS、Linux 分别打包、解压校验、全新安装并重启。每个平台产物保存候选 ZIP、`candidate.json`、宿主结果和环境信息。当前运行入口：[Desktop host](https://github.com/danlingdan/highlight-boost/actions/workflows/host.yml)。

```sh
pnpm package:candidate
node scripts/prepare-install.mjs --current
pnpm test:install
```

`candidate.json` 记录源码提交和每个文件摘要。首次安装测试使用全新测试目录；日常功能回归继续使用各自独立测试库。候选构建产物由 CI 提供，正式 tag、GitHub Release 和社区提交进入阶段 H。
