/**
 * Tests for DecisionContextService
 * Following TDD approach - tests written before implementation
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
  IDecisionContextRepository,
  DecisionContext,
  CreateDecisionContext,
  IDecisionContextService,
  ITemplateFieldAssignmentRepository,
  TemplateFieldAssignment,
} from "@repo/core";
import { DecisionContextService } from "../services/decision-context-service";

const FIELD_META_KEY = "__fieldMeta";

// Mock repository for testing
class MockDecisionContextRepository implements IDecisionContextRepository {
  private contexts: Map<string, DecisionContext> = new Map();

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

    const locked = context.lockedFields.includes(fieldId)
      ? context.lockedFields
      : [...context.lockedFields, fieldId];

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

    const locked = context.lockedFields.filter((id) => id !== fieldId);

    const updated = {
      ...context,
      lockedFields: [...locked],
      updatedAt: new Date().toISOString(),
    };
    this.contexts.set(id, updated);
    return updated;
  }

  async setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null> {
    const context = this.contexts.get(id);
    if (!context) return null;

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

  seed(context: DecisionContext) {
    this.contexts.set(context.id, context);
  }
}

describe("DecisionContextService", () => {
  let repository: IDecisionContextRepository;
  let service: IDecisionContextService;
  let templateFieldAssignmentRepository: ITemplateFieldAssignmentRepository;
  let testMeetingId: string;
  let testFlaggedDecisionId: string;
  let testTemplateId: string;
  let assignedFields: TemplateFieldAssignment[];

  beforeEach(() => {
    repository = new MockDecisionContextRepository();
    testMeetingId = crypto.randomUUID();
    testFlaggedDecisionId = crypto.randomUUID();
    testTemplateId = crypto.randomUUID();
    assignedFields = [
      { fieldId: "field1", order: 0, required: true },
      { fieldId: "field2", order: 1, required: false },
    ];
    templateFieldAssignmentRepository = {
      create: async () => ({ fieldId: "field1", order: 0, required: true }),
      findByTemplateId: async () => assignedFields,
      findByFieldId: async () => [],
      update: async () => null,
      delete: async () => true,
      deleteByTemplateId: async () => true,
      createMany: async () => assignedFields,
      updateOrder: async () => undefined,
    };
    service = new DecisionContextService(repository, templateFieldAssignmentRepository);
  });

  describe("createContext", () => {
    it("should create a new decision context", async () => {
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
      expect(result.lockedFields).toEqual([]);
      expect(result.activeField).toBeUndefined();
      expect(result.draftVersions).toEqual([]);
    });

    it("should create context with initial draft data", async () => {
      const data = {
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
        draftData: { field1: "value1" },
      };

      const result = await service.createContext(data);

      expect(result.draftData).toEqual({ field1: "value1" });
      expect(result.draftVersions).toEqual([]);
    });
  });

  describe("changeTemplate", () => {
    it("should update templateId while preserving draft data", async () => {
      const nextTemplateId = crypto.randomUUID();
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Template Change Context",
        templateId: testTemplateId,
        draftData: { field1: "keep me" },
      });

      const result = await service.changeTemplate(context.id, nextTemplateId);

      expect(result).toBeDefined();
      expect(result!.templateId).toBe(nextTemplateId);
      expect(result!.draftData).toEqual({ field1: "keep me" });
    });

    it("should return null for a missing context", async () => {
      const result = await service.changeTemplate(crypto.randomUUID(), crypto.randomUUID());

      expect(result).toBeNull();
    });
  });

  describe("version management", () => {
    it("should save a snapshot of the current draft data", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Versioned Context",
        templateId: testTemplateId,
        draftData: { field1: "current", field2: "draft" },
      });

      const result = await service.saveSnapshot(context.id);

      expect(result).toBeDefined();
      expect(result!.draftVersions).toHaveLength(1);
      expect(result!.draftVersions[0]!.version).toBe(1);
      expect(result!.draftVersions[0]!.draftData).toEqual({ field1: "current", field2: "draft" });
    });

    it("should list saved versions with field counts", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Versioned Context",
        templateId: testTemplateId,
        draftData: { field1: "current" },
      });

      await service.saveSnapshot(context.id);

      const versions = await service.listVersions(context.id);

      expect(versions).toEqual([expect.objectContaining({ version: 1, fieldCount: 1 })]);
    });

    it("should rollback draft data to a saved version", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Versioned Context",
        templateId: testTemplateId,
        draftData: { field1: "original" },
      });

      await service.saveSnapshot(context.id);
      await service.updateDraftData(context.id, { field1: "modified", field2: "new value" });

      const rolledBack = await service.rollback(context.id, 1);

      expect(rolledBack).toBeDefined();
      expect(rolledBack!.draftData).toEqual({ field1: "original" });
      expect(rolledBack!.draftVersions).toHaveLength(1);
    });

    it("should throw when rolling back to a missing version", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Versioned Context",
        templateId: testTemplateId,
        draftData: { field1: "original" },
      });

      await expect(service.rollback(context.id, 99)).rejects.toThrow("Draft version 99 not found");
    });
  });

  describe("updateDraftData", () => {
    it("should update draft data for unlocked fields", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const result = await service.updateDraftData(context.id, { field1: "updated" });

      expect(result).toBeDefined();
      expect(result!.draftData).toEqual({ field1: "updated" });
    });

    it("should not update locked fields", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
        draftData: { field1: "original" },
      });

      await repository.lockField(context.id, "field1");

      const result = await service.updateDraftData(context.id, { field1: "updated" });

      expect(result).toBeDefined();
      expect(result!.draftData).toEqual({ field1: "original" });
    });
  });

  describe("setFieldValue", () => {
    it("should set a single field value directly on the draft data", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Editable Context",
        templateId: testTemplateId,
        draftData: { field1: "original", field2: "existing" },
      });

      const result = await service.setFieldValue(context.id, "field1", "manually edited");

      expect(result).toBeDefined();
      expect(result!.draftData).toEqual({
        field1: "manually edited",
        field2: "existing",
        [FIELD_META_KEY]: {
          field1: {
            manuallyEdited: true,
          },
        },
      });
      expect(result!.lockedFields).toEqual([]);
    });

    it("should reject fields not assigned to the active template", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Editable Context",
        templateId: testTemplateId,
      });

      await expect(service.setFieldValue(context.id, "field3", "value")).rejects.toThrow(
        `Field field3 is not assigned to template ${testTemplateId}`,
      );
    });

    it("should return null when setting a field on a missing context", async () => {
      const result = await service.setFieldValue(crypto.randomUUID(), "field1", "value");

      expect(result).toBeNull();
    });
  });

  describe("lockField", () => {
    it("should lock a field when not already locked", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const result = await service.lockField(context.id, "field1");

      expect(result).toBeDefined();
      expect(result!.lockedFields).toContain("field1");
    });

    it("should not lock an already locked field", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      // Lock the field first time
      await service.lockField(context.id, "field1");

      // Try to lock again
      const result = await service.lockField(context.id, "field1");

      // Should return unchanged context
      expect(result).toBeDefined();
      expect(result!.lockedFields).toEqual(["field1"]);
    });

    it("should return null for non-existent context", async () => {
      const result = await service.lockField("non-existent-id", "field1");
      expect(result).toBeNull();
    });
  });

  describe("unlockField", () => {
    it("should unlock a field", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      await repository.lockField(context.id, "field1");
      const result = await service.unlockField(context.id, "field1");

      expect(result).toBeDefined();
      expect(result!.lockedFields).not.toContain("field1");
    });
  });

  describe("setActiveField", () => {
    it("should set the active field", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const result = await service.setActiveField(context.id, "field1");

      expect(result).toBeDefined();
      expect(result!.activeField).toBe("field1");
    });
  });

  describe("submitForReview", () => {
    it("should transition from drafting to reviewing", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const result = await service.submitForReview(context.id);

      expect(result).toBeDefined();
      expect(result!.status).toBe("reviewing");
    });

    it("should throw error when submitting from non-drafting status", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      // Manually set status to reviewing
      await repository.updateStatus(context.id, "reviewing");

      await expect(service.submitForReview(context.id)).rejects.toThrow(
        "Can only submit contexts that are in drafting status",
      );
    });

    it("should return null for non-existent context", async () => {
      const result = await service.submitForReview("non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("approveAndLock", () => {
    it("should transition from reviewing to locked", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
        draftData: { field1: "value1", field2: "value2" },
      });

      await service.submitForReview(context.id);
      const result = await service.approveAndLock(context.id);

      expect(result).toBeDefined();
      expect(result!.status).toBe("locked");
    });

    it("should throw error when approving from non-reviewing status", async () => {
      const context = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      await expect(service.approveAndLock(context.id)).rejects.toThrow(
        "Can only approve contexts that are in reviewing status",
      );
    });
  });

  describe("getContextByFlaggedDecision", () => {
    it("should return context for flagged decision", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Test Context",
        templateId: testTemplateId,
      });

      const result = await service.getContextByFlaggedDecision(testFlaggedDecisionId);

      expect(result).toEqual(created);
    });

    it("should return null if no context exists", async () => {
      const result = await service.getContextByFlaggedDecision("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getAllContextsForMeeting", () => {
    it("should return all contexts for a meeting", async () => {
      await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Context 1",
        templateId: testTemplateId,
      });

      await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: crypto.randomUUID(),
        title: "Context 2",
        templateId: testTemplateId,
      });

      const result = await service.getAllContextsForMeeting(testMeetingId);

      expect(result).toHaveLength(2);
      expect(result[0]!.title).toBe("Context 1");
      expect(result[1]!.title).toBe("Context 2");
    });
  });

  describe("getById", () => {
    it("should return a context by id", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Fetch me",
        templateId: testTemplateId,
      });

      const result = await service.getById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
      expect(result!.title).toBe("Fetch me");
    });

    it("should return null for a missing id", async () => {
      const result = await service.getById(crypto.randomUUID());
      expect(result).toBeNull();
    });
  });

  describe("updateMeta", () => {
    it("should update the title of a context", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Original title",
        templateId: testTemplateId,
      });

      const result = await service.updateMeta(created.id, { title: "Revised title" });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Revised title");
    });

    it("should return null for a missing context", async () => {
      const result = await service.updateMeta(crypto.randomUUID(), { title: "No-op" });
      expect(result).toBeNull();
    });

    it("should leave title unchanged when not provided", async () => {
      const created = await repository.create({
        meetingId: testMeetingId,
        flaggedDecisionId: testFlaggedDecisionId,
        title: "Unchanged",
        templateId: testTemplateId,
      });

      const result = await service.updateMeta(created.id, {});

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Unchanged");
    });
  });
});
