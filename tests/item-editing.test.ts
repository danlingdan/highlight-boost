import { expect, it } from 'vitest';
import { collectItems } from '../src/anchors';
import { applyChanges, planHighlight } from '../src/editing';
import { planItemUpdate } from '../src/item-editing';
import { presets } from '../src/domain';
import { parseDocument, serializeMetadata } from '../src/parsing';

it('侧栏逐条修改和移除正文及行内语义', () => {
  let text = 'prose `inline`';
  text = applyChanges(text, planHighlight(text, [{ from: 0, to: text.length }], presets[0]!).changes);
  const inline = collectItems(text).find(item => item.kind === 'inline-code')!;
  text = applyChanges(text, planItemUpdate(text, inline, presets[1]!).changes);
  expect(collectItems(text).map(item => item.semantic)).toEqual(['important', 'question']);
  const prose = collectItems(text)[0]!;
  text = applyChanges(text, planItemUpdate(text, prose, null).changes);
  expect(collectItems(text)).toHaveLength(1);
  expect(parseDocument(text).inlines[0]!.text).toBe('inline');
});

it('修改或移除重叠代码标注时只处理选定身份，代码和其他标注保持原样', () => {
  let text = '```js\nabcdef\n```';
  const mark = (word: string, preset: typeof presets[number]) => {
    const from = text.indexOf(word); text = applyChanges(text, planHighlight(text, [{ from, to: from + word.length }], preset).changes);
  };
  mark('abcdef', presets[0]!);
  const block = parseDocument(text).blocks[0]!, metadata = block.metadata!;
  metadata.marks.push({ ...metadata.marks[0]!, id: 'overlap', from: 1, to: 4, quote: 'bcd', prefix: 'a', suffix: 'ef', semantic: 'question', label: '疑问', color: 'red' });
  text = applyChanges(text, [{ ...block.metadataSpan!, insert: serializeMetadata(metadata) }]);
  const target = collectItems(text).find(item => item.quote === 'abcdef')!;
  const untouched = parseDocument(text).blocks[0]!.metadata!.marks.find(mark => mark.quote === 'bcd')!;
  const plan = planItemUpdate(text, target, presets[2]!);
  text = applyChanges(text, plan.changes);
  expect(text.slice(plan.selections[0]!.from, plan.selections[0]!.to)).toBe('abcdef');
  expect(parseDocument(text).blocks[0]!.metadata!.marks.find(mark => mark.quote === 'bcd')).toEqual(untouched);
  expect(collectItems(text).find(item => item.quote === 'abcdef')!.semantic).toBe('reference');
  text = applyChanges(text, planItemUpdate(text, collectItems(text).find(item => item.quote === 'abcdef')!, null).changes);
  expect(collectItems(text).map(item => item.quote)).toEqual(['bcd']);
  expect(parseDocument(text).blocks[0]!.text).toBe('abcdef');
});

it('旧卡片在源文或语义变化后不会操作其他条目', () => {
  const source = 'word', text = applyChanges(source, planHighlight(source, [{ from: 0, to: 4 }], presets[0]!).changes);
  const item = collectItems(text)[0]!;
  expect(() => planItemUpdate(`prefix ${text}`, item, null)).toThrow('标注位置已变化');
  const changed = applyChanges(text, planItemUpdate(text, item, presets[1]!).changes);
  expect(() => planItemUpdate(changed, item, null)).toThrow('标注位置已变化');
});
