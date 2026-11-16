import { Menu, Modal, setIcon } from 'obsidian';
import type HighlightBoost from './main';
import type { Message } from './i18n';

export function action(parent: HTMLElement, label: string, icon: string, run: () => void, cls = ''): HTMLButtonElement {
  const button = parent.createEl('button', { cls: `hb-action ${cls}`, attr: { 'aria-label': label, title: label } });
  setIcon(button.createSpan({ cls: 'hb-action-icon' }), icon);
  button.createSpan({ text: label }); button.addEventListener('click', run); return button;
}

export function menuAt(button: HTMLElement, build: (menu: Menu) => void): void {
  const menu = new Menu(); build(menu);
  const rect = button.getBoundingClientRect();
  menu.onHide(() => button.ownerDocument.defaultView!.requestAnimationFrame(() => {
    const document = button.ownerDocument; if (document.querySelector('.menu, .modal-container')) return;
    const target = button.isConnected ? button : document.querySelector<HTMLElement>('.hb-panel h4');
    target?.focus({ preventScroll: true });
  }));
  menu.showAtPosition({ x: rect.left, y: rect.bottom }, button.ownerDocument);
}

export class FocusModal extends Modal {
  private titleMessage?: Message;
  protected messageTitle(message: Message): void { this.titleMessage = message; this.setTitle(this.plugin.t(message)); }
  refreshLocale(): void {
    if (this.titleMessage) this.setTitle(this.plugin.t(this.titleMessage));
    for (const control of this.contentEl.querySelectorAll<HTMLElement>('[data-hb-message]')) control.textContent = this.plugin.t(control.dataset.hbMessage as Message);
    this.contentEl.querySelector('.hb-note-input')?.setAttribute('aria-label', this.plugin.t('annotation'));
  }
  constructor(protected plugin: HighlightBoost, private trigger?: HTMLElement) { super(plugin.app); this.shouldRestoreSelection = false; }
  onOpen(): void {
    this.plugin.uiModals.add(this); this.modalEl.addClass('hb-modal');
    if (this.trigger && this.containerEl.ownerDocument !== this.trigger.ownerDocument) this.trigger.ownerDocument.body.append(this.containerEl);
  }
  onClose(): void {
    this.plugin.uiModals.delete(this); this.contentEl.empty();
    const target = this.trigger?.isConnected ? this.trigger : this.trigger?.ownerDocument.querySelector<HTMLElement>('.hb-panel h4');
    target?.focus({ preventScroll: true });
    target?.dispatchEvent(new CustomEvent('hb-modal-close', { bubbles: true }));
  }
  protected button(parent: HTMLElement, message: Message, run: () => void): HTMLButtonElement {
    return parent.createEl('button', { text: this.plugin.t(message), attr: { 'data-hb-message': message } }, button => button.addEventListener('click', run));
  }
}
