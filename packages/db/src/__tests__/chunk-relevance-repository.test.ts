/**
 * Unit tests for DrizzleChunkRelevanceRepository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleChunkRelevanceRepository } from '../../src/repositories/chunk-relevance-repository';
import { DrizzleTranscriptChunkRepository } from '../../src/repositories/transcript-chunk-repository';
import { DrizzleRawTranscriptRepository } from '../../src/repositories/raw-transcript-repository';
import { DrizzleMeetingRepository } from '../../src/repositories/meeting-repository';
import { db } from '../../src/client';
import { chunkRelevance, transcriptChunks, rawTranscripts, meetings } from '../../src/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('DrizzleChunkRelevanceRepository', () => {
  let repository: DrizzleChunkRelevanceRepository;
  let chunkRepo: DrizzleTranscriptChunkRepository;
  let rawTranscriptRepo: DrizzleRawTranscriptRepository;
  let meetingRepo: DrizzleMeetingRepository;
  let testMeetingId: string;
  let testChunkId: string;
  let testDecisionContextId: string;
  let testFieldId: string;

  beforeEach(async () => {
    repository = new DrizzleChunkRelevanceRepository();
    chunkRepo = new DrizzleTranscriptChunkRepository();
    rawTranscriptRepo = new DrizzleRawTranscriptRepository();
    meetingRepo = new DrizzleMeetingRepository();
    
    const meeting = await meetingRepo.create({
      title: `Chunk Relevance ${randomUUID()}`,
      date: new Date().toISOString(),
      participants: ['Test User'],
    });
    testMeetingId = meeting.id;
    testChunkId = randomUUID();
    testDecisionContextId = randomUUID();
    testFieldId = randomUUID();
    
    // Create test data
    const rawTranscript = await rawTranscriptRepo.create({
      meetingId: testMeetingId,
      source: 'upload',
      format: 'txt',
      content: 'Test transcript',
    });

    const chunk = await chunkRepo.create({
      meetingId: testMeetingId,
      rawTranscriptId: rawTranscript.id,
      sequenceNumber: 1,
      text: 'Test chunk',
      chunkStrategy: 'fixed',
    });
    testChunkId = chunk.id;
    
    // Clean up any existing test data
    await db.delete(chunkRelevance).where(eq(chunkRelevance.chunkId, testChunkId));
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(chunkRelevance).where(eq(chunkRelevance.chunkId, testChunkId));
    await db.delete(transcriptChunks).where(eq(transcriptChunks.meetingId, testMeetingId));
    await db.delete(rawTranscripts).where(eq(rawTranscripts.meetingId, testMeetingId));
    await db.delete(meetings).where(eq(meetings.id, testMeetingId));
  });

  describe('upsert', () => {
    it('should create a new relevance record', async () => {
      const data = {
        chunkId: testChunkId,
        decisionContextId: testDecisionContextId,
        fieldId: testFieldId,
        relevance: 0.85,
        taggedBy: 'llm' as const,
      };

      const result = await repository.upsert(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.chunkId).toBe(testChunkId);
      expect(result.decisionContextId).toBe(testDecisionContextId);
      expect(result.fieldId).toBe(testFieldId);
      expect(result.relevance).toBe(0.85);
      expect(result.taggedBy).toBe('llm');
      expect(result.taggedAt).toBeDefined();
    });

    it('should update existing relevance record', async () => {
      // Create initial record
      const initialData = {
        chunkId: testChunkId,
        decisionContextId: testDecisionContextId,
        fieldId: testFieldId,
        relevance: 0.5,
        taggedBy: 'rule' as const,
      };
      await repository.upsert(initialData);

      // Update with new relevance
      const updateData = {
        chunkId: testChunkId,
        decisionContextId: testDecisionContextId,
        fieldId: testFieldId,
        relevance: 0.9,
        taggedBy: 'manual' as const,
      };

      const result = await repository.upsert(updateData);

      expect(result.relevance).toBe(0.9);
      expect(result.taggedBy).toBe('rule'); // Should not update taggedBy
      expect(result.id).toBeDefined();
    });
  });

  describe('findByDecisionField', () => {
    it('should return relevance records for decision field', async () => {
      // Create multiple relevance records
      await repository.upsert({
        chunkId: testChunkId,
        decisionContextId: testDecisionContextId,
        fieldId: testFieldId,
        relevance: 0.8,
        taggedBy: 'llm',
      });

      await repository.upsert({
        chunkId: testChunkId,
        decisionContextId: testDecisionContextId,
        fieldId: '11111111-1111-1111-1111-111111111111',
        relevance: 0.6,
        taggedBy: 'llm',
      });

      const results = await repository.findByDecisionField(testDecisionContextId, testFieldId);

      expect(results).toHaveLength(1);
      expect(results[0]!.fieldId).toBe(testFieldId);
      expect(results[0]!.relevance).toBe(0.8);
    });

    it('should return empty array for non-existent field', async () => {
      const results = await repository.findByDecisionField('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
      expect(results).toEqual([]);
    });
  });

  describe('deleteByChunk', () => {
    it('should delete all relevance records for a chunk', async () => {
      // Create multiple relevance records for the chunk
      await repository.upsert({
        chunkId: testChunkId,
        decisionContextId: testDecisionContextId,
        fieldId: testFieldId,
        relevance: 0.8,
        taggedBy: 'llm',
      });

      await repository.upsert({
        chunkId: testChunkId,
        decisionContextId: '22222222-2222-2222-2222-222222222222',
        fieldId: '11111111-1111-1111-1111-111111111111',
        relevance: 0.6,
        taggedBy: 'llm',
      });

      await repository.deleteByChunk(testChunkId);

      const results = await repository.findByDecisionField(testDecisionContextId, testFieldId);
      expect(results).toEqual([]);
    });
  });

  describe('findByChunk', () => {
    it('should return all relevance records for a chunk', async () => {
      // Create multiple relevance records for the chunk
      await repository.upsert({
        chunkId: testChunkId,
        decisionContextId: testDecisionContextId,
        fieldId: testFieldId,
        relevance: 0.8,
        taggedBy: 'llm',
      });

      await repository.upsert({
        chunkId: testChunkId,
        decisionContextId: '33333333-3333-3333-3333-333333333333',
        fieldId: '44444444-4444-4444-4444-444444444444',
        relevance: 0.9,
        taggedBy: 'manual',
      });

      const results = await repository.findByChunk(testChunkId);

      expect(results).toHaveLength(2);
      expect(results[0]!.relevance).toBe(0.8); // Ordered by relevance
      expect(results[1]!.relevance).toBe(0.9);
    });

    it('should return empty array for non-existent chunk', async () => {
      const results = await repository.findByChunk('00000000-0000-0000-0000-000000000000');
      expect(results).toEqual([]);
    });
  });
});
