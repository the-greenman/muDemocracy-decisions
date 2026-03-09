/**
 * Drizzle implementation of IDecisionContextWindowRepository
 */

import { eq, and, desc, arrayContains } from 'drizzle-orm';
import { db } from '../client.js';
import { 
  decisionContextWindows, 
  transcriptChunks,
  DecisionContextWindowSelect, 
  DecisionContextWindowInsert 
} from '../schema.js';
import { DecisionContextWindow, TranscriptChunk } from '@repo/schema';

export class DrizzleDecisionContextWindowRepository {
  async createOrUpdate(data: Omit<DecisionContextWindow, 'id' | 'createdAt' | 'updatedAt'>): Promise<DecisionContextWindow> {
    const insertData: DecisionContextWindowInsert = {
      decisionContextId: data.decisionContextId,
      chunkIds: data.chunkIds,
      selectionStrategy: data.selectionStrategy,
      totalTokens: data.totalTokens,
      totalChunks: data.totalChunks,
      relevanceScores: data.relevanceScores || null,
      usedFor: data.usedFor,
    };

    // Check if a window exists for this context and usedFor
    const [existing] = await db.select()
      .from(decisionContextWindows)
      .where(and(
        eq(decisionContextWindows.decisionContextId, data.decisionContextId),
        eq(decisionContextWindows.usedFor, data.usedFor)
      ))
      .orderBy(desc(decisionContextWindows.updatedAt))
      .limit(1);

    if (existing) {
      // Update existing record
      const [updated] = await db.update(decisionContextWindows)
        .set({
          chunkIds: data.chunkIds,
          selectionStrategy: data.selectionStrategy,
          totalTokens: data.totalTokens,
          totalChunks: data.totalChunks,
          relevanceScores: data.relevanceScores || null,
          updatedAt: new Date(),
        })
        .where(eq(decisionContextWindows.id, existing.id))
        .returning();

      return this.mapToSchema(updated!);
    } else {
      // Insert new record
      const [result] = await db.insert(decisionContextWindows)
        .values(insertData)
        .returning();

      return this.mapToSchema(result!);
    }
  }

  async findByDecisionContextId(decisionContextId: string): Promise<DecisionContextWindow[]> {
    const results = await db.select()
      .from(decisionContextWindows)
      .where(eq(decisionContextWindows.decisionContextId, decisionContextId))
      .orderBy(desc(decisionContextWindows.updatedAt));

    return results.map(r => this.mapToSchema(r));
  }

  async preview(decisionContextId: string, _strategy: string, limit: number = 10): Promise<{
    chunks: TranscriptChunk[];
    totalTokens: number;
    estimatedRelevance: Record<string, number>;
  }> {
    // Get chunks tagged with this decision context
    const contextTag = `decision:${decisionContextId}`;
    const chunks = await db.select()
      .from(transcriptChunks)
      .where(arrayContains(transcriptChunks.contexts, [contextTag]))
      .orderBy(transcriptChunks.sequenceNumber)
      .limit(limit);

    // Calculate total tokens
    const totalTokens = chunks.reduce((sum, chunk) => sum + (chunk.tokenCount || 0), 0);

    // For now, return dummy relevance scores
    // In production, this would use actual relevance calculations
    const estimatedRelevance: Record<string, number> = {};
    chunks.forEach(chunk => {
      estimatedRelevance[chunk.id] = 0.8; // Default relevance
    });

    return {
      chunks: chunks.map(c => this.mapChunkToSchema(c)),
      totalTokens,
      estimatedRelevance,
    };
  }

  private mapToSchema(row: DecisionContextWindowSelect): DecisionContextWindow {
    return {
      id: row.id,
      decisionContextId: row.decisionContextId,
      chunkIds: row.chunkIds,
      selectionStrategy: row.selectionStrategy,
      totalTokens: row.totalTokens,
      totalChunks: row.totalChunks,
      relevanceScores: row.relevanceScores as Record<string, number> | undefined,
      usedFor: row.usedFor,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapChunkToSchema(row: any): TranscriptChunk {
    return {
      id: row.id,
      meetingId: row.meetingId,
      rawTranscriptId: row.rawTranscriptId,
      sequenceNumber: row.sequenceNumber,
      text: row.text,
      speaker: row.speaker || undefined,
      startTime: row.startTime || undefined,
      endTime: row.endTime || undefined,
      chunkStrategy: row.chunkStrategy,
      tokenCount: row.tokenCount || undefined,
      wordCount: row.wordCount || undefined,
      contexts: row.contexts,
      topics: row.topics || undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
