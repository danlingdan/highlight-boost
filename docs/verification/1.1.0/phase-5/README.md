# 1.1.0 第五阶段：性能与发布验证

日期：2026-11-18。对照源码为 `0eec69c`，优化及候选源码为 `2518fa3`。

代码展示设置与着色更新分开。阅读视图和实时预览在调整行号时复用语法节点，保留标注和折叠状态。影响终端框、自动标题判定和换行布局的设置仍交给代码组件渲染。编辑器使用缓存的逻辑行末偏移查找 token 的源文位置，适用于引用、列表和 Callout 中的围栏。

## 性能对照

同一台 Windows 11 / i9-14900HX，Obsidian 1.15.1、Electron 43.8.9、SDK 1.14.4、Node 24.22.3。性能、帧和工作台各用独立测试库，沿用启动器的默认配置并顺序运行，帧测试使用离屏软件渲染。下表单位为 ms，成对值为 p50 / p95。样本为 3–7 次时，p95 对应该组最大值。

| 场景 | 样本数 | 1.1.0 优化前 | 1.1.0 优化后 |
| --- | ---: | ---: | ---: |
| 首次启用至索引就绪 | 1 | 147.9 | 151.1 |
| 重新启用至索引就绪 | 3 | 61.5 / 79.1 | 59.1 / 86.4 |
| 200 KiB 笔记从标注到侧栏 DOM | 5 | 181.3 / 239.0 | 156.4 / 223.2 |
| 启用至 500 行首次着色 | 3 | 982.9 / 983.3 | 979.6 / 986.0 |
| 阅读中更新 500 行的起始行号 | 7 | 102.9 / 245.6 | 20.3 / 132.4 |
| 写入 5,000 行后等待源码着色 | 1 | 2,486.5 | 2,370.4 |
| 5,000 行着色后的选区与定位事务 | 5 | 13.8 / 196.8 | 9.4 / 87.8 |
| 200 KiB 笔记从标注到侧栏绘制帧 | 7 | 179.3 / 230.5 | 163.4 / 224.6 |
| 5,000 行从滚动到绘制帧 | 6 | 46.2 / 74.2 | 33.7 / 51.2 |

500 行起始编号更新的中位耗时下降约 80%。首次启用和 500 行首次着色仍处于同一量级。首次着色与选区等待分开采样后，原始前测中 2,909.7 ms 的首个选区样本不再用于选区对照。5,000 行首次着色在本轮各采一次。

原始数据：[首次前测](reports/host-before.json) · [分离首次着色后的前测](reports/host-before-warm.json) · [后测](reports/host-after.json) · [绘制帧前测](reports/frames-before.json) · [绘制帧后测](reports/frames-after.json) · [工具链](reports/toolchain.json)。日志及历史 1.0.1 单次参考保存在主工作区 `.local/cache/bench/1.1.0/`。

## 工作台与资源释放

- 工作台在实际读取 1,000 篇、合计 10,486,000 字节的笔记时响应搜索。输入到结果布局的中位数前后均为 5.6 ms，三轮重建中位用时为 3,829.2 → 4,003.5 ms。所有轮次都保留分页按钮焦点和首张卡片，最终结果为 1,000 条、当前页 50 张卡片。分页测试覆盖切页、筛选和全量摘录。[工作台前测](reports/responsive-before.json) · [工作台后测](reports/responsive-after.json) · [分页](reports/pagination-after.json)
- 三轮关闭插件后均回收插件和工作台对象，清空索引、编辑器、阅读及语法运行时引用。CDP 回收后 JS 堆从基线 23.1 MiB 到第三轮 23.5 MiB，后三轮 DOM 节点均为 2,493。Windows 实际桌面窗口关闭后释放编辑器与语法文档，独立进程重启后恢复窗口布局与原文。[资源回收](reports/lifecycle-after.json) · [多窗口](reports/multiwindow-after.json) · [窗口恢复](reports/multiwindow-restart-after.json)

## 工程与宿主

`pnpm check` 通过，包含 lint、类型检查、34 文件 / 225 项单测和生产构建。按变更验证了[展示](reports/display-after.json)与[重启](reports/display-restart-after.json)、[围栏参数](reports/parameters-after.json)、[嵌套容器](reports/embedded-after.json)、[行内代码](reports/inline-after.json)、[界面语言](reports/i18n-after.json)和[统一体验与升级](reports/unified-after.json)。展示场景直接比较阅读与实时预览中的着色行节点身份。

[测试精简说明](test-scope.md)记录保留范围。完整语言、主题及共存证据见[第四阶段](../phase-4/README.md)，本轮验证改动涉及的路径。Linux 窗口关闭通知检查按既定范围跳过。

正式发布前，用同一候选包在 Ubuntu 26.04 WSL、Xvfb、Obsidian 1.15.1 和 Electron 43.8.9 复测 `multiwindow`，37 项通过，关闭阶段没有记录到 ResizeObserver 通知，本次没有跳过项。Openbox 因主题缺失未启动，本次结果对应无窗口管理器的 Xvfb 环境。CI 继续沿用指定关闭阶段的通知跳过规则。[Linux 窗口复测](reports/linux-window-close.json)

截图：[实时预览代码](images/live-preview.png) · [滚动后的代码](images/frame-scroll.png) · [工作台分页](images/workbench-pagination.png)。

## 候选与安装

候选包为 `dist/highlight-boost-1.1.0-2518fa37/highlight-boost.zip`，解压后逐项核对摘要，`main.js` 与性能、帧和工作台后测的构建摘要一致。manifest、package 和 versions 均为 1.1.0，最低宿主为 1.15.1。

从候选 ZIP 的解压文件安装到全新测试库，校验版本及文件摘要，并测试标注、撤销重做、批注、复制和阅读展示。独立进程重启验证设置、笔记和批注恢复。16 个专项进程共 587 项断言通过，其中全新安装 25 项、重启 18 项。[候选摘要](reports/candidate.json) · [全新安装](reports/install-after.json) · [安装后重启](reports/install-restart-after.json)

1.1.0 已于 2026-11-18 发布，标签提交为 `0e68661`。正式附件逐项核对了 CI 摘要和来源证明。`main.js` 与已安装的候选逐字节一致，`manifest.json` 和 `styles.css` 仅换行符有差异。[GitHub Release](https://github.com/danlingdan/highlight-boost/releases/tag/1.1.0) · [正式构建摘要](reports/release-proof.json)
