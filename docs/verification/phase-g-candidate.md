# 候选包与全新安装

2026-11-15，候选版本 **0.1.0**，最低宿主 **1.15.1**，桌面端。发布前再次核对[官方更新记录](https://obsidian.md/changelog/)，最新桌面稳定版为 1.15.1。

候选包从已提交的产品源码构建，包含 `main.js`、`manifest.json`、`styles.css`、项目 LICENSE、第三方声明和三份上游许可。打包前检查产品文件已提交，版本声明一致；ZIP 解压后逐文件核对 SHA-256。

## 本机候选

源码：`01418fab87cbeb6b2e9725c269ee01768a720508`。

- ZIP：`dist/highlight-boost-0.1.0-01418fab/highlight-boost.zip`
- ZIP SHA-256：`894950597900751d0fb6c05ca0610fe63ea3fa52b7759c79e5a69db178f031db`
- main.js SHA-256：`7aa02854a535a8d9e5c3a067322068201d286abfca080ed78277d6ad64d75b7e`
- styles.css SHA-256：`cc60335a7bbbd1870f7fee4141a598e6b6bd67f349fe5f84f5bba8cec21d31c3`

从 ZIP 解压目录复制到全新 `.test-install-vault`。没有旧插件配置和笔记状态。首次运行 [25 项检查](host-install-results.json)、独立进程重启后 [18 项检查](host-install-restart-results.json)通过，页面错误为零。

检查涵盖全部文件摘要、版本、默认设置、正文 / 行内代码 / 代码块命令、单步撤销重做、代码批注、宿主保存、纯代码复制、内置 Shiki 切换、三条工作台卡片、阅读显示和重启恢复。

## CI 与复现

Desktop host 工作流在 Windows、macOS、Linux 分别打包、解压校验、全新安装并重启。每个平台产物保存候选 ZIP、`candidate.json`、宿主结果和环境信息。当前运行入口：[Desktop host](https://github.com/danlingdan/highlight-boost/actions/workflows/host.yml)。

最终[三平台验收运行](https://github.com/danlingdan/highlight-boost/actions/runs/43718754693)全部通过，候选源码为 `dc9941b4fffad2146eb0aa500c8fb859e8e292a0`。该提交补充窗口测试的系统剪贴板核对，产品源码与上述本机候选相同。各平台 ZIP 摘要及逐文件摘要已经下载复核，见 [Windows](platforms/windows.json)、[macOS](platforms/macos.json)、[Linux](platforms/ubuntu.json) 的 `candidate` 字段。

```sh
pnpm package:candidate
node scripts/prepare-install.mjs --current
pnpm test:install
```

`candidate.json` 记录源码提交和每个文件摘要。首次安装测试使用全新测试目录；日常功能回归继续使用各自独立测试库。候选构建产物由 CI 提供，正式 tag、GitHub Release 和社区提交进入阶段 H。
