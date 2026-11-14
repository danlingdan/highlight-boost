# 阶段 G：桌面兼容与发布验收矩阵

更新时间：2026-11-15。矩阵区分 Node 工程检查与实际 Obsidian 宿主运行。

| 项目 | 当前状态 | 证据 / 后续动作 |
| --- | --- | --- |
| Windows，Obsidian 1.15.0，Source / LP / 阅读 | 638 项功能回归通过 | 二十五份 `host-*-results.json` |
| Windows，默认深浅主题、中英文 | 主要功能场景通过 | i18n、selection、display、parameters、migration 场景 |
| Windows / macOS / Linux，Node 24 | Check 工作流已配置三平台矩阵 | [Check 工作流](https://github.com/danlingdan/highlight-boost/actions/workflows/check.yml)，独立构建产物 |
| macOS / Linux，实际 Obsidian | 待验证 | 保存各平台真实宿主运行证据 |
| 最低版本 1.14.0 | 待验证 | 对应运行包上的三视图回归 |
| 稳定版本核查 | 待验证 | 发布验收时核对官方稳定版本并运行 |
| Minimal / AnuPpuccin | 待验证 | 三视图、长行、折叠、批注、深浅主题 |
| 外部 Shiki Highlighter | 已有 0.7.7/0.8.0 对照；共存矩阵继续 | 来源对照记录与当前构建复核 |
| Code Styler / Customizer | 通用参数适配通过；插件共存待验证 | 区分围栏参数与同期开启插件的运行结果 |
| Style Settings | 待验证 | 设置、主题变量、窗口状态 |
| 多窗口 / PDF / 可访问性 / 系统输入法 | 待验证 | 窗口关闭与恢复、导出、键盘及辅助技术 |
| ResizeObserver 布局通知 | 已捕获，专项待完成 | [阶段 F 记录](migration.md)，当前回归通过 |
| 性能 | 第一轮基线与优化完成 | [性能记录](phase-g-performance.md)，剩余路径继续测量 |
| 发布候选、全新安装与版本一致性 | 待验证 | 阶段 G 收尾，再进入 H 发布 |

当前仍为桌面范围，正式版发布前不承诺移动端支持。阶段 G 的完成状态按全部矩阵、性能对照及发布候选验收共同确认。
