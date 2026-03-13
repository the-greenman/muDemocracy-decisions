/**
 * Unit tests for DrizzleRawTranscriptRepository
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DrizzleRawTranscriptRepository } from "../../src/repositories/raw-transcript-repository";
import { db } from "../../src/client";
import { rawTranscripts, meetings } from "../../src/schema";
import { eq } from "drizzle-orm";
import { CreateRawTranscript } from "@repo/schema";
import { randomUUID } from "crypto";

describe("DrizzleRawTranscriptRepository", () => {
  let repository: DrizzleRawTranscriptRepository;
  let testMeetingId: string;
  let otherMeetingId: string;

  beforeEach(async () => {
    repository = new DrizzleRawTranscriptRepository();
    testMeetingId = randomUUID();
    otherMeetingId = randomUUID();

    // Create a test meeting to satisfy foreign key constraint
    await db.insert(meetings).values({
      id: testMeetingId,
      title: "Test Meeting",
      date: new Date(),
      participants: [],
      status: "in_session",
    });

    await db.insert(meetings).values({
      id: otherMeetingId,
      title: "Other Meeting",
      date: new Date(),
      participants: [],
      status: "in_session",
    });

    // Clean up any existing test data
    await db.delete(rawTranscripts).where(eq(rawTranscripts.meetingId, testMeetingId));
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(rawTranscripts).where(eq(rawTranscripts.meetingId, testMeetingId));
    await db.delete(meetings).where(eq(meetings.id, testMeetingId));
    await db.delete(rawTranscripts).where(eq(rawTranscripts.meetingId, otherMeetingId));
    await db.delete(meetings).where(eq(meetings.id, otherMeetingId));
  });

  describe("create", () => {
    it("should create a raw transcript", async () => {
      const data: CreateRawTranscript = {
        meetingId: testMeetingId,
        source: "upload",
        format: "txt",
        content: "Test transcript content",
        metadata: { fileName: "test.txt" },
        uploadedBy: "test-user",
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.meetingId).toBe(testMeetingId);
      expect(result.source).toBe("upload");
      expect(result.format).toBe("txt");
      expect(result.content).toBe("Test transcript content");
      expect(result.metadata).toEqual({ fileName: "test.txt" });
      expect(result.uploadedBy).toBe("test-user");
      expect(result.uploadedAt).toBeDefined();
    });

    it("should create a transcript without optional fields", async () => {
      const data: CreateRawTranscript = {
        meetingId: testMeetingId,
        source: "stream",
        format: "json",
        content: '{"text": "streamed content"}',
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.metadata).toBeUndefined();
      expect(result.uploadedBy).toBeUndefined();
    });
  });

  describe("findByMeetingId", () => {
    it("should return all transcripts for a meeting", async () => {
      // Create multiple transcripts
      const transcript1 = await repository.create({
        meetingId: testMeetingId,
        source: "upload",
        format: "txt",
        content: "First transcript",
      });

      const transcript2 = await repository.create({
        meetingId: testMeetingId,
        source: "stream",
        format: "json",
        content: "Second transcript",
      });

      // Create a transcript for a different meeting
      await repository.create({
        meetingId: otherMeetingId,
        source: "upload",
        format: "txt",
        content: "Other transcript",
      });

      const results = await repository.findByMeetingId(testMeetingId);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toContain(transcript1.id);
      expect(results.map((r) => r.id)).toContain(transcript2.id);
    });

    it("should return empty array for meeting with no transcripts", async () => {
      const results = await repository.findByMeetingId("00000000-0000-0000-0000-000000000000");
      expect(results).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should return a transcript by ID", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        source: "upload",
        format: "txt",
        content: "Test content",
      });

      const result = await repository.findById(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.content).toBe("Test content");
    });

    it("should return null for non-existent ID", async () => {
      const result = await repository.findById("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });
});
