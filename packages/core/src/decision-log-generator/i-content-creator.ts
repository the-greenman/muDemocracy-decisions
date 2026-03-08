import type { DecisionContext } from '@repo/schema';
import type { GuidanceSegment } from '../llm';
import type { MarkdownExportOptions } from '../services/markdown-export-service';

export interface IContentCreator {
  generateDraft(decisionContextId: string, guidance?: GuidanceSegment[]): Promise<DecisionContext>;
  regenerateField(decisionContextId: string, fieldId: string, guidance?: GuidanceSegment[]): Promise<string>;
  exportMarkdown(decisionContextId: string, options?: MarkdownExportOptions): Promise<string>;
}
