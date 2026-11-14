import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../src/settings';

describe('设置迁移与校验', () => {
  it('从旧配置迁移并保持默认语义', () => {
    const result = normalizeSettings({ schemaVersion: 1, defaultPreset: 'question' });
    expect(result.schemaVersion).toBe(2);
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
