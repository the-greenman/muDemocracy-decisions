/**
 * Drizzle implementation of ITranscriptChunkRepository
 */

import { eq, and, ilike, arrayContains, inArray } from "drizzle-orm";
import { db } from "../client.js";
import { transcriptChunks, TranscriptChunkSelect, TranscriptChunkInsert } from "../schema.js";
import { TranscriptChunk } from "@repo/schema";

export class DrizzleTranscriptChunkRepository {
  async create(data: any): Promise<TranscriptChunk> {
    const insertData: TranscriptChunkInsert = {
      meetingId: data.meetingId,
      rawTranscriptId: data.rawTranscriptId,
      sequenceNumber: data.sequenceNumber,
      text: data.text,
      speaker: data.speaker || null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      chunkStrategy: data.chunkStrategy,
      tokenCount: data.tokenCount || null,
      wordCount: data.wordCount || null,
      contexts: data.contexts || [],
      topics: data.topics || null,
    };

    const [result] = await db.insert(transcriptChunks).values(insertData).returning();

    return this.mapToSchema(result!);
  }

  async findByMeetingId(meetingId: string): Promise<TranscriptChunk[]> {
    const results = await db
      .select()
      .from(transcriptChunks)
      .where(eq(transcriptChunks.meetingId, meetingId))
      .orderBy(transcriptChunks.sequenceNumber);

    return results
      .map((r) => (r ? this.mapToSchema(r) : null))
      .filter(Boolean) as TranscriptChunk[];
  }

  async findByContext(contextTag: string): Promise<TranscriptChunk[]> {
    // Using arrayContains for array search
    const results = await db
      .select()
      .from(transcriptChunks)
      .where(arrayContains(transcriptChunks.contexts, [contextTag]))
      .orderBy(transcriptChunks.sequenceNumber);

    return results
      .map((r) => (r ? this.mapToSchema(r) : null))
      .filter(Boolean) as TranscriptChunk[];
  }

  async findById(id: string): Promise<TranscriptChunk | null> {
    const [result] = await db.select().from(transcriptChunks).where(eq(transcriptChunks.id, id));

    return result ? this.mapToSchema(result) : null;
  }

  async search(meetingId: string, query: string): Promise<TranscriptChunk[]> {
    const results = await db
      .select()
      .from(transcriptChunks)
      .where(
        and(eq(transcriptChunks.meetingId, meetingId), ilike(transcriptChunks.text, `%${query}%`)),
      )
      .orderBy(transcriptChunks.sequenceNumber);

    return results
      .map((r) => (r ? this.mapToSchema(r) : null))
      .filter(Boolean) as TranscriptChunk[];
  }

  async findByDecisionContext(decisionContextId: string): Promise<TranscriptChunk[]> {
    // This would need to join through chunk_relevance or decision_context_windows
    // For now, return chunks by context tag pattern
    const contextTag = `decision:${decisionContextId}`;
    return this.findByContext(contextTag);
  }

  async addContexts(chunkIds: string[], contexts: string[]): Promise<TranscriptChunk[]> {
    if (chunkIds.length === 0 || contexts.length === 0) {
      return [];
    }

    const dedupedChunkIds = Array.from(new Set(chunkIds));
    const dedupedContexts = Array.from(new Set(contexts));
    const existing = await db
      .select()
      .from(transcriptChunks)
      .where(inArray(transcriptChunks.id, dedupedChunkIds));

    if (existing.length === 0) {
      return [];
    }

    const updatedRows = await Promise.all(
      existing.map(async (row) => {
        const mergedContexts = Array.from(new Set([...(row.contexts ?? []), ...dedupedContexts]));
        const [updated] = await db
          .update(transcriptChunks)
          .set({ contexts: mergedContexts })
          .where(eq(transcriptChunks.id, row.id))
          .returning();
        return updated;
      }),
    );

    const bySequence = updatedRows
      .filter((row): row is TranscriptChunkSelect => Boolean(row))
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return bySequence.map((row) => this.mapToSchema(row));
  }

  private mapToSchema(row: TranscriptChunkSelect): TranscriptChunk {
    const rawStartTime = row.startTime as unknown;
    const rawEndTime = row.endTime as unknown;
    const startTime = rawStartTime instanceof Date ? rawStartTime.toISOString() : row.startTime;
    const endTime = rawEndTime instanceof Date ? rawEndTime.toISOString() : row.endTime;

    return {
      id: row.id,
      meetingId: row.meetingId,
      rawTranscriptId: row.rawTranscriptId,
      sequenceNumber: row.sequenceNumber,
      text: row.text,
      speaker: row.speaker || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      chunkStrategy: row.chunkStrategy,
      tokenCount: row.tokenCount || undefined,
      wordCount: row.wordCount || undefined,
      contexts: row.contexts,
      topics: row.topics || undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
