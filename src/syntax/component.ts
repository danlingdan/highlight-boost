import type { CodeBlock } from '../domain';
import type { SyntaxEngine } from './engine';
import type { CodeDisplaySettings } from '../code-options';
import { translate, type Locale } from '../i18n';
import { unifiedCodeModel } from './model';
import { renderCode } from '../rendering';
import { renderCodeDisplay } from '../code-display';

export async function renderUnifiedCode(engine: SyntaxEngine, block: CodeBlock, document: Document, locale: Locale, settings: CodeDisplaySettings, sessions: Map<string, boolean>, key: string): Promise<HTMLElement> {
  const model = unifiedCodeModel(block, settings);
  const holder = document.createElement('div');
  holder.className = 'hb-unified-code'; holder.dataset.hbFence = String(block.fenceFrom);
  holder.dataset.hbSourceCode = block.text;
  holder.append(await engine.render(block.text, block.language, model.meta, document, locale));
  const code = holder.querySelector<HTMLElement>('pre > code');
  if (code) {
    renderCode(code, block, locale, true);
    renderCodeDisplay(code, block, settings, locale, sessions, key);
  }
  for (const note of holder.querySelectorAll<HTMLElement>('[data-hb-note-id]')) {
    const edit = document.createElement('button'); edit.textContent = translate(locale, 'editAnnotation');
    edit.className = 'hb-code-edit-note'; edit.addEventListener('click', () => edit.dispatchEvent(new CustomEvent('hb-edit-mark', { bubbles: true, detail: { key, id: note.dataset.hbNoteId } }))); note.append(edit);
  }
  for (const [index, details] of [...holder.querySelectorAll<HTMLDetailsElement>('details.ec-section')].entries()) {
    const sectionKey = `${key}\u0000section\u0000${index}`;
    details.dataset.hbSectionKey = sectionKey;
    if (sessions.has(sectionKey)) details.open = !sessions.get(sectionKey);
    details.addEventListener('toggle', () => { sessions.set(sectionKey, !details.open); });
  }
  return holder;
}
