/**
 * Unit Tests for Decision Template Service
 */

import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { DecisionTemplateService } from "../services/decision-template-service";
import type {
  IDecisionTemplateRepository,
  ITemplateFieldAssignmentRepository,
  DecisionTemplate,
  CreateDecisionTemplate,
  TemplateFieldAssignment,
  CreateTemplateFieldAssignment,
} from "@repo/core";

describe("DecisionTemplateService", () => {
  let service: DecisionTemplateService;
  let mockTemplateRepo: Mocked<IDecisionTemplateRepository>;
  let mockFieldAssignmentRepo: Mocked<ITemplateFieldAssignmentRepository>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTemplateRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByIdentity: vi.fn(),
      findAll: vi.fn(),
      findDefault: vi.fn(),
      setDefault: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByCategory: vi.fn(),
      findByName: vi.fn(),
      search: vi.fn(),
      createMany: vi.fn(),
    };

    mockFieldAssignmentRepo = {
      create: vi.fn(),
      findByTemplateId: vi.fn(),
      findByFieldId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByTemplateId: vi.fn(),
      createMany: vi.fn(),
      updateOrder: vi.fn(),
    };

    service = new DecisionTemplateService(mockTemplateRepo, mockFieldAssignmentRepo);
  });

  describe("createTemplate", () => {
    it("should create a template without fields", async () => {
      const data: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
      };

      const expectedTemplate: DecisionTemplate = {
        id: "tpl-123",
        ...data,
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      mockTemplateRepo.create.mockResolvedValue(expectedTemplate);

      const result = await service.createTemplate(data);

      expect(result).toEqual(expectedTemplate);
      expect(mockTemplateRepo.create).toHaveBeenCalledWith(data);
      expect(mockFieldAssignmentRepo.createMany).not.toHaveBeenCalled();
    });

    it("should create a template with fields", async () => {
      const fields: CreateTemplateFieldAssignment[] = [
        {
          fieldId: "field-1",
          order: 0,
          required: true,
        },
      ];

      const data: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields,
      };

      const createdTemplate: DecisionTemplate = {
        id: "tpl-123",
        namespace: "core",
        name: data.name,
        description: data.description,
        category: data.category,
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      const templateWithFields: DecisionTemplate = {
        ...createdTemplate,
        fields: [
          {
            fieldId: "field-1",
            order: 0,
            required: true,
          },
        ],
      };

      mockTemplateRepo.create.mockResolvedValue(createdTemplate);
      mockFieldAssignmentRepo.createMany.mockResolvedValue([]);
      mockTemplateRepo.findById.mockResolvedValue(templateWithFields);

      const result = await service.createTemplate(data);

      expect(result).toEqual(templateWithFields);
      expect(mockTemplateRepo.create).toHaveBeenCalledWith({
        namespace: data.namespace,
        name: data.name,
        description: data.description,
        category: data.category,
        fields: [],
      });
      expect(mockFieldAssignmentRepo.createMany).toHaveBeenCalledWith(
        fields.map((f) => ({
          ...f,
          templateId: "tpl-123",
        })),
      );
    });

    it("should throw error for invalid template definition", async () => {
      const data: CreateDecisionTemplate = {
        namespace: "core",
        name: "",
        description: "A test template",
        category: "standard",
        fields: [],
      };

      await expect(service.createTemplate(data)).rejects.toThrow("Invalid template definition");
      expect(mockTemplateRepo.create).not.toHaveBeenCalled();
    });

    it("should throw error for invalid category", async () => {
      const data: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "invalid" as any,
        fields: [],
      };

      await expect(service.createTemplate(data)).rejects.toThrow("Invalid template definition");
      expect(mockTemplateRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("getTemplate", () => {
    it("should return a template by ID", async () => {
      const templateId = "tpl-123";
      const expectedTemplate: DecisionTemplate = {
        id: templateId,
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      mockTemplateRepo.findById.mockResolvedValue(expectedTemplate);

      const result = await service.getTemplate(templateId);

      expect(result).toEqual(expectedTemplate);
      expect(mockTemplateRepo.findById).toHaveBeenCalledWith(templateId);
    });

    it("should return null for non-existent template", async () => {
      mockTemplateRepo.findById.mockResolvedValue(null);

      const result = await service.getTemplate("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getTemplateByIdentity", () => {
    it("should return a template by stable identity", async () => {
      const identity = { namespace: "core", name: "Standard Decision", version: 1 };
      const expectedTemplate: DecisionTemplate = {
        id: "tpl-123",
        namespace: "core",
        name: "Standard Decision",
        description: "A test template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      mockTemplateRepo.findByIdentity.mockResolvedValue(expectedTemplate);

      const result = await service.getTemplateByIdentity(identity);

      expect(result).toEqual(expectedTemplate);
      expect(mockTemplateRepo.findByIdentity).toHaveBeenCalledWith(identity);
    });

    it("should return null when template identity is not found", async () => {
      const identity = { namespace: "core", name: "Missing Template" };

      mockTemplateRepo.findByIdentity.mockResolvedValue(null);

      const result = await service.getTemplateByIdentity(identity);

      expect(result).toBeNull();
      expect(mockTemplateRepo.findByIdentity).toHaveBeenCalledWith(identity);
    });
  });

  describe("getAllTemplates", () => {
    it("should return all templates", async () => {
      const expectedTemplates: DecisionTemplate[] = [
        {
          id: "tpl-1",
          namespace: "core",
          name: "Template 1",
          description: "First template",
          category: "standard",
          fields: [],
          version: 1,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-02-27T00:00:00.000Z",
        },
        {
          id: "tpl-2",
          namespace: "core",
          name: "Template 2",
          description: "Second template",
          category: "technology",
          fields: [],
          version: 1,
          isDefault: true,
          isCustom: false,
          createdAt: "2026-02-27T00:00:00.000Z",
        },
      ];

      mockTemplateRepo.findAll.mockResolvedValue(expectedTemplates);

      const result = await service.getAllTemplates();

      expect(result).toEqual(expectedTemplates);
      expect(mockTemplateRepo.findAll).toHaveBeenCalled();
    });
  });

  describe("setDefaultTemplate", () => {
    it("should set a template as default", async () => {
      const templateId = "tpl-123";
      const template: DecisionTemplate = {
        id: templateId,
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      const updatedTemplate: DecisionTemplate = {
        ...template,
        isDefault: true,
      };

      mockTemplateRepo.findById.mockResolvedValue(template);
      mockTemplateRepo.setDefault.mockResolvedValue(updatedTemplate);

      const result = await service.setDefaultTemplate(templateId);

      expect(result).toEqual(updatedTemplate);
      expect(mockTemplateRepo.findById).toHaveBeenCalledWith(templateId);
      expect(mockTemplateRepo.setDefault).toHaveBeenCalledWith(templateId);
    });

    it("should throw error for non-existent template", async () => {
      mockTemplateRepo.findById.mockResolvedValue(null);

      await expect(service.setDefaultTemplate("non-existent")).rejects.toThrow(
        "Template not found",
      );
      expect(mockTemplateRepo.setDefault).not.toHaveBeenCalled();
    });
  });

  describe("updateTemplate", () => {
    it("should update a template", async () => {
      const templateId = "tpl-123";
      const updateData = {
        name: "Updated Template",
        description: "Updated description",
      };

      const existingTemplate: DecisionTemplate = {
        id: templateId,
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      const updatedTemplate: DecisionTemplate = {
        ...existingTemplate,
        ...updateData,
      };

      mockTemplateRepo.findById.mockResolvedValue(existingTemplate);
      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);
      mockTemplateRepo.findById.mockResolvedValue(updatedTemplate);

      const result = await service.updateTemplate(templateId, updateData);

      expect(result).toEqual(updatedTemplate);
      expect(mockTemplateRepo.findById).toHaveBeenCalledWith(templateId);
      expect(mockTemplateRepo.update).toHaveBeenCalledWith(templateId, updateData);
    });

    it("should return null for non-existent template", async () => {
      mockTemplateRepo.findById.mockResolvedValue(null);

      const result = await service.updateTemplate("non-existent", { name: "Updated" });

      expect(result).toBeNull();
      expect(mockTemplateRepo.update).not.toHaveBeenCalled();
    });

    it("should update template fields", async () => {
      const templateId = "tpl-123";
      const fields: CreateTemplateFieldAssignment[] = [
        {
          fieldId: "field-1",
          order: 0,
          required: true,
        },
      ];

      const updateData = {
        name: "Updated Template",
        fields,
      };

      const existingTemplate: DecisionTemplate = {
        id: templateId,
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      const updatedTemplate: DecisionTemplate = {
        ...existingTemplate,
        name: updateData.name,
        fields: [
          {
            fieldId: "field-1",
            order: 0,
            required: true,
          },
        ],
      };

      mockTemplateRepo.findById.mockResolvedValue(existingTemplate);
      mockTemplateRepo.update.mockResolvedValue(updatedTemplate);
      mockFieldAssignmentRepo.deleteByTemplateId.mockResolvedValue(true);
      mockFieldAssignmentRepo.createMany.mockResolvedValue([]);
      mockTemplateRepo.findById.mockResolvedValue(updatedTemplate);

      const result = await service.updateTemplate(templateId, updateData);

      expect(result).toEqual(updatedTemplate);
      expect(mockFieldAssignmentRepo.deleteByTemplateId).toHaveBeenCalledWith(templateId);
      expect(mockFieldAssignmentRepo.createMany).toHaveBeenCalledWith(
        fields.map((f) => ({
          ...f,
          templateId,
        })),
      );
    });
  });

  describe("deleteTemplate", () => {
    it("should delete a template", async () => {
      const templateId = "tpl-123";
      const template: DecisionTemplate = {
        id: templateId,
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      mockTemplateRepo.findById.mockResolvedValue(template);
      mockFieldAssignmentRepo.deleteByTemplateId.mockResolvedValue(true);
      mockTemplateRepo.delete.mockResolvedValue(true);

      const result = await service.deleteTemplate(templateId);

      expect(result).toBe(true);
      expect(mockTemplateRepo.findById).toHaveBeenCalledWith(templateId);
      expect(mockFieldAssignmentRepo.deleteByTemplateId).toHaveBeenCalledWith(templateId);
      expect(mockTemplateRepo.delete).toHaveBeenCalledWith(templateId);
    });

    it("should return false for non-existent template", async () => {
      mockTemplateRepo.findById.mockResolvedValue(null);

      const result = await service.deleteTemplate("non-existent");

      expect(result).toBe(false);
      expect(mockFieldAssignmentRepo.deleteByTemplateId).not.toHaveBeenCalled();
      expect(mockTemplateRepo.delete).not.toHaveBeenCalled();
    });

    it("should throw error when trying to delete default template", async () => {
      const templateId = "tpl-123";
      const template: DecisionTemplate = {
        id: templateId,
        namespace: "core",
        name: "Default Template",
        description: "The default template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: true,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      mockTemplateRepo.findById.mockResolvedValue(template);

      await expect(service.deleteTemplate(templateId)).rejects.toThrow(
        "Cannot delete the default template",
      );
      expect(mockFieldAssignmentRepo.deleteByTemplateId).not.toHaveBeenCalled();
      expect(mockTemplateRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("getTemplatesByCategory", () => {
    it("should return templates by category", async () => {
      const category = "technology";
      const expectedTemplates: DecisionTemplate[] = [
        {
          id: "tpl-1",
          namespace: "core",
          name: "Tech Template",
          description: "Technology decisions",
          category,
          fields: [],
          version: 1,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-02-27T00:00:00.000Z",
        },
      ];

      mockTemplateRepo.findByCategory.mockResolvedValue(expectedTemplates);

      const result = await service.getTemplatesByCategory(category);

      expect(result).toEqual(expectedTemplates);
      expect(mockTemplateRepo.findByCategory).toHaveBeenCalledWith(category);
    });
  });

  describe("searchTemplates", () => {
    it("should search templates by query", async () => {
      const query = "tech";
      const expectedTemplates: DecisionTemplate[] = [
        {
          id: "tpl-1",
          namespace: "core",
          name: "Technology Template",
          description: "For tech decisions",
          category: "technology",
          fields: [],
          version: 1,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-02-27T00:00:00.000Z",
        },
      ];

      mockTemplateRepo.search.mockResolvedValue(expectedTemplates);

      const result = await service.searchTemplates(query);

      expect(result).toEqual(expectedTemplates);
      expect(mockTemplateRepo.search).toHaveBeenCalledWith(query);
    });
  });

  describe("getTemplateCategories", () => {
    it("should return unique sorted categories", async () => {
      const templates: DecisionTemplate[] = [
        {
          id: "tpl-1",
          namespace: "core",
          name: "Template 1",
          description: "First template",
          category: "standard",
          fields: [],
          version: 1,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-02-27T00:00:00.000Z",
        },
        {
          id: "tpl-2",
          namespace: "core",
          name: "Template 2",
          description: "Second template",
          category: "technology",
          fields: [],
          version: 1,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-02-27T00:00:00.000Z",
        },
        {
          id: "tpl-3",
          namespace: "core",
          name: "Template 3",
          description: "Third template",
          category: "standard",
          fields: [],
          version: 1,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-02-27T00:00:00.000Z",
        },
      ];

      mockTemplateRepo.findAll.mockResolvedValue(templates);

      const result = await service.getTemplateCategories();

      expect(result).toEqual(["standard", "technology"]);
    });
  });

  describe("addFieldToTemplate", () => {
    it("should add a field to a template", async () => {
      const templateId = "tpl-123";
      const assignment: CreateTemplateFieldAssignment = {
        fieldId: "field-123",
        order: 0,
        required: true,
      };

      const template: DecisionTemplate = {
        id: templateId,
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      const expectedAssignment: TemplateFieldAssignment = {
        fieldId: "field-123",
        order: 0,
        required: true,
      };

      mockTemplateRepo.findById.mockResolvedValue(template);
      mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue([]);
      mockFieldAssignmentRepo.create.mockResolvedValue(expectedAssignment);

      const result = await service.addFieldToTemplate(templateId, assignment);

      expect(result).toEqual(expectedAssignment);
      expect(mockTemplateRepo.findById).toHaveBeenCalledWith(templateId);
      expect(mockFieldAssignmentRepo.create).toHaveBeenCalledWith({
        fieldId: assignment.fieldId,
        order: assignment.order,
        required: assignment.required,
        templateId: "tpl-123",
      });
    });

    it("should throw error if template does not exist", async () => {
      mockTemplateRepo.findById.mockResolvedValue(null);

      await expect(
        service.addFieldToTemplate("tpl-123", {
          fieldId: "field-123",
          order: 0,
          required: true,
        }),
      ).rejects.toThrow("Template not found");
    });

    it("should throw error if field already exists in template", async () => {
      const templateId = "tpl-123";
      const fieldId = "field-123";

      const template: DecisionTemplate = {
        id: templateId,
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      const existingFields: TemplateFieldAssignment[] = [
        {
          fieldId,
          order: 0,
          required: true,
        },
      ];

      mockTemplateRepo.findById.mockResolvedValue(template);
      mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue(existingFields);

      await expect(
        service.addFieldToTemplate(templateId, {
          fieldId,
          order: 1,
          required: false,
        }),
      ).rejects.toThrow("Field already exists in template");
    });
  });

  describe("removeFieldFromTemplate", () => {
    it("should remove a field from a template", async () => {
      const templateId = "tpl-123";
      const fieldId = "field-123";

      const template: DecisionTemplate = {
        id: templateId,
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      mockTemplateRepo.findById.mockResolvedValue(template);
      mockFieldAssignmentRepo.delete.mockResolvedValue(true);

      const result = await service.removeFieldFromTemplate(templateId, fieldId);

      expect(result).toBe(true);
      expect(mockTemplateRepo.findById).toHaveBeenCalledWith(templateId);
      expect(mockFieldAssignmentRepo.delete).toHaveBeenCalledWith(templateId, fieldId);
    });

    it("should return false if template does not exist", async () => {
      mockTemplateRepo.findById.mockResolvedValue(null);

      const result = await service.removeFieldFromTemplate("tpl-123", "field-123");

      expect(result).toBe(false);
      expect(mockFieldAssignmentRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("reorderTemplateFields", () => {
    it("should reorder fields in a template", async () => {
      const templateId = "tpl-123";
      const fieldOrders = [
        { fieldId: "field-1", order: 1 },
        { fieldId: "field-2", order: 0 },
      ];

      const existingFields: TemplateFieldAssignment[] = [
        { fieldId: "field-1", order: 0, required: true },
        { fieldId: "field-2", order: 1, required: false },
      ];

      mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue(existingFields);
      mockFieldAssignmentRepo.updateOrder.mockResolvedValue();

      await service.reorderTemplateFields(templateId, fieldOrders);

      expect(mockFieldAssignmentRepo.findByTemplateId).toHaveBeenCalledWith(templateId);
      expect(mockFieldAssignmentRepo.updateOrder).toHaveBeenCalledWith(templateId, fieldOrders);
    });

    it("should throw error if field not found in template", async () => {
      const templateId = "tpl-123";
      const fieldOrders = [
        { fieldId: "field-1", order: 0 },
        { fieldId: "field-3", order: 1 }, // This field doesn't exist
      ];

      const existingFields: TemplateFieldAssignment[] = [
        { fieldId: "field-1", order: 0, required: true },
        { fieldId: "field-2", order: 1, required: false },
      ];

      mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue(existingFields);

      await expect(service.reorderTemplateFields(templateId, fieldOrders)).rejects.toThrow(
        "Field field-3 not found in template",
      );
    });
  });

  describe("createTemplateWithFields", () => {
    it("should create a template with fields in one operation", async () => {
      const templateData: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
      };

      const fieldAssignments: CreateTemplateFieldAssignment[] = [
        {
          fieldId: "field-1",
          order: 0,
          required: true,
        },
      ];

      const createdTemplate: DecisionTemplate = {
        id: "tpl-123",
        ...templateData,
        fields: [
          {
            fieldId: "field-1",
            order: 0,
            required: true,
          },
        ],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      };

      mockTemplateRepo.create.mockResolvedValue({
        id: "tpl-123",
        ...templateData,
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-02-27T00:00:00.000Z",
      });
      mockFieldAssignmentRepo.createMany.mockResolvedValue([]);
      mockTemplateRepo.findById.mockResolvedValue(createdTemplate);

      const result = await service.createTemplateWithFields(templateData, fieldAssignments);

      expect(result).toEqual(createdTemplate);
      expect(mockTemplateRepo.create).toHaveBeenCalledWith(templateData);
      expect(mockFieldAssignmentRepo.createMany).toHaveBeenCalledWith(
        fieldAssignments.map((f) => ({
          ...f,
          templateId: "tpl-123",
        })),
      );
    });

    it("should throw error for invalid template", async () => {
      const templateData: CreateDecisionTemplate = {
        namespace: "core",
        name: "",
        description: "A test template",
        category: "standard",
        fields: [],
      };

      await expect(service.createTemplateWithFields(templateData, [])).rejects.toThrow(
        "Invalid template definition",
      );
    });

    it("should throw error for invalid field assignments", async () => {
      const templateData: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [],
      };

      const fieldAssignments: CreateTemplateFieldAssignment[] = [
        {
          fieldId: "field-1",
          order: -1, // Invalid negative order
          required: true,
        },
      ];

      await expect(
        service.createTemplateWithFields(templateData, fieldAssignments),
      ).rejects.toThrow("Invalid field assignments");
    });
  });

  describe("validateTemplateDefinition", () => {
    it("should validate a correct template", async () => {
      const template: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [
          {
            fieldId: "field-1",
            order: 0,
            required: true,
          },
          {
            fieldId: "field-2",
            order: 1,
            required: false,
          },
        ],
      };

      const result = await service.validateTemplateDefinition(template);

      expect(result).toBe(true);
    });

    it("should reject template with empty name", async () => {
      const template: CreateDecisionTemplate = {
        namespace: "core",
        name: "",
        description: "A test template",
        category: "standard",
        fields: [],
      };

      const result = await service.validateTemplateDefinition(template);

      expect(result).toBe(false);
    });

    it("should reject template with invalid category", async () => {
      const template: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "invalid" as any,
        fields: [],
      };

      const result = await service.validateTemplateDefinition(template);

      expect(result).toBe(false);
    });

    it("should reject template with duplicate field IDs", async () => {
      const template: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [
          {
            fieldId: "field-1",
            order: 0,
            required: true,
          },
          {
            fieldId: "field-1", // Duplicate
            order: 1,
            required: false,
          },
        ],
      };

      const result = await service.validateTemplateDefinition(template);

      expect(result).toBe(false);
    });

    it("should reject template with non-sequential field orders", async () => {
      const template: CreateDecisionTemplate = {
        namespace: "core",
        name: "Test Template",
        description: "A test template",
        category: "standard",
        fields: [
          {
            fieldId: "field-1",
            order: 0,
            required: true,
          },
          {
            fieldId: "field-2",
            order: 2, // Should be 1
            required: false,
          },
        ],
      };

      const result = await service.validateTemplateDefinition(template);

      expect(result).toBe(false);
    });
  });

  describe("validateFieldAssignments", () => {
    it("should validate correct field assignments", async () => {
      const assignments: CreateTemplateFieldAssignment[] = [
        {
          fieldId: "field-123",
          order: 0,
          required: true,
        },
        {
          fieldId: "field-2",
          order: 1,
          required: false,
        },
      ];

      const result = await service.validateFieldAssignments(assignments);

      expect(result).toBe(true);
    });

    it("should reject assignments with duplicate field IDs", async () => {
      const assignments: CreateTemplateFieldAssignment[] = [
        {
          fieldId: "field-123",
          order: 0,
          required: true,
        },
        {
          fieldId: "field-123", // Duplicate
          order: 1,
          required: false,
        },
      ];

      const result = await service.validateFieldAssignments(assignments);

      expect(result).toBe(false);
    });

    it("should reject assignments with negative order", async () => {
      const assignments: CreateTemplateFieldAssignment[] = [
        {
          fieldId: "field-123",
          order: -1, // Invalid
          required: true,
        },
      ];

      const result = await service.validateFieldAssignments(assignments);

      expect(result).toBe(false);
    });
  });

  describe("seedTemplates", () => {
    it("should seed multiple templates", async () => {
      const templates: CreateDecisionTemplate[] = [
        {
          namespace: "core",
          name: "Template 1",
          description: "First template",
          category: "standard",
          fields: [],
        },
        {
          namespace: "core",
          name: "Template 2",
          description: "Second template",
          category: "technology",
          fields: [],
        },
      ];

      const createdTemplates: DecisionTemplate[] = [
        {
          id: "tpl-1",
          namespace: "core",
          name: templates[0]!.name,
          description: templates[0]!.description,
          category: templates[0]!.category,
          fields: [],
          version: 1,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-02-27T00:00:00.000Z",
        },
        {
          id: "tpl-2",
          namespace: "core",
          name: templates[1]!.name,
          description: templates[1]!.description,
          category: templates[1]!.category,
          fields: [],
          version: 1,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-02-27T00:00:00.000Z",
        },
      ];

      mockTemplateRepo.createMany.mockResolvedValue(createdTemplates);

      const result = await service.seedTemplates(templates);

      expect(result).toEqual(createdTemplates);
      expect(mockTemplateRepo.createMany).toHaveBeenCalledWith(templates);
    });

    it("should throw error for invalid template during seeding", async () => {
      const templates: CreateDecisionTemplate[] = [
        {
          namespace: "core",
          name: "", // Invalid
          description: "Invalid template",
          category: "standard",
          fields: [],
        },
      ];

      await expect(service.seedTemplates(templates)).rejects.toThrow(
        "Invalid template definition: ",
      );
      expect(mockTemplateRepo.createMany).not.toHaveBeenCalled();
    });
  });
});
