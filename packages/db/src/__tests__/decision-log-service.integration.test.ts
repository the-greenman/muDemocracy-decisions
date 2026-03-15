/**
 * Integration tests for Decision Log Service
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { DecisionLogService } from "@repo/core";
import { DrizzleDecisionLogRepository } from "../repositories/decision-log-repository";
import { DrizzleDecisionContextRepository } from "../repositories/decision-context-repository";
import {
  DrizzleDecisionTemplateRepository,
  DrizzleTemplateFieldAssignmentRepository,
} from "../repositories/decision-template-repository";
import { DrizzleChunkRelevanceRepository } from "../repositories/chunk-relevance-repository";
import { db, client } from "../client";
import {
  decisionLogs,
  decisionContexts,
  meetings,
  flaggedDecisions,
  decisionTemplates,
  decisionFields,
  templateFieldAssignments,
} from "../schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

describe("Decision Log Service Integration Tests", () => {
  let decisionLogService: DecisionLogService;
  let decisionLogRepository: DrizzleDecisionLogRepository;
  let decisionContextRepository: DrizzleDecisionContextRepository;
  let testMeetingId: string;
  let testFlaggedDecisionId: string;
  let testDecisionContextId: string;
  let testTemplateId: string;
  let decisionFieldId: string;
  let reasonFieldId: string;
  let impactFieldId: string;

  const createLockedContext = async (title: string) => {
    const [decisionContext] = await db
      .insert(decisionContexts)
      .values({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title,
        templateId: testTemplateId,
        activeField: null,
        lockedFields: [decisionFieldId, reasonFieldId, impactFieldId],
        draftData: {
          [decisionFieldId]: "Approved",
          [reasonFieldId]: "Meets all criteria",
          [impactFieldId]: "Low",
        },
        status: "locked",
      })
      .returning();

    return decisionContext!;
  };

  beforeAll(async () => {
    // Initialize repositories and service
    decisionLogRepository = new DrizzleDecisionLogRepository();
    decisionContextRepository = new DrizzleDecisionContextRepository();
    decisionLogService = new DecisionLogService(
      decisionLogRepository,
      decisionContextRepository,
      new DrizzleDecisionTemplateRepository(),
      new DrizzleTemplateFieldAssignmentRepository(),
      new DrizzleChunkRelevanceRepository(),
    );

    // Create test template
    const [template] = await db
      .insert(decisionTemplates)
      .values({
        namespace: "test",
        name: `Test Decision Template ${randomUUID()}`,
        description: "Template for testing",
        category: "standard",
        version: 1,
        isDefault: false,
        isCustom: false,
      })
      .returning();
    testTemplateId = template!.id;

    // Create test meeting
    const [meeting] = await db
      .insert(meetings)
      .values({
        title: "Test Meeting for Decision Logs",
        date: new Date("2026-02-28T00:00:00.000Z"),
        participants: ["Alice", "Bob"],
        status: "in_session",
      })
      .returning();
    testMeetingId = meeting!.id;

    // Create test flagged decision
    const [flaggedDecision] = await db
      .insert(flaggedDecisions)
      .values({
        meetingId: testMeetingId,
        suggestedTitle: "Test Decision",
        contextSummary: "Test context",
        confidence: 0.9,
        chunkIds: [],
        suggestedTemplateId: null,
        templateConfidence: 0.8,
        status: "pending",
      })
      .returning();
    testFlaggedDecisionId = flaggedDecision!.id;

    const [decisionField, reasonField, impactField] = await db
      .insert(decisionFields)
      .values([
        {
          namespace: "test",
          name: `decision_${randomUUID()}`,
          description: "Decision field for testing",
          category: "outcome",
          fieldType: "text",
          extractionPrompt: "Extract the decision",
        },
        {
          namespace: "test",
          name: `reason_${randomUUID()}`,
          description: "Reason field for testing",
          category: "context",
          fieldType: "text",
          extractionPrompt: "Extract the reason",
        },
        {
          namespace: "test",
          name: `impact_${randomUUID()}`,
          description: "Impact field for testing",
          category: "evaluation",
          fieldType: "text",
          extractionPrompt: "Extract the impact",
        },
      ])
      .returning();

    decisionFieldId = decisionField!.id;
    reasonFieldId = reasonField!.id;
    impactFieldId = impactField!.id;

    await db.insert(templateFieldAssignments).values([
      { templateId: testTemplateId, fieldId: decisionFieldId, order: 0, required: true },
      { templateId: testTemplateId, fieldId: reasonFieldId, order: 1, required: true },
      { templateId: testTemplateId, fieldId: impactFieldId, order: 2, required: true },
    ]);

    // Create test decision context
    const [decisionContext] = await db
      .insert(decisionContexts)
      .values({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Decision Context",
        templateId: testTemplateId,
        activeField: null,
        lockedFields: [decisionFieldId, reasonFieldId, impactFieldId],
        draftData: {
          [decisionFieldId]: "Approved",
          [reasonFieldId]: "Meets all criteria",
          [impactFieldId]: "Low",
        },
        status: "locked",
      })
      .returning();
    testDecisionContextId = decisionContext!.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(decisionLogs).where(eq(decisionLogs.meetingId, testMeetingId));
    await db.delete(decisionContexts).where(eq(decisionContexts.meetingId, testMeetingId));
    await db
      .delete(templateFieldAssignments)
      .where(eq(templateFieldAssignments.templateId, testTemplateId));
    await db.delete(decisionFields).where(eq(decisionFields.id, decisionFieldId));
    await db.delete(decisionFields).where(eq(decisionFields.id, reasonFieldId));
    await db.delete(decisionFields).where(eq(decisionFields.id, impactFieldId));
    await db.delete(flaggedDecisions).where(eq(flaggedDecisions.meetingId, testMeetingId));
    await db.delete(meetings).where(eq(meetings.id, testMeetingId));
    await db.delete(decisionTemplates).where(eq(decisionTemplates.id, testTemplateId));
    await client.end();
  });

  beforeEach(async () => {
    // Clean up decision logs before each test
    await db.delete(decisionLogs).where(eq(decisionLogs.meetingId, testMeetingId));
    await db
      .update(decisionContexts)
      .set({ status: "locked" })
      .where(eq(decisionContexts.id, testDecisionContextId));
  });

  describe("logDecision", () => {
    it("should log a decision successfully", async () => {
      // First verify the context exists
      const context = await decisionContextRepository.findById(testDecisionContextId);
      expect(context).toBeDefined();
      expect(context!.meetingId).toBe(testMeetingId);

      const result = await decisionLogService.logDecision(testDecisionContextId, {
        loggedBy: "test-user",
        decisionMethod: { type: "manual" },
      });

      expect(result).toBeDefined();
      expect(result!.meetingId).toBe(testMeetingId);
      expect(result!.decisionContextId).toBe(testDecisionContextId);
      expect(result!.decisionMethod).toEqual({ type: "manual" });
      expect(result!.loggedBy).toBe("test-user");
      expect(result!.fields).toEqual({
        [decisionFieldId]: "Approved",
        [reasonFieldId]: "Meets all criteria",
        [impactFieldId]: "Low",
      });

      // Verify it's in the database
      const [found] = await db
        .select()
        .from(decisionLogs)
        .where(eq(decisionLogs.id, result!.id))
        .limit(1);

      expect(found!).toBeDefined();
      expect(found!.decisionMethod).toEqual({ type: "manual" });
      expect(found!.loggedBy).toBe("test-user");
    });

    it("should not log decision from unlocked context", async () => {
      // Create an unlocked context
      const [unlockedContext] = await db
        .insert(decisionContexts)
        .values({
          meetingId: testMeetingId,
          flaggedDecisionId: testFlaggedDecisionId,
          title: "Unlocked Context",
          templateId: testTemplateId,
          activeField: null,
          lockedFields: [],
          draftData: { [decisionFieldId]: "Pending" },
          status: "drafting",
        })
        .returning();

      await expect(
        decisionLogService.logDecision(unlockedContext!.id, {
          loggedBy: "test-user",
          decisionMethod: { type: "manual" },
        }),
      ).rejects.toThrow("Decision context must be locked before logging");

      // Clean up
      await db.delete(decisionContexts).where(eq(decisionContexts.id, unlockedContext!.id));
    });

    it("should return null for non-existent context", async () => {
      const result = await decisionLogService.logDecision("00000000-0000-0000-0000-000000000000", {
        loggedBy: "test-user",
        decisionMethod: { type: "manual" },
      });

      expect(result).toBeNull();
    });
  });

  describe("getDecisionLog", () => {
    it("should retrieve a decision log", async () => {
      // First create a decision log
      const created = await decisionLogService.logDecision(testDecisionContextId, {
        loggedBy: "test-user",
        decisionMethod: { type: "ai_assisted" },
      });

      const retrieved = await decisionLogService.getDecisionLog(created!.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created!.id);
      expect(retrieved!.decisionMethod).toEqual({ type: "ai_assisted" });
    });

    it("should return null for non-existent log", async () => {
      const result = await decisionLogService.getDecisionLog(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(result).toBeNull();
    });
  });

  describe("getMeetingDecisionLogs", () => {
    it("should retrieve all decision logs for a meeting", async () => {
      // Create multiple decision logs
      await decisionLogService.logDecision(testDecisionContextId, {
        loggedBy: "user-1",
        decisionMethod: { type: "manual" },
      });

      const secondContext = await createLockedContext("Test Decision Context 2");

      await decisionLogService.logDecision(secondContext.id, {
        loggedBy: "user-2",
        decisionMethod: { type: "consensus" },
      });

      const logs = await decisionLogService.getMeetingDecisionLogs(testMeetingId);

      expect(logs).toHaveLength(2);
      expect(logs[0]!.loggedBy).toBe("user-2"); // Should be ordered by loggedAt desc
      expect(logs[1]!.loggedBy).toBe("user-1");
    });
  });

  describe("getDecisionContextLogs", () => {
    it("should retrieve all logs for a decision context", async () => {
      // Create a decision log
      await decisionLogService.logDecision(testDecisionContextId, {
        loggedBy: "test-user",
        decisionMethod: { type: "manual" },
      });

      const logs = await decisionLogService.getDecisionContextLogs(testDecisionContextId);

      expect(logs).toHaveLength(1);
      expect(logs[0]!.decisionContextId).toBe(testDecisionContextId);
    });
  });

  describe("getUserDecisionLogs", () => {
    it("should retrieve all logs by a specific user", async () => {
      const user1Id = `user-1-${randomUUID()}`;
      const user2Id = `user-2-${randomUUID()}`;

      // Create logs by different users
      await decisionLogService.logDecision(testDecisionContextId, {
        loggedBy: user1Id,
        decisionMethod: { type: "manual" },
      });

      const secondContext = await createLockedContext("User Log Context 2");

      await decisionLogService.logDecision(secondContext.id, {
        loggedBy: user2Id,
        decisionMethod: { type: "manual" },
      });

      const thirdContext = await createLockedContext("User Log Context 3");

      await decisionLogService.logDecision(thirdContext.id, {
        loggedBy: user1Id,
        decisionMethod: { type: "ai_assisted" },
      });

      const user1Logs = await decisionLogService.getUserDecisionLogs(user1Id);
      const user2Logs = await decisionLogService.getUserDecisionLogs(user2Id);

      expect(user1Logs).toHaveLength(2);
      expect(user1Logs.every((log) => log!.loggedBy === user1Id)).toBe(true);
      expect(user2Logs).toHaveLength(1);
      expect(user2Logs[0]!.loggedBy).toBe(user2Id);
    });
  });

  describe("getDecisionLogsByDateRange", () => {
    it("should retrieve logs within date range", async () => {
      // Create a decision log
      const created = await decisionLogService.logDecision(testDecisionContextId, {
        loggedBy: "test-user",
        decisionMethod: { type: "manual" },
      });

      // Search for logs around the creation time
      const loggedAt = new Date(created!.loggedAt);
      const startDate = new Date(loggedAt.getTime() - 60000); // 1 minute before
      const endDate = new Date(loggedAt.getTime() + 60000); // 1 minute after

      const logs = await decisionLogService.getDecisionLogsByDateRange(startDate, endDate);

      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.some((log) => log.id === created!.id)).toBe(true);
    });
  });

  describe("getMeetingDecisionStats", () => {
    it("should generate correct statistics", async () => {
      // Create multiple decisions with different methods and users
      await decisionLogService.logDecision(testDecisionContextId, {
        loggedBy: "user-1",
        decisionMethod: { type: "manual" },
      });

      const secondContext = await createLockedContext("Stats Context 2");

      await decisionLogService.logDecision(secondContext.id, {
        loggedBy: "user-2",
        decisionMethod: { type: "manual" },
      });

      const thirdContext = await createLockedContext("Stats Context 3");

      await decisionLogService.logDecision(thirdContext.id, {
        loggedBy: "user-1",
        decisionMethod: { type: "ai_assisted" },
      });

      const fourthContext = await createLockedContext("Stats Context 4");

      await decisionLogService.logDecision(fourthContext.id, {
        loggedBy: "user-3",
        decisionMethod: { type: "consensus" },
      });

      const stats = await decisionLogService.getMeetingDecisionStats(testMeetingId);

      expect(stats.totalDecisions).toBe(4);
      expect(stats.decisionsByMethod).toEqual({
        manual: 2,
        ai_assisted: 1,
        consensus: 1,
      });
      expect(stats.decisionsByUser).toEqual({
        "user-1": 2,
        "user-2": 1,
        "user-3": 1,
      });
    });

    it("should return empty stats for no decisions", async () => {
      const stats = await decisionLogService.getMeetingDecisionStats(testMeetingId);

      expect(stats.totalDecisions).toBe(0);
      expect(stats.decisionsByMethod).toEqual({});
      expect(stats.decisionsByUser).toEqual({});
    });
  });
});
