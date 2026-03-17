/**
 * Integration tests for DrizzleStreamingBufferRepository — Phase 3
 *
 * Phase 3 replaces the in-memory Map buffer with a DB-backed stream_events table
 * and adds PostgreSQL advisory-lock-based flush idempotency.
 *
 * These tests run against the real test DB (decision_logger_test).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DrizzleStreamingBufferRepository } from "../repositories/streaming-buffer-repository.js";
import { DrizzleMeetingRepository } from "../repositories/meeting-repository.js";
import { db } from "../client.js";
import { transcriptChunks, rawTranscripts, meetings, streamEvents } from "../schema.js";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

describe("DrizzleStreamingBufferRepository (DB-backed)", () => {
  let repository: DrizzleStreamingBufferRepository;
  let testMeetingId: string;

  beforeEach(async () => {
    repository = new DrizzleStreamingBufferRepository();
    const meetingRepo = new DrizzleMeetingRepository();
    const meeting = await meetingRepo.create({
      title: `Streaming Buffer Phase3 ${randomUUID()}`,
      date: new Date().toISOString(),
      participants: ["Test User"],
    });
    testMeetingId = meeting.id;
  });

  afterEach(async () => {
    await db.delete(streamEvents).where(eq(streamEvents.meetingId, testMeetingId));
    await db.delete(transcriptChunks).where(eq(transcriptChunks.meetingId, testMeetingId));
    await db.delete(rawTranscripts).where(eq(rawTranscripts.meetingId, testMeetingId));
    await db.delete(meetings).where(eq(meetings.id, testMeetingId));
  });

  // ---------------------------------------------------------------------------
  // appendEvent — persists to stream_events table
  // ---------------------------------------------------------------------------

  describe("appendEvent", () => {
    it("inserts a row into stream_events", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Hello world", speaker: "Alice" },
      });

      const rows = await db
        .select()
        .from(streamEvents)
        .where(eq(streamEvents.meetingId, testMeetingId));

      expect(rows).toHaveLength(1);
      expect(rows[0]!.text).toBe("Hello world");
      expect(rows[0]!.speaker).toBe("Alice");
      expect(rows[0]!.flushed).toBe(false);
    });

    it("persists streamSource when supplied", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "From transcription service", streamSource: "transcription" },
      });

      const [row] = await db
        .select()
        .from(streamEvents)
        .where(eq(streamEvents.meetingId, testMeetingId));

      expect(row!.streamSource).toBe("transcription");
    });

    it("persists null streamSource when not supplied", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Unknown source" },
      });

      const [row] = await db
        .select()
        .from(streamEvents)
        .where(eq(streamEvents.meetingId, testMeetingId));

      expect(row!.streamSource).toBeNull();
    });

    it("handles multiple events from different sources", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "A", streamSource: "transcription" },
      });
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "B", streamSource: "local-audio" },
      });

      const rows = await db
        .select()
        .from(streamEvents)
        .where(eq(streamEvents.meetingId, testMeetingId));

      expect(rows).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getStatus — counts unflushed rows in DB
  // ---------------------------------------------------------------------------

  describe("getStatus", () => {
    it("returns idle with 0 events when no rows exist", async () => {
      const status = await repository.getStatus(testMeetingId);
      expect(status.status).toBe("idle");
      expect(status.eventCount).toBe(0);
    });

    it("returns active with correct count when unflushed rows exist", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "First" },
      });
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Second" },
      });

      const status = await repository.getStatus(testMeetingId);
      expect(status.status).toBe("active");
      expect(status.eventCount).toBe(2);
    });

    it("excludes already-flushed rows from the count", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Will be flushed" },
      });
      await repository.flush(testMeetingId);

      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "New after flush" },
      });

      const status = await repository.getStatus(testMeetingId);
      expect(status.eventCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // flush — creates chunks, marks rows flushed, preserves streamSource
  // ---------------------------------------------------------------------------

  describe("flush", () => {
    it("returns empty array when no unflushed rows exist", async () => {
      const chunks = await repository.flush(testMeetingId);
      expect(chunks).toEqual([]);
    });

    it("creates one chunk per text event", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "First message", speaker: "Bob" },
      });
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Second message", speaker: "Alice" },
      });

      const chunks = await repository.flush(testMeetingId);

      expect(chunks).toHaveLength(2);
      // Order is by (createdAt, id) — check presence, not position, to avoid
      // flakiness when both rows land in the same millisecond.
      const texts = chunks.map((c) => c.text);
      expect(texts).toContain("First message");
      expect(texts).toContain("Second message");
    });

    it("ignores non-text events during flush but still stores them in stream_events", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "metadata",
        data: { some: "metadata" },
      });
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Real content" },
      });

      // Both rows should be in the DB
      const rows = await db
        .select()
        .from(streamEvents)
        .where(eq(streamEvents.meetingId, testMeetingId));
      expect(rows).toHaveLength(2);

      // But only the text event produces a chunk
      const chunks = await repository.flush(testMeetingId);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.text).toBe("Real content");
    });

    it("preserves streamSource on resulting chunks", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Transcription output", streamSource: "transcription" },
      });

      const chunks = await repository.flush(testMeetingId);

      expect(chunks[0]!.streamSource).toBe("transcription");
    });

    it("marks flushed rows as flushed in DB", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Test event" },
      });

      await repository.flush(testMeetingId);

      const unflushed = await db
        .select()
        .from(streamEvents)
        .where(and(eq(streamEvents.meetingId, testMeetingId), eq(streamEvents.flushed, false)));

      expect(unflushed).toHaveLength(0);
    });

    it("returns [] when called again after all rows are already flushed", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Only event" },
      });

      const first = await repository.flush(testMeetingId);
      const second = await repository.flush(testMeetingId);

      expect(first).toHaveLength(1);
      expect(second).toHaveLength(0);
    });

    it("does not re-flush already-flushed rows", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "First" },
      });
      const firstFlush = await repository.flush(testMeetingId);
      expect(firstFlush).toHaveLength(1);

      // Append a second event after the first flush
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Second" },
      });
      const secondFlush = await repository.flush(testMeetingId);

      // Should only include the new event
      expect(secondFlush).toHaveLength(1);
      expect(secondFlush[0]!.text).toBe("Second");
    });

    it("correctly labels chunks from two concurrent streams with different streamSources", async () => {
      // Simulate two interleaved streams from different sources
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Transcription chunk 1", streamSource: "transcription" },
      });
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Local audio chunk 1", streamSource: "local-audio" },
      });
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Transcription chunk 2", streamSource: "transcription" },
      });

      const chunks = await repository.flush(testMeetingId);

      expect(chunks).toHaveLength(3);

      const sources = chunks.map((c) => c.streamSource);
      expect(sources).toContain("transcription");
      expect(sources).toContain("local-audio");

      const transcriptionChunks = chunks.filter((c) => c.streamSource === "transcription");
      const localAudioChunks = chunks.filter((c) => c.streamSource === "local-audio");
      expect(transcriptionChunks).toHaveLength(2);
      expect(localAudioChunks).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Concurrent flush safety — advisory lock prevents double-flush
  // ---------------------------------------------------------------------------

  describe("concurrent flush safety", () => {
    it("two simultaneous flush() calls produce exactly N chunks with no duplicates", async () => {
      const eventCount = 10;
      for (let i = 0; i < eventCount; i++) {
        await repository.appendEvent(testMeetingId, {
          type: "text",
          data: { text: `Event ${i + 1}` },
        });
      }

      // Fire both flushes simultaneously — advisory lock means only one
      // transaction reads and marks the rows; the other returns [].
      const [resultA, resultB] = await Promise.all([
        repository.flush(testMeetingId),
        repository.flush(testMeetingId),
      ]);

      // Key invariant: no chunks are created twice
      expect(resultA.length + resultB.length).toBe(eventCount);

      // Verify DB: exactly N chunks, none duplicated
      const dbChunks = await db
        .select()
        .from(transcriptChunks)
        .where(eq(transcriptChunks.meetingId, testMeetingId));

      expect(dbChunks).toHaveLength(eventCount);
    });
  });

  // ---------------------------------------------------------------------------
  // clear — deletes rows from stream_events
  // ---------------------------------------------------------------------------

  describe("clear", () => {
    it("deletes all stream_events rows for the meeting", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Will be cleared" },
      });

      await repository.clear(testMeetingId);

      const rows = await db
        .select()
        .from(streamEvents)
        .where(eq(streamEvents.meetingId, testMeetingId));

      expect(rows).toHaveLength(0);
    });

    it("also removes flushed rows", async () => {
      await repository.appendEvent(testMeetingId, {
        type: "text",
        data: { text: "Flushed event" },
      });
      await repository.flush(testMeetingId);

      await repository.clear(testMeetingId);

      const rows = await db
        .select()
        .from(streamEvents)
        .where(eq(streamEvents.meetingId, testMeetingId));

      expect(rows).toHaveLength(0);
    });

    it("is a no-op when no rows exist", async () => {
      await expect(repository.clear(testMeetingId)).resolves.toBeUndefined();
    });
  });
});
