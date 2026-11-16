import { colors, presets, type Color, type Preset } from './domain';
import type { Language } from './i18n';
import { normalizeCollections, type HighlightCollection } from './collections';
import type { ExcerptTemplate } from './excerpts';
import { normalizeCodeDisplay, type CodeDisplaySettings } from './code-options';
import { normalizeCodeSyntax, type CodeSyntaxSettings } from './syntax/settings';

export interface ConfiguredPreset extends Preset { customName?: true }

export interface Settings {
  schemaVersion: 3;
  defaultPreset: string;
  presets: ConfiguredPreset[];
  codeSyntax: CodeSyntaxSettings;
  language: Language;
  selectionToolbar: boolean;
  recentColors: Color[];
  collections: HighlightCollection[];
  excerptTemplate: ExcerptTemplate;
  codeDisplay: CodeDisplaySettings;
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
    const preset: ConfiguredPreset = { id: original.id, name, color };
    if (saved.customName === true && typeof saved.name === 'string' && saved.name.trim()) preset.customName = true;
    return preset;
  });
  return {
    schemaVersion: 3,
    defaultPreset: normalized.some(preset => preset.id === input.defaultPreset) ? input.defaultPreset as string : presets[0]!.id,
    presets: normalized,
    codeSyntax: normalizeCodeSyntax(input.codeSyntax),
    language: input.language === 'zh' || input.language === 'en' ? input.language : 'auto',
    selectionToolbar: input.selectionToolbar !== false,
    recentColors: Array.isArray(input.recentColors) ? [...new Set(input.recentColors.filter((color): color is Color => colors.includes(color as Color)))].slice(0, 3) : [],
    collections: normalizeCollections(input.collections),
    excerptTemplate: ['plain', 'quote', 'code'].includes(String(input.excerptTemplate)) ? input.excerptTemplate as ExcerptTemplate : 'markdown',
    codeDisplay: normalizeCodeDisplay(input.codeDisplay),
  };
}
