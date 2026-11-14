import { colors, presets, type Color, type Preset } from './domain';

export interface Settings {
  schemaVersion: 2;
  defaultPreset: string;
  presets: Preset[];
  syntaxProvider: 'native' | 'shiki';
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeSettings(value: unknown): Settings {
  const input = record(value);
  const configured = Array.isArray(input.presets) ? input.presets : [];
  const normalized = presets.map(original => {
    const saved = record(configured.find(entry => record(entry).id === original.id));
    const name = typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim() : original.name;
    const color = colors.includes(saved.color as Color) ? saved.color as Color : original.color;
    return { id: original.id, name, color };
  });
  return {
    schemaVersion: 2,
    defaultPreset: normalized.some(preset => preset.id === input.defaultPreset) ? input.defaultPreset as string : presets[0]!.id,
    presets: normalized,
    syntaxProvider: input.syntaxProvider === 'shiki' ? 'shiki' : 'native',
  };
}
