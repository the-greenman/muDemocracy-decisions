/**
 * Unit tests for DrizzleTranscriptChunkRepository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleTranscriptChunkRepository } from '../../src/repositories/transcript-chunk-repository';
import { DrizzleRawTranscriptRepository } from '../../src/repositories/raw-transcript-repository';
import { DrizzleMeetingRepository } from '../../src/repositories/meeting-repository';
import { db } from '../../src/client';
import { transcriptChunks, rawTranscripts, meetings } from '../../src/schema';
import { eq } from 'drizzle-orm';
import { CreateTranscriptChunk } from '@repo/schema';
import { randomUUID } from 'crypto';

describe('DrizzleTranscriptChunkRepository', () => {
  let repository: DrizzleTranscriptChunkRepository;
  let rawTranscriptRepo: DrizzleRawTranscriptRepository;
  let meetingRepo: DrizzleMeetingRepository;
  let testMeetingId: string;
  let testRawTranscriptId: string;

  beforeEach(async () => {
    repository = new DrizzleTranscriptChunkRepository();
    rawTranscriptRepo = new DrizzleRawTranscriptRepository();
    meetingRepo = new DrizzleMeetingRepository();

    const meeting = await meetingRepo.create({
      title: `Test Meeting ${randomUUID()}`,
      date: new Date().toISOString(),
      participants: ['Test User'],
    });
    testMeetingId = meeting.id;
    
    // Create a raw transcript for testing
    const rawTranscript = await rawTranscriptRepo.create({
      meetingId: testMeetingId,
      source: 'upload',
      format: 'txt',
      content: 'Test transcript for chunks',
    });
    testRawTranscriptId = rawTranscript.id;
    
    // Clean up any existing test data
    await db.delete(transcriptChunks).where(eq(transcriptChunks.meetingId, testMeetingId));
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(transcriptChunks).where(eq(transcriptChunks.meetingId, testMeetingId));
    await db.delete(rawTranscripts).where(eq(rawTranscripts.meetingId, testMeetingId));
    await db.delete(meetings).where(eq(meetings.id, testMeetingId));
  });

  describe('create', () => {
    it('should create a transcript chunk', async () => {
      const data: CreateTranscriptChunk = {
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 1,
        text: 'This is a test chunk',
        speaker: 'Alice',
        startTime: '2026-03-01T00:01:00Z',
        endTime: '2026-03-01T00:01:10Z',
        chunkStrategy: 'semantic',
        tokenCount: 10,
        wordCount: 6,
        contexts: ['meeting:' + testMeetingId, 'decision:test-decision'],
        topics: ['architecture'],
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.meetingId).toBe(testMeetingId);
      expect(result.rawTranscriptId).toBe(testRawTranscriptId);
      expect(result.sequenceNumber).toBe(1);
      expect(result.text).toBe('This is a test chunk');
      expect(result.speaker).toBe('Alice');
      expect(result.startTime).toBe('2026-03-01T00:01:00.000Z');
      expect(result.endTime).toBe('2026-03-01T00:01:10.000Z');
      expect(result.chunkStrategy).toBe('semantic');
      expect(result.tokenCount).toBe(10);
      expect(result.wordCount).toBe(6);
      expect(result.contexts).toEqual(['meeting:' + testMeetingId, 'decision:test-decision']);
      expect(result.topics).toEqual(['architecture']);
      expect(result.createdAt).toBeDefined();
    });

    it('should create a chunk with minimal required fields', async () => {
      const data: CreateTranscriptChunk = {
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 1,
        text: 'Minimal chunk',
        contexts: ['meeting:' + testMeetingId],
        chunkStrategy: 'fixed',
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.speaker).toBeUndefined();
      expect(result.startTime).toBeUndefined();
      expect(result.endTime).toBeUndefined();
      expect(result.tokenCount).toBeUndefined();
      expect(result.wordCount).toBeUndefined();
      expect(result.contexts).toEqual(['meeting:' + testMeetingId]);
      expect(result.topics).toBeUndefined();
    });
  });

  describe('findByMeetingId', () => {
    it('should return chunks ordered by sequence number', async () => {
      // Create chunks out of order
      await repository.create({
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 3,
        text: 'Third chunk',
        contexts: ['meeting:' + testMeetingId],
        chunkStrategy: 'fixed',
      });

      await repository.create({
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 1,
        text: 'First chunk',
        contexts: ['meeting:' + testMeetingId],
        chunkStrategy: 'fixed',
      });

      await repository.create({
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 2,
        text: 'Second chunk',
        contexts: ['meeting:' + testMeetingId],
        chunkStrategy: 'fixed',
      });

      const results = await repository.findByMeetingId(testMeetingId);

      expect(results).toHaveLength(3);
      expect(results[0]!.sequenceNumber).toBe(1);
      expect(results[1]!.sequenceNumber).toBe(2);
      expect(results[2]!.sequenceNumber).toBe(3);
    });
  });

  describe('findByContext', () => {
    it('should return chunks tagged with specific context', async () => {
      const contextTag = 'decision:test-decision';
      
      await repository.create({
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 1,
        text: 'Chunk with context',
        contexts: ['meeting:' + testMeetingId, contextTag],
        chunkStrategy: 'fixed',
      });

      await repository.create({
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 2,
        text: 'Chunk without context',
        contexts: ['meeting:' + testMeetingId],
        chunkStrategy: 'fixed',
      });

      const results = await repository.findByContext(contextTag);

      expect(results).toHaveLength(1);
      expect(results[0]!.text).toBe('Chunk with context');
    });
  });

  describe('search', () => {
    it('should find chunks containing search query', async () => {
      await repository.create({
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 1,
        text: 'This is about architecture decisions',
        chunkStrategy: 'fixed',
      });

      await repository.create({
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 2,
        text: 'This is about user interface',
        chunkStrategy: 'fixed',
      });

      const results = await repository.search(testMeetingId, 'architecture');

      expect(results).toHaveLength(1);
      expect(results[0]!.text).toContain('architecture');
    });
  });

  describe('findById', () => {
    it('should return a chunk by ID', async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        rawTranscriptId: testRawTranscriptId,
        sequenceNumber: 1,
        text: 'Test chunk',
        chunkStrategy: 'semantic',
      });

      const result = await repository.findById(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.text).toBe('Test chunk');
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.findById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });
});
