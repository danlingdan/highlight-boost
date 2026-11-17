# 验收记录索引

## 当前验收入口

- [1.1.0 第四阶段](1.1.0/phase-4/README.md)：完整流程本地验收、主题共存、键盘、多窗口、PDF 与安装；三平台 CI 待执行。
- [1.1.0 第三阶段](1.1.0/phase-3/README.md)：共享视觉、工作台与工具栏流程、批注、集合、摘录和设置预览。
- [1.1.0 第二阶段](1.1.0/phase-2/README.md)：统一代码引擎、配置迁移、资源重载和完整基础宿主回归。
- [1.1.0 第一阶段](1.1.0/phase-1/README.md)：界面样稿、Shiki 能力基线、接管规则、参数与配置迁移设计。
- [阶段 G 完整矩阵](phase-g-matrix.md)：平台、主题、插件、窗口、辅助技术、性能和候选安装。
- [G01—G09 完成清单](../plan/10-阶段G收尾清单.md)。
- [P01—P14 实现与验证对应](phase-g-requirements.md)。
- [三平台原始文件摘要](platforms/)：Windows、macOS、Linux 的运行环境、场景与候选包摘要。

## 专项

- [主题、插件与多窗口](phase-g-compatibility.md)，原始结果在 `compatibility/`。
- [窗口与布局生命周期](phase-g-layout.md)。
- [PDF、键盘、AX、对比度与组合输入](phase-g-accessibility.md)。
- [候选包与全新安装](phase-g-candidate.md)。
- 性能：[第一轮](phase-g-performance.md)、[第二轮](phase-g-performance-round2.md)、[第三轮](phase-g-performance-round3.md)、[第四轮](phase-g-performance-round4.md)、[第五轮](phase-g-performance-round5.md)。

## 历史记录与产物

阶段 A—F、原型对照及功能专项报告保留在本目录；`host-*-results.json` 为报告引用的宿主结果，`images/` 和 `pdf/` 为已归档视觉产物。各报告中的版本、路径和检查数对应当时运行，当前版本准备见[发布维护](../releases/README.md)。

重新执行宿主场景会更新对应结果文件。归档时按实际改动选择结果与报告一起提交。下载缓存、临时日志和分析中间文件放在 `.local/`，目录约定见[项目目录](../structure.md)。
