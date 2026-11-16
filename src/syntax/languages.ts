import { bundledLanguages, bundledLanguagesInfo } from 'shiki';
import type { LanguageRegistration } from 'shiki';
import type { InlineCode } from '../domain';

const aliases = new Map(bundledLanguagesInfo.flatMap(language => [language.id, ...(language.aliases ?? [])].map(name => [name.toLowerCase(), language.id] as const)));
const plain = new Set(['text', 'txt', 'plain', 'plaintext']);
const dedicated = new Set(['mermaid', 'query', 'dataview', 'dataviewjs', 'tasks', 'chart', 'charts', 'tracker', 'button', 'buttons']);

export function resolveLanguage(name: string, custom: LanguageRegistration[] = []): string {
  const key = name.trim().toLowerCase();
  const registration = custom.find(language => language.name.toLowerCase() === key || language.aliases?.some(alias => alias.toLowerCase() === key));
  return registration?.name ?? (plain.has(key) ? 'text' : key === 'ansi' ? 'ansi' : aliases.get(key) ?? key);
}

export function knownLanguage(name: string, custom: LanguageRegistration[] = []): boolean {
  const key = resolveLanguage(name, custom);
  return key === 'text' || key === 'ansi' || Object.hasOwn(bundledLanguages, key) || custom.some(language => language.name === key);
}

export function resolveCodeOwner(name: string, excluded: string[] = [], custom: LanguageRegistration[] = []): 'hb' | 'external' {
  const raw = name.trim().toLowerCase(), key = resolveLanguage(raw, custom);
  return dedicated.has(raw) || raw.startsWith('ad-') || excluded.some(language => language.toLowerCase() === raw || resolveLanguage(language, custom) === key) ? 'external' : 'hb';
}

export function inlineLanguage(text: string): { language: string; code: string; prefix: number } | undefined {
  const match = /^\{([^\s}]+)\} ([\s\S]*)$/.exec(text);
  return match ? { language: match[1]!, code: match[2]!, prefix: match[1]!.length + 3 } : undefined;
}

export function inlineSourceOffsets(inline: InlineCode, text: string): number[] {
  const raw = text.slice(inline.content.from, inline.content.to), offsets: number[] = [];
  let normalized = '';
  for (let index = 0; index < raw.length; index++) {
    offsets.push(inline.content.from + index);
    const character = raw[index]!;
    normalized += character === '\r' || character === '\n' ? ' ' : character;
    if (character === '\r' && raw[index + 1] === '\n') index++;
  }
  offsets.push(inline.content.to);
  const padding = Math.max(0, normalized.indexOf(inline.text));
  return offsets.slice(padding, padding + inline.text.length + 1);
}
