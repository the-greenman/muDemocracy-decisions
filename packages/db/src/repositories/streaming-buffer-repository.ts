/**
 * Drizzle implementation of IStreamingBufferRepository - Phase 3
 *
 * DB-backed streaming buffer with streamSource support and advisory lock-based
 * flush idempotency.
 */

import { db } from "../client.js";
import { streamEvents, transcriptChunks, rawTranscripts } from "../schema.js";
import { TranscriptChunk, CreateTranscriptChunk } from "@repo/schema";
import { eq, and, sql, count } from "drizzle-orm";

interface StreamingEvent {
  type: "text" | "metadata";
  data: any;
  streamSource?: string;
}

interface BufferStatus {
  status: "idle" | "active" | "flushing";
  eventCount: number;
}

export class DrizzleStreamingBufferRepository {
  async appendEvent(meetingId: string, event: StreamingEvent): Promise<void> {
    // Extract fields for easier querying
    const { text, speaker, startTime, endTime, streamSource } = event.data || event;

    await db.insert(streamEvents).values({
      meetingId,
      type: event.type || "text",
      text: typeof text === "string" ? text : null,
      speaker: speaker || null,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      streamSource: streamSource || null,
      data: event.data || event,
      flushed: false,
    });
  }

  async getStatus(meetingId: string): Promise<BufferStatus> {
    const [result] = await db
      .select({ count: count() })
      .from(streamEvents)
      .where(and(eq(streamEvents.meetingId, meetingId), eq(streamEvents.flushed, false)));

    const eventCount = Number(result?.count || 0);
    
    return {
      status: eventCount > 0 ? "active" : "idle",
      eventCount,
    };
  }

  async flush(meetingId: string): Promise<TranscriptChunk[]> {
    // Use PostgreSQL advisory lock to prevent concurrent flushes
    const lockKey = `stream_flush_${meetingId}`;
    
    return await db.transaction(async (tx) => {
      // Acquire advisory lock using raw SQL
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      // Get unflushed events ordered by creation time
      const events = await tx
        .select()
        .from(streamEvents)
        .where(and(eq(streamEvents.meetingId, meetingId), eq(streamEvents.flushed, false)))
        .orderBy(streamEvents.createdAt);

      if (events.length === 0) {
        return [];
      }

      // Create a fallback raw transcript if needed
      const fallbackRawTranscriptId = await this.createFallbackRawTranscript(meetingId, events);

      // Create chunks from events
      const chunks: TranscriptChunk[] = [];
      let sequenceNumber = 1;

      for (const event of events) {
        if (event.type === "text" && event.text) {
          const eventData = event.data as any;
          const chunkData: CreateTranscriptChunk = {
            meetingId,
            rawTranscriptId: eventData.rawTranscriptId || fallbackRawTranscriptId,
            sequenceNumber: sequenceNumber++,
            text: event.text,
            speaker: event.speaker || undefined,
            startTime: event.startTime?.toISOString(),
            endTime: event.endTime?.toISOString(),
            chunkStrategy: "streaming",
            tokenCount: this.estimateTokenCount(event.text),
            wordCount: this.countWords(event.text),
            contexts: eventData.contexts || [`meeting:${meetingId}`],
            topics: eventData.topics,
          };

          const [result] = await tx.insert(transcriptChunks).values({
            meetingId: chunkData.meetingId,
            rawTranscriptId: chunkData.rawTranscriptId,
            sequenceNumber: chunkData.sequenceNumber,
            text: chunkData.text,
            speaker: chunkData.speaker || null,
            startTime: chunkData.startTime || null,
            endTime: chunkData.endTime || null,
            chunkStrategy: chunkData.chunkStrategy,
            tokenCount: chunkData.tokenCount || null,
            wordCount: chunkData.wordCount || null,
            contexts: chunkData.contexts,
            topics: chunkData.topics || null,
            streamSource: event.streamSource, // Preserve streamSource
          }).returning();

          chunks.push(this.mapToSchema(result));
        }
      }

      // Mark all events as flushed
      await tx
        .update(streamEvents)
        .set({ flushed: true })
        .where(and(eq(streamEvents.meetingId, meetingId), eq(streamEvents.flushed, false)));

      return chunks;
    });
  }

  async clear(meetingId: string): Promise<void> {
    await db.delete(streamEvents).where(eq(streamEvents.meetingId, meetingId));
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  private async createFallbackRawTranscript(
    meetingId: string,
    events: any[],
  ): Promise<string> {
    const combinedText = events
      .filter((event) => event.type === "text" && typeof event.text === "string")
      .map((event) => event.text.trim())
      .filter(Boolean)
      .join("\n");

    const [rawTranscript] = await db
      .insert(rawTranscripts)
      .values({
        meetingId,
        source: "stream",
        format: "txt",
        content: combinedText.length > 0 ? combinedText : "[stream flush without text payload]",
        metadata: {
          generatedBy: "streaming-buffer-flush",
          eventCount: events.length,
        },
      })
      .returning({ id: rawTranscripts.id });

    if (!rawTranscript) {
      throw new Error("Failed to create raw transcript for stream flush");
    }

    return rawTranscript.id;
  }

  private mapToSchema(row: any): TranscriptChunk {
    return {
      id: row.id,
      meetingId: row.meetingId,
      rawTranscriptId: row.rawTranscriptId,
      sequenceNumber: row.sequenceNumber,
      text: row.text,
      speaker: row.speaker || undefined,
      startTime: row.startTime?.toISOString() || undefined,
      endTime: row.endTime?.toISOString() || undefined,
      chunkStrategy: row.chunkStrategy,
      tokenCount: row.tokenCount || undefined,
      wordCount: row.wordCount || undefined,
      contexts: row.contexts,
      topics: row.topics || undefined,
      streamSource: row.streamSource || undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
