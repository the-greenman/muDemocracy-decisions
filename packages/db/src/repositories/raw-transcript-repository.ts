/**
 * Drizzle implementation of IRawTranscriptRepository
 */

import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { rawTranscripts, RawTranscriptSelect, RawTranscriptInsert } from "../schema.js";
import { RawTranscript, CreateRawTranscript } from "@repo/schema";

export class DrizzleRawTranscriptRepository {
  async create(data: CreateRawTranscript): Promise<RawTranscript> {
    const insertData: RawTranscriptInsert = {
      meetingId: data.meetingId,
      source: data.source,
      format: data.format,
      content: data.content,
      metadata: data.metadata || null,
      uploadedBy: data.uploadedBy || null,
    };

    const [result] = await db.insert(rawTranscripts).values(insertData).returning();

    return this.mapToSchema(result!);
  }

  async findByMeetingId(meetingId: string): Promise<RawTranscript[]> {
    const results = await db
      .select()
      .from(rawTranscripts)
      .where(eq(rawTranscripts.meetingId, meetingId));

    return results.map((r) => this.mapToSchema(r));
  }

  async findById(id: string): Promise<RawTranscript | null> {
    const [result] = await db.select().from(rawTranscripts).where(eq(rawTranscripts.id, id));

    return result ? this.mapToSchema(result) : null;
  }

  async updateMetadata(
    id: string,
    metadata: Record<string, unknown>,
  ): Promise<RawTranscript | null> {
    const [result] = await db
      .update(rawTranscripts)
      .set({ metadata })
      .where(eq(rawTranscripts.id, id))
      .returning();

    return result ? this.mapToSchema(result) : null;
  }

  private mapToSchema(row: RawTranscriptSelect): RawTranscript {
    return {
      id: row.id,
      meetingId: row.meetingId,
      source: row.source,
      format: row.format,
      content: row.content,
      metadata: row.metadata || undefined,
      uploadedAt: row.uploadedAt.toISOString(),
      uploadedBy: row.uploadedBy || undefined,
    };
  }
}
