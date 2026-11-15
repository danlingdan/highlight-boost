import { Component } from 'obsidian';
import { translate, type Locale } from '../i18n';

export class SyntaxRuntime extends Component {
  private documents = new Map<Document, () => void>();
  constructor(private getLocale: () => Locale) { super(); }
  attach(document: Document): void {
    if (this.documents.has(document)) return;
    const window = document.defaultView;
    if (!window) return;
    const observed = new Set<HTMLElement>(), pending = new Set<HTMLElement>(), managed = new Set<HTMLElement>(), timers = new Set<number>(), feedback = new Set<HTMLElement>();
    const clearRole = (pre: HTMLElement) => { if (managed.delete(pre)) { pre.removeAttribute('tabindex'); pre.removeAttribute('role'); pre.removeAttribute('aria-label'); } };
    let disposed = false, scheduled: number | undefined;
    const later = (run: () => void, delay = 0) => {
      const timer = window.setTimeout(() => { timers.delete(timer); if (!disposed) run(); }, delay); timers.add(timer); return timer;
    };
    const resize = new window.ResizeObserver(entries => {
      for (const entry of entries) pending.add(entry.target as HTMLElement);
      if (scheduled !== undefined) return;
      scheduled = later(() => {
        scheduled = undefined;
        for (const pre of pending) if (pre.isConnected) {
          const scrollable = pre.scrollWidth > pre.clientWidth;
          if (scrollable && !pre.hasAttribute('tabindex')) { pre.setAttribute('tabindex', '0'); pre.setAttribute('role', 'region'); pre.setAttribute('aria-label', translate(this.getLocale(), 'code')); managed.add(pre); }
          else if (!scrollable) clearRole(pre);
        }
        pending.clear();
      });
    });
    const scan = (root: ParentNode) => {
      for (const pre of root.querySelectorAll<HTMLElement>('[data-hb-syntax-root] pre')) if (!observed.has(pre)) { observed.add(pre); resize.observe(pre); }
    };
    scan(document);
    const mutation = new window.MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) {
        const element = node as HTMLElement;
        if (element.matches('[data-hb-syntax-root] pre') && !observed.has(element)) { observed.add(element); resize.observe(element); }
        scan(element);
      }
      for (const pre of observed) if (!pre.isConnected) { resize.unobserve(pre); observed.delete(pre); pending.delete(pre); clearRole(pre); }
    });
    mutation.observe(document.body, { childList: true, subtree: true });
    const click = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>('.copy button');
      if (!button?.closest('[data-hb-syntax-root]')) return;
      const code = button.dataset.code?.replace(/\u007f/g, '\n');
      if (code === undefined) return;
      void window.navigator.clipboard.writeText(code).then(() => {
        if (disposed || !button.isConnected || button.parentElement?.querySelector('.feedback')) return;
        const live = button.parentElement?.querySelector('[aria-live]');
        if (!live) return;
        const message = document.createElement('div'); message.className = 'feedback show'; message.textContent = button.dataset.copied ?? ''; live.append(message); feedback.add(message);
        later(() => { message.remove(); feedback.delete(message); }, 2000);
      }).catch(error => { if (!disposed) console.error('HB 代码复制失败', error); });
    };
    document.addEventListener('click', click);
    const dispose = () => {
      if (disposed) return; disposed = true;
      document.removeEventListener('click', click); window.removeEventListener('pagehide', dispose);
      mutation.disconnect(); resize.disconnect();
      for (const timer of timers) window.clearTimeout(timer);
      for (const message of feedback) message.remove();
      for (const pre of managed) clearRole(pre);
      observed.clear(); pending.clear(); timers.clear(); feedback.clear(); this.documents.delete(document);
    };
    window.addEventListener('pagehide', dispose, { once: true }); this.documents.set(document, dispose);
  }
  detach(document: Document): void { this.documents.get(document)?.(); }
  onunload(): void { for (const dispose of this.documents.values()) dispose(); }
}
