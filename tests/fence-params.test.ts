import { expect, it } from 'vitest';
import { fenceParameters, parameterLines } from '../src/fence-params';
import { codeOptions, defaultCodeDisplay } from '../src/code-options';
import { parseDocument } from '../src/parsing';

const block = (meta: string) => parseDocument('```js ' + meta + '\nfirst();\ntarget();\n\nlast();\n```').blocks[0]!;
it('Code Styler 和 Customizer 的标题、编号和折叠映射到统一选项', () => {
  expect(codeOptions(block('file:"src/my file.js" ln:27 fold'), defaultCodeDisplay)).toMatchObject({ title: 'src/my file.js', showTitle: true, showLineNumbers: true, startLine: 27, collapsible: true, collapseByDefault: true });
  expect(codeOptions(block('title:"file.js" ln=false unfold'), { ...defaultCodeDisplay, showLineNumbers: true, collapseByDefault: true })).toMatchObject({ showLineNumbers: false, collapsible: true, collapseByDefault: false });
  expect(codeOptions(block('fold:"更多代码"'), defaultCodeDisplay).title).toBe('更多代码');
});
it('Hugo 支持大小写不敏感的属性、数组、逗号和逻辑编号', () => {
  const example = block('{lineNos=table,lineNoStart=20,hl_lines=[1,"3-4"]}');
  expect(codeOptions(example, defaultCodeDisplay)).toMatchObject({ showLineNumbers: true, startLine: 20 });
  expect(parameterLines(example)).toEqual(['mark', undefined, 'mark', 'mark']);
  expect(parameterLines(block('{hl_lines="1-2 4"}'))).toEqual(['mark', 'mark', undefined, 'mark']);
});
it('HB 原生参数优先于别名且参数值中的词语不被当作指令', () => {
  const example = block('title="hl:2 fold ln:9" file:other ln:20 showLineNumbers=false startLineNumber=5 hb-fold=false fold');
  expect(codeOptions(example, defaultCodeDisplay)).toMatchObject({ title: 'hl:2 fold ln:9', showLineNumbers: false, startLine: 5, collapsible: false });
  expect(parameterLines(example)).toEqual([undefined, undefined, undefined, undefined]);
});
it('行范围按块内行计算，与显示起始编号独立，越界范围不扩展数组', () => {
  expect(parameterLines(block('ln:20 hl:1,3-4,0,9-999999999999'))).toEqual(['mark', undefined, 'mark', 'mark']);
  expect(parameterLines(block('hl:4-2,-1,0'))).toEqual([undefined, undefined, undefined, undefined]);
});
it('Expressive Code 数字范围、标签和增删行共用原文行映射', () => {
  expect(parameterLines(block('{1, 3} ins={"新增":2-3} del={4}'))).toEqual(['mark', 'insert', 'insert', 'delete']);
  expect(parameterLines(block('collapse={2-3} title="{4}"'))).toEqual([undefined, undefined, undefined, undefined]);
});
it('hl 文本、限定行文本与正则匹配保留代码内容', () => {
  const example = block('hl:first,4|target,2-3|target,/^last/');
  expect(parameterLines(example)).toEqual(['mark', 'mark', undefined, 'mark']);
  expect(parameterLines(block('hl:"target();"'))[1]).toBe('mark');
  expect(parameterLines(block('hl:/[/'))).toEqual([undefined, undefined, undefined, undefined]);
});
it('标题转义、未知参数及不完整输入可重复解析', () => {
  expect(fenceParameters('title="a \\"b\\".js" custom:x')).toEqual([{ key: 'title', value: 'a "b".js' }, { key: 'custom', value: 'x' }]);
  expect(fenceParameters('title="unfinished')).toEqual([]);
  expect(codeOptions(block('ln:10:20'), defaultCodeDisplay).startLine).toBe(1);
});
