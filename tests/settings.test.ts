import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../src/settings';

describe('设置迁移与校验', () => {
  it('选区面板默认开启，最近颜色去重并保留三种', () => {
    expect(normalizeSettings(null).selectionToolbar).toBe(true);
    const result = normalizeSettings({ selectionToolbar: false, recentColors: ['blue', 'blue', 'bad', 'red', 'green', 'yellow'] });
    expect(result.selectionToolbar).toBe(false);
    expect(result.recentColors).toEqual(['blue', 'red', 'green']);
    expect(normalizeSettings(result)).toEqual(result);
  });
  it('旧配置默认跟随 Obsidian，校验语言并保持规范化一致', () => {
    expect(normalizeSettings({ schemaVersion: 1 }).language).toBe('auto');
    expect(normalizeSettings({ language: 'en' }).language).toBe('en');
    expect(normalizeSettings({ language: 'zh' }).language).toBe('zh');
    const result = normalizeSettings({ language: 'invalid' });
    expect(result.language).toBe('auto');
    expect(normalizeSettings(result)).toEqual(result);
  });

  it('显式自定义的内置同名名称保持身份，清空名称恢复默认', () => {
    const custom = normalizeSettings({ presets: [{ id: 'important', name: '重点', customName: true }] });
    expect(custom.presets[0]?.customName).toBe(true);
    expect(normalizeSettings(custom)).toEqual(custom);
    expect(normalizeSettings({ presets: [{ id: 'important', name: '', customName: true }] }).presets[0]?.customName).toBeUndefined();
  });
  it('从旧配置迁移并保持默认语义', () => {
    const result = normalizeSettings({ schemaVersion: 1, defaultPreset: 'question' });
    expect(result.schemaVersion).toBe(3);
    expect(result.defaultPreset).toBe('question');
    expect(result.presets).toHaveLength(4);
    expect(normalizeSettings(result)).toEqual(result);
  });

  it('保留稳定 ID，校验每个名称与颜色', () => {
    const result = normalizeSettings({ defaultPreset: 'removed', presets: [
      { id: 'important', name: '  考点  ', color: 'purple' },
      { id: 'question', name: '', color: 'invalid' },
      { id: 'unknown', name: '忽略', color: 'red' },
    ] });
    expect(result.defaultPreset).toBe('important');
    expect(result.presets[0]).toEqual({ id: 'important', name: '考点', color: 'purple' });
    expect(result.presets[1]).toEqual({ id: 'question', name: '疑问', color: 'red' });
    expect(result.presets).toHaveLength(4);
  });

  it('接受空配置与错误类型，每次返回独立对象', () => {
    for (const value of [null, undefined, [], 'bad', { presets: [null, 1], defaultPreset: {} }]) {
      expect(normalizeSettings(value)).toEqual(normalizeSettings(null));
    }
    const first = normalizeSettings(null);
    first.presets[0]!.name = '改变';
    expect(normalizeSettings(null).presets[0]!.name).toBe('重点');
  });
});
