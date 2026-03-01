import type { TranscriptChunk, DecisionField } from '@repo/schema';
import type { GuidanceSegment } from './i-llm-service';

export type PromptSegment =
  | { type: 'system'; content: string }
  | { type: 'transcript'; speaker?: string; text: string; tags: string[] }
  | { type: 'guidance'; fieldId?: string; content: string; source: 'user_text' | 'tagged_transcript' }
  | { type: 'template_fields'; fields: Array<{ id: string; displayName: string; description: string }> };

export type BuiltPrompt = {
  segments: PromptSegment[];
  text: string;
};

export const DEFAULT_DRAFT_SYSTEM_PROMPT = `You are an expert at analyzing meeting transcripts and extracting structured decision information.
Your task is to extract field values from the provided transcript segments.
Only use information explicitly present in the transcript.
Do not hallucinate or infer beyond what is stated.
If a field cannot be determined from the transcript, return an empty string for that field.`;

/**
 * Constructs LLM prompts as a typed segment list, then serializes to a string.
 *
 * The segment list is stored per LLM interaction for full auditability.
 * Guidance is visually and semantically distinct from transcript content.
 */
export class PromptBuilder {
  private segments: PromptSegment[] = [];

  addSystem(content: string): this {
    this.segments.push({ type: 'system', content });
    return this;
  }

  addTranscriptChunk(chunk: TranscriptChunk): this {
    this.segments.push({
      type: 'transcript',
      speaker: chunk.speaker,
      text: chunk.text,
      tags: chunk.contexts,
    });
    return this;
  }

  addGuidance(segment: GuidanceSegment): this {
    this.segments.push({
      type: 'guidance',
      fieldId: segment.fieldId,
      content: segment.content,
      source: segment.source,
    });
    return this;
  }

  addTemplateFields(fields: DecisionField[]): this {
    this.segments.push({
      type: 'template_fields',
      fields: fields.map(f => ({
        id: f.id,
        displayName: f.name,
        description: f.description,
      })),
    });
    return this;
  }

  buildSegments(): PromptSegment[] {
    return [...this.segments];
  }

  buildString(): string {
    const parts: string[] = [];

    const transcriptLines: string[] = [];
    const guidanceByField = new Map<string | undefined, string[]>();
    const fieldLines: string[] = [];

    for (const seg of this.segments) {
      if (seg.type === 'system') {
        parts.push(seg.content);
      } else if (seg.type === 'transcript') {
        const prefix = seg.speaker ? `[${seg.speaker}]: ` : '';
        transcriptLines.push(`${prefix}${seg.text}`);
      } else if (seg.type === 'guidance') {
        const key = seg.fieldId;
        const existing = guidanceByField.get(key) ?? [];
        existing.push(seg.content);
        guidanceByField.set(key, existing);
      } else if (seg.type === 'template_fields') {
        seg.fields.forEach((f, i) => {
          fieldLines.push(`${i + 1}. ${f.displayName}: ${f.description}`);
        });
      }
    }

    if (transcriptLines.length > 0) {
      parts.push('=== TRANSCRIPT ===');
      parts.push(transcriptLines.join('\n'));
    }

    // Whole-draft guidance first (fieldId = undefined)
    const wholeDraftGuidance = guidanceByField.get(undefined);
    if (wholeDraftGuidance && wholeDraftGuidance.length > 0) {
      parts.push('=== GUIDANCE ===');
      parts.push(wholeDraftGuidance.join('\n'));
    }

    // Field-specific guidance
    for (const [fieldId, lines] of guidanceByField.entries()) {
      if (fieldId !== undefined) {
        parts.push(`=== GUIDANCE (applies to: ${fieldId} field) ===`);
        parts.push(lines.join('\n'));
      }
    }

    if (fieldLines.length > 0) {
      parts.push('=== FIELDS TO EXTRACT ===');
      parts.push(fieldLines.join('\n'));
    }

    return parts.join('\n\n');
  }
}

export function buildDraftPrompt(
  transcriptChunks: TranscriptChunk[],
  templateFields: DecisionField[],
  guidance: GuidanceSegment[] = [],
): BuiltPrompt {
  const builder = new PromptBuilder();
  builder.addSystem(DEFAULT_DRAFT_SYSTEM_PROMPT);

  for (const chunk of transcriptChunks) {
    builder.addTranscriptChunk(chunk);
  }

  for (const segment of guidance) {
    if (!segment.fieldId) {
      builder.addGuidance(segment);
    }
  }

  builder.addTemplateFields(templateFields);

  return {
    segments: builder.buildSegments(),
    text: builder.buildString(),
  };
}

export function buildFieldRegenerationPrompt(
  transcriptChunks: TranscriptChunk[],
  field: DecisionField,
  fieldId: string,
  guidance: GuidanceSegment[] = [],
): BuiltPrompt {
  const builder = new PromptBuilder();
  builder.addSystem(DEFAULT_DRAFT_SYSTEM_PROMPT);

  for (const chunk of transcriptChunks) {
    builder.addTranscriptChunk(chunk);
  }

  for (const segment of guidance) {
    if (!segment.fieldId || segment.fieldId === fieldId) {
      builder.addGuidance(segment);
    }
  }

  builder.addTemplateFields([field]);

  return {
    segments: builder.buildSegments(),
    text: builder.buildString(),
  };
}
