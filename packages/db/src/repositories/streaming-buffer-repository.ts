/**
 * Drizzle implementation of IStreamingBufferRepository - Phase 3
 *
 * DB-backed streaming buffer with streamSource support and advisory lock-based
 * flush idempotency.
 */

import { db } from "../client.js";
import { streamEvents, transcriptChunks, rawTranscripts } from "../schema.js";
import { TranscriptChunk, CreateTranscriptChunk } from "@repo/schema";
import { eq, and, sql, count, asc } from "drizzle-orm";

interface StreamingEvent {
  type: "text" | "metadata";
  data: any;
  streamSource?: string;
}

interface BufferStatus {
  status: "idle" | "active";
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

      // Get unflushed events ordered by (createdAt, id) for stable ordering
      // when multiple rows share the same timestamp granularity.
      const events = await tx
        .select()
        .from(streamEvents)
        .where(and(eq(streamEvents.meetingId, meetingId), eq(streamEvents.flushed, false)))
        .orderBy(asc(streamEvents.createdAt), asc(streamEvents.id));

      if (events.length === 0) {
        return [];
      }

      // Group events by streamSource, create one raw_transcript per group
      const NO_SOURCE = "__no_source__";
      const eventsBySource = new Map<string, typeof events>();
      for (const event of events) {
        const key = event.streamSource ?? NO_SOURCE;
        if (!eventsBySource.has(key)) eventsBySource.set(key, []);
        eventsBySource.get(key)!.push(event);
      }

      const rawTranscriptBySource = new Map<string, string>();
      for (const [source, sourceEvents] of eventsBySource) {
        const id = await this.createFallbackRawTranscript(
          tx,
          meetingId,
          sourceEvents,
          source === NO_SOURCE ? undefined : source,
        );
        rawTranscriptBySource.set(source, id);
      }

      // Create chunks from events, sequence numbers reset per source
      const chunks: TranscriptChunk[] = [];
      const seqBySource = new Map<string, number>();

      for (const event of events) {
        if (event.type === "text" && event.text) {
          const eventData = event.data as any;
          const sourceKey = event.streamSource ?? NO_SOURCE;
          const rawTranscriptId = eventData.rawTranscriptId ?? rawTranscriptBySource.get(sourceKey)!;
          const seq = (seqBySource.get(sourceKey) ?? 0) + 1;
          seqBySource.set(sourceKey, seq);

          const chunkData: CreateTranscriptChunk = {
            meetingId,
            rawTranscriptId,
            sequenceNumber: seq,
            text: event.text,
            speaker: event.speaker || undefined,
            startTime: event.startTime?.toISOString(),
            endTime: event.endTime?.toISOString(),
            chunkStrategy: "streaming",
            tokenCount: this.estimateTokenCount(event.text),
            wordCount: this.countWords(event.text),
            contexts: eventData.contexts || [`meeting:${meetingId}`],
            topics: eventData.topics,
            contentType: eventData.contentType ?? "speech",
            startTimeMs: eventData.startTimeMs,
            endTimeMs: eventData.endTimeMs,
            messageId: eventData.messageId,
            threadId: eventData.threadId,
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
            streamSource: event.streamSource,
            contentType: eventData.contentType ?? "speech",
            startTimeMs: eventData.startTimeMs ?? null,
            endTimeMs: eventData.endTimeMs ?? null,
            messageId: eventData.messageId ?? null,
            threadId: eventData.threadId ?? null,
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
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    meetingId: string,
    events: any[],
    streamSource?: string,
  ): Promise<string> {
    const combinedText = events
      .filter((event) => event.type === "text" && typeof event.text === "string")
      .map((event) => event.text.trim())
      .filter(Boolean)
      .join("\n");

    const metadata: Record<string, unknown> = {
      generatedBy: "streaming-buffer-flush",
      eventCount: events.length,
    };
    if (streamSource !== undefined) {
      metadata.streamSource = streamSource;
    }

    const [rawTranscript] = await tx
      .insert(rawTranscripts)
      .values({
        meetingId,
        source: "stream",
        format: "txt",
        content: combinedText.length > 0 ? combinedText : "[stream flush without text payload]",
        metadata,
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
      contentType: row.contentType ?? "speech",
      startTimeMs: row.startTimeMs ?? undefined,
      endTimeMs: row.endTimeMs ?? undefined,
      messageId: row.messageId ?? undefined,
      threadId: row.threadId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
