import type { LanguageRegistration, ThemeRegistration } from 'shiki';
import type { CodeSyntaxSettings } from './settings';
import { knownLanguage } from './languages';

export interface SyntaxFiles { list(path: string): Promise<{ files: string[] }>; read(path: string): Promise<string> }
export interface CustomTheme { id: string; label: string; theme: ThemeRegistration }
export interface SyntaxResources { themes: CustomTheme[]; languages: LanguageRegistration[]; errors: { path: string; message: string }[]; languagePaths?: Record<string, string> }

function vaultPath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (/^(?:\/|[a-z]:)/i.test(normalized) || normalized.split('/').includes('..')) throw new Error('请选择笔记库内的目录。');
  return normalized;
}

export async function loadSyntaxResources(settings: CodeSyntaxSettings, files: SyntaxFiles): Promise<SyntaxResources> {
  const result: SyntaxResources = { themes: [], languages: [], errors: [], languagePaths: {} };
  const load = async (folder: string, kind: 'theme' | 'language') => {
    if (!folder) return;
    let directory: string;
    try { directory = vaultPath(folder); }
    catch (error) { result.errors.push({ path: folder, message: String(error) }); return; }
    let entries: string[];
    try { entries = (await files.list(directory)).files.filter(path => /\.json$/i.test(path)).sort(); }
    catch (error) { result.errors.push({ path: directory, message: String(error) }); return; }
    for (const entry of entries) {
      try {
        const path = vaultPath(entry);
        const data: unknown = JSON.parse(await files.read(path));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON 内容应为对象。');
        const value = data as Record<string, unknown>;
        if (kind === 'theme') {
          if (!value.colors && !Array.isArray(value.tokenColors) && !Array.isArray(value.settings)) throw new Error('主题缺少 colors 或 tokenColors。');
          const id = `custom:${path}`;
          result.themes.push({ id, label: typeof value.displayName === 'string' ? value.displayName : typeof value.name === 'string' ? value.name : path, theme: { ...value, name: id } });
        } else {
          if (typeof value.name !== 'string' || !value.name.trim() || typeof value.scopeName !== 'string' || !Array.isArray(value.patterns)) throw new Error('语法需要 name、scopeName 和 patterns。');
          const language = value as unknown as LanguageRegistration;
          if (result.languages.some(existing => existing.name === language.name)) throw new Error(`语言名称重复：${language.name}`);
          result.languages.push(language);
          result.languagePaths![language.name] = path;
        }
      } catch (error) { result.errors.push({ path: entry, message: String(error) }); }
    }
  };
  await load(settings.customThemeFolder, 'theme');
  await load(settings.customLanguageFolder, 'language');
  let changed: boolean;
  do {
    changed = false;
    result.languages = result.languages.filter(language => {
      const missing = language.embeddedLangs?.filter(name => !knownLanguage(name, result.languages)) ?? [];
      if (!missing.length) return true;
      result.errors.push({ path: result.languagePaths![language.name]!, message: `语言 ${language.name} 缺少依赖：${missing.join(', ')}` });
      changed = true; return false;
    });
  } while (changed);
  return result;
}
