import { describe, expect, it } from 'vitest';
import { colorName, colorSearch, en, errorMessage, presetName, resolveLocale, translate, zh, type Message } from '../src/i18n';
import { normalizeSettings } from '../src/settings';
import { presets } from '../src/domain';

describe('中英文界面', () => {
  it('词条与插值参数在两种语言中完整对应', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    for (const key of Object.keys(zh) as Message[]) {
      expect(en[key].trim().length).toBeGreaterThan(0);
      expect(placeholders(en[key])).toEqual(placeholders(zh[key]));
    }
  });

  it('跟随 Obsidian，未提供的语言使用英文，也可明确指定语言', () => {
    expect(resolveLocale('auto', 'zh-CN')).toBe('zh');
    expect(resolveLocale('auto', 'zh-TW')).toBe('zh');
    expect(resolveLocale('auto', 'en')).toBe('en');
    expect(resolveLocale('auto', 'de')).toBe('en');
    expect(resolveLocale('en', 'zh')).toBe('en');
    expect(resolveLocale('zh', 'en')).toBe('zh');
  });

  it('插值只替换模板，不解释用户文本中的占位符', () => {
    expect(translate('en', 'applyPreset', { preset: '{count} 自定义' })).toBe('Mark as {count} 自定义');
    expect(translate('zh', 'codeMarks', { count: 0 })).toBe('代码标注 · 0 条');
    expect(translate('en', 'sourceLine', { path: 'note{preset}.md', label: '名称' })).toBe('Source: [[note{preset}.md]] · 名称');
  });

  it('默认预设只改变显示，自定义名称保留原文', () => {
    const settings = normalizeSettings(null), before = structuredClone(settings);
    expect(presetName(settings.presets[0]!, 'en')).toBe('Important');
    expect(presetName(settings.presets[0]!, 'zh')).toBe('重点');
    expect(presetName({ ...presets[0]!, name: '我的考点' }, 'en')).toBe('我的考点');
    expect(presetName({ ...presets[0]!, customName: true }, 'en')).toBe('重点');
    expect(settings).toEqual(before);
  });

  it('两种语言的颜色名称都可搜索', () => {
    expect(colorName('purple', 'en')).toBe('Purple');
    expect(colorSearch('purple', 'en', '紫')).toBe(true);
    expect(colorSearch('purple', 'zh', 'PURP')).toBe(true);
    expect(colorSearch('yellow', 'en', 'purple')).toBe(false);
  });

  it('已知编辑提示本地化，其他错误保留原信息', () => {
    expect(errorMessage(new Error('请先选择要标记的代码文本。'), 'en')).toBe('Select the code text to mark.');
    expect(errorMessage(new Error('请在该代码块中选择新的标注位置。'), 'zh')).toContain('该代码块');
    expect(errorMessage(new Error('disk full'), 'en')).toBe('disk full');
  });
});
