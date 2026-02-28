/**
 * Unit tests for DrizzleStreamingBufferRepository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleStreamingBufferRepository } from '../../src/repositories/streaming-buffer-repository';
import { DrizzleRawTranscriptRepository } from '../../src/repositories/raw-transcript-repository';
import { db } from '../../src/client';
import { transcriptChunks } from '../../src/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('DrizzleStreamingBufferRepository', () => {
  let repository: DrizzleStreamingBufferRepository;
  let rawTranscriptRepo: DrizzleRawTranscriptRepository;
  let testMeetingId: string;
  let testRawTranscriptId: string;

  beforeEach(async () => {
    repository = new DrizzleStreamingBufferRepository();
    rawTranscriptRepo = new DrizzleRawTranscriptRepository();
    testMeetingId = randomUUID();
    
    // Create a raw transcript for testing
    const rawTranscript = await rawTranscriptRepo.create({
      meetingId: testMeetingId,
      source: 'upload',
      format: 'txt',
      content: 'Test transcript for streaming',
    });
    testRawTranscriptId = rawTranscript.id;
    
    // Clean up any existing test data
    await db.delete(transcriptChunks).where(eq(transcriptChunks.meetingId, testMeetingId));
    
    // Clear any existing buffer
    await repository.clear(testMeetingId);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(transcriptChunks).where(eq(transcriptChunks.meetingId, testMeetingId));
    await repository.clear(testMeetingId);
  });

  describe('appendEvent', () => {
    it('should append events to the buffer', async () => {
      const event = {
        type: 'text' as const,
        data: {
          text: 'Hello world',
          speaker: 'Alice',
          rawTranscriptId: testRawTranscriptId,
        },
      };

      await repository.appendEvent(testMeetingId, event);

      const status = await repository.getStatus(testMeetingId);
      expect(status.status).toBe('active');
      expect(status.eventCount).toBe(1);
    });

    it('should handle multiple events', async () => {
      await repository.appendEvent(testMeetingId, {
        type: 'text',
        data: { text: 'First', rawTranscriptId: testRawTranscriptId },
      });

      await repository.appendEvent(testMeetingId, {
        type: 'text',
        data: { text: 'Second', rawTranscriptId: testRawTranscriptId },
      });

      const status = await repository.getStatus(testMeetingId);
      expect(status.eventCount).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('should return idle status for empty buffer', async () => {
      const status = await repository.getStatus(testMeetingId);
      expect(status.status).toBe('idle');
      expect(status.eventCount).toBe(0);
    });

    it('should return active status for buffer with events', async () => {
      await repository.appendEvent(testMeetingId, {
        type: 'text',
        data: { text: 'Test', rawTranscriptId: testRawTranscriptId },
      });

      const status = await repository.getStatus(testMeetingId);
      expect(status.status).toBe('active');
      expect(status.eventCount).toBe(1);
    });
  });

  describe('flush', () => {
    it('should create chunks from text events', async () => {
      await repository.appendEvent(testMeetingId, {
        type: 'text',
        data: {
          text: 'This is a streamed message',
          speaker: 'Bob',
          startTime: '00:02:00',
          endTime: '00:02:05',
          rawTranscriptId: testRawTranscriptId,
          contexts: ['meeting:' + testMeetingId],
          topics: ['streaming'],
        },
      });

      const chunks = await repository.flush(testMeetingId);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.text).toBe('This is a streamed message');
      expect(chunks[0]!.speaker).toBe('Bob');
      expect(chunks[0]!.startTime).toBe('00:02:00');
      expect(chunks[0]!.endTime).toBe('00:02:05');
      expect(chunks[0]!.chunkStrategy).toBe('streaming');
      expect(chunks[0]!.contexts).toContain('meeting:' + testMeetingId);
      expect(chunks[0]!.topics).toEqual(['streaming']);

      // Buffer should be cleared after flush
      const status = await repository.getStatus(testMeetingId);
      expect(status.status).toBe('idle');
      expect(status.eventCount).toBe(0);
    });

    it('should handle multiple text events', async () => {
      await repository.appendEvent(testMeetingId, {
        type: 'text',
        data: { text: 'First message', rawTranscriptId: testRawTranscriptId },
      });

      await repository.appendEvent(testMeetingId, {
        type: 'text',
        data: { text: 'Second message', rawTranscriptId: testRawTranscriptId },
      });

      const chunks = await repository.flush(testMeetingId);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]!.text).toBe('First message');
      expect(chunks[1]!.text).toBe('Second message');
    });

    it('should ignore non-text events', async () => {
      await repository.appendEvent(testMeetingId, {
        type: 'metadata',
        data: { some: 'metadata' },
      });

      const chunks = await repository.flush(testMeetingId);

      expect(chunks).toHaveLength(0);
    });

    it('should return empty array for empty buffer', async () => {
      const chunks = await repository.flush(testMeetingId);
      expect(chunks).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear the buffer', async () => {
      await repository.appendEvent(testMeetingId, {
        type: 'text',
        data: { text: 'Test', rawTranscriptId: testRawTranscriptId },
      });

      await repository.clear(testMeetingId);

      const status = await repository.getStatus(testMeetingId);
      expect(status.status).toBe('idle');
      expect(status.eventCount).toBe(0);
    });
  });
});
