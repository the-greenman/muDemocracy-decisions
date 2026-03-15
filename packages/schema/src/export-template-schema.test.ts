import { describe, expect, it } from "vitest";
import {
  CreateExportTemplateSchema,
  ExportTemplateDefinitionPackageSchema,
  ExportTemplateFieldAssignmentSchema,
  ExportTemplateSchema,
} from "./index";

describe("ExportTemplateSchema", () => {
  it("accepts a valid export template with identity, parent linkage, and metadata", () => {
    const result = ExportTemplateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440018",
      deliberationTemplateId: "550e8400-e29b-41d4-a716-446655440008",
      namespace: "core",
      name: "Decision Record",
      description: "Human-readable permanent log layout",
      fields: [
        {
          fieldId: "550e8400-e29b-41d4-a716-446655440005",
          order: 0,
          title: "Analysis",
        },
      ],
      version: 2,
      isDefault: true,
      isCustom: false,
      lineage: {
        sourceDefinitionId: "550e8400-e29b-41d4-a716-446655440018",
        sourceVersion: 1,
      },
      provenance: {
        publisher: "core",
        sourcePackage: "core-template-library",
        importedAt: "2026-03-15T19:45:00Z",
      },
      createdAt: "2026-03-15T19:45:00Z",
    });

    expect(result.success).toBe(true);
  });

  it("requires a parent deliberation template reference", () => {
    const result = CreateExportTemplateSchema.safeParse({
      namespace: "core",
      name: "Decision Record",
      description: "Human-readable permanent log layout",
      fields: [],
    });

    expect(result.success).toBe(false);
  });

  it("supports ordered field assignments with optional presentation title", () => {
    const result = ExportTemplateFieldAssignmentSchema.safeParse({
      fieldId: "550e8400-e29b-41d4-a716-446655440005",
      order: 1,
      title: "Key Analysis",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid assignment ordering", () => {
    const result = ExportTemplateFieldAssignmentSchema.safeParse({
      fieldId: "550e8400-e29b-41d4-a716-446655440005",
      order: -1,
    });

    expect(result.success).toBe(false);
  });

  it("accepts provenance and lineage metadata in create payloads", () => {
    const result = CreateExportTemplateSchema.safeParse({
      deliberationTemplateId: "550e8400-e29b-41d4-a716-446655440008",
      namespace: "community.pack",
      name: "Board Summary",
      description: "Compact board-facing export",
      fields: [
        {
          fieldId: "550e8400-e29b-41d4-a716-446655440001",
          order: 0,
          title: "Decision",
        },
      ],
      lineage: {
        sourceDefinitionId: "550e8400-e29b-41d4-a716-446655440099",
        sourceVersion: 3,
        forkedFromDefinitionId: "550e8400-e29b-41d4-a716-446655440098",
        forkedFromVersion: 2,
      },
      provenance: {
        publisher: "community.pack",
        sourcePackage: "community-export-templates",
        importedAt: "2026-03-15T19:45:00Z",
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a bundled export-template definition package with explicit dependencies", () => {
    const result = ExportTemplateDefinitionPackageSchema.safeParse({
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
            title: "Decision",
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
        deliberationTemplates: [
          {
            id: "550e8400-e29b-41d4-a716-446655440008",
            namespace: "core",
            name: "Standard Decision",
            description: "General decision template",
            category: "standard",
            fields: [
              {
                fieldId: "550e8400-e29b-41d4-a716-446655440001",
                order: 0,
                required: true,
              },
            ],
            version: 1,
            isDefault: true,
            isCustom: false,
            createdAt: "2026-03-15T19:45:00Z",
          },
        ],
        fields: [
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            namespace: "core",
            name: "decision_statement",
            description: "The decision",
            category: "outcome",
            extractionPrompt: "Extract the decision",
            fieldType: "textarea",
            version: 2,
            isCustom: false,
            createdAt: "2026-03-15T19:45:00Z",
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a standalone export-template definition package when dependency references are complete", () => {
    const result = ExportTemplateDefinitionPackageSchema.safeParse({
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
            title: "Decision",
          },
        ],
        version: 3,
        isDefault: false,
        isCustom: false,
        lineage: {
          sourceDefinitionId: "550e8400-e29b-41d4-a716-446655440117",
          sourceVersion: 2,
        },
        provenance: {
          publisher: "community.pack",
          sourcePackage: "community-export-templates",
          importedAt: "2026-03-15T19:45:00Z",
        },
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
    });

    expect(result.success).toBe(true);
  });

  it("rejects bundled packages with missing dependencies", () => {
    const result = ExportTemplateDefinitionPackageSchema.safeParse({
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
    });

    expect(result.success).toBe(false);
  });
});
