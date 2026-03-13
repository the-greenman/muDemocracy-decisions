/**
 * Integration tests for FlaggedDecisionService
 * Tests the service with real database and repository
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FlaggedDecisionService } from "@repo/core";
import { DrizzleFlaggedDecisionRepository } from "@repo/db";
import { db, meetings, flaggedDecisions } from "@repo/db";
import { eq } from "drizzle-orm";
import type { FlaggedDecision, CreateFlaggedDecision } from "@repo/schema";
import { randomUUID } from "crypto";

describe("FlaggedDecisionService Integration Tests", () => {
  let service: FlaggedDecisionService;
  let repository: DrizzleFlaggedDecisionRepository;
  let testMeetingId: string;

  beforeEach(async () => {
    // Initialize service with real repository
    repository = new DrizzleFlaggedDecisionRepository();
    service = new FlaggedDecisionService(repository);

    // Create test meeting
    testMeetingId = randomUUID();
    await db.insert(meetings).values({
      id: testMeetingId,
      title: "Integration Test Meeting",
      date: new Date("2026-02-28T00:00:00.000Z"),
      participants: ["Alice", "Bob"],
      status: "in_session",
    });
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(flaggedDecisions).where(eq(flaggedDecisions.meetingId, testMeetingId));
    await db.delete(meetings).where(eq(meetings.id, testMeetingId));
  });

  describe("createFlaggedDecision", () => {
    it("should create a flagged decision in the database", async () => {
      const data: CreateFlaggedDecision = {
        meetingId: testMeetingId,
        suggestedTitle: "Integration Test Decision",
        contextSummary: "This decision tests integration",
        confidence: 0.85,
        chunkIds: [randomUUID(), randomUUID()],
        priority: 5,
      };

      const result = await service.createFlaggedDecision(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.meetingId).toBe(testMeetingId);
      expect(result.suggestedTitle).toBe(data.suggestedTitle);
      expect(result.status).toBe("pending");

      // Verify it's actually in the database
      const found = await repository.findById(result.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(result.id);
      expect(found!.meetingId).toBe(result.meetingId);
      expect(found!.suggestedTitle).toBe(result.suggestedTitle);
      expect(found!.status).toBe(result.status);
    });

    it("should persist decisions with different priorities", async () => {
      const decisions: CreateFlaggedDecision[] = [
        {
          meetingId: testMeetingId,
          suggestedTitle: "High Priority",
          contextSummary: "Important",
          confidence: 0.9,
          chunkIds: [randomUUID()],
          priority: 10,
        },
        {
          meetingId: testMeetingId,
          suggestedTitle: "Low Priority",
          contextSummary: "Less important",
          confidence: 0.7,
          chunkIds: [randomUUID()],
          priority: 1,
        },
      ];

      const created = await Promise.all(decisions.map((d) => service.createFlaggedDecision(d)));

      expect(created).toHaveLength(2);
      expect(created[0]?.priority).toBe(10);
      expect(created[1]?.priority).toBe(1);
    });
  });

  describe("getDecisionsForMeeting", () => {
    it("should retrieve decisions ordered by priority (descending)", async () => {
      // Create decisions with different priorities
      const decisionData = [
        { priority: 5, title: "Medium Priority" },
        { priority: 10, title: "High Priority" },
        { priority: 1, title: "Low Priority" },
      ];

      for (const data of decisionData) {
        await service.createFlaggedDecision({
          meetingId: testMeetingId,
          suggestedTitle: data.title,
          contextSummary: `Context for ${data.title}`,
          confidence: 0.8,
          chunkIds: [randomUUID()],
          priority: data.priority,
        });
      }

      const results = await service.getDecisionsForMeeting(testMeetingId);

      expect(results).toHaveLength(3);
      // Should be ordered by priority descending
      expect(results[0]?.suggestedTitle).toBe("High Priority");
      expect(results[1]?.suggestedTitle).toBe("Medium Priority");
      expect(results[2]?.suggestedTitle).toBe("Low Priority");
    });

    it("should return empty array for meeting with no decisions", async () => {
      const results = await service.getDecisionsForMeeting(randomUUID());
      expect(results).toEqual([]);
    });
  });

  describe("updateDecisionStatus", () => {
    it("should update status in the database", async () => {
      // Create a decision
      const created = await service.createFlaggedDecision({
        meetingId: testMeetingId,
        suggestedTitle: "Status Test",
        contextSummary: "Testing status updates",
        confidence: 0.8,
        chunkIds: [randomUUID()],
        priority: 0,
      });

      // Update status
      const updated = await service.updateDecisionStatus(created.id, "accepted");

      expect(updated.status).toBe("accepted");
      expect(updated.updatedAt).not.toBe(created.updatedAt);

      // Verify in database
      const found = await repository.findById(created.id);
      expect(found?.status).toBe("accepted");
    });

    it("should support all status values", async () => {
      const statuses: FlaggedDecision["status"][] = [
        "pending",
        "accepted",
        "rejected",
        "dismissed",
      ];

      for (const status of statuses) {
        const created = await service.createFlaggedDecision({
          meetingId: testMeetingId,
          suggestedTitle: `Status ${status}`,
          contextSummary: "Testing",
          confidence: 0.8,
          chunkIds: [randomUUID()],
          priority: 0,
        });

        const updated = await service.updateDecisionStatus(created.id, status);
        expect(updated.status).toBe(status);
      }
    });
  });

  describe("prioritizeDecisions", () => {
    it("should update multiple decision priorities", async () => {
      // Create decisions
      const decision1 = await service.createFlaggedDecision({
        meetingId: testMeetingId,
        suggestedTitle: "Decision 1",
        contextSummary: "Context 1",
        confidence: 0.8,
        chunkIds: [randomUUID()],
        priority: 1,
      });

      const decision2 = await service.createFlaggedDecision({
        meetingId: testMeetingId,
        suggestedTitle: "Decision 2",
        contextSummary: "Context 2",
        confidence: 0.8,
        chunkIds: [randomUUID()],
        priority: 2,
      });

      // Update priorities
      await service.prioritizeDecisions([decision1.id, decision2.id], [10, 20]);

      // Verify updates
      const updated1 = await repository.findById(decision1.id);
      const updated2 = await repository.findById(decision2.id);

      expect(updated1!.priority).toBe(10);
      expect(updated2!.priority).toBe(20);
    });

    it("should maintain order after priority updates", async () => {
      // Create decisions
      const decisions = await Promise.all([
        service.createFlaggedDecision({
          meetingId: testMeetingId,
          suggestedTitle: "First",
          contextSummary: "Context 1",
          confidence: 0.8,
          chunkIds: [randomUUID()],
          priority: 1,
        }),
        service.createFlaggedDecision({
          meetingId: testMeetingId,
          suggestedTitle: "Second",
          contextSummary: "Context 2",
          confidence: 0.8,
          chunkIds: [randomUUID()],
          priority: 2,
        }),
        service.createFlaggedDecision({
          meetingId: testMeetingId,
          suggestedTitle: "Third",
          contextSummary: "Context 3",
          confidence: 0.8,
          chunkIds: [randomUUID()],
          priority: 3,
        }),
      ]);

      // Reverse priorities
      await service.prioritizeDecisions(
        decisions.map((d) => d.id),
        [30, 20, 10],
      );

      // Check new order
      const results = await service.getDecisionsForMeeting(testMeetingId);
      expect(results[0]?.suggestedTitle).toBe("First"); // priority 30
      expect(results[1]?.suggestedTitle).toBe("Second"); // priority 20
      expect(results[2]?.suggestedTitle).toBe("Third"); // priority 10
    });
  });

  describe("Error Handling", () => {
    it("should handle database constraints gracefully", async () => {
      const invalidData: CreateFlaggedDecision = {
        meetingId: randomUUID(), // Non-existent meeting
        suggestedTitle: "Invalid",
        contextSummary: "This should fail",
        confidence: 0.8,
        chunkIds: [randomUUID()],
        priority: 0,
      };

      await expect(service.createFlaggedDecision(invalidData)).rejects.toThrow();
    });
  });
});
