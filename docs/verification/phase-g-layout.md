# 布局通知与资源生命周期

布局专项覆盖两条路径：实际多窗口的创建、移动、关闭和恢复，以及代码组件连续改变容器宽度、语言后的重渲染。

- 原生和 Shiki 各创建笔记与工作台弹出窗口，关闭后核对编辑器映射及每文档运行时释放，[47 项检查](host-multiwindow-results.json)通过。
- 保存真实窗口布局，结束整个宿主进程后恢复两个弹出窗口，[12 项重启检查](host-multiwindow-restart-results.json)通过，覆盖恢复、着色、跨窗口跳转、关闭与资源释放。
- 默认主题深浅色检查后连续进行 24 次宽度和中英文重渲染，核对源文与全局错误，[辅助技术专项](host-accessibility-results.json)通过。
- 三次启停分别检查旧插件、工作台和运行时实例被回收，结果见[资源回收记录](phase-g-performance-round4.md)。

`SyntaxRuntime` 的 ResizeObserver 收集待更新节点，通过后续任务更新滚动区域角色；MutationObserver 释放已移除节点，窗口关闭时断开观察器、事件和定时器。Shiki 的全文件着色装饰只在文档变化及组合输入结束后更新，滚动和选区移动复用已有范围。

[早期三平台专项](https://github.com/danlingdan/highlight-boost/actions/runs/43695792684)记录过 macOS 关闭 Shiki 窗口时的 ResizeObserver 循环通知。着色复用改动后的[三平台复核](https://github.com/danlingdan/highlight-boost/actions/runs/43697969553)全部通过，多窗口与连续布局场景的错误收集为空。该复核关闭了观察器追踪注入。

宿主脚本保留可选 `HB_RO_TRACE=1` 诊断，记录观察目标与构造栈；常规 CI 运行原始观察器。

最终工具栏修复将控件创建放入所属窗口的动画帧；CodeMirror 测量的 read 阶段统一读取坐标、边界和尺寸，write 阶段只更新位置。初始容器位于窗口内，定位完成后显示；关闭和销毁时取消帧任务。内容相同的控件直接复用，保留键盘焦点。

多窗口脚本为每个操作阶段收集错误，保存布局和关闭窗口后再静置一秒收集事件；复制结果由 Electron 原生系统剪贴板读取。错误断言保留全部 ResizeObserver 通知。

最终源码 `dc9941b` 的[三平台完整验收](https://github.com/danlingdan/highlight-boost/actions/runs/43718754693)全部通过：每平台 36 个场景、1112 项检查，包含上述窗口与布局专项，页面错误为零。[平台摘要](platforms/windows.json)记录各场景文件摘要；macOS、Linux 对应结果保存在同目录。
