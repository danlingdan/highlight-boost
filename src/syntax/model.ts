import type { CodeBlock } from '../domain';
import { codeOptions, defaultCodeDisplay, type CodeDisplaySettings } from '../code-options';
import { fenceTokens, fenceParameters, parameterValue } from '../fence-params';

const displayKeys = new Set(['title', 'file', 'fold', 'unfold', 'ln', 'linenos', 'linenostart', 'startlinenumber', 'showlinenumbers', 'wrap', 'frame', 'hb-fold', 'hb-collapsed']);
export function unifiedCodeModel(block: CodeBlock, settings: CodeDisplaySettings = defaultCodeDisplay) {
  const options = codeOptions(block, settings), parameters = fenceParameters(block.meta ?? '');
  const flag = parameterValue(parameters, 'usediffsyntax');
  const diff = options.diff && flag !== 'false' && (block.language.toLowerCase() === 'diff' || flag === 'true');
  const preserved = fenceTokens(block.meta ?? '').filter(token => {
    if (/^\{\s*[\w-]+\s*=/.test(token)) return false;
    return !displayKeys.has(/^([\w-]+)/.exec(token)?.[1]?.toLowerCase() ?? '');
  });
  const meta = [`frame=${options.frame}`, `showLineNumbers=${options.showLineNumbers}`, `startLineNumber=${options.startLine}`, `wrap=${options.wrap}`, ...(options.title || options.showTitle ? [`title=${JSON.stringify(options.title || block.language || 'Code')}`] : []), ...preserved].join(' ');
  return { block, options, diff, meta, sourceMeta: block.meta ?? '' };
}
