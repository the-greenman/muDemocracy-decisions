/**
 * Unit tests for DrizzleFlaggedDecisionRepository
 * Following TDD approach - tests written first
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DrizzleFlaggedDecisionRepository } from "../../src/repositories/flagged-decision-repository";
import { db } from "../../src/client";
import { flaggedDecisions, meetings } from "../../src/schema";
import { eq } from "drizzle-orm";
import { CreateFlaggedDecision } from "@repo/schema";
import { randomUUID } from "crypto";

describe("DrizzleFlaggedDecisionRepository", () => {
  let repository: DrizzleFlaggedDecisionRepository;
  let testMeetingId: string;

  beforeEach(async () => {
    repository = new DrizzleFlaggedDecisionRepository();
    testMeetingId = randomUUID();

    // Create a test meeting with the specific ID
    await db.insert(meetings).values({
      id: testMeetingId,
      title: "Test Meeting",
      date: new Date("2026-02-27T00:00:00.000Z"),
      participants: ["Alice", "Bob"],
      status: "in_session",
    });

    // Clean up any existing test data
    await db.delete(flaggedDecisions).where(eq(flaggedDecisions.meetingId, testMeetingId));
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(flaggedDecisions).where(eq(flaggedDecisions.meetingId, testMeetingId));
    await db.delete(meetings).where(eq(meetings.id, testMeetingId));
  });

  describe("create", () => {
    it("should create a flagged decision", async () => {
      const data: CreateFlaggedDecision = {
        meetingId: testMeetingId,
        suggestedTitle: "Test Decision",
        contextSummary: "This is a test decision about architecture",
        confidence: 0.85,
        chunkIds: [randomUUID(), randomUUID()],
        suggestedTemplateId: undefined,
        templateConfidence: undefined,
        priority: 5,
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.meetingId).toBe(testMeetingId);
      expect(result.suggestedTitle).toBe("Test Decision");
      expect(result.contextSummary).toBe("This is a test decision about architecture");
      expect(result.confidence).toBe(0.85);
      expect(result.chunkIds).toEqual(data.chunkIds);
      expect(result.suggestedTemplateId).toBeUndefined();
      expect(result.templateConfidence).toBeUndefined();
      expect(result.status).toBe("pending");
      expect(result.priority).toBe(5);
      expect(result.createdAt).toBeDefined();
    });

    it("should create a flagged decision with minimal required fields", async () => {
      const data: CreateFlaggedDecision = {
        meetingId: testMeetingId,
        suggestedTitle: "Minimal Decision",
        contextSummary: "Minimal context",
        confidence: 0.5,
        chunkIds: [randomUUID()],
        priority: 0,
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.suggestedTemplateId).toBeUndefined();
      expect(result.templateConfidence).toBeUndefined();
      expect(result.status).toBe("pending");
      expect(result.priority).toBe(0);
    });
  });

  describe("findByMeetingId", () => {
    it("should return all flagged decisions for a meeting", async () => {
      // Create multiple decisions
      await repository.create({
        meetingId: testMeetingId,
        suggestedTitle: "Decision 1",
        contextSummary: "Context 1",
        confidence: 0.8,
        chunkIds: [randomUUID()],
        priority: 5,
      });

      await repository.create({
        meetingId: testMeetingId,
        suggestedTitle: "Decision 2",
        contextSummary: "Context 2",
        confidence: 0.6,
        chunkIds: [randomUUID()],
        priority: 3,
      });

      const results = await repository.findByMeetingId(testMeetingId);

      expect(results).toHaveLength(2);
      expect(results[0]!.suggestedTitle).toBe("Decision 1"); // Higher priority (5) comes first
      expect(results[1]!.suggestedTitle).toBe("Decision 2");
    });

    it("should return empty array for meeting with no decisions", async () => {
      const results = await repository.findByMeetingId(randomUUID());
      expect(results).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should return a flagged decision by ID", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        suggestedTitle: "Find Me",
        contextSummary: "Context",
        confidence: 0.7,
        chunkIds: [randomUUID()],
        priority: 0,
      });

      const result = await repository.findById(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.suggestedTitle).toBe("Find Me");
    });

    it("should return null for non-existent ID", async () => {
      const result = await repository.findById(randomUUID());
      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update a flagged decision", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        suggestedTitle: "Original Title",
        contextSummary: "Original context",
        confidence: 0.5,
        chunkIds: [randomUUID()],
        priority: 0,
      });

      const updateData = {
        suggestedTitle: "Updated Title",
        contextSummary: "Updated context",
        confidence: 0.9,
        priority: 8,
      };

      const result = await repository.update(created.id, updateData);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.suggestedTitle).toBe("Updated Title");
      expect(result!.contextSummary).toBe("Updated context");
      expect(result!.confidence).toBe(0.9);
      expect(result!.priority).toBe(8);
      expect(result!.updatedAt).toBeDefined();
    });

    it("should return null when updating non-existent decision", async () => {
      const result = await repository.update(randomUUID(), {
        suggestedTitle: "New Title",
      });
      expect(result).toBeNull();
    });
  });

  describe("updatePriority", () => {
    it("should update only the priority", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        suggestedTitle: "Priority Test",
        contextSummary: "Context",
        confidence: 0.7,
        chunkIds: [randomUUID()],
        priority: 1,
      });

      const result = await repository.updatePriority(created.id, 10);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.priority).toBe(10);
      expect(result!.suggestedTitle).toBe("Priority Test"); // Other fields unchanged
    });
  });

  describe("updateStatus", () => {
    it("should update only the status", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        suggestedTitle: "Status Test",
        contextSummary: "Context",
        confidence: 0.7,
        chunkIds: [randomUUID()],
        priority: 0,
      });

      const result = await repository.updateStatus(created.id, "accepted");

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.status).toBe("accepted");
      expect(result!.suggestedTitle).toBe("Status Test"); // Other fields unchanged
    });

    it("should support all status values", async () => {
      const statuses = ["pending", "accepted", "rejected", "dismissed"] as const;

      for (const status of statuses) {
        const created = await repository.create({
          meetingId: testMeetingId,
          suggestedTitle: `Status ${status}`,
          contextSummary: "Context",
          confidence: 0.7,
          chunkIds: [randomUUID()],
          priority: 0,
        });

        const result = await repository.updateStatus(created.id, status);
        expect(result!.status).toBe(status);
      }
    });
  });
});
