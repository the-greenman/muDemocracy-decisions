import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";
import type {
  CreateExportTemplate,
  DecisionTemplate,
  ExportTemplateDefinitionPackage,
} from "@repo/schema";
import type {
  IDecisionTemplateRepository,
  ITemplateFieldAssignmentRepository,
} from "../interfaces/i-decision-template-repository";
import type {
  IExportTemplateFieldAssignmentRepository,
  IExportTemplateRepository,
} from "../interfaces/i-export-template-repository";
import { ExportTemplateService } from "../services/export-template-service";

describe("ExportTemplateService", () => {
  let service: ExportTemplateService;
  let mockDecisionTemplateRepository: Mocked<IDecisionTemplateRepository>;
  let mockTemplateFieldAssignmentRepository: Mocked<ITemplateFieldAssignmentRepository>;
  let mockExportTemplateRepository: Mocked<IExportTemplateRepository>;
  let mockExportTemplateFieldAssignmentRepository: Mocked<IExportTemplateFieldAssignmentRepository>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDecisionTemplateRepository = {
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

    mockTemplateFieldAssignmentRepository = {
      create: vi.fn(),
      findByTemplateId: vi.fn(),
      findByFieldId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByTemplateId: vi.fn(),
      createMany: vi.fn(),
      updateOrder: vi.fn(),
    };

    mockExportTemplateRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByDeliberationTemplateId: vi.fn(),
      findDefaultByDeliberationTemplateId: vi.fn(),
    };

    mockExportTemplateFieldAssignmentRepository = {
      create: vi.fn(),
      findByExportTemplateId: vi.fn(),
    };

    service = new ExportTemplateService(
      mockDecisionTemplateRepository,
      mockTemplateFieldAssignmentRepository,
      mockExportTemplateRepository,
      mockExportTemplateFieldAssignmentRepository,
    );
  });

  describe("validateExportTemplateDefinition", () => {
    it("returns false when the parent deliberation template does not exist", async () => {
      const data: CreateExportTemplate = {
        deliberationTemplateId: "tpl-missing",
        namespace: "core",
        name: "Decision Record",
        description: "Human-readable permanent log layout",
        fields: [],
      };

      mockDecisionTemplateRepository.findById.mockResolvedValue(null);

      const result = await service.validateExportTemplateDefinition(data);

      expect(result).toBe(false);
    });

    it("returns false when an export field is not assigned to the parent deliberation template", async () => {
      const parentTemplate: DecisionTemplate = {
        id: "tpl-123",
        namespace: "core",
        name: "Standard Decision",
        description: "Parent deliberation template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-03-15T20:00:00Z",
      };

      const data: CreateExportTemplate = {
        deliberationTemplateId: parentTemplate.id,
        namespace: "core",
        name: "Decision Record",
        description: "Human-readable permanent log layout",
        fields: [
          {
            fieldId: "field-not-in-parent",
            order: 0,
            title: "Decision",
          },
        ],
      };

      mockDecisionTemplateRepository.findById.mockResolvedValue(parentTemplate);
      mockTemplateFieldAssignmentRepository.findByTemplateId.mockResolvedValue([
        {
          fieldId: "field-in-parent",
          order: 0,
          required: true,
        },
      ]);

      const result = await service.validateExportTemplateDefinition(data);

      expect(result).toBe(false);
    });

    it("returns true when all export fields are a subset of the parent deliberation template", async () => {
      const parentTemplate: DecisionTemplate = {
        id: "tpl-123",
        namespace: "core",
        name: "Standard Decision",
        description: "Parent deliberation template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-03-15T20:00:00Z",
      };

      const data: CreateExportTemplate = {
        deliberationTemplateId: parentTemplate.id,
        namespace: "core",
        name: "Decision Record",
        description: "Human-readable permanent log layout",
        fields: [
          {
            fieldId: "field-1",
            order: 0,
            title: "Decision",
          },
          {
            fieldId: "field-2",
            order: 1,
            title: "Analysis",
          },
        ],
      };

      mockDecisionTemplateRepository.findById.mockResolvedValue(parentTemplate);
      mockTemplateFieldAssignmentRepository.findByTemplateId.mockResolvedValue([
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
      ]);

      const result = await service.validateExportTemplateDefinition(data);

      expect(result).toBe(true);
    });
  });

  describe("createExportTemplate", () => {
    it("creates an export template and its field assignments when the definition is valid", async () => {
      const parentTemplate: DecisionTemplate = {
        id: "tpl-123",
        namespace: "core",
        name: "Standard Decision",
        description: "Parent deliberation template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-03-15T20:00:00Z",
      };

      const data: CreateExportTemplate = {
        deliberationTemplateId: parentTemplate.id,
        namespace: "core",
        name: "Decision Record",
        description: "Human-readable permanent log layout",
        fields: [
          {
            fieldId: "field-1",
            order: 0,
            title: "Decision",
          },
        ],
      };

      const createdTemplate = {
        id: "exp-123",
        deliberationTemplateId: parentTemplate.id,
        namespace: "core",
        name: data.name,
        description: data.description,
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-03-15T20:01:00Z",
      };

      const loadedTemplate = {
        ...createdTemplate,
        fields: [
          {
            id: "efa-123",
            exportTemplateId: "exp-123",
            fieldId: "field-1",
            order: 0,
            title: "Decision",
          },
        ],
      };

      mockDecisionTemplateRepository.findById.mockResolvedValue(parentTemplate);
      mockTemplateFieldAssignmentRepository.findByTemplateId.mockResolvedValue([
        {
          fieldId: "field-1",
          order: 0,
          required: true,
        },
      ]);
      mockExportTemplateRepository.create.mockResolvedValue(createdTemplate);
      mockExportTemplateFieldAssignmentRepository.create.mockResolvedValue({
        id: "efa-123",
        exportTemplateId: "exp-123",
        fieldId: "field-1",
        order: 0,
        title: "Decision",
      });
      mockExportTemplateRepository.findById.mockResolvedValue(loadedTemplate);

      const result = await service.createExportTemplate(data);

      expect(result).toEqual(loadedTemplate);
      expect(mockExportTemplateRepository.create).toHaveBeenCalledWith({
        ...data,
        fields: [],
      });
      expect(mockExportTemplateFieldAssignmentRepository.create).toHaveBeenCalledWith({
        exportTemplateId: "exp-123",
        fieldId: "field-1",
        order: 0,
        title: "Decision",
      });
    });

    it("throws when the export template definition is invalid", async () => {
      const data: CreateExportTemplate = {
        deliberationTemplateId: "tpl-missing",
        namespace: "core",
        name: "Decision Record",
        description: "Human-readable permanent log layout",
        fields: [],
      };

      mockDecisionTemplateRepository.findById.mockResolvedValue(null);

      await expect(service.createExportTemplate(data)).rejects.toThrow(
        "Invalid export template definition",
      );
      expect(mockExportTemplateRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("getDefaultExportTemplate", () => {
    it("returns the persisted default export template when one exists", async () => {
      const persistedDefault = {
        id: "exp-default",
        deliberationTemplateId: "tpl-123",
        namespace: "core",
        name: "Decision Record",
        description: "Persisted default export template",
        fields: [
          {
            fieldId: "field-1",
            order: 0,
          },
        ],
        version: 1,
        isDefault: true,
        isCustom: false,
        createdAt: "2026-03-15T20:01:00Z",
      };

      mockExportTemplateRepository.findDefaultByDeliberationTemplateId.mockResolvedValue(
        persistedDefault,
      );

      const result = await service.getDefaultExportTemplate("tpl-123");

      expect(result).toEqual(persistedDefault);
      expect(mockDecisionTemplateRepository.findById).not.toHaveBeenCalled();
    });

    it("derives a deterministic default export template from the parent deliberation template when none is persisted", async () => {
      const parentTemplate: DecisionTemplate = {
        id: "tpl-123",
        namespace: "core",
        name: "Standard Decision",
        description: "Parent deliberation template",
        category: "standard",
        fields: [],
        version: 2,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-03-15T20:00:00Z",
      };

      mockExportTemplateRepository.findDefaultByDeliberationTemplateId.mockResolvedValue(null);
      mockDecisionTemplateRepository.findById.mockResolvedValue(parentTemplate);
      mockTemplateFieldAssignmentRepository.findByTemplateId.mockResolvedValue([
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
      ]);

      const result = await service.getDefaultExportTemplate(parentTemplate.id);

      expect(result).toEqual({
        id: "derived-default:tpl-123",
        deliberationTemplateId: "tpl-123",
        namespace: "core",
        name: "Standard Decision Default Export",
        description: "Derived default export template for Standard Decision",
        fields: [
          {
            fieldId: "field-1",
            order: 0,
          },
          {
            fieldId: "field-2",
            order: 1,
          },
        ],
        version: 2,
        isDefault: true,
        isCustom: false,
        createdAt: "2026-03-15T20:00:00Z",
      });
    });

    it("throws when the parent deliberation template is missing and no persisted default exists", async () => {
      mockExportTemplateRepository.findDefaultByDeliberationTemplateId.mockResolvedValue(null);
      mockDecisionTemplateRepository.findById.mockResolvedValue(null);

      await expect(service.getDefaultExportTemplate("tpl-missing")).rejects.toThrow(
        "Deliberation template not found",
      );
    });
  });

  describe("getExportTemplate", () => {
    it("returns an explicitly selected export template when it belongs to the deliberation template", async () => {
      const exportTemplate = {
        id: "exp-123",
        deliberationTemplateId: "tpl-123",
        namespace: "core",
        name: "Compact Summary",
        description: "Selected export template",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-03-15T20:01:00Z",
      };

      mockExportTemplateRepository.findById.mockResolvedValue(exportTemplate);

      const result = await service.getExportTemplate("tpl-123", "exp-123");

      expect(result).toEqual(exportTemplate);
    });

    it("returns the derived default export template when explicitly selected", async () => {
      mockExportTemplateRepository.findDefaultByDeliberationTemplateId.mockResolvedValue(null);
      mockDecisionTemplateRepository.findById.mockResolvedValue({
        id: "tpl-123",
        namespace: "core",
        name: "Standard Decision",
        description: "Standard decision template",
        category: "standard",
        fields: [],
        version: 1,
        isDefault: true,
        isCustom: false,
        createdAt: "2026-03-15T20:00:00Z",
      });
      mockTemplateFieldAssignmentRepository.findByTemplateId.mockResolvedValue([
        {
          id: "assign-1",
          templateId: "tpl-123",
          fieldId: "field-1",
          order: 0,
          required: true,
        },
      ]);

      const result = await service.getExportTemplate("tpl-123", "derived-default:tpl-123");

      expect(result.id).toBe("derived-default:tpl-123");
      expect(result.deliberationTemplateId).toBe("tpl-123");
      expect(result.fields).toEqual([{ fieldId: "field-1", order: 0 }]);
      expect(mockExportTemplateRepository.findById).not.toHaveBeenCalled();
    });

    it("throws when the explicit export template does not belong to the deliberation template", async () => {
      mockExportTemplateRepository.findById.mockResolvedValue({
        id: "exp-123",
        deliberationTemplateId: "tpl-other",
        namespace: "core",
        name: "Wrong Template",
        description: "Wrong parent",
        fields: [],
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: "2026-03-15T20:01:00Z",
      });

      await expect(service.getExportTemplate("tpl-123", "exp-123")).rejects.toThrow(
        "Export template does not belong to the deliberation template",
      );
    });

    it("throws when a derived default export template belongs to a different deliberation template", async () => {
      await expect(service.getExportTemplate("tpl-123", "derived-default:tpl-other")).rejects.toThrow(
        "Export template does not belong to the deliberation template",
      );
    });
  });

  describe("validateImportPackage", () => {
    it("returns true for bundled packages without requiring known dependencies", async () => {
      const definitionPackage: ExportTemplateDefinitionPackage = {
        mode: "bundled",
        exportTemplate: {
          id: "550e8400-e29b-41d4-a716-446655440018",
          deliberationTemplateId: "550e8400-e29b-41d4-a716-446655440008",
          namespace: "core",
          name: "Decision Record",
          description: "Human-readable permanent log layout",
          fields: [
            {
              fieldId: "550e8400-e29b-41d4-a716-446655440001",
              order: 0,
            },
          ],
          version: 1,
          isDefault: true,
          isCustom: false,
          createdAt: "2026-03-15T19:45:00Z",
        },
        dependencyRefs: {
          deliberationTemplate: {
            definitionId: "550e8400-e29b-41d4-a716-446655440008",
            namespace: "core",
            name: "Standard Decision",
            version: 1,
          },
          fields: [
            {
              definitionId: "550e8400-e29b-41d4-a716-446655440001",
              namespace: "core",
              name: "decision_statement",
              version: 2,
            },
          ],
        },
        bundledDependencies: {
          deliberationTemplates: [],
          fields: [],
        },
      };

      await expect(service.validateImportPackage(definitionPackage)).resolves.toBe(true);
    });

    it("returns true for standalone packages when known dependencies are complete", async () => {
      const definitionPackage: ExportTemplateDefinitionPackage = {
        mode: "standalone",
        exportTemplate: {
          id: "550e8400-e29b-41d4-a716-446655440118",
          deliberationTemplateId: "550e8400-e29b-41d4-a716-446655440108",
          namespace: "community.pack",
          name: "Board Summary",
          description: "Compact board-facing export",
          fields: [
            {
              fieldId: "550e8400-e29b-41d4-a716-446655440101",
              order: 0,
            },
          ],
          version: 3,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-03-15T19:45:00Z",
        },
        dependencyRefs: {
          deliberationTemplate: {
            definitionId: "550e8400-e29b-41d4-a716-446655440108",
            namespace: "community.pack",
            name: "Board Deliberation",
            version: 5,
          },
          fields: [
            {
              definitionId: "550e8400-e29b-41d4-a716-446655440101",
              namespace: "community.pack",
              name: "decision_statement",
              version: 4,
            },
          ],
        },
        bundledDependencies: {
          deliberationTemplates: [],
          fields: [],
        },
      };

      await expect(
        service.validateImportPackage(definitionPackage, {
          deliberationTemplateIds: ["550e8400-e29b-41d4-a716-446655440108"],
          fieldIds: ["550e8400-e29b-41d4-a716-446655440101"],
        }),
      ).resolves.toBe(true);
    });

    it("returns false for standalone packages when known dependencies are missing", async () => {
      const definitionPackage: ExportTemplateDefinitionPackage = {
        mode: "standalone",
        exportTemplate: {
          id: "550e8400-e29b-41d4-a716-446655440118",
          deliberationTemplateId: "550e8400-e29b-41d4-a716-446655440108",
          namespace: "community.pack",
          name: "Board Summary",
          description: "Compact board-facing export",
          fields: [
            {
              fieldId: "550e8400-e29b-41d4-a716-446655440101",
              order: 0,
            },
          ],
          version: 3,
          isDefault: false,
          isCustom: false,
          createdAt: "2026-03-15T19:45:00Z",
        },
        dependencyRefs: {
          deliberationTemplate: {
            definitionId: "550e8400-e29b-41d4-a716-446655440108",
            namespace: "community.pack",
            name: "Board Deliberation",
            version: 5,
          },
          fields: [
            {
              definitionId: "550e8400-e29b-41d4-a716-446655440101",
              namespace: "community.pack",
              name: "decision_statement",
              version: 4,
            },
          ],
        },
        bundledDependencies: {
          deliberationTemplates: [],
          fields: [],
        },
      };

      await expect(
        service.validateImportPackage(definitionPackage, {
          deliberationTemplateIds: [],
          fieldIds: [],
        }),
      ).resolves.toBe(false);
    });
  });
});
