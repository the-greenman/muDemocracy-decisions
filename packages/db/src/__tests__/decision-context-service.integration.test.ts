/**
 * Integration tests for DecisionContextService
 * Tests against real database
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DecisionContextService } from '@repo/core';
import { DrizzleDecisionContextRepository } from '@repo/db';
import { DrizzleMeetingRepository } from '@repo/db';
import { DrizzleFlaggedDecisionRepository } from '@repo/db';
import { db } from '@repo/db';
import { decisionContexts } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Use test database
process.env.DATABASE_URL = 'postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test';

describe('DecisionContextService Integration', () => {
  let service: DecisionContextService;
  let meetingRepo: DrizzleMeetingRepository;
  let flaggedDecisionRepo: DrizzleFlaggedDecisionRepository;
  let testMeetingId: string;
  let testFlaggedDecisionId: string;
  let testTemplateId: string;

  beforeEach(async () => {
    const repository = new DrizzleDecisionContextRepository();
    service = new DecisionContextService(repository);
    meetingRepo = new DrizzleMeetingRepository();
    flaggedDecisionRepo = new DrizzleFlaggedDecisionRepository();
    
    // Create test meeting
    const meeting = await meetingRepo.create({
      title: 'Test Meeting',
      date: '2026-02-28',
      participants: ['Alice', 'Bob'],
    });
    testMeetingId = meeting.id;

    // Create test flagged decision
    const flaggedDecision = await flaggedDecisionRepo.create({
      meetingId: testMeetingId,
      suggestedTitle: 'Test Decision',
      contextSummary: 'Test context',
      confidence: 0.8,
      chunkIds: [randomUUID()],
      priority: 0,
    });
    testFlaggedDecisionId = flaggedDecision.id;

    // Create test template
    testTemplateId = randomUUID();
    await db.execute(sql`
      INSERT INTO decision_templates (id, name, category, description)
      VALUES (${testTemplateId}, 'Test Template', 'standard', 'A test template')
    `);
  });

  afterEach(async () => {
    // Clean up test data
    await db
      .delete(decisionContexts)
      .where(eq(decisionContexts.meetingId, testMeetingId));
  });

  describe('createContext', () => {
    it('should create a context in the database', async () => {
      const data = {
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Decision Context',
        templateId: testTemplateId,
      };

      const result = await service.createContext(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('drafting');
      
      // Verify it's in the database
      const found = await db.select().from(decisionContexts)
        .where(eq(decisionContexts.id, result.id))
        .limit(1);
      expect(found).toHaveLength(1);
      expect(found[0]!.title).toBe('Test Decision Context');
    });

    it('should create context with initial draft data', async () => {
      const data = {
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Context',
        templateId: testTemplateId,
        draftData: { field1: 'value1', field2: 'value2' },
      };

      const result = await service.createContext(data);

      expect(result.draftData).toEqual({ field1: 'value1', field2: 'value2' });
    });
  });

  describe('updateDraftData', () => {
    it('should update draft data in the database', async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Context',
        templateId: testTemplateId,
        draftData: { field1: 'original' },
      });

      const result = await service.updateDraftData(context.id, { field1: 'updated' });

      expect(result).toBeDefined();
      expect(result!.draftData).toEqual({ field1: 'updated' });
      
      // Verify in database
      const found = await db.select().from(decisionContexts)
        .where(eq(decisionContexts.id, context.id))
        .limit(1);
      expect(found[0]!.draftData).toEqual({ field1: 'updated' });
    });

    it('should not update locked fields', async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Context',
        templateId: testTemplateId,
        draftData: { field1: 'original', field2: 'value2' },
      });

      await service.lockField(context.id, 'field1');
      const result = await service.updateDraftData(context.id, { 
        field1: 'updated', 
        field2: 'new value' 
      });

      expect(result).toBeDefined();
      expect(result!.draftData).toEqual({ 
        field1: 'original', // Should not change
        field2: 'new value' // Should change
      });
    });
  });

  describe('field locking', () => {
    it('should lock and unlock fields', async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Context',
        templateId: testTemplateId,
      });

      // Lock field
      const locked = await service.lockField(context.id, 'field1');
      expect(locked!.lockedFields).toContain('field1');

      // Unlock field
      const unlocked = await service.unlockField(context.id, 'field1');
      expect(unlocked!.lockedFields).not.toContain('field1');
    });

    it('should set active field', async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Context',
        templateId: testTemplateId,
      });

      // Create a decision field
      const fieldId = randomUUID();
      await db.execute(sql`
        INSERT INTO decision_fields (id, name, category, description, extraction_prompt, field_type)
        VALUES (${fieldId}, 'Test Field', 'context', 'A test field', 'Extract this field', 'text')
      `);

      const result = await service.setActiveField(context.id, fieldId);
      expect(result!.activeField).toBe(fieldId);

      const cleared = await service.setActiveField(context.id, null);
      expect(cleared!.activeField).toBeNull();
    });
  });

  describe('status transitions', () => {
    it('should transition through statuses', async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Context',
        templateId: testTemplateId,
        draftData: { field1: 'value1', field2: 'value2' },
      });

      // Initial status
      expect(context.status).toBe('drafting');

      // Submit for review
      const reviewing = await service.submitForReview(context.id);
      expect(reviewing!.status).toBe('reviewing');

      // Approve and lock
      const locked = await service.approveAndLock(context.id);
      expect(locked!.status).toBe('locked');
      expect(locked!.lockedFields).toContain('field1');
      expect(locked!.lockedFields).toContain('field2');
    });

    it('should throw error for invalid transitions', async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Context',
        templateId: testTemplateId,
      });

      // Can't approve from drafting
      await expect(
        service.approveAndLock(context.id)
      ).rejects.toThrow('Can only approve contexts that are in reviewing status');

      // Can't submit twice
      await service.submitForReview(context.id);
      await expect(
        service.submitForReview(context.id)
      ).rejects.toThrow('Can only submit contexts that are in drafting status');
    });

    it('should reopen for editing', async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Context',
        templateId: testTemplateId,
      });

      await service.submitForReview(context.id);
      const reopened = await service.reopenForEditing(context.id);
      expect(reopened!.status).toBe('drafting');
    });
  });

  describe('queries', () => {
    it('should get context by flagged decision', async () => {
      const created = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Test Context',
        templateId: testTemplateId,
      });

      const found = await service.getContextByFlaggedDecision(testFlaggedDecisionId);
      expect(found).toEqual(created);
    });

    it('should get all contexts for meeting', async () => {
      await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: 'Context 1',
        templateId: testTemplateId,
      });

      // Create another flagged decision and context
      const flaggedDecision2 = await flaggedDecisionRepo.create({
        meetingId: testMeetingId,
        suggestedTitle: 'Decision 2',
        contextSummary: 'Context 2',
        confidence: 0.8,
        chunkIds: [randomUUID()],
        priority: 0,
      });

      await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: flaggedDecision2.id,
        title: 'Context 2',
        templateId: testTemplateId,
      });

      const contexts = await service.getAllContextsForMeeting(testMeetingId);
      expect(contexts).toHaveLength(2);
    });
  });
});
