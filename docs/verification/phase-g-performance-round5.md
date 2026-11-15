# 尾延迟、绘制帧与大代码块滚动

2026-11-15，Windows，Obsidian 1.15.1 / Electron 43.8.9，与前四轮同设备。

## DOM 复测

[宿主样本](performance-round5/host-final.json)保留首个样本，使用与第二轮相同的 DOM 就绪与强制布局计时。

| 指标 | 第二轮 p50 / p95 | 本轮 p50 / p95 |
| --- | --- | --- |
| 200 KiB 标注至侧栏 DOM | 218 / 294 ms | 147.2 / 168.6 ms |
| 500 行代码阅读更新 | 34 / 324 ms | 19.3 / 204.9 ms |
| 五千行代码选区事务 | 6.8 / 10.1 ms | 6.1 / 10.7 ms |

250 ms 的侧栏 DOM p95 目标达到。500 行更新保留 204.9 ms 的首次样本。本轮测试库 56 篇笔记，原生启用至索引就绪 p50 / p95 为 159.1 / 174.5 ms，内置 Shiki 为 202.9 / 205.6 ms。第二轮启用样本使用 51 篇笔记，启动数据按各自库规模记录。

## 实际绘制与滚动

独立库使用 204800 字节正文和 1037790 字节 / 五千行代码。每轮关闭同文件的旧测试视图，固定当前笔记工作台。前后均使用 Electron 屏外软件渲染，操作后等待两个 animation frame，再由原生 `capturePage` 捕获实际像素。该计时包括绘制确认和图像捕获。截图另行核对原文、选区和侧栏。

| 指标 | 前测 p50 / p95 | 后测 p50 / p95 |
| --- | --- | --- |
| 200 KiB 标注至侧栏帧，7 次 | 150.6 / 198.9 ms | 164.2 / 200.6 ms |
| 原生五千行跳转至帧，6 次 | 49.1 / 50.7 ms | 49.5 / 51.7 ms |
| Shiki 五千行跳转至帧，6 次 | 1187.6 / 1236.2 ms | 48.9 / 51.2 ms |

Shiki 原先在每次选区和视口变化时重新处理全部代码。现在全文件 DecorationSet 随文档复用，文档变更和组合输入结束时更新着色；选区和滚动使用已有范围。后续 [70 项复核](performance-round5/frames-validation.json)通过，包括目标行进入实际视口、精确选区、源文一致、移动选区和滚动不重新分词，以及编辑后重新着色与撤销。

该改动减少 Shiki 滚动 p50 约 95.9%。原生路径及侧栏帧耗时基本相同。

原始数组和构建摘要：[前测](performance-round5/frames-before.json)、[后测](performance-round5/frames-after.json)。截图：[侧栏](images/frame-sidebar.png)、[滚动目标](images/frame-scroll.png)。大文件首次分词在采样前完成，滚动数据测量已打开文档的交互；首次初始化由 DOM 及启用样本分别记录。

重跑：`pnpm build` → `node scripts/prepare-vault.mjs --suite=frames` → `node scripts/test-host.mjs --mode=frames`。`HB_FRAME_BASELINE=1` 用于旧实现对照，记录分词次数。

资源回收和万篇索引结果继续见[第三轮](phase-g-performance-round3.md)与[第四轮](phase-g-performance-round4.md)。
