/**
 * Unit tests for DrizzleDecisionContextWindowRepository
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleDecisionContextWindowRepository } from '../../src/repositories/decision-context-window-repository';
import { DrizzleTranscriptChunkRepository } from '../../src/repositories/transcript-chunk-repository';
import { DrizzleRawTranscriptRepository } from '../../src/repositories/raw-transcript-repository';
import { db } from '../../src/client';
import { decisionContextWindows } from '../../src/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('DrizzleDecisionContextWindowRepository', () => {
  let repository: DrizzleDecisionContextWindowRepository;
  let chunkRepo: DrizzleTranscriptChunkRepository;
  let rawTranscriptRepo: DrizzleRawTranscriptRepository;
  let testMeetingId: string;
  let testDecisionContextId: string;
  let testChunkIds: string[];

  beforeEach(async () => {
    repository = new DrizzleDecisionContextWindowRepository();
    chunkRepo = new DrizzleTranscriptChunkRepository();
    rawTranscriptRepo = new DrizzleRawTranscriptRepository();
    
    testMeetingId = randomUUID();
    testDecisionContextId = randomUUID();
    
    // Create test data
    const rawTranscript = await rawTranscriptRepo.create({
      meetingId: testMeetingId,
      source: 'upload',
      format: 'txt',
      content: 'Test transcript',
    });

    // Create multiple chunks
    const chunk1 = await chunkRepo.create({
      meetingId: testMeetingId,
      rawTranscriptId: rawTranscript.id,
      sequenceNumber: 1,
      text: 'First chunk',
      chunkStrategy: 'fixed',
      contexts: ['meeting:' + testMeetingId, 'decision:' + testDecisionContextId],
    });

    const chunk2 = await chunkRepo.create({
      meetingId: testMeetingId,
      rawTranscriptId: rawTranscript.id,
      sequenceNumber: 2,
      text: 'Second chunk',
      chunkStrategy: 'fixed',
      contexts: ['meeting:' + testMeetingId, 'decision:' + testDecisionContextId],
    });

    testChunkIds = [chunk1.id, chunk2.id];
    
    // Clean up any existing test data
    await db.delete(decisionContextWindows).where(eq(decisionContextWindows.decisionContextId, testDecisionContextId));
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(decisionContextWindows).where(eq(decisionContextWindows.decisionContextId, testDecisionContextId));
  });

  describe('createOrUpdate', () => {
    it('should create a new context window', async () => {
      const data = {
        decisionContextId: testDecisionContextId,
        chunkIds: testChunkIds,
        selectionStrategy: 'relevant' as const,
        totalTokens: 100,
        totalChunks: 2,
        relevanceScores: { [testChunkIds[0]!]: 0.8, [testChunkIds[1]!]: 0.6 },
        usedFor: 'draft' as const,
      };

      const result = await repository.createOrUpdate(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.decisionContextId).toBe(testDecisionContextId);
      expect(result.chunkIds).toEqual(testChunkIds);
      expect(result.selectionStrategy).toBe('relevant');
      expect(result.totalTokens).toBe(100);
      expect(result.totalChunks).toBe(2);
      expect(result.relevanceScores).toEqual({ [testChunkIds[0]!]: 0.8, [testChunkIds[1]!]: 0.6 });
      expect(result.usedFor).toBe('draft');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should update existing context window', async () => {
      // Create initial window
      const initialData = {
        decisionContextId: testDecisionContextId,
        chunkIds: [testChunkIds[0]],
        selectionStrategy: 'recent' as const,
        totalTokens: 50,
        totalChunks: 1,
        usedFor: 'draft' as const,
      };
      await repository.createOrUpdate(initialData);

      // Update with new data
      const updateData = {
        decisionContextId: testDecisionContextId,
        chunkIds: testChunkIds,
        selectionStrategy: 'weighted' as const,
        totalTokens: 150,
        totalChunks: 2,
        relevanceScores: { [testChunkIds[0]!]: 0.7, [testChunkIds[1]!]: 0.9 },
        usedFor: 'regenerate' as const,
      };

      const result = await repository.createOrUpdate(updateData);

      expect(result.chunkIds).toEqual(testChunkIds);
      expect(result.selectionStrategy).toBe('weighted');
      expect(result.totalTokens).toBe(150);
      expect(result.totalChunks).toBe(2);
      expect(result.usedFor).toBe('regenerate');
      expect(result.relevanceScores).toEqual({ [testChunkIds[0]!]: 0.7, [testChunkIds[1]!]: 0.9 });
    });

    it('should create separate windows for different usedFor values', async () => {
      const draftData = {
        decisionContextId: testDecisionContextId,
        chunkIds: testChunkIds,
        selectionStrategy: 'relevant' as const,
        totalTokens: 100,
        totalChunks: 2,
        usedFor: 'draft' as const,
      };

      const regenerateData = {
        decisionContextId: testDecisionContextId,
        chunkIds: [testChunkIds[0]],
        selectionStrategy: 'recent' as const,
        totalTokens: 50,
        totalChunks: 1,
        usedFor: 'regenerate' as const,
      };

      await repository.createOrUpdate(draftData);
      await repository.createOrUpdate(regenerateData);

      const windows = await repository.findByDecisionContextId(testDecisionContextId);
      expect(windows).toHaveLength(2);
      expect(windows.find(w => w.usedFor === 'draft')).toBeDefined();
      expect(windows.find(w => w.usedFor === 'regenerate')).toBeDefined();
    });
  });

  describe('findByDecisionContextId', () => {
    it('should return windows ordered by updatedAt', async () => {
      // Create windows with different timestamps
      await repository.createOrUpdate({
        decisionContextId: testDecisionContextId,
        chunkIds: [testChunkIds[0]],
        selectionStrategy: 'recent',
        totalTokens: 50,
        totalChunks: 1,
        usedFor: 'draft',
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await repository.createOrUpdate({
        decisionContextId: testDecisionContextId,
        chunkIds: testChunkIds,
        selectionStrategy: 'relevant',
        totalTokens: 100,
        totalChunks: 2,
        usedFor: 'regenerate',
      });

      const results = await repository.findByDecisionContextId(testDecisionContextId);

      expect(results).toHaveLength(2);
      expect(results[0]!.usedFor).toBe('regenerate'); // Most recently updated
      expect(results[1]!.usedFor).toBe('draft');
    });

    it('should return empty array for non-existent context', async () => {
      const results = await repository.findByDecisionContextId('non-existent');
      expect(results).toEqual([]);
    });
  });

  describe('preview', () => {
    it('should return preview of chunks for context', async () => {
      const result = await repository.preview(testDecisionContextId, 'relevant', 10);

      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0]!.text).toBe('First chunk');
      expect(result.chunks[1]!.text).toBe('Second chunk');
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.estimatedRelevance).toBeDefined();
      expect(result.estimatedRelevance[testChunkIds[0]!]).toBe(0.8);
      expect(result.estimatedRelevance[testChunkIds[1]!]).toBe(0.8);
    });

    it('should limit results by limit parameter', async () => {
      const result = await repository.preview(testDecisionContextId, 'relevant', 1);

      expect(result.chunks).toHaveLength(1);
    });

    it('should return empty preview for non-existent context', async () => {
      const result = await repository.preview('non-existent', 'relevant', 10);

      expect(result.chunks).toEqual([]);
      expect(result.totalTokens).toBe(0);
      expect(result.estimatedRelevance).toEqual({});
    });
  });
});
