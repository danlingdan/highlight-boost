import { colorLabels, presets, type Color, type Preset } from './domain';

export type Locale = 'zh' | 'en';
export type Language = 'auto' | Locale;
export const zh = {
  selectionToolbar: '选区面板', selectionToolbarHint: '选中文本后显示语义和颜色操作。', openSelectionToolbar: '打开选区面板',
  selectionContext: '{context} · {count} 处选区', mixedSelection: '混合内容', inlineCode: '行内代码',
  blockSelection: '代码块 {block} · 第 {from}—{to} 行', textMode: '文本', lineMode: '整行', recentColors: '最近颜色',
  close: '关闭', searchHighlights: '搜索当前笔记重点', allTypes: '全部类型', allSemantics: '全部语义', noMatches: '没有匹配的重点。',
  changeSemantic: '更改语义', removeItem: '移除此条标注',
  applyPreset: '标记为{preset}', linesPreset: '代码行：{preset}', colorCommand: '高亮颜色：{color}',
  chooseColor: '选择高亮颜色', remove: '移除所选标注', openPanel: '打开当前笔记重点', copyCode: '复制当前代码块',
  panelTitle: '当前笔记重点', markLines: '标记所选代码行',
  selectTarget: '请选择一处新的标注位置。', selectText: '请选择文本，或将光标放入已有高亮。',
  cursorInCode: '请将光标放入代码块。', copiedCode: '已复制代码。',
  staleMark: '标注位置已变化，请刷新侧栏后重试。', selectInBlock: '请在该代码块中选择新的标注位置。', selectCode: '请先选择要标记的代码文本。',
  panelEmpty: '打开笔记后，在这里查看正文和代码重点。', summary: '{note} · {count} 条', summaryOne: '{note} · 1 条',
  noHighlights: '选中正文或代码，使用“标记为{preset}”开始。', blankLine: '空行', prose: '正文',
  inlineInfo: '行内代码 · 第 {line} 行', codeInfo: '{language} · 第 {line} 行', code: '代码', pending: '待重新定位',
  contentChanged: '原内容已变化，请重新选择目标。', rebind: '绑定到当前选区', rebindHint: '在该代码块中选择新的位置，再点击绑定。',
  copyExcerpt: '复制摘录', sourceLine: '来源：[[{path}]] · {label}',
  language: '界面语言', languageHint: '切换后立即更新界面，笔记中的名称快照保持原样。', autoLanguage: '跟随 Obsidian',
  syntax: '语法着色', syntaxHint: '选择宿主着色或内置 Shiki。更改后重新启用插件。', native: '宿主', builtinShiki: '内置 Shiki',
  defaultPreset: '默认语义', defaultPresetHint: '“标记所选代码行”使用的语义。', presets: '语义预设',
  presetsHint: '名称和颜色用于后续标注。已有标注保留名称快照。直接改色保留已有语义；正文颜色使用原生格式。',
  resetPresets: '恢复默认预设', reset: '恢复默认', shortcutsHint: '在快捷键中为标注和代码行命令配置按键。',
  presetName: '{preset}的名称', presetColor: '{preset}的颜色',
  inlineMark: '行内标注', proseMark: '正文标注', codeMarks: '代码标注 · {count} 条', expandMetadata: '展开标注元数据',
  important: '重点', question: '疑问', reference: '引用', action: '行动',
  default: '默认色', red: '红色', orange: '橙色', yellow: '黄色', green: '绿色', blue: '蓝色', purple: '紫色',
} as const;
export type Message = keyof typeof zh;
export const en: Record<Message, string> = {
  selectionToolbar: 'Selection toolbar', selectionToolbarHint: 'Show semantic and color actions when text is selected.', openSelectionToolbar: 'Open selection toolbar',
  selectionContext: '{context} · {count} selections', mixedSelection: 'Mixed content', inlineCode: 'Inline code',
  blockSelection: 'Code block {block} · lines {from}–{to}', textMode: 'Text', lineMode: 'Whole lines', recentColors: 'Recent colors',
  close: 'Close', searchHighlights: 'Search note highlights', allTypes: 'All types', allSemantics: 'All semantics', noMatches: 'No matching highlights.',
  changeSemantic: 'Change semantic preset', removeItem: 'Remove this annotation',
  applyPreset: 'Mark as {preset}', linesPreset: 'Code lines: {preset}', colorCommand: 'Highlight color: {color}',
  chooseColor: 'Choose highlight color', remove: 'Remove selected annotations', openPanel: 'Open note highlights', copyCode: 'Copy current code block',
  panelTitle: 'Note highlights', markLines: 'Mark selected code lines',
  selectTarget: 'Select one new annotation target.', selectText: 'Select text or place the cursor in an existing highlight.',
  cursorInCode: 'Place the cursor in a code block.', copiedCode: 'Code copied.',
  staleMark: 'The annotation position changed. Refresh the sidebar and try again.', selectInBlock: 'Select a new position in this code block.', selectCode: 'Select the code text to mark.',
  panelEmpty: 'Open a note to see its prose and code highlights.', summary: '{note} · {count} highlights', summaryOne: '{note} · 1 highlight',
  noHighlights: 'Select prose or code and use “Mark as {preset}” to begin.', blankLine: 'Blank line', prose: 'Prose',
  inlineInfo: 'Inline code · line {line}', codeInfo: '{language} · line {line}', code: 'Code', pending: 'Needs relocation',
  contentChanged: 'The original content changed. Select a new target.', rebind: 'Bind to current selection', rebindHint: 'Select a new position in this code block, then bind it.',
  copyExcerpt: 'Copy excerpt', sourceLine: 'Source: [[{path}]] · {label}',
  language: 'Interface language', languageHint: 'Updates the interface immediately and keeps name snapshots in your notes.', autoLanguage: 'Follow Obsidian',
  syntax: 'Syntax highlighting', syntaxHint: 'Choose native highlighting or built-in Shiki. Re-enable the plugin after changing this option.', native: 'Native', builtinShiki: 'Built-in Shiki',
  defaultPreset: 'Default semantic preset', defaultPresetHint: 'Used by “Mark selected code lines”.', presets: 'Semantic presets',
  presetsHint: 'Names and colors apply to future annotations. Existing annotations keep their name snapshots. Changing color keeps semantics; prose uses native color syntax.',
  resetPresets: 'Restore default presets', reset: 'Restore defaults', shortcutsHint: 'Assign hotkeys to annotation and code-line commands in Hotkeys.',
  presetName: '{preset} name', presetColor: '{preset} color',
  inlineMark: 'Inline annotation', proseMark: 'Prose annotation', codeMarks: 'Code annotations · {count}', expandMetadata: 'Expand annotation metadata',
  important: 'Important', question: 'Question', reference: 'Reference', action: 'Action',
  default: 'Default', red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple',
};

export function resolveLocale(language: Language, obsidianLanguage: string): Locale {
  return language === 'auto' ? obsidianLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en' : language;
}

export function translate(locale: Locale, key: Message, values: Record<string, string | number> = {}): string {
  return (locale === 'zh' ? zh[key] : en[key]).replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token));
}

const presetKeys: Record<string, Message> = { important: 'important', question: 'question', reference: 'reference', action: 'action' };
export function presetName(preset: Preset & { customName?: true }, locale: Locale): string {
  const original = presets.find(item => item.id === preset.id);
  return !preset.customName && original?.name === preset.name ? translate(locale, presetKeys[preset.id]!) : preset.name;
}

export function colorName(color: Color, locale: Locale): string { return translate(locale, color); }
export function colorSearch(color: Color, locale: Locale, query: string): boolean {
  return [colorName(color, locale), colorLabels[color], color].some(value => value.toLowerCase().includes(query.toLowerCase()));
}

const errorKeys: Message[] = ['selectTarget', 'selectText', 'cursorInCode', 'staleMark', 'selectInBlock', 'selectCode'];
export function errorMessage(error: unknown, locale: Locale): string {
  const text = error instanceof Error ? error.message : String(error);
  const key = errorKeys.find(key => zh[key] === text);
  return key ? translate(locale, key) : text;
}
