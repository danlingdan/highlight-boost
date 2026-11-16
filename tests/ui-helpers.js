window.__hbUI = {
  menu(button, label) {
    button.click();
    const item = [...button.ownerDocument.querySelectorAll('.menu-item')].find(item => item.textContent.includes(label));
    if (!item) throw new Error(`Missing menu item: ${label}`);
    return item;
  },
  template(panel, value) {
    panel.querySelector('[data-hb-workbench-action="preview"]').click();
    const modal = panel.ownerDocument.querySelector('.hb-excerpt-preview').closest('.modal');
    const select = modal.querySelector('.hb-template'); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
    [...modal.querySelectorAll('button')].find(button => ['取消', 'Cancel'].includes(button.textContent)).click();
  },
  export(panel) {
    panel.querySelector('[data-hb-workbench-action="preview"]').click();
    panel.ownerDocument.querySelector('[data-hb-workbench-action="export"]').click();
  },
  async collection(card, id) {
    this.menu(card.querySelector('.hb-card-more'), '加入集合').click();
    const select = card.ownerDocument.querySelector('.hb-modal .hb-add-collection'); select.value = id;
    [...select.closest('.modal').querySelectorAll('button')].find(button => button.textContent === '加入集合').click();
    for (let i = 0; i < 30 && select.isConnected; i++) await new Promise(resolve => setTimeout(resolve, 50));
  },
};
void 0;
