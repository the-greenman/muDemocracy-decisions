import type { DecisionContext, DecisionField } from '@repo/schema';
import type { ILLMService, GuidanceSegment } from '../llm/i-llm-service';
import { buildDraftPrompt, buildFieldRegenerationPrompt } from '../llm/prompt-builder';
import type { ITranscriptChunkRepository } from '../interfaces/transcript-repositories';
import type { ITemplateFieldAssignmentRepository } from '../interfaces/i-decision-template-repository';
import type { IDecisionContextRepository } from '../interfaces/i-decision-context-repository';
import type { IDecisionFieldRepository } from '../interfaces/i-decision-field-repository';
import type { ILLMInteractionRepository } from '../interfaces/i-llm-interaction-repository';

/**
 * Orchestrates LLM-based draft generation for a decision context.
 *
 * Responsibilities:
 * 1. Fetch transcript chunks (field-tagged > decision-tagged > meeting-tagged priority)
 * 2. Fetch template fields (only unlocked fields are sent to LLM)
 * 3. Build prompt via PromptBuilder
 * 4. Call LLM and record the interaction in llm_interactions table
 * 5. Merge result with existing locked field values
 * 6. Persist updated draft_data to decision_contexts
 */
export class DraftGenerationService {
  constructor(
    private llm: ILLMService,
    private transcriptRepo: ITranscriptChunkRepository,
    private fieldAssignmentRepo: ITemplateFieldAssignmentRepository,
    private fieldRepo: IDecisionFieldRepository,
    private contextRepo: IDecisionContextRepository,
    private llmInteractionRepo: ILLMInteractionRepository,
  ) {}

  async generateDraft(decisionContextId: string, guidance?: GuidanceSegment[]): Promise<DecisionContext> {
    const context = await this.contextRepo.findById(decisionContextId);
    if (!context) {
      throw new Error(`Decision context not found: ${decisionContextId}`);
    }

    const fields = await this.resolveTemplateFields(context.templateId);
    const unlockedFields = fields.filter(f => !context.lockedFields.includes(f.id));

    if (unlockedFields.length === 0) {
      // All fields locked — nothing to generate
      return context;
    }

    const chunks = await this.fetchChunks(context.meetingId, decisionContextId);

    const prompt = buildDraftPrompt(chunks, unlockedFields, guidance ?? []);

    const provider = process.env['LLM_PROVIDER'] ?? 'anthropic';
    const model = process.env['LLM_MODEL'] ?? 'claude-opus-4-5';

    const start = Date.now();
    const draftResult = await this.llm.generateDraft({
      transcriptChunks: chunks,
      templateFields: unlockedFields,
      guidance: guidance ?? [],
    });
    const latencyMs = Date.now() - start;

    await this.llmInteractionRepo.create({
      decisionContextId,
      fieldId: null,
      operation: 'generate_draft',
      promptSegments: prompt.segments as object[],
      promptText: prompt.text,
      responseText: JSON.stringify(draftResult),
      parsedResult: draftResult,
      provider,
      model,
      latencyMs,
      tokenCount: null,
    });

    // Merge: keep locked fields, apply LLM result for unlocked fields
    const currentDraft = context.draftData ?? {};
    const updatedDraft: Record<string, unknown> = { ...currentDraft };
    for (const [fieldId, value] of Object.entries(draftResult)) {
      if (!context.lockedFields.includes(fieldId)) {
        updatedDraft[fieldId] = value;
      }
    }

    const updated = await this.contextRepo.update(decisionContextId, { draftData: updatedDraft });
    if (!updated) {
      throw new Error(`Failed to update draft for context: ${decisionContextId}`);
    }

    return updated;
  }

  async regenerateField(
    decisionContextId: string,
    fieldId: string,
    guidance?: GuidanceSegment[],
  ): Promise<string> {
    const context = await this.contextRepo.findById(decisionContextId);
    if (!context) {
      throw new Error(`Decision context not found: ${decisionContextId}`);
    }

    if (context.lockedFields.includes(fieldId)) {
      throw new Error(`Field ${fieldId} is locked`);
    }

    const fields = await this.resolveTemplateFields(context.templateId);
    const field = fields.find(f => f.id === fieldId);
    if (!field) {
      throw new Error(`Field ${fieldId} not found in template ${context.templateId}`);
    }

    // Field-tagged chunks get priority (fetched with context tag for this field)
    const chunks = await this.fetchChunks(context.meetingId, decisionContextId);

    const prompt = buildFieldRegenerationPrompt(chunks, field, fieldId, guidance ?? []);

    const provider = process.env['LLM_PROVIDER'] ?? 'anthropic';
    const model = process.env['LLM_MODEL'] ?? 'claude-opus-4-5';

    const start = Date.now();
    const value = await this.llm.regenerateField({
      transcriptChunks: chunks,
      templateFields: [field],
      guidance: guidance ?? [],
      fieldId,
    });
    const latencyMs = Date.now() - start;

    await this.llmInteractionRepo.create({
      decisionContextId,
      fieldId,
      operation: 'regenerate_field',
      promptSegments: prompt.segments as object[],
      promptText: prompt.text,
      responseText: JSON.stringify({ [fieldId]: value }),
      parsedResult: { [fieldId]: value },
      provider,
      model,
      latencyMs,
      tokenCount: null,
    });

    // Persist the updated field value
    const currentDraft = context.draftData ?? {};
    await this.contextRepo.update(decisionContextId, {
      draftData: { ...currentDraft, [fieldId]: value },
    });

    return value;
  }

  /**
   * Fetch template fields in display order.
   */
  private async resolveTemplateFields(templateId: string): Promise<DecisionField[]> {
    const assignments = await this.fieldAssignmentRepo.findByTemplateId(templateId);
    const sorted = [...assignments].sort((a, b) => a.order - b.order);

    const fields: DecisionField[] = [];
    for (const assignment of sorted) {
      const field = await this.fieldRepo.findById(assignment.fieldId);
      if (field) {
        fields.push(field);
      }
    }
    return fields;
  }

  /**
   * Fetch transcript chunks for the meeting, ordered by specificity:
   * decision-context-tagged chunks are most relevant.
   */
  private async fetchChunks(meetingId: string, decisionContextId: string) {
    const allChunks = await this.transcriptRepo.findByMeetingId(meetingId);

    // Sort: decision-tagged first, then meeting-wide
    const decisionTag = `decision:${decisionContextId}`;
    return allChunks.sort((a, b) => {
      const aTagged = a.contexts.some(c => c.startsWith(decisionTag));
      const bTagged = b.contexts.some(c => c.startsWith(decisionTag));
      if (aTagged && !bTagged) return -1;
      if (!aTagged && bTagged) return 1;
      return a.sequenceNumber - b.sequenceNumber;
    });
  }
}
