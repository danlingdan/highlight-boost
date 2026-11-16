import { setIcon, Notice, type MarkdownView } from 'obsidian';
import type HighlightBoost from './main';
import type { IndexHit } from './vault-index';
import type { ExcerptContext } from './excerpts';
import { colors } from './domain';
import { action, menuAt } from './ui';
import { annotate, chooseCollection } from './item-actions';

const semanticIcons: Record<string, string> = { important: 'star', question: 'circle-help', reference: 'quote', action: 'check-square' };

export function renderCard(parent: HTMLElement, plugin: HighlightBoost, hit: IndexHit, context: ExcerptContext, preferred?: MarkdownView, removeEntry?: () => void): HTMLElement {
  const { item } = hit, t = plugin.t.bind(plugin);
  const card = parent.createDiv({ cls: `hb-card hb-${item.color}` }); card.dataset.hbPath = hit.path; card.dataset.hbItem = JSON.stringify([hit.path, item.kind, item.blockId ?? '', item.markId ?? item.id]);
  if (item.semantic) card.dataset.hbSemantic = item.semantic;
  const label = item.markId ? item.label : plugin.colorLabel(item.color);
  const header = card.createDiv({ cls: 'hb-card-header' });
  const badge = header.createSpan({ cls: 'hb-semantic', text: label }); const semanticIcon = badge.createSpan({ cls: 'hb-semantic-icon' }); setIcon(semanticIcon, semanticIcons[item.semantic ?? ''] ?? 'highlighter'); badge.prepend(semanticIcon);
  header.createSpan({ cls: 'hb-type', text: t(item.kind === 'prose' ? 'prose' : item.kind === 'inline-code' ? 'inlineCode' : 'code') + (item.language ? ` · ${item.language}` : '') });
  if (item.status !== 'resolved') header.createSpan({ text: t('pending'), cls: 'hb-pending' });
  const jump = card.createEl('button', { text: item.quote || t('blankLine'), cls: item.kind === 'prose' ? 'hb-quote' : 'hb-quote hb-code-quote' });
  if (item.kind !== 'prose') {
    jump.empty(); jump.classList.toggle('hb-card-wrap', plugin.settings.codeDisplay.wrap);
    const lines = (item.quote || t('blankLine')).split('\n');
    lines.forEach((line, index) => jump.createSpan({ text: line + (index < lines.length - 1 ? '\n' : ''), cls: 'hb-quote-row', attr: item.line ? { 'data-hb-line': String(item.line + index) } : {} }));
  }
  if (item.note) {
    const note = card.createEl('details', { cls: 'hb-note', attr: { 'data-hb-expanded': 'note' } });
    note.createEl('summary', { text: item.note.split('\n')[0]!.slice(0, 100) }); note.createDiv({ text: item.note, cls: 'hb-note-text' });
  }
  card.createEl('small', { text: hit.path, cls: 'hb-source-path', attr: { title: hit.path } });
  if (context.headings.length) card.createEl('small', { text: context.headings.join(' › '), cls: 'hb-heading-context' });
  if (context.code !== undefined && context.code !== item.quote) {
    const details = card.createEl('details', { cls: 'hb-card-context', attr: { 'data-hb-expanded': 'context' } });
    details.createEl('summary', { text: t('excerptCodeContext', { from: context.contextFrom!, to: context.contextTo! }) }); details.createEl('pre').createEl('code', { text: context.code });
  }
  const sourceView = plugin.openView(hit.path, preferred), file = sourceView?.file;
  const act = (run: (view: MarkdownView) => void | Promise<void>) => {
    if (sourceView && sourceView.file !== file) { new Notice(t('staleMark')); return; }
    void plugin.editHit(hit, run, sourceView);
  };
  const locate = () => { if (item.status !== 'resolved') new Notice(t('contentChanged')); else act(view => plugin.jumpToItem(view, item)); };
  jump.addEventListener('click', locate);
  const actions = card.createDiv({ cls: 'hb-card-actions' });
  action(actions, t('locate'), 'arrow-right', locate, 'hb-locate');
  if (item.status === 'resolved') {
    const edit = action(actions, t('annotation'), 'message-square', () => annotate(plugin, hit, edit, sourceView), 'hb-edit-note');
  }
  const copy = action(actions, t('copy'), 'copy', () => {
    void card.ownerDocument.defaultView!.navigator.clipboard.writeText(plugin.excerpt(hit)).then(() => { copy.lastElementChild!.textContent = t('copied'); copy.setAttribute('aria-label', t('copied')); card.ownerDocument.defaultView!.setTimeout(() => { if (copy.isConnected) { copy.lastElementChild!.textContent = t('copy'); copy.setAttribute('aria-label', t('copy')); } }, 2000); }).catch(() => { copy.lastElementChild!.textContent = t('copyFailed'); });
  }, 'hb-copy-excerpt');
  const canRebind = (item.kind === 'code-line' || item.kind === 'code-range') && sourceView === preferred && sourceView;
  const rebind = () => { if (sourceView && sourceView.file === file) plugin.rebind(sourceView.editor, item); };
  const more = action(actions, t('more'), 'ellipsis', () => menuAt(more, menu => {
    if (item.status === 'resolved') {
      for (const preset of plugin.settings.presets) menu.addItem(entry => entry.setTitle(`${t('changeSemantic')} · ${plugin.presetLabel(preset)}`).setChecked(item.semantic === preset.id).onClick(() => act(view => plugin.updateItem(view.editor, item, plugin.presetForAction(preset.id)))));
      menu.addSeparator();
      for (const color of colors) menu.addItem(entry => entry.setTitle(`${t('chooseColor')} · ${plugin.colorLabel(color)}`).setChecked(item.color === color).onClick(() => act(view => plugin.updateItem(view.editor, item, { id: item.semantic ?? `color:${color}`, color, name: label }))));
      menu.addSeparator();
      menu.addItem(entry => entry.setTitle(t('addCollection')).setIcon('folder-plus').onClick(() => chooseCollection(plugin, hit, more)));
      menu.addItem(entry => entry.setTitle(t('removeItem')).setIcon('trash-2').onClick(() => act(view => plugin.updateItem(view.editor, item, null))));
    }
    if (canRebind && item.status === 'resolved') menu.addItem(entry => entry.setTitle(t('rebind')).setIcon('link').onClick(rebind));
    if (removeEntry) menu.addItem(entry => entry.setTitle(t('removeCollectionEntry')).onClick(removeEntry));
  }), 'hb-card-more hb-icon-only');
  if (canRebind && item.status !== 'resolved') {
    action(actions, t('rebind'), 'link', rebind, 'hb-rebind');
  }
  return card;
}
