/**
 * Integration tests for DecisionContextService
 * Tests against real database
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DecisionContextService } from "@repo/core";
import { DrizzleDecisionContextRepository } from "@repo/db";
import { DrizzleMeetingRepository } from "@repo/db";
import { DrizzleFlaggedDecisionRepository } from "@repo/db";
import { db } from "@repo/db";
import { decisionContexts, decisionFields } from "@repo/db";
import { eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// Use test database
process.env.DATABASE_URL =
  "postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test";

const testTemplateNamePrefix = "Test Template ";

describe("DecisionContextService Integration", () => {
  let service: DecisionContextService;
  let meetingRepo: DrizzleMeetingRepository;
  let flaggedDecisionRepo: DrizzleFlaggedDecisionRepository;
  let testMeetingId: string;
  let testFlaggedDecisionId: string;
  let testTemplateId: string;
  let testFieldIds: string[];

  beforeEach(async () => {
    const repository = new DrizzleDecisionContextRepository();
    service = new DecisionContextService(repository);
    meetingRepo = new DrizzleMeetingRepository();
    flaggedDecisionRepo = new DrizzleFlaggedDecisionRepository();

    // Create test meeting
    const meeting = await meetingRepo.create({
      title: "Test Meeting",
      date: "2026-02-28",
      participants: ["Alice", "Bob"],
    });
    testMeetingId = meeting.id;

    // Create test flagged decision
    const flaggedDecision = await flaggedDecisionRepo.create({
      meetingId: testMeetingId,
      suggestedTitle: "Test Decision",
      contextSummary: "Test context",
      confidence: 0.8,
      chunkIds: [randomUUID()],
      priority: 0,
    });
    testFlaggedDecisionId = flaggedDecision.id;

    // Create test template
    testTemplateId = randomUUID();
    testFieldIds = [];
    const templateName = `${testTemplateNamePrefix}${testTemplateId}`;
    await db.execute(sql`
      INSERT INTO decision_templates (id, name, category, description)
      VALUES (${testTemplateId}, ${templateName}, 'standard', 'A test template')
    `);
  });

  afterEach(async () => {
    // Clean up test data
    await db.execute(sql`
      DELETE FROM decision_contexts
      WHERE meeting_id IN (
        SELECT id FROM meetings WHERE title = 'Test Meeting'
      )
    `);
    await db.delete(decisionContexts).where(eq(decisionContexts.templateId, testTemplateId));
    if (testFieldIds.length > 0) {
      await db.delete(decisionFields).where(inArray(decisionFields.id, testFieldIds));
    }
    await db.execute(sql`
      DELETE FROM flagged_decisions
      WHERE meeting_id IN (
        SELECT id FROM meetings WHERE title = 'Test Meeting'
      )
    `);
    await db.execute(sql`
      DELETE FROM meetings WHERE title = 'Test Meeting'
    `);
    await db.execute(sql`
      DELETE FROM decision_templates WHERE name LIKE ${`${testTemplateNamePrefix}%`}
    `);
  });

  describe("createContext", () => {
    it("should create a context in the database", async () => {
      const data = {
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Decision Context",
        templateId: testTemplateId,
      };

      const result = await service.createContext(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe("drafting");

      // Verify it's in the database
      const found = await db
        .select()
        .from(decisionContexts)
        .where(eq(decisionContexts.id, result.id))
        .limit(1);
      expect(found).toHaveLength(1);
      expect(found[0]!.title).toBe("Test Decision Context");
    });

    it("should create context with initial draft data", async () => {
      const data = {
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
        draftData: { field1: "value1", field2: "value2" },
      };

      const result = await service.createContext(data);

      expect(result.draftData).toEqual({ field1: "value1", field2: "value2" });
    });
  });

  describe("updateDraftData", () => {
    it("should update draft data in the database", async () => {
      const fieldId = randomUUID();
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
        draftData: { [fieldId]: "original" },
      });

      const result = await service.updateDraftData(context.id, { [fieldId]: "updated" });

      expect(result).toBeDefined();
      expect(result!.draftData).toEqual({ [fieldId]: "updated" });

      // Verify in database
      const found = await db
        .select()
        .from(decisionContexts)
        .where(eq(decisionContexts.id, context.id))
        .limit(1);
      expect(found[0]!.draftData).toEqual({ [fieldId]: "updated" });
    });

    it("should not update locked fields", async () => {
      const lockedFieldId = randomUUID();
      const unlockedFieldId = randomUUID();
      testFieldIds.push(lockedFieldId, unlockedFieldId);
      await db.execute(sql`
        INSERT INTO decision_fields (id, namespace, name, category, description, extraction_prompt, field_type)
        VALUES
          (${lockedFieldId}, 'test', ${`Locked Field ${lockedFieldId}`}, 'context', 'A locked test field', 'Extract this field', 'text'),
          (${unlockedFieldId}, 'test', ${`Unlocked Field ${unlockedFieldId}`}, 'context', 'An unlocked test field', 'Extract this field', 'text')
      `);
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
        draftData: { [lockedFieldId]: "original", [unlockedFieldId]: "value2" },
      });

      await service.lockField(context.id, lockedFieldId);
      const result = await service.updateDraftData(context.id, {
        [lockedFieldId]: "updated",
        [unlockedFieldId]: "new value",
      });

      expect(result).toBeDefined();
      expect(result!.draftData).toEqual({
        [lockedFieldId]: "original",
        [unlockedFieldId]: "new value",
      });
    });
  });

  describe("field locking", () => {
    it("should lock and unlock fields", async () => {
      const fieldId = randomUUID();
      testFieldIds.push(fieldId);
      await db.execute(sql`
        INSERT INTO decision_fields (id, namespace, name, category, description, extraction_prompt, field_type)
        VALUES (${fieldId}, 'test', ${`Test Field ${fieldId}`}, 'context', 'A test field', 'Extract this field', 'text')
      `);
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      // Lock field
      const locked = await service.lockField(context.id, fieldId);
      expect(locked!.lockedFields).toContain(fieldId);

      // Unlock field
      const unlocked = await service.unlockField(context.id, fieldId);
      expect(unlocked!.lockedFields).not.toContain(fieldId);
    });

    it("should set active field", async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      // Create a decision field
      const fieldId = randomUUID();
      testFieldIds.push(fieldId);
      const fieldName = `Test Field ${fieldId}`;
      await db.execute(sql`
        INSERT INTO decision_fields (id, namespace, name, category, description, extraction_prompt, field_type)
        VALUES (${fieldId}, 'test', ${fieldName}, 'context', 'A test field', 'Extract this field', 'text')
      `);

      const result = await service.setActiveField(context.id, fieldId);
      expect(result!.activeField).toBe(fieldId);

      const cleared = await service.setActiveField(context.id, null);
      expect(cleared!.activeField).toBeNull();
    });
  });

  describe("status transitions", () => {
    it("should transition through statuses", async () => {
      const field1Id = randomUUID();
      const field2Id = randomUUID();
      testFieldIds.push(field1Id, field2Id);
      await db.execute(sql`
        INSERT INTO decision_fields (id, namespace, name, category, description, extraction_prompt, field_type)
        VALUES
          (${field1Id}, 'test', ${`Status Field ${field1Id}`}, 'context', 'A status test field', 'Extract this field', 'text'),
          (${field2Id}, 'test', ${`Status Field ${field2Id}`}, 'context', 'Another status test field', 'Extract this field', 'text')
      `);
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
        draftData: { [field1Id]: "value1", [field2Id]: "value2" },
      });

      // Initial status
      expect(context.status).toBe("drafting");

      // Submit for review
      const reviewing = await service.submitForReview(context.id);
      expect(reviewing!.status).toBe("reviewing");

      // Approve and lock
      const locked = await service.approveAndLock(context.id);
      expect(locked!.status).toBe("locked");
      expect(locked!.lockedFields).toContain(field1Id);
      expect(locked!.lockedFields).toContain(field2Id);
    });

    it("should throw error for invalid transitions", async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      // Can't approve from drafting
      await expect(service.approveAndLock(context.id)).rejects.toThrow(
        "Can only approve contexts that are in reviewing status",
      );

      // Can't submit twice
      await service.submitForReview(context.id);
      await expect(service.submitForReview(context.id)).rejects.toThrow(
        "Can only submit contexts that are in drafting status",
      );
    });

    it("should reopen for editing", async () => {
      const context = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      await service.submitForReview(context.id);
      const reopened = await service.reopenForEditing(context.id);
      expect(reopened!.status).toBe("drafting");
    });
  });

  describe("queries", () => {
    it("should get context by flagged decision", async () => {
      const created = await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const found = await service.getContextByFlaggedDecision(testFlaggedDecisionId);
      expect(found).toEqual(created);
    });

    it("should get all contexts for meeting", async () => {
      await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Context 1",
        templateId: testTemplateId,
      });

      // Create another flagged decision and context
      const flaggedDecision2 = await flaggedDecisionRepo.create({
        meetingId: testMeetingId,
        suggestedTitle: "Decision 2",
        contextSummary: "Context 2",
        confidence: 0.8,
        chunkIds: [randomUUID()],
        priority: 0,
      });

      await service.createContext({
        meetingId: testMeetingId,
        flaggedDecisionId: flaggedDecision2.id,
        title: "Context 2",
        templateId: testTemplateId,
      });

      const contexts = await service.getAllContextsForMeeting(testMeetingId);
      expect(contexts).toHaveLength(2);
    });
  });
});
