/**
 * Tests for IDecisionContextRepository interface
 * Following TDD approach - tests written before implementation
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
  IDecisionContextRepository,
  DecisionContext,
  CreateDecisionContext,
} from "@repo/core";

// Mock implementation for testing interface
class MockDecisionContextRepository implements IDecisionContextRepository {
  private contexts: Map<string, DecisionContext> = new Map();
  private lockedFields: Map<string, string[]> = new Map();

  async create(data: CreateDecisionContext): Promise<DecisionContext> {
    const context: DecisionContext = {
      ...data,
      id: crypto.randomUUID(),
      status: "drafting",
      lockedFields: [],
      activeField: undefined,
      draftVersions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(context.id, context);
    return context;
  }

  async findById(id: string): Promise<DecisionContext | null> {
    return this.contexts.get(id) || null;
  }

  async findByMeetingId(meetingId: string): Promise<DecisionContext[]> {
    return Array.from(this.contexts.values())
      .filter((c) => c.meetingId === meetingId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async findByFlaggedDecisionId(flaggedDecisionId: string): Promise<DecisionContext | null> {
    return (
      Array.from(this.contexts.values()).find((c) => c.flaggedDecisionId === flaggedDecisionId) ||
      null
    );
  }

  async update(id: string, data: Partial<CreateDecisionContext>): Promise<DecisionContext | null> {
    const context = this.contexts.get(id);
    if (!context) return null;

    // Ensure a different timestamp
    await new Promise((resolve) => setTimeout(resolve, 1));

    const updated = {
      ...context,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(id, updated);
    return updated;
  }

  async lockField(id: string, fieldId: string): Promise<DecisionContext | null> {
    const context = this.contexts.get(id);
    if (!context) return null;

    const locked = this.lockedFields.get(id) || [];
    if (!locked.includes(fieldId)) {
      locked.push(fieldId);
      this.lockedFields.set(id, locked);
    }

    const updated = {
      ...context,
      lockedFields: [...locked],
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(id, updated);
    return updated;
  }

  async unlockField(id: string, fieldId: string): Promise<DecisionContext | null> {
    const context = this.contexts.get(id);
    if (!context) return null;

    const locked = this.lockedFields.get(id) || [];
    const index = locked.indexOf(fieldId);
    if (index > -1) {
      locked.splice(index, 1);
      this.lockedFields.set(id, locked);
    }

    const updated = {
      ...context,
      lockedFields: [...locked],
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(id, updated);
    return updated;
  }

  async lockAllFields(id: string): Promise<DecisionContext | null> {
    const context = this.contexts.get(id);
    if (!context) return null;

    const allFields = Object.keys(context.draftData || {});
    const updated = {
      ...context,
      lockedFields: [...new Set([...context.lockedFields, ...allFields])],
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(id, updated);
    return updated;
  }

  async setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null> {
    const context = this.contexts.get(id);
    if (!context) {
      return null;
    }
    const updated = {
      ...context,
      activeField: fieldId || undefined,
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(id, updated);
    return updated;
  }

  async updateStatus(
    id: string,
    status: DecisionContext["status"],
  ): Promise<DecisionContext | null> {
    const context = this.contexts.get(id);
    if (!context) return null;

    const updated = {
      ...context,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(id, updated);
    return updated;
  }
}

describe("IDecisionContextRepository", () => {
  let repository: IDecisionContextRepository;
  let testMeetingId: string;
  let testFlaggedDecisionId: string;
  let testTemplateId: string;

  beforeEach(() => {
    repository = new MockDecisionContextRepository();
    testMeetingId = crypto.randomUUID();
    testFlaggedDecisionId = crypto.randomUUID();
    testTemplateId = crypto.randomUUID();
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
      expect(result.activeField).toBeUndefined();
      expect(result.draftVersions).toEqual([]);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it("should create a decision context with initial draft data", async () => {
      const data: CreateDecisionContext = {
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Decision Context",
        templateId: testTemplateId,
        draftData: { field1: "value1", field2: "value2" },
      };

      const result = await repository.create(data);

      expect(result.draftData).toEqual({ field1: "value1", field2: "value2" });
      expect(result.draftVersions).toEqual([]);
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
      const found = await repository.findById("non-existent-id");
      expect(found).toBeNull();
    });
  });

  describe("findByMeetingId", () => {
    it("should return all contexts for a meeting", async () => {
      const meetingId1 = crypto.randomUUID();
      const meetingId2 = crypto.randomUUID();

      await repository.create({
        meetingId: meetingId1,
        flaggedDecisionId: crypto.randomUUID(),
        title: "Context 1",
        templateId: testTemplateId,
      });

      await repository.create({
        meetingId: meetingId1,
        flaggedDecisionId: crypto.randomUUID(),
        title: "Context 2",
        templateId: testTemplateId,
      });

      await repository.create({
        meetingId: meetingId2,
        flaggedDecisionId: crypto.randomUUID(),
        title: "Context 3",
        templateId: testTemplateId,
      });

      const results = await repository.findByMeetingId(meetingId1);

      expect(results).toHaveLength(2);
      expect(results[0]!.title).toBe("Context 1");
      expect(results[1]!.title).toBe("Context 2");
    });

    it("should return empty array for meeting with no contexts", async () => {
      const results = await repository.findByMeetingId(crypto.randomUUID());
      expect(results).toEqual([]);
    });
  });

  describe("findByFlaggedDecisionId", () => {
    it("should return context for a flagged decision", async () => {
      const flaggedDecisionId = crypto.randomUUID();
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const found = await repository.findByFlaggedDecisionId(flaggedDecisionId);

      expect(found).toEqual(created);
    });

    it("should return null when no context exists for flagged decision", async () => {
      const found = await repository.findByFlaggedDecisionId(crypto.randomUUID());
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
      const result = await repository.update("non-existent-id", { title: "New Title" });
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

      const fieldId = crypto.randomUUID();
      const updated = await repository.lockField(created.id, fieldId);

      expect(updated).toBeDefined();
      expect(updated!.lockedFields).toContain(fieldId);
    });

    it("should not duplicate locked fields", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const fieldId = crypto.randomUUID();
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

      const fieldId = crypto.randomUUID();
      await repository.lockField(created.id, fieldId);
      const updated = await repository.unlockField(created.id, fieldId);

      expect(updated).toBeDefined();
      expect(updated!.lockedFields).not.toContain(fieldId);
    });

    it("should handle unlocking non-locked field", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const fieldId = crypto.randomUUID();
      const updated = await repository.unlockField(created.id, fieldId);

      expect(updated).toBeDefined();
      expect(updated!.lockedFields).toEqual([]);
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

      const fieldId = crypto.randomUUID();
      const updated = await repository.setActiveField(created.id, fieldId);

      expect(updated).toBeDefined();
      expect(updated!.activeField).toBe(fieldId);
    });

    it("should clear the active field when set to null", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const fieldId = crypto.randomUUID();
      await repository.setActiveField(created.id, fieldId);
      const updated = await repository.setActiveField(created.id, null);

      expect(updated).toBeDefined();
      expect(updated!.activeField).toBeUndefined();
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
    });
  });
});
