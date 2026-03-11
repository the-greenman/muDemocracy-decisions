/**
 * Drizzle implementation of IChunkRelevanceRepository
 */

import { eq, and } from "drizzle-orm";
import { db } from "../client.js";
import { chunkRelevance, ChunkRelevanceSelect, ChunkRelevanceInsert } from "../schema.js";
import { ChunkRelevance } from "@repo/schema";

export class DrizzleChunkRelevanceRepository {
  async upsert(data: Omit<ChunkRelevance, "id" | "taggedAt">): Promise<ChunkRelevance> {
    const insertData: ChunkRelevanceInsert = {
      chunkId: data.chunkId,
      decisionContextId: data.decisionContextId,
      fieldId: data.fieldId,
      relevance: data.relevance,
      taggedBy: data.taggedBy,
    };

    // Check if record exists
    const [existing] = await db
      .select()
      .from(chunkRelevance)
      .where(
        and(
          eq(chunkRelevance.chunkId, data.chunkId),
          eq(chunkRelevance.decisionContextId, data.decisionContextId),
          eq(chunkRelevance.fieldId, data.fieldId),
        ),
      );

    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(chunkRelevance)
        .set({ relevance: data.relevance })
        .where(eq(chunkRelevance.id, existing.id))
        .returning();

      return this.mapToSchema(updated!);
    } else {
      // Insert new record
      const [result] = await db.insert(chunkRelevance).values(insertData).returning();

      return this.mapToSchema(result!);
    }
  }

  async findByDecisionField(decisionContextId: string, fieldId: string): Promise<ChunkRelevance[]> {
    const results = await db
      .select()
      .from(chunkRelevance)
      .where(
        and(
          eq(chunkRelevance.decisionContextId, decisionContextId),
          eq(chunkRelevance.fieldId, fieldId),
        ),
      )
      .orderBy(chunkRelevance.relevance); // Most relevant first

    return results.map((r) => this.mapToSchema(r));
  }

  async deleteByChunk(chunkId: string): Promise<void> {
    await db.delete(chunkRelevance).where(eq(chunkRelevance.chunkId, chunkId));
  }

  async findByChunk(chunkId: string): Promise<ChunkRelevance[]> {
    const results = await db
      .select()
      .from(chunkRelevance)
      .where(eq(chunkRelevance.chunkId, chunkId))
      .orderBy(chunkRelevance.relevance);

    return results.map((r) => this.mapToSchema(r));
  }

  private mapToSchema(row: ChunkRelevanceSelect): ChunkRelevance {
    return {
      id: row.id,
      chunkId: row.chunkId,
      decisionContextId: row.decisionContextId,
      fieldId: row.fieldId,
      relevance: row.relevance,
      taggedBy: row.taggedBy,
      taggedAt: row.taggedAt.toISOString(),
    };
  }
}
