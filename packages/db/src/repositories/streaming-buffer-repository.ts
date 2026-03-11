/**
 * Drizzle implementation of IStreamingBufferRepository
 *
 * Note: This is a simplified implementation that stores events in memory
 * and creates chunks when flushed. In a production environment, this might
 * use Redis or another streaming solution.
 */

import { db } from "../client.js";
import { rawTranscripts, transcriptChunks, TranscriptChunkInsert } from "../schema.js";
import { TranscriptChunk, CreateTranscriptChunk } from "@repo/schema";

interface StreamingEvent {
  type: "text" | "metadata";
  data: any;
  timestamp: Date;
}

interface BufferState {
  status: "active" | "idle" | "flushing";
  events: StreamingEvent[];
  lastActivity: Date;
}

// In-memory buffer store (production: use Redis)
const bufferStore = new Map<string, BufferState>();

export class DrizzleStreamingBufferRepository {
  async appendEvent(meetingId: string, event: any): Promise<void> {
    const buffer = bufferStore.get(meetingId) || {
      status: "active" as const,
      events: [],
      lastActivity: new Date(),
    };

    buffer.events.push({
      type: event.type || "text",
      data: event.data || event,
      timestamp: new Date(),
    });

    buffer.lastActivity = new Date();
    buffer.status = "active";

    bufferStore.set(meetingId, buffer);
  }

  async getStatus(meetingId: string): Promise<{ status: string; eventCount: number }> {
    const buffer = bufferStore.get(meetingId);

    if (!buffer) {
      return { status: "idle", eventCount: 0 };
    }

    // Mark as idle if no activity for 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (buffer.lastActivity < fiveMinutesAgo && buffer.status === "active") {
      buffer.status = "idle";
      bufferStore.set(meetingId, buffer);
    }

    return {
      status: buffer.status,
      eventCount: buffer.events.length,
    };
  }

  async flush(meetingId: string): Promise<TranscriptChunk[]> {
    const buffer = bufferStore.get(meetingId);

    if (!buffer || buffer.events.length === 0) {
      return [];
    }

    buffer.status = "flushing";

    try {
      const fallbackRawTranscriptId = await this.createFallbackRawTranscript(
        meetingId,
        buffer.events,
      );

      // Group events by type and create chunks
      const chunks: TranscriptChunk[] = [];
      let sequenceNumber = 1;

      // For now, we'll create one chunk per text event
      // In production, this would use more sophisticated chunking
      for (const event of buffer.events) {
        if (event.type === "text" && event.data.text) {
          const chunkData: CreateTranscriptChunk = {
            meetingId,
            rawTranscriptId: event.data.rawTranscriptId || fallbackRawTranscriptId,
            sequenceNumber: sequenceNumber++,
            text: event.data.text,
            speaker: event.data.speaker,
            startTime: event.data.startTime,
            endTime: event.data.endTime,
            chunkStrategy: "streaming",
            tokenCount: this.estimateTokenCount(event.data.text),
            wordCount: this.countWords(event.data.text),
            contexts: event.data.contexts || [`meeting:${meetingId}`],
            topics: event.data.topics,
          };

          const insertData: TranscriptChunkInsert = {
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
          };

          const [result] = await db.insert(transcriptChunks).values(insertData).returning();

          chunks.push(this.mapToSchema(result));
        }
      }

      // Clear the buffer after successful flush
      buffer.events = [];
      buffer.status = "idle";
      bufferStore.set(meetingId, buffer);

      return chunks;
    } catch (error) {
      buffer.status = "active";
      bufferStore.set(meetingId, buffer);
      throw error;
    }
  }

  async clear(meetingId: string): Promise<void> {
    bufferStore.delete(meetingId);
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
    events: StreamingEvent[],
  ): Promise<string> {
    const combinedText = events
      .filter((event) => event.type === "text" && typeof event.data?.text === "string")
      .map((event) => String(event.data.text).trim())
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
    const startTime = row.startTime instanceof Date ? row.startTime.toISOString() : row.startTime;
    const endTime = row.endTime instanceof Date ? row.endTime.toISOString() : row.endTime;

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
