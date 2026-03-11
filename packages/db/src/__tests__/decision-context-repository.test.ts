/**
 * Repository tests for DrizzleDecisionContextRepository
 * Tests against real test database
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DrizzleDecisionContextRepository } from "@repo/db";
import { DrizzleMeetingRepository } from "@repo/db";
import { DrizzleFlaggedDecisionRepository } from "@repo/db";
import { db } from "@repo/db";
import { decisionContexts } from "@repo/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// Type definition to avoid circular dependency
interface CreateDecisionContext {
  meetingId: string;
  flaggedDecisionId: string;
  title: string;
  templateId: string;
  activeField?: string;
  draftData?: Record<string, any>;
}

// Use test database
process.env.DATABASE_URL =
  "postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test";

describe("DrizzleDecisionContextRepository", () => {
  let repository: DrizzleDecisionContextRepository;
  let meetingRepo: DrizzleMeetingRepository;
  let flaggedDecisionRepo: DrizzleFlaggedDecisionRepository;
  let testMeetingId: string;
  let testFlaggedDecisionId: string;
  let testTemplateId: string;

  beforeEach(async () => {
    repository = new DrizzleDecisionContextRepository();
    meetingRepo = new DrizzleMeetingRepository();
    flaggedDecisionRepo = new DrizzleFlaggedDecisionRepository();

    // Create test meeting
    testMeetingId = randomUUID();
    const meeting = await meetingRepo.create({
      title: "Test Meeting",
      date: "2026-02-28",
      participants: ["Alice", "Bob"],
    });
    testMeetingId = meeting.id;

    // Create test flagged decision
    testFlaggedDecisionId = randomUUID();
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
    const templateName = `Test Template ${testTemplateId}`;
    await db.execute(sql`
      INSERT INTO decision_templates (id, name, category, description)
      VALUES (${testTemplateId}, ${templateName}, 'standard', 'A test template')
    `);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(decisionContexts).where(eq(decisionContexts.meetingId, testMeetingId));
  });

  describe("create", () => {
    it("should create a decision context with default values", async () => {
      const data: CreateDecisionContext = {
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Decision Context",
        templateId: testTemplateId,
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.meetingId).toBe(testMeetingId);
      expect(result.flaggedDecisionId).toBe(testFlaggedDecisionId);
      expect(result.title).toBe("Test Decision Context");
      expect(result.templateId).toBe(testTemplateId);
      expect(result.status).toBe("drafting");
      expect(result.lockedFields).toEqual([]);
      expect(result.activeField).toBeNull();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it("should persist in database", async () => {
      const data: CreateDecisionContext = {
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      };

      const created = await repository.create(data);
      const found = await repository.findById(created.id);

      expect(found).toEqual(created);
    });
  });

  describe("findById", () => {
    it("should return a context when it exists", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const found = await repository.findById(created.id);

      expect(found).toEqual(created);
    });

    it("should return null when context does not exist", async () => {
      const found = await repository.findById("00000000-0000-0000-0000-000000000000");
      expect(found).toBeNull();
    });
  });

  describe("findByMeetingId", () => {
    it("should return all contexts for a meeting", async () => {
      const meeting1 = await meetingRepo.create({
        title: "Meeting 1",
        date: "2026-02-28",
        participants: ["Alice"],
      });

      const flaggedDecision1 = await flaggedDecisionRepo.create({
        meetingId: meeting1.id,
        suggestedTitle: "Decision 1",
        contextSummary: "Context 1",
        confidence: 0.8,
        chunkIds: [randomUUID()],
        priority: 0,
      });

      await repository.create({
        meetingId: meeting1.id,
        flaggedDecisionId: flaggedDecision1.id,
        title: "Context 1",
        templateId: testTemplateId,
      });

      const flaggedDecision2 = await flaggedDecisionRepo.create({
        meetingId: meeting1.id,
        suggestedTitle: "Decision 2",
        contextSummary: "Context 2",
        confidence: 0.8,
        chunkIds: [randomUUID()],
        priority: 0,
      });

      await repository.create({
        meetingId: meeting1.id,
        flaggedDecisionId: flaggedDecision2.id,
        title: "Context 2",
        templateId: testTemplateId,
      });

      await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Context 3",
        templateId: testTemplateId,
      });

      const results = await repository.findByMeetingId(meeting1.id);

      expect(results).toHaveLength(2);
      expect(results[0]!.title).toBe("Context 1");
      expect(results[1]!.title).toBe("Context 2");
    });

    it("should return empty array for meeting with no contexts", async () => {
      const results = await repository.findByMeetingId(randomUUID());
      expect(results).toEqual([]);
    });
  });

  describe("findByFlaggedDecisionId", () => {
    it("should return context for a flagged decision", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const found = await repository.findByFlaggedDecisionId(testFlaggedDecisionId);

      expect(found).toEqual(created);
    });

    it("should return null when no context exists for flagged decision", async () => {
      const found = await repository.findByFlaggedDecisionId(randomUUID());
      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("should update context fields", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Original Title",
        templateId: testTemplateId,
      });

      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure timestamp difference

      const updated = await repository.update(created.id, {
        title: "Updated Title",
        draftData: { field1: "updated" },
      });

      expect(updated).toBeDefined();
      expect(updated!.id).toBe(created.id);
      expect(updated!.title).toBe("Updated Title");
      expect(updated!.draftData).toEqual({ field1: "updated" });
      expect(updated!.updatedAt).not.toBe(created.updatedAt);
    });

    it("should return null when updating non-existent context", async () => {
      const result = await repository.update("00000000-0000-0000-0000-000000000000", {
        title: "New Title",
      });
      expect(result).toBeNull();
    });
  });

  describe("lockField", () => {
    it("should lock a field in the context", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const fieldId = randomUUID();
      const updated = await repository.lockField(created.id, fieldId);

      expect(updated).toBeDefined();
      expect(updated!.lockedFields).toContain(fieldId);

      // Re-query to verify it was actually written to the database
      const persisted = await repository.findById(created.id);
      expect(persisted).toBeDefined();
      expect(persisted!.lockedFields).toContain(fieldId);
    });

    it("should not duplicate locked fields", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const fieldId = randomUUID();
      await repository.lockField(created.id, fieldId);
      await repository.lockField(created.id, fieldId);

      const updated = await repository.findById(created.id);
      expect(updated!.lockedFields).toEqual([fieldId]);
    });
  });

  describe("unlockField", () => {
    it("should unlock a field in the context", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const fieldId = randomUUID();
      await repository.lockField(created.id, fieldId);
      const updated = await repository.unlockField(created.id, fieldId);

      expect(updated).toBeDefined();
      expect(updated!.lockedFields).not.toContain(fieldId);

      // Re-query to verify it was actually written to the database
      const persisted = await repository.findById(created.id);
      expect(persisted).toBeDefined();
      expect(persisted!.lockedFields).not.toContain(fieldId);
    });

    it("should handle unlocking non-locked field gracefully", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const fieldId = randomUUID();
      const updated = await repository.unlockField(created.id, fieldId);

      expect(updated).toBeDefined();
      expect(updated!.lockedFields).toEqual([]);

      // Re-query to verify it was actually written to the database
      const persisted = await repository.findById(created.id);
      expect(persisted).toBeDefined();
      expect(persisted!.lockedFields).toEqual([]);
    });
  });

  describe("setActiveField", () => {
    it("should set the active field", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const fieldId = randomUUID();
      const fieldName = `Test Field ${fieldId}`;
      await db.execute(sql`
        INSERT INTO decision_fields (id, namespace, name, category, description, extraction_prompt, field_type)
        VALUES (${fieldId}, 'test', ${fieldName}, 'context', 'A test field', 'Extract this field', 'text')
      `);

      const updated = await repository.setActiveField(created.id, fieldId);

      expect(updated).toBeDefined();
      expect(updated!.activeField).toBe(fieldId);

      const persisted = await repository.findById(created.id);
      expect(persisted).toBeDefined();
      expect(persisted!.activeField).toBe(fieldId);
    });

    it("should clear the active field when set to null", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      // Create a decision field
      const fieldId = randomUUID();
      const fieldName = `Test Field ${fieldId}`;
      await db.execute(sql`
        INSERT INTO decision_fields (id, namespace, name, category, description, extraction_prompt, field_type)
        VALUES (${fieldId}, 'test', ${fieldName}, 'context', 'A test field', 'Extract this field', 'text')
      `);

      await repository.setActiveField(created.id, fieldId);
      const updated = await repository.setActiveField(created.id, null);

      expect(updated).toBeDefined();
      expect(updated!.activeField).toBeNull();

      // Re-query to verify it was actually written to the database
      const persisted = await repository.findById(created.id);
      expect(persisted).toBeDefined();
      expect(persisted!.activeField).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("should update the context status", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const updated = await repository.updateStatus(created.id, "reviewing");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("reviewing");

      // Re-query to verify it was actually written to the database
      const persisted = await repository.findById(created.id);
      expect(persisted).toBeDefined();
      expect(persisted!.status).toBe("reviewing");
    });
  });
});
