/**
 * Unit Tests for Decision Template Repository
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DrizzleDecisionTemplateRepository,
  DrizzleExportTemplateFieldAssignmentRepository,
  DrizzleExportTemplateRepository,
  DrizzleTemplateFieldAssignmentRepository,
} from "../repositories/decision-template-repository";
import { db } from "../client";
import type {
  CreateDecisionTemplate,
  CreateExportTemplate,
  CreateExportTemplateFieldAssignment,
  CreateTemplateFieldAssignment,
} from "@repo/schema";

// Mock the database
vi.mock("../client", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn(),
    and: vi.fn(),
    ilike: vi.fn(),
    desc: vi.fn(),
    asc: vi.fn(),
  };
});

describe("DrizzleDecisionTemplateRepository", () => {
  let repository: DrizzleDecisionTemplateRepository;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DrizzleDecisionTemplateRepository();
    mockDb = vi.mocked(db);
  });

  describe("create", () => {
    it("should create a decision template", async () => {
      const data: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template for unit testing",
        category: "standard",
        fields: [],
      };

      const expectedRow = {
        id: "tpl-123",
        namespace: "core",
        name: data.name,
        description: data.description,
        category: data.category,
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expectedRow]),
        }),
      });
      mockDb.insert = mockInsert;

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBe(expectedRow.id);
      expect(result.name).toBe(data.name);
      expect(result.description).toBe(data.description);
      expect(result.category).toBe(data.category);
      expect(result.fields).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should return null if template not found", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.select = mockSelect;

      const result = await repository.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should return null for non-existent template", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.update = mockUpdate;

      const result = await repository.update("non-existent", { name: "Updated" });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete a template", async () => {
      const templateId = "tpl-123";
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: templateId }]),
        }),
      });
      mockDb.delete = mockDelete;

      const result = await repository.delete(templateId);

      expect(result).toBe(true);
    });

    it("should return false for non-existent template", async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });
      mockDb.delete = mockDelete;

      const result = await repository.delete("non-existent");

      expect(result).toBe(false);
    });
  });
});

describe("DrizzleTemplateFieldAssignmentRepository", () => {
  let repository: DrizzleTemplateFieldAssignmentRepository;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DrizzleTemplateFieldAssignmentRepository();
    mockDb = vi.mocked(db);
  });

  describe("create", () => {
    it("should create a field assignment", async () => {
      const data: CreateTemplateFieldAssignment = {
        fieldId: "field-123",
        order: 0,
        required: true,
      };

      // The service adds templateId to the data before passing to repository
      const dataWithTemplateId = {
        templateId: "tpl-123",
        fieldId: data.fieldId,
        order: data.order,
        required: data.required,
      };

      const expectedRow = {
        id: "tfa-123",
        ...dataWithTemplateId,
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expectedRow]),
        }),
      });
      mockDb.insert = mockInsert;

      const result = await repository.create(dataWithTemplateId);

      expect(result).toBeDefined();
      expect(result.fieldId).toBe(data.fieldId);
      expect(result.order).toBe(data.order);
      expect(result.required).toBe(data.required);
    });
  });

  describe("findByTemplateId", () => {
    it("should return field assignments by template ID", async () => {
      const templateId = "tpl-123";
      const expectedRows = [
        {
          id: "tfa-1",
          templateId,
          fieldId: "field-1",
          order: 0,
          required: true,
        },
        {
          id: "tfa-2",
          templateId,
          fieldId: "field-2",
          order: 1,
          required: false,
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(expectedRows),
          }),
        }),
      });
      mockDb.select = mockSelect;

      const result = await repository.findByTemplateId(templateId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeDefined();
      expect(result[1]).toBeDefined();
      expect(result[0]!.fieldId).toBe("field-1");
      expect(result[1]!.fieldId).toBe("field-2");
      expect(result[0]!.order).toBe(0);
      expect(result[1]!.order).toBe(1);
    });
  });

  describe("update", () => {
    it("should update a field assignment", async () => {
      const templateId = "tpl-123";
      const fieldId = "field-123";
      const updateData = {
        order: 1,
        required: false,
      };

      const expectedRow = {
        id: "tfa-123",
        templateId,
        fieldId,
        order: 1,
        required: false,
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([expectedRow]),
          }),
        }),
      });
      mockDb.update = mockUpdate;

      const result = await repository.update(templateId, fieldId, updateData);

      expect(result).toBeDefined();
      expect(result!.order).toBe(1);
      expect(result!.required).toBe(false);
    });

    it("should return null for non-existent assignment", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.update = mockUpdate;

      const result = await repository.update("tpl-123", "field-123", { order: 1 });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete a field assignment", async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "tfa-123" }]),
        }),
      });
      mockDb.delete = mockDelete;

      const result = await repository.delete("tpl-123", "field-123");

      expect(result).toBe(true);
    });

    it("should return false for non-existent assignment", async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });
      mockDb.delete = mockDelete;

      const result = await repository.delete("tpl-123", "field-123");

      expect(result).toBe(false);
    });
  });

  describe("updateOrder", () => {
    it("should update the order of multiple field assignments", async () => {
      const templateId = "tpl-123";
      const assignments = [
        { fieldId: "field-1", order: 1 },
        { fieldId: "field-2", order: 0 },
      ];

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };
        await callback(tx);
      });
      mockDb.transaction = mockTransaction;

      await repository.updateOrder(templateId, assignments);

      expect(mockTransaction).toHaveBeenCalled();
    });
  });
});


describe("DrizzleExportTemplateRepository", () => {
  let repository: DrizzleExportTemplateRepository;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DrizzleExportTemplateRepository();
    mockDb = vi.mocked(db);
  });

  describe("create", () => {
    it("should create an export template", async () => {
      const data: CreateExportTemplate = {
        deliberationTemplateId: "550e8400-e29b-41d4-a716-446655440008",
        namespace: "core",
        name: "Decision Record",
        description: "Human-readable permanent log layout",
        fields: [],
      };

      const expectedRow = {
        id: "exp-123",
        deliberationTemplateId: data.deliberationTemplateId,
        namespace: data.namespace,
        name: data.name,
        description: data.description,
        version: 1,
        isDefault: false,
        isCustom: false,
        lineage: null,
        provenance: null,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expectedRow]),
        }),
      });
      mockDb.insert = mockInsert;

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBe(expectedRow.id);
      expect(result.deliberationTemplateId).toBe(data.deliberationTemplateId);
      expect(result.fields).toEqual([]);
    });
  });

  describe("findByDeliberationTemplateId", () => {
    it("should list export templates for a deliberation template", async () => {
      const deliberationTemplateId = "550e8400-e29b-41d4-a716-446655440008";
      const rows = [
        {
          id: "exp-1",
          deliberationTemplateId,
          namespace: "core",
          name: "Decision Record",
          description: "Human-readable permanent log layout",
          version: 1,
          isDefault: true,
          isCustom: false,
          lineage: null,
          provenance: null,
          createdAt: new Date(),
        },
      ];

      const fieldRows = [
        {
          id: "efa-1",
          exportTemplateId: "exp-1",
          fieldId: "field-1",
          order: 0,
          title: "Decision",
        },
      ];

      const mockSelect = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(rows),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(fieldRows),
            }),
          }),
        });
      mockDb.select = mockSelect;

      const result = await repository.findByDeliberationTemplateId(deliberationTemplateId);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("exp-1");
      expect(result[0]?.fields).toHaveLength(1);
    });
  });

  describe("findDefaultByDeliberationTemplateId", () => {
    it("should resolve the default export template for a deliberation template", async () => {
      const deliberationTemplateId = "550e8400-e29b-41d4-a716-446655440008";
      const row = {
        id: "exp-1",
        deliberationTemplateId,
        namespace: "core",
        name: "Decision Record",
        description: "Human-readable permanent log layout",
        version: 1,
        isDefault: true,
        isCustom: false,
        lineage: null,
        provenance: null,
        createdAt: new Date(),
      };

      const mockSelect = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([row]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        });
      mockDb.select = mockSelect;

      const result = await repository.findDefaultByDeliberationTemplateId(deliberationTemplateId);

      expect(result).not.toBeNull();
      expect(result?.isDefault).toBe(true);
      expect(result?.deliberationTemplateId).toBe(deliberationTemplateId);
    });
  });
});

describe("DrizzleExportTemplateFieldAssignmentRepository", () => {
  let repository: DrizzleExportTemplateFieldAssignmentRepository;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DrizzleExportTemplateFieldAssignmentRepository();
    mockDb = vi.mocked(db);
  });

  describe("create", () => {
    it("should create an export-template field assignment", async () => {
      const data: CreateExportTemplateFieldAssignment = {
        fieldId: "field-123",
        order: 0,
        title: "Decision",
      };

      const dataWithTemplateId = {
        exportTemplateId: "exp-123",
        fieldId: data.fieldId,
        order: data.order,
        ...(data.title !== undefined ? { title: data.title } : {}),
      };

      const expectedRow = {
        id: "efa-123",
        ...dataWithTemplateId,
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expectedRow]),
        }),
      });
      mockDb.insert = mockInsert;

      const result = await repository.create(dataWithTemplateId);

      expect(result).toBeDefined();
      expect(result.exportTemplateId).toBe("exp-123");
      expect(result.title).toBe("Decision");
    });
  });
});
