import { eq, and } from 'drizzle-orm';
import { db } from '../client.js';
import { llmInteractions } from '../schema.js';
import type { LLMInteraction, CreateLLMInteraction } from '@repo/schema';

export class DrizzleLLMInteractionRepository {
  async create(data: CreateLLMInteraction): Promise<LLMInteraction> {
    const result = await db.insert(llmInteractions).values({
      decisionContextId: data.decisionContextId,
      fieldId: data.fieldId ?? null,
      operation: data.operation,
      promptSegments: data.promptSegments as object[],
      promptText: data.promptText,
      responseText: data.responseText,
      parsedResult: data.parsedResult as Record<string, unknown> ?? null,
      provider: data.provider,
      model: data.model,
      latencyMs: data.latencyMs,
      tokenCount: data.tokenCount ?? null,
    }).returning();

    if (!result[0]) {
      throw new Error('Failed to create LLM interaction record');
    }

    return this.toSchema(result[0]);
  }

  async findByDecisionContext(decisionContextId: string): Promise<LLMInteraction[]> {
    const rows = await db
      .select()
      .from(llmInteractions)
      .where(eq(llmInteractions.decisionContextId, decisionContextId))
      .orderBy(llmInteractions.createdAt);

    return rows.map(row => this.toSchema(row));
  }

  async findByField(decisionContextId: string, fieldId: string): Promise<LLMInteraction[]> {
    const rows = await db
      .select()
      .from(llmInteractions)
      .where(
        and(
          eq(llmInteractions.decisionContextId, decisionContextId),
          eq(llmInteractions.fieldId, fieldId)
        )
      )
      .orderBy(llmInteractions.createdAt);

    return rows.map(row => this.toSchema(row));
  }

  private toSchema(row: typeof llmInteractions.$inferSelect): LLMInteraction {
    return {
      id: row.id,
      decisionContextId: row.decisionContextId,
      fieldId: row.fieldId ?? null,
      operation: row.operation,
      promptSegments: row.promptSegments as LLMInteraction['promptSegments'],
      promptText: row.promptText,
      responseText: row.responseText,
      parsedResult: (row.parsedResult as Record<string, unknown>) ?? null,
      provider: row.provider,
      model: row.model,
      latencyMs: row.latencyMs,
      tokenCount: (row.tokenCount as { input: number; output: number }) ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
