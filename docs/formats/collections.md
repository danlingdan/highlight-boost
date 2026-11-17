# 集合与索引配置

集合保存在插件配置中，当前使用 schemaVersion 3。集合结构及笔记的正文、行内和代码 v1 格式保持不变。

```ts
interface HighlightCollection {
  id: string;
  name: string;
  entries: CollectionEntry[];
}
```

条目引用包含 `id`、Vault 相对 `path`、对象 `kind`、加入时的 `from`、`quote`、`prefix`、`suffix`、`color`、`label`，以及可选的 `semantic`、`markId`、HB `blockId`、`language` 和 `line`。集合条目的 `id` 独立于源标注身份；前后文各保存最多 32 个 UTF-16 单元。

引用优先通过源标注 ID 与代码块 ID 关联；多个同 ID 候选再使用上下文区分。普通原生高亮使用原句和上下文。唯一关联成功时展示当前内容，无法关联时保留加入时快照，显示待定位状态。集合本身不向源笔记写入新元数据。

文件和目录改名更新相应路径。文件删除或改为非 Markdown 后，引用继续保留原摘录；重新出现相应源条目时重新关联。重复加入当前同一条目不会增加记录；移除集合或引用只修改插件配置。

`excerptTemplate` 保存最近选择的模板，值为 `markdown`、`plain`、`quote` 或 `code`。恢复默认语义预设保留集合和模板选项。

阶段 F 的集合引用增加可选 `note`，保留加入时的说明快照。源条目可定位时显示当前批注，缺失时显示快照。

索引缓存保存在内存，从 Markdown 源文及打开的编辑器缓冲区构建。每个路径有独立读取版本；读失败保留上一快照，重建从源文件重试。配置和缓存分开管理，重建索引不改变集合 ID 或笔记内容。

生成摘录笔记使用以下 frontmatter：

```yaml
---
highlight-boost-export: true
---
```

带此标记的笔记不进入源索引。摘录是生成时的快照，再次点击生成会创建新笔记。来源链接通过 Obsidian 文件管理接口生成，优先使用已有块 ID，再使用所在标题。
