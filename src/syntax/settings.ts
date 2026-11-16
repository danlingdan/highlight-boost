export interface CodeSyntaxSettings {
  lightTheme: string;
  darkTheme: string;
  preferThemeColors: boolean;
  inlineHighlighting: boolean;
  customThemeFolder: string;
  customLanguageFolder: string;
  disabledLanguages: string[];
}

export const defaultCodeSyntax: CodeSyntaxSettings = {
  lightTheme: 'obsidian-theme', darkTheme: 'obsidian-theme', preferThemeColors: true,
  inlineHighlighting: true, customThemeFolder: '', customLanguageFolder: '', disabledLanguages: [],
};

export function normalizeCodeSyntax(value: unknown): CodeSyntaxSettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = (key: string, fallback = '') => typeof input[key] === 'string' ? input[key].trim() || fallback : fallback;
  return {
    lightTheme: text('lightTheme', 'obsidian-theme'), darkTheme: text('darkTheme', 'obsidian-theme'),
    preferThemeColors: input.preferThemeColors !== false, inlineHighlighting: input.inlineHighlighting !== false,
    customThemeFolder: text('customThemeFolder'), customLanguageFolder: text('customLanguageFolder'),
    disabledLanguages: Array.isArray(input.disabledLanguages) ? [...new Set(input.disabledLanguages.filter((v): v is string => typeof v === 'string' && !!v.trim()).map(v => v.trim().toLowerCase()))] : [],
  };
}
