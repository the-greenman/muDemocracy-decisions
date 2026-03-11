/**
 * Integration tests for TranscriptService
 * These tests use mock repositories to test the business logic
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TranscriptService } from "../../src/services/transcript-service";
import { randomUUID } from "crypto";

// Mock repositories
class MockRawTranscriptRepository {
  private transcripts = new Map<string, any>();

  async create(data: any) {
    const transcript = {
      id: randomUUID(),
      ...data,
      uploadedAt: new Date().toISOString(),
    };
    this.transcripts.set(transcript.id, transcript);
    return transcript;
  }

  async findByMeetingId(meetingId: string) {
    return Array.from(this.transcripts.values()).filter(
      (transcript) => transcript.meetingId === meetingId,
    );
  }

  async findById(id: string) {
    // Return a mock transcript for testing chunkTranscript
    if (this.transcripts.has(id)) {
      return this.transcripts.get(id);
    }
    return {
      id: id,
      meetingId: randomUUID(),
      source: "upload",
      format: "txt",
      content: "This is a test transcript content for chunking",
      uploadedAt: new Date().toISOString(),
    };
  }

  async updateMetadata(id: string, metadata: Record<string, unknown>) {
    const transcript = await this.findById(id);
    if (!transcript) {
      return null;
    }

    const updated = {
      ...transcript,
      metadata,
    };
    this.transcripts.set(id, updated);
    return updated;
  }
}

class MockTranscriptChunkRepository {
  private chunks: any[] = [];

  async create(data: any) {
    const chunk = {
      id: randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
    };
    this.chunks.push(chunk);
    return chunk;
  }

  async findByMeetingId(meetingId: string) {
    return this.chunks.filter((chunk) => chunk.meetingId === meetingId);
  }

  async findByContext(_contextTag: string) {
    return [];
  }

  async search(_meetingId: string, _query: string) {
    return [];
  }

  async findByDecisionContext(_decisionContextId: string) {
    return [];
  }

  async findById(_id: string) {
    return null;
  }

  getAll() {
    return this.chunks;
  }
}

class MockStreamingBufferRepository {
  private buffers = new Map<string, { events: any[]; status: string }>();

  async appendEvent(meetingId: string, event: any) {
    if (!this.buffers.has(meetingId)) {
      this.buffers.set(meetingId, { events: [], status: "idle" });
    }
    const buffer = this.buffers.get(meetingId)!;
    buffer.events.push(event);
    buffer.status = "active";
  }

  async getStatus(meetingId: string) {
    const buffer = this.buffers.get(meetingId);
    return {
      status: buffer?.status || "idle",
      eventCount: buffer?.events.length || 0,
      lastActivity: new Date(),
    };
  }

  async flush(meetingId: string) {
    const buffer = this.buffers.get(meetingId);
    if (!buffer) return [];

    const chunks = buffer.events
      .filter((e: any) => e.type === "text")
      .map((e: any, index: number) => ({
        id: randomUUID(),
        meetingId,
        rawTranscriptId: e.data.rawTranscriptId || randomUUID(),
        sequenceNumber: index + 1,
        text: e.data.text,
        chunkStrategy: "streaming" as const,
        speaker: e.data.speaker,
        startTime: e.data.startTime,
        endTime: e.data.endTime,
        tokenCount: undefined,
        wordCount: undefined,
        contexts: e.data.contexts || [`meeting:${meetingId}`],
        topics: e.data.topics,
        createdAt: new Date().toISOString(),
      }));

    buffer.events = [];
    buffer.status = "idle";
    return chunks;
  }

  async clear(meetingId: string) {
    this.buffers.delete(meetingId);
  }
}

class MockChunkRelevanceRepository {
  async upsert(data: any) {
    return {
      id: randomUUID(),
      ...data,
      taggedAt: new Date().toISOString(),
    };
  }

  async findByDecisionField(_decisionContextId: string, _fieldId: string) {
    return [];
  }

  async deleteByChunk(_chunkId: string) {
    // Mock implementation
  }

  async findByChunk(_chunkId: string) {
    return [];
  }
}

class MockDecisionContextWindowRepository {
  async createOrUpdate(data: any) {
    return {
      id: randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async findByDecisionContextId(_decisionContextId: string) {
    return [];
  }

  async preview(_decisionContextId: string, _strategy: string, _limit?: number) {
    return {
      chunks: [],
      totalTokens: 0,
      estimatedRelevance: {},
    };
  }
}

describe("TranscriptService", () => {
  let service: TranscriptService;
  let mockRawTranscriptRepo: MockRawTranscriptRepository;
  let mockChunkRepo: MockTranscriptChunkRepository;
  let mockBufferRepo: MockStreamingBufferRepository;
  let mockRelevanceRepo: MockChunkRelevanceRepository;
  let mockContextWindowRepo: MockDecisionContextWindowRepository;

  beforeEach(() => {
    mockRawTranscriptRepo = new MockRawTranscriptRepository();
    mockChunkRepo = new MockTranscriptChunkRepository();
    mockBufferRepo = new MockStreamingBufferRepository();
    mockRelevanceRepo = new MockChunkRelevanceRepository();
    mockContextWindowRepo = new MockDecisionContextWindowRepository();

    service = new TranscriptService(
      mockRawTranscriptRepo,
      mockChunkRepo,
      mockBufferRepo,
      mockRelevanceRepo,
      mockContextWindowRepo,
    );
  });

  describe("uploadTranscript", () => {
    it("should create a raw transcript and auto-chunk if txt format", async () => {
      const data = {
        meetingId: randomUUID(),
        source: "upload" as const,
        format: "txt" as const,
        content: "This is a test transcript content",
        metadata: { fileName: "test.txt" },
        uploadedBy: "test-user",
      };

      const result = await service.uploadTranscript(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.meetingId).toBe(data.meetingId);
      expect(result.source).toBe("upload");
      expect(result.format).toBe("txt");
      expect(result.content).toBe("This is a test transcript content");
    });

    it("should create a raw transcript without auto-chunking for non-txt formats", async () => {
      const data = {
        meetingId: randomUUID(),
        source: "stream" as const,
        format: "json" as const,
        content: '{"text": "structured content"}',
      };

      const result = await service.uploadTranscript(data);

      expect(result).toBeDefined();
      expect(result.format).toBe("json");
    });
  });

  describe("preprocessTranscript", () => {
    it("should normalize plain text paragraphs into deterministic segments", async () => {
      const transcript = await service.uploadTranscript({
        meetingId: randomUUID(),
        source: "upload",
        format: "txt",
        content: "First paragraph line one.\n\nSecond paragraph line two.",
      });

      const segments = await service.preprocessTranscript(transcript.id);

      expect(segments).toHaveLength(2);
      expect(segments[0]?.sequenceNumber).toBe(1);
      expect(segments[0]?.text).toBe("First paragraph line one.");
      expect(segments[1]?.sequenceNumber).toBe(2);
      expect(segments[1]?.text).toBe("Second paragraph line two.");
    });

    it("should normalize whisper-like json transcripts into canonical segments", async () => {
      const transcript = await service.uploadTranscript({
        meetingId: randomUUID(),
        source: "upload",
        format: "json",
        content: JSON.stringify({
          segments: [
            { text: "Hello there", speaker: "Alice", start: 0, end: 1.2 },
            { text: "General Kenobi", start: 1.2, end: 2.5 },
          ],
        }),
      });

      const segments = await service.preprocessTranscript(transcript.id);

      expect(segments).toHaveLength(2);
      expect(segments[0]?.speaker).toBe("Alice");
      expect(segments[0]?.startTimeMs).toBe(0);
      expect(segments[0]?.endTimeMs).toBe(1200);
      expect(segments[1]?.text).toBe("General Kenobi");
    });
  });

  describe("getReadableTranscriptRows", () => {
    it("should return readable transcript rows derived from preprocessing output", async () => {
      const meetingId = randomUUID();
      const transcript = await service.uploadTranscript({
        meetingId,
        source: "upload",
        format: "txt",
        content: "Hello there.\n\nGeneral Kenobi.",
      });

      const processedChunks = await service.processTranscript(transcript.id, {
        strategy: "fixed",
        maxTokens: 50,
        overlap: 0,
      });

      const rows = await service.getReadableTranscriptRows(meetingId);

      expect(rows).toHaveLength(2);
      expect(rows[0]?.id).toBe(`${transcript.id}:1`);
      expect(rows[0]?.displayText).toBe("Hello there.");
      expect(rows[0]?.chunkIds).toEqual(processedChunks.map((chunk) => chunk.id));
      expect(rows[1]?.displayText).toBe("General Kenobi.");
      expect(rows[1]?.rawTranscriptId).toBe(transcript.id);
    });
  });

  describe("processTranscript", () => {
    it("should persist preprocessing metadata and chunk normalized plain text content", async () => {
      const meetingId = randomUUID();
      const transcript = await service.uploadTranscript({
        meetingId,
        source: "upload",
        format: "txt",
        content: "Alpha section.\n\nBeta section.",
        metadata: { fileName: "google-recorder.txt" },
      });

      const chunks = await service.processTranscript(transcript.id, {
        strategy: "fixed",
        maxTokens: 50,
        overlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);

      const updatedTranscript = await mockRawTranscriptRepo.findById(transcript.id);
      expect(updatedTranscript?.metadata?.fileName).toBe("google-recorder.txt");
      expect(updatedTranscript?.metadata?.preprocessing?.processorId).toBe("plain_text_blocks");
      expect(updatedTranscript?.metadata?.preprocessing?.stats?.outputSegmentCount).toBe(2);
      expect(chunks[0]?.text).toContain("Alpha section.");
      expect(chunks[0]?.text).toContain("Beta section.");
    });
  });

  describe("addStreamEvent", () => {
    it("should append events to the streaming buffer", async () => {
      const meetingId = randomUUID();
      const event = {
        type: "text" as const,
        data: {
          text: "Hello world",
          speaker: "Alice",
          rawTranscriptId: randomUUID(),
        },
      };

      await service.addStreamEvent(meetingId, event);

      const status = await service.getStreamStatus(meetingId);
      expect(status.status).toBe("active");
    });
  });

  describe("addTranscriptText", () => {
    it("should create a raw transcript and an immediate streaming chunk", async () => {
      const meetingId = randomUUID();

      const chunk = await service.addTranscriptText({
        meetingId,
        text: "Additional context about costs",
        speaker: "Alice",
      });

      expect(chunk.meetingId).toBe(meetingId);
      expect(chunk.text).toBe("Additional context about costs");
      expect(chunk.chunkStrategy).toBe("streaming");
      expect(chunk.sequenceNumber).toBe(1);
      expect(chunk.contexts).toContain(`meeting:${meetingId}`);
    });

    it("should append the next sequence number for existing meeting chunks", async () => {
      const meetingId = randomUUID();

      await service.addTranscriptText({ meetingId, text: "First line" });
      const nextChunk = await service.addTranscriptText({ meetingId, text: "Second line" });

      expect(nextChunk.sequenceNumber).toBe(2);
    });

    it("should preserve additional decision and field context tags", async () => {
      const meetingId = randomUUID();

      const chunk = await service.addTranscriptText({
        meetingId,
        text: "Option 1 costs less long term",
        contexts: [`decision:ctx-1`, `decision:ctx-1:options`],
      });

      expect(chunk.contexts).toContain(`meeting:${meetingId}`);
      expect(chunk.contexts).toContain("decision:ctx-1");
      expect(chunk.contexts).toContain("decision:ctx-1:options");
    });
  });

  describe("flushStream", () => {
    it("should flush the streaming buffer and create chunks", async () => {
      const meetingId = randomUUID();

      // Add some events first
      await service.addStreamEvent(meetingId, {
        type: "text",
        data: {
          text: "Test message",
          rawTranscriptId: randomUUID(),
        },
      });

      const chunks = await service.flushStream(meetingId);

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe("tagChunkRelevance", () => {
    it("should tag a chunk with relevance to a decision field", async () => {
      const chunkId = randomUUID();
      const decisionContextId = randomUUID();
      const fieldId = randomUUID();

      const result = await service.tagChunkRelevance({
        chunkId,
        decisionContextId,
        fieldId,
        relevance: 0.9,
        taggedBy: "llm",
      });

      expect(result).toBeDefined();
      expect(result.chunkId).toBe(chunkId);
      expect(result.decisionContextId).toBe(decisionContextId);
      expect(result.fieldId).toBe(fieldId);
      expect(result.relevance).toBe(0.9);
      expect(result.taggedBy).toBe("llm");
    });
  });

  describe("createContextWindow", () => {
    it("should create a context window for a decision", async () => {
      const decisionContextId = randomUUID();

      const result = await service.createContextWindow(decisionContextId, "relevant", "draft");

      expect(result).toBeDefined();
      expect(result.decisionContextId).toBe(decisionContextId);
      expect(result.selectionStrategy).toBe("relevant");
      expect(result.usedFor).toBe("draft");
    });
  });

  describe("getTranscriptChunks", () => {
    it("should return chunks for a meeting", async () => {
      const meetingId = randomUUID();

      const chunks = await service.getChunksByMeeting(meetingId);

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe("searchTranscripts", () => {
    it("should search chunks within a meeting", async () => {
      const meetingId = randomUUID();

      const results = await service.searchChunks(meetingId, "test query");

      expect(Array.isArray(results)).toBe(true);
    });
  });
});
