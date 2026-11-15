import { detachedEl } from './dom';
import type { CodeBlock } from './domain';
import { codeOptions, diffAfter, diffKinds, type CodeDisplaySettings } from './code-options';
import { translate, type Locale } from './i18n';
import { parameterLines } from './fence-params';
import { structuredRows } from './code-rows';

interface DisplayState { wrapper: HTMLElement; body: HTMLElement; header: HTMLElement; target: HTMLElement; pre: HTMLElement; signature: string }
const displays = new WeakMap<HTMLElement, DisplayState>();

export function clearCodeDisplay(code: HTMLElement): void {
  const display = displays.get(code);
  if (!display) return;
  for (const row of code.querySelectorAll<HTMLElement>('[data-hb-number], [data-hb-diff], [data-hb-param]')) { delete row.dataset.hbNumber; delete row.dataset.hbDiff; delete row.dataset.hbParam; }
  display.pre.classList.remove('hb-code-wrap'); display.pre.style.removeProperty('--hb-number-font');
  display.wrapper.replaceWith(...display.body.childNodes); displays.delete(code);
}

export function renderCodeDisplay(code: HTMLElement, block: CodeBlock, settings: CodeDisplaySettings, locale: Locale, sessions: Map<string, boolean>, key: string): void {
  const options = codeOptions(block, settings), isDiff = block.language.toLowerCase() === 'diff';
  const markers = parameterLines(block);
  const active = options.showTitle || options.showLineNumbers || options.collapsible || options.wrap || isDiff && options.diff || markers.some(Boolean);
  const pre = code.closest('pre');
  if (!active || !pre?.parentElement) { clearCodeDisplay(code); return; }
  let display = displays.get(code);
  if (!display) {
    const doc = code.ownerDocument, wrapper = detachedEl(doc, 'div'), header = detachedEl(doc, 'div'), body = detachedEl(doc, 'div');
    wrapper.className = 'hb-code-display'; header.className = 'hb-code-header'; body.className = 'hb-code-body'; body.id = `hb-code-${crypto.randomUUID()}`;
    const target = code.closest<HTMLElement>('.expressive-code') ?? pre;
    const notes = target === pre && pre.nextElementSibling?.classList.contains('hb-code-notes') ? pre.nextElementSibling : undefined;
    target.before(wrapper); wrapper.append(header, body); body.append(target); if (notes) body.append(notes);
    display = { wrapper, header, body, target, pre, signature: '' }; displays.set(code, display);
  }
  display.wrapper.dataset.hbFence = String(block.fenceFrom);
  display.wrapper.classList.toggle('hb-show-numbers', options.showLineNumbers);
  pre.classList.toggle('hb-code-wrap', options.wrap);
  pre.style.setProperty('--hb-number-font', options.numberFont === 'interface' ? 'var(--font-interface)' : 'var(--font-monospace)');
  const structured = structuredRows(code);
  const rows = structured.length ? structured.map(row => row.parentElement!) : [...code.querySelectorAll<HTMLElement>(':scope > .hb-code-row')];
  const kinds = isDiff && options.diff ? diffKinds(block.text) : [];
  rows.forEach((row, index) => {
    if (options.showLineNumbers && index < block.lines.length) row.dataset.hbNumber = String(options.startLine + index); else delete row.dataset.hbNumber;
    if (kinds[index]) row.dataset.hbDiff = kinds[index]; else delete row.dataset.hbDiff;
    if (markers[index]) row.dataset.hbParam = markers[index]; else delete row.dataset.hbParam;
  });
  const t = (message: Parameters<typeof translate>[1]) => translate(locale, message);
  const collapsed = options.collapsible && (sessions.get(key) ?? options.collapseByDefault);
  display.body.hidden = collapsed;
  const signature = JSON.stringify({ options, locale, code: block.text, key, count: block.metadata?.marks.length ?? 0, collapsed });
  if (display.signature === signature) return;
  display.signature = signature; display.header.replaceChildren();
  const doc = code.ownerDocument;
  if (options.showTitle) {
    const title = detachedEl(doc, 'span'); title.className = 'hb-code-title'; title.textContent = options.title || block.language || t('code'); display.header.append(title);
  }
  if (block.metadata?.marks.length) {
    const count = detachedEl(doc, 'span'); count.className = 'hb-code-mark-count'; count.textContent = `${translate(locale, 'codeMarks', { count: block.metadata.marks.length })} · ${[...new Set(block.metadata.marks.map(mark => mark.label))].join(' / ')}`; display.header.append(count);
  }
  const button = (action: string, text: string, run: (button: HTMLButtonElement) => void) => {
    const button = detachedEl(doc, 'button'); button.dataset.hbDisplayAction = action; button.textContent = text; button.setAttribute('aria-label', text);
    button.addEventListener('click', () => run(button)); display.header.append(button); return button;
  };
  if (options.collapsible) {
    const toggle = button('toggle', t(collapsed ? 'expandCode' : 'collapseCode'), () => {
      sessions.set(key, !display.body.hidden); display.signature = '';
      renderCodeDisplay(code, block, settings, locale, sessions, key);
    });
    toggle.setAttribute('aria-expanded', String(!collapsed)); toggle.setAttribute('aria-controls', display.body.id);
  }
  const copy = (value: string, button: HTMLButtonElement) => {
    void Promise.resolve().then(() => doc.defaultView!.navigator.clipboard.writeText(value)).then(() => { button.dataset.hbCopied = 'true'; button.title = t('copiedCode'); button.setAttribute('aria-description', t('copiedCode')); }).catch(() => { delete button.dataset.hbCopied; button.title = t('copyFailed'); button.setAttribute('aria-description', t('copyFailed')); });
  };
  button('copy', t(isDiff ? 'copyRawDiff' : 'copyCode'), button => copy(block.text, button));
  if (isDiff) button('copy-after', t('copyDiffAfter'), button => copy(diffAfter(block.text), button));
}
