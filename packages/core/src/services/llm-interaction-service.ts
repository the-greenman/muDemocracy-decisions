/**
 * Service for managing LLM interactions
 */

import { ILLMInteractionRepository } from '../interfaces/i-llm-interaction-repository.js';
import type { LLMInteraction } from '@repo/schema';

export class LLMInteractionService {
  constructor(private repository: ILLMInteractionRepository) {}

  /**
   * Get all LLM interactions for a decision context
   */
  async findByDecisionContext(decisionContextId: string): Promise<LLMInteraction[]> {
    return await this.repository.findByDecisionContext(decisionContextId);
  }

  /**
   * Get all LLM interactions for a specific field
   */
  async findByField(decisionContextId: string, fieldId: string): Promise<LLMInteraction[]> {
    return await this.repository.findByField(decisionContextId, fieldId);
  }

  /**
   * Create an LLM interaction record
   */
  async create(data: {
    decisionContextId: string;
    fieldId?: string;
    operation: 'generate_draft' | 'regenerate_field';
    promptSegments: any[];
    promptText: string;
    responseText: string;
    parsedResult: Record<string, unknown> | null;
    provider: string;
    model: string;
    latencyMs: number;
    tokenCount?: { input: number; output: number } | null;
  }): Promise<LLMInteraction> {
    return await this.repository.create({
      decisionContextId: data.decisionContextId,
      fieldId: data.fieldId || null,
      operation: data.operation,
      promptSegments: data.promptSegments,
      promptText: data.promptText,
      responseText: data.responseText,
      parsedResult: data.parsedResult,
      provider: data.provider,
      model: data.model,
      latencyMs: data.latencyMs,
      tokenCount: data.tokenCount || null,
    });
  }
}
