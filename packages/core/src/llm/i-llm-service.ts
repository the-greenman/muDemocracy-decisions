import type { TranscriptChunk, DecisionField } from "@repo/schema";

export type GuidanceSegment = {
  fieldId?: string; // undefined = applies to whole draft
  content: string;
  source: "user_text" | "tagged_transcript";
};

export type GenerateDraftParams = {
  transcriptChunks: TranscriptChunk[];
  templateFields: DecisionField[];
  guidance?: GuidanceSegment[];
  promptText?: string;
};

export type RegenerateFieldParams = GenerateDraftParams & { fieldId: string };

export type DraftResult = Record<string, string>; // fieldId → value

export interface ILLMService {
  generateDraft(params: GenerateDraftParams): Promise<DraftResult>;
  regenerateField(params: RegenerateFieldParams): Promise<string>;
}
