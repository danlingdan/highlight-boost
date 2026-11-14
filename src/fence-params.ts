import type { CodeBlock } from './domain';

export interface FenceParameter { key: string; value?: string }
function unquote(value: string): string {
  return /^(["']).*\1$/s.test(value) ? value.slice(1, -1).replace(/\\([\\"'])/g, '$1') : value;
}
function split(value: string, commas = false): string[] {
  const result: string[] = []; let start = 0, quote = '', depth = 0;
  for (let i = 0; i <= value.length; i++) {
    const character = value[i] ?? ' ';
    if (quote) { if (character === '\\') i++; else if (character === quote) quote = ''; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '[' || character === '{') depth++;
    if (character === ']' || character === '}') depth--;
    if (!depth && (i === value.length || (commas ? character === ',' : /\s/.test(character)))) {
      if (i > start) result.push(value.slice(start, i)); start = i + 1;
    }
  }
  return result;
}
export function fenceParameters(meta: string): FenceParameter[] {
  return split(meta).flatMap(raw => {
    if (raw.startsWith('{') && raw.endsWith('}')) {
      const body = raw.slice(1, -1);
      if (/^\s*[\w-]+\s*=/.test(body)) return fenceParameters(split(body, true).join(' '));
      return [{ key: 'mark', value: raw }];
    }
    const match = /^([\w-]+)[:=](.*)$/s.exec(raw);
    return match ? [{ key: match[1]!.toLowerCase(), value: match[1]!.toLowerCase() === 'hl' ? match[2]! : unquote(match[2]!) }] : [{ key: raw.toLowerCase() }];
  });
}
export function parameterValue(parameters: FenceParameter[], ...keys: string[]): string | undefined {
  for (const key of keys) { const found = parameters.find(parameter => parameter.key === key.toLowerCase()); if (found) return found.value ?? 'true'; }
  return undefined;
}
export type ParameterLineKind = 'mark' | 'insert' | 'delete';
function selectors(value: string): string[] {
  let body = value.replace(/^\{(.*)\}$/s, '$1').replace(/^\[(.*)\]$/s, '$1');
  body = body.replace(/^\s*(?:"[^"]*"|'[^']*')\s*:/, '');
  return split(body, true).flatMap(part => split(part)).map(part => unquote(part.trim())).filter(Boolean);
}
function matches(selector: string, number: number, text: string, words: boolean): boolean {
  const range = /^(\d+)(?:-(\d+))?$/.exec(selector);
  if (range) return number >= Number(range[1]) && number <= Number(range[2] ?? range[1]);
  if (!words) return false;
  const restricted = /^(\d+(?:-\d+)?)\|(.*)$/s.exec(selector);
  if (restricted) return matches(restricted[1]!, number, text, false) && text.includes(unquote(restricted[2]!));
  if (selector.startsWith('/')) {
    const regex = /^\/(.*)\/([imsu]*)$/.exec(selector);
    if (!regex) return false;
    try { return new RegExp(regex[1]!, regex[2]).test(text); } catch { return false; }
  }
  return text.includes(selector);
}
export function parameterLines(block: CodeBlock): (ParameterLineKind | undefined)[] {
  const parameters = fenceParameters(block.meta ?? '');
  const result: (ParameterLineKind | undefined)[] = block.text.split('\n').map(() => undefined);
  for (const [key, kind] of [['hl', 'mark'], ['hl_lines', 'mark'], ['mark', 'mark'], ['ins', 'insert'], ['del', 'delete']] as const) {
    for (const parameter of parameters.filter(parameter => parameter.key === key && parameter.value !== undefined)) {
      const parts = selectors(parameter.value!);
      block.text.split('\n').forEach((line, index) => { if (parts.some(part => matches(part, index + 1, line, key === 'hl'))) result[index] = kind; });
    }
  }
  return result;
}
