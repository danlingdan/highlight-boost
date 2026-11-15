import { parseDocument } from './parsing';
import { collectItems } from './anchors';
import { createExcerptContext } from './excerpts';
import type { HighlightItem, ParsedDocument } from './domain';

export class DocumentSnapshot {
  private model?: ParsedDocument;
  private highlights?: HighlightItem[];
  private excerpt?: ReturnType<typeof createExcerptContext>;
  constructor(readonly text: string) {}
  get parsed(): ParsedDocument { return this.model ??= parseDocument(this.text); }
  get items(): HighlightItem[] { return this.highlights ??= collectItems(this.text, this.parsed); }
  get context(): ReturnType<typeof createExcerptContext> { return this.excerpt ??= createExcerptContext(this.text, this.parsed); }
}
