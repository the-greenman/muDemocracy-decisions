import type { DecisionContext, DecisionField, SupplementaryContent } from "@repo/schema";
import type { ILLMService, GuidanceSegment } from "../llm/i-llm-service.js";
import type { PromptSegmentData } from "@repo/schema";
import {
  buildDraftPrompt,
  buildFieldRegenerationPrompt,
  buildDraftPromptFromTemplate,
} from "../llm/prompt-builder.js";
import type { ITranscriptChunkRepository } from "../interfaces/transcript-repositories.js";
import type { ITemplateFieldAssignmentRepository, IDecisionTemplateRepository } from "../interfaces/i-decision-template-repository.js";
import type { IDecisionContextRepository } from "../interfaces/i-decision-context-repository.js";
import type { IDecisionFieldRepository } from "../interfaces/i-decision-field-repository.js";
import type { ILLMInteractionRepository } from "../interfaces/i-llm-interaction-repository.js";
import type { IFlaggedDecisionRepository } from "../interfaces/i-flagged-decision-repository.js";
import type { ISupplementaryContentRepository } from "../interfaces/i-supplementary-content-repository.js";
import type { FlaggedDecision } from "@repo/schema";

const FIELD_META_KEY = "__fieldMeta";

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
    private flaggedDecisionRepo: IFlaggedDecisionRepository,
    private supplementaryContentRepo: ISupplementaryContentRepository,
    private templateRepo: IDecisionTemplateRepository,
  ) {}

  async generateDraft(
    decisionContextId: string,
    guidance?: GuidanceSegment[],
  ): Promise<DecisionContext> {
    const context = await this.contextRepo.findById(decisionContextId);
    if (!context) {
      throw new Error(`Decision context not found: ${decisionContextId}`);
    }

    const fields = await this.resolveTemplateFields(context.templateId);
    const unlockedFields = fields.filter((f) => !context.lockedFields.includes(f.id));

    if (unlockedFields.length === 0) {
      // All fields locked — nothing to generate
      return context;
    }

    const chunks = await this.fetchDraftChunks(context.meetingId, decisionContextId);
    const supplementaryItems = await this.fetchDraftSupplementaryContent(
      context.meetingId,
      decisionContextId,
    );
    const currentDraftText = this.buildCurrentDraftText(context.draftData ?? {}, fields);

    const template = await this.templateRepo.findById(context.templateId);
    const templatePrompt = template?.promptTemplate ?? null;

    // Check if we should use the template-based prompt
    const useTemplatePrompt = process.env["USE_TEMPLATE_PROMPT"] === "true";

    let prompt;
    if (useTemplatePrompt) {
      // Get additional context for the template
      const flaggedDecision = await this.findFlaggedDecision(context.flaggedDecisionId);
      const decisionTitle =
        flaggedDecision?.suggestedTitle ||
        context.draftData?.decision_statement ||
        "Untitled Decision";
      const contextSummary = flaggedDecision?.contextSummary || "No summary available";

      prompt = await buildDraftPromptFromTemplate(
        chunks,
        unlockedFields,
        guidance ?? [],
        context.meetingId,
        decisionTitle,
        contextSummary,
        currentDraftText,
        templatePrompt,
      );
    } else {
      prompt = buildDraftPrompt(
        chunks,
        supplementaryItems,
        unlockedFields,
        guidance ?? [],
        currentDraftText,
        templatePrompt,
      );
    }

    const provider = process.env["LLM_PROVIDER"] ?? "anthropic";
    const model = process.env["LLM_MODEL"] ?? "claude-opus-4-5";

    const start = Date.now();
    const draftResult = await this.llm.generateDraft({
      transcriptChunks: chunks,
      templateFields: unlockedFields,
      guidance: guidance ?? [],
      promptText: prompt.text,
    });
    const latencyMs = Date.now() - start;

    await this.llmInteractionRepo.create({
      decisionContextId,
      fieldId: null,
      operation: "generate_draft",
      promptSegments: prompt.segments as PromptSegmentData[],
      promptText: prompt.text,
      responseText: JSON.stringify(draftResult.fields),
      parsedResult: draftResult.fields,
      provider,
      model,
      latencyMs,
      tokenCount: null,
    });

    // Merge: keep locked fields, apply LLM result for unlocked fields
    const currentDraft = context.draftData ?? {};
    const updatedDraft: Record<string, unknown> = { ...currentDraft };
    for (const [fieldId, value] of Object.entries(draftResult.fields)) {
      if (!context.lockedFields.includes(fieldId) && fieldId !== FIELD_META_KEY) {
        updatedDraft[fieldId] = value;
      }
    }

    if (this.getPersistedFieldEntries(currentDraft).length > 0) {
      await this.contextRepo.update(decisionContextId, {
        draftVersions: [
          ...context.draftVersions,
          {
            version: context.draftVersions.length + 1,
            draftData: { ...currentDraft },
            savedAt: new Date().toISOString(),
          },
        ],
      });
    }

    const updated = await this.contextRepo.update(decisionContextId, {
      draftData: updatedDraft,
      suggestedTags: draftResult.suggestedTags,
    });
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
    const field = fields.find((f) => f.id === fieldId);
    if (!field) {
      throw new Error(`Field ${fieldId} not found in template ${context.templateId}`);
    }

    // Field-tagged chunks get priority (fetched with context tag for this field)
    const chunks = await this.fetchFieldChunks(context.meetingId, decisionContextId, fieldId);
    const supplementaryItems = await this.fetchFieldSupplementaryContent(
      context.meetingId,
      decisionContextId,
      fieldId,
    );

    const currentDraftText = this.buildCurrentDraftText(context.draftData ?? {}, fields);

    const prompt = buildFieldRegenerationPrompt(
      chunks,
      supplementaryItems,
      field,
      fieldId,
      guidance ?? [],
      currentDraftText,
    );

    const provider = process.env["LLM_PROVIDER"] ?? "anthropic";
    const model = process.env["LLM_MODEL"] ?? "claude-opus-4-5";

    const start = Date.now();
    const value = await this.llm.regenerateField({
      transcriptChunks: chunks,
      templateFields: [field],
      guidance: guidance ?? [],
      fieldId,
      promptText: prompt.text,
    });
    const latencyMs = Date.now() - start;

    await this.llmInteractionRepo.create({
      decisionContextId,
      fieldId,
      operation: "regenerate_field",
      promptSegments: prompt.segments as PromptSegmentData[],
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
    const updated = await this.contextRepo.update(decisionContextId, {
      draftData: { ...currentDraft, [fieldId]: value },
    });

    if (!updated) {
      throw new Error(
        `Failed to persist regenerated field ${fieldId} for context: ${decisionContextId}`,
      );
    }

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
   * Find flagged decision by ID.
   */
  private async findFlaggedDecision(flaggedDecisionId?: string): Promise<FlaggedDecision | null> {
    if (!flaggedDecisionId) {
      return null;
    }
    return await this.flaggedDecisionRepo.findById(flaggedDecisionId);
  }

  /**
   * Fetch transcript chunks for the meeting, ordered by specificity:
   * decision-context-tagged chunks are most relevant.
   */
  private async fetchDraftChunks(meetingId: string, decisionContextId: string) {
    const allChunks = await this.transcriptRepo.findByMeetingId(meetingId);

    const decisionTag = `decision:${decisionContextId}`;
    return allChunks.sort((a, b) => {
      const aTagged = a.contexts.some((c) => c.startsWith(decisionTag));
      const bTagged = b.contexts.some((c) => c.startsWith(decisionTag));
      if (aTagged && !bTagged) return -1;
      if (!aTagged && bTagged) return 1;
      return a.sequenceNumber - b.sequenceNumber;
    });
  }

  private buildCurrentDraftText(
    draftData: Record<string, unknown>,
    fields: DecisionField[],
  ): string | undefined {
    const lines = fields
      .map((field) => {
        const value = draftData[field.id];
        if (typeof value !== "string") {
          return null;
        }

        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return null;
        }

        return `${field.name}: ${trimmed}`;
      })
      .filter((line): line is string => line !== null);

    return lines.length > 0 ? lines.join("\n") : undefined;
  }

  private async fetchFieldChunks(meetingId: string, decisionContextId: string, fieldId: string) {
    const allChunks = await this.transcriptRepo.findByMeetingId(meetingId);
    const fieldTag = `decision:${decisionContextId}:${fieldId}`;
    const decisionTag = `decision:${decisionContextId}`;
    const meetingTag = `meeting:${meetingId}`;

    return [...allChunks].sort((a, b) => {
      const rankA = this.getChunkWeight(a.contexts, fieldTag, decisionTag, meetingTag);
      const rankB = this.getChunkWeight(b.contexts, fieldTag, decisionTag, meetingTag);
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return a.sequenceNumber - b.sequenceNumber;
    });
  }

  private async fetchDraftSupplementaryContent(
    meetingId: string,
    decisionContextId: string,
  ): Promise<SupplementaryContent[]> {
    const meetingTag = `meeting:${meetingId}`;
    const decisionTag = `decision:${decisionContextId}`;

    return this.mergeSupplementaryItems(
      await this.supplementaryContentRepo.findByContext(meetingTag),
      await this.supplementaryContentRepo.findByContext(decisionTag),
    );
  }

  private async fetchFieldSupplementaryContent(
    meetingId: string,
    decisionContextId: string,
    fieldId: string,
  ): Promise<SupplementaryContent[]> {
    const meetingTag = `meeting:${meetingId}`;
    const decisionTag = `decision:${decisionContextId}`;
    const fieldTag = `decision:${decisionContextId}:${fieldId}`;

    return this.mergeSupplementaryItems(
      await this.supplementaryContentRepo.findByContext(fieldTag),
      await this.supplementaryContentRepo.findByContext(decisionTag),
      await this.supplementaryContentRepo.findByContext(meetingTag),
    );
  }

  private mergeSupplementaryItems(...groups: SupplementaryContent[][]): SupplementaryContent[] {
    const itemsById = new Map<string, SupplementaryContent>();

    for (const group of groups) {
      for (const item of group) {
        if (!itemsById.has(item.id)) {
          itemsById.set(item.id, item);
        }
      }
    }

    return [...itemsById.values()];
  }

  private getChunkWeight(
    contexts: string[],
    fieldTag: string,
    decisionTag: string,
    meetingTag: string,
  ): number {
    if (contexts.includes(fieldTag)) {
      return 0;
    }

    if (
      contexts.some((context) => context === decisionTag || context.startsWith(`${decisionTag}:`))
    ) {
      return 1;
    }

    if (contexts.includes(meetingTag)) {
      return 2;
    }

    return 3;
  }

  private getPersistedFieldEntries(draftData: Record<string, unknown>): Array<[string, unknown]> {
    return Object.entries(draftData).filter(([fieldId]) => fieldId !== FIELD_META_KEY);
  }
}
