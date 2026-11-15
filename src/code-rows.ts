export function structuredRows(code: HTMLElement): HTMLElement[] {
  return [...code.querySelectorAll<HTMLElement>('.ec-line > .code, .code-styler-line > .code-styler-line-text, .codeblock-customizer-line > .codeblock-customizer-line-text')].filter(row => !row.closest('summary'));
}
export function rowText(row: HTMLElement): string { return row.textContent === '\n' ? '' : row.textContent ?? ''; }
