import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";
import type {
  DecisionContext,
  DecisionField,
  DecisionTemplate,
  Meeting,
} from "@repo/schema";
import type { IDecisionContextRepository } from "../interfaces/i-decision-context-repository";
import type { IDecisionTemplateRepository, ITemplateFieldAssignmentRepository } from "../interfaces/i-decision-template-repository";
import type { IDecisionFieldRepository } from "../interfaces/i-decision-field-repository";
import type { IMeetingRepository } from "../interfaces/i-meeting-repository";
import type { IExportTemplateService } from "../interfaces/i-export-template-service";
import { MarkdownExportService } from "../services/markdown-export-service";

describe("MarkdownExportService", () => {
  let service: MarkdownExportService;
  let mockContextRepo: Mocked<IDecisionContextRepository>;
  let mockTemplateRepo: Mocked<IDecisionTemplateRepository>;
  let mockFieldAssignmentRepo: Mocked<ITemplateFieldAssignmentRepository>;
  let mockFieldRepo: Mocked<IDecisionFieldRepository>;
  let mockMeetingRepo: Mocked<IMeetingRepository>;
  let mockExportTemplateService: Mocked<IExportTemplateService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContextRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByMeetingId: vi.fn(),
      findByFlaggedDecisionId: vi.fn(),
      update: vi.fn(),
      lockField: vi.fn(),
      unlockField: vi.fn(),
      lockAllFields: vi.fn(),
      setActiveField: vi.fn(),
      updateStatus: vi.fn(),
    };

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

    mockFieldRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByIdentity: vi.fn(),
      findAll: vi.fn(),
      findByCategory: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMany: vi.fn(),
      search: vi.fn(),
      findByType: vi.fn(),
    };

    mockMeetingRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
    };

    mockExportTemplateService = {
      createExportTemplate: vi.fn(),
      getExportTemplate: vi.fn(),
      getExportTemplatesForDeliberationTemplate: vi.fn(),
      getDefaultExportTemplate: vi.fn(),
      validateExportTemplateDefinition: vi.fn(),
      validateImportPackage: vi.fn(),
    };

    service = new MarkdownExportService(
      mockContextRepo,
      mockTemplateRepo,
      mockFieldAssignmentRepo,
      mockFieldRepo,
      mockMeetingRepo,
      mockExportTemplateService,
    );
  });

  const context: DecisionContext = {
    id: "ctx-123",
    meetingId: "mtg-123",
    templateId: "tpl-123",
    flaggedDecisionId: null,
    title: "Ship export templates",
    activeField: null,
    lockedFields: [],
    draftData: {
      "field-1": "Use export templates for markdown output",
      "field-2": "Improves human readability",
    },
    draftVersions: [],
    status: "draft",
    createdAt: "2026-03-15T20:00:00Z",
    updatedAt: "2026-03-15T20:05:00Z",
  };

  const meeting: Meeting = {
    id: "mtg-123",
    title: "Platform Decisions",
    date: "2026-03-15T19:00:00Z",
    participants: ["Alex", "Sam"],
    status: "ended",
    createdAt: "2026-03-15T18:00:00Z",
  };

  const template: DecisionTemplate = {
    id: "tpl-123",
    namespace: "core",
    name: "Standard Decision",
    description: "Parent deliberation template",
    category: "standard",
    fields: [],
    version: 1,
    isDefault: false,
    isCustom: false,
    createdAt: "2026-03-15T18:00:00Z",
  };

  const decisionField: DecisionField = {
    id: "field-1",
    namespace: "core",
    name: "decision_statement",
    description: "Decision statement",
    extractionPrompt: "Capture the decision",
    instructions: "",
    category: "summary",
    fieldType: "textarea",
    placeholder: "",
    version: 1,
    isCustom: false,
    createdAt: "2026-03-15T18:00:00Z",
  };

  const analysisField: DecisionField = {
    id: "field-2",
    namespace: "core",
    name: "analysis_notes",
    description: "Analysis notes",
    extractionPrompt: "Capture analysis",
    instructions: "",
    category: "analysis",
    fieldType: "textarea",
    placeholder: "",
    version: 1,
    isCustom: false,
    createdAt: "2026-03-15T18:00:00Z",
  };

  it("uses export-template titles when present and preserves export ordering", async () => {
    mockContextRepo.findById.mockResolvedValue(context);
    mockTemplateRepo.findById.mockResolvedValue(template);
    mockMeetingRepo.findById.mockResolvedValue(meeting);
    mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue([
      {
        fieldId: "field-2",
        order: 0,
        required: false,
      },
      {
        fieldId: "field-1",
        order: 1,
        required: true,
      },
    ]);
    mockFieldRepo.findById.mockImplementation(async (id) => {
      if (id === "field-1") return decisionField;
      if (id === "field-2") return analysisField;
      return null;
    });
    mockExportTemplateService.getDefaultExportTemplate.mockResolvedValue({
      id: "exp-default",
      deliberationTemplateId: "tpl-123",
      namespace: "core",
      name: "Standard Decision Default Export",
      description: "Derived default export template for Standard Decision",
      fields: [
        {
          fieldId: "field-2",
          order: 0,
          title: "Analysis Notes",
        },
        {
          fieldId: "field-1",
          order: 1,
          title: "Decision Statement",
        },
      ],
      version: 1,
      isDefault: true,
      isCustom: false,
      createdAt: "2026-03-15T18:00:00Z",
    });

    const markdown = await service.exportToMarkdown("ctx-123", {
      includeMetadata: false,
      includeTimestamps: false,
      includeParticipants: false,
    });

    expect(markdown).toContain("## Analysis Notes");
    expect(markdown).toContain("## Decision Statement");
    expect(markdown.indexOf("## Analysis Notes")).toBeLessThan(
      markdown.indexOf("## Decision Statement"),
    );
  });

  it("falls back to formatted field names for human-readable headings", async () => {
    mockContextRepo.findById.mockResolvedValue(context);
    mockTemplateRepo.findById.mockResolvedValue(template);
    mockMeetingRepo.findById.mockResolvedValue(meeting);
    mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue([
      {
        fieldId: "field-1",
        order: 0,
        required: true,
      },
    ]);
    mockFieldRepo.findById.mockResolvedValue(decisionField);
    mockExportTemplateService.getDefaultExportTemplate.mockResolvedValue({
      id: "exp-default",
      deliberationTemplateId: "tpl-123",
      namespace: "core",
      name: "Standard Decision Default Export",
      description: "Derived default export template for Standard Decision",
      fields: [
        {
          fieldId: "field-1",
          order: 0,
        },
      ],
      version: 1,
      isDefault: true,
      isCustom: false,
      createdAt: "2026-03-15T18:00:00Z",
    });

    const markdown = await service.exportToMarkdown("ctx-123", {
      includeMetadata: false,
      includeTimestamps: false,
      includeParticipants: false,
    });

    expect(markdown).toContain("## Decision Statement");
    expect(markdown).not.toContain("## decision_statement");
  });

  it("renders preamble before the # Decision heading when template has a preamble", async () => {
    mockContextRepo.findById.mockResolvedValue({
      ...context,
      id: "5f9f814e-3eda-429a-81d1-222ac47ac6f0",
      flaggedDecisionId: "fd-abc",
      status: "logged",
      title: "Adopt ADR Process",
      createdAt: "2026-03-16T10:00:00Z",
    });
    mockTemplateRepo.findById.mockResolvedValue(template);
    mockMeetingRepo.findById.mockResolvedValue(meeting);
    mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue([
      { fieldId: "field-1", order: 0, required: true },
    ]);
    mockFieldRepo.findById.mockResolvedValue(decisionField);
    mockExportTemplateService.getDefaultExportTemplate.mockResolvedValue({
      id: "exp-adr",
      deliberationTemplateId: "tpl-123",
      namespace: "core",
      name: "ADR Export",
      description: "ADR export with frontmatter",
      preamble: "---\ndecision-id: {{decision-id}}\ndate: {{date}}\nslug: {{slug}}\nstatus: {{status}}\n---",
      fields: [{ fieldId: "field-1", order: 0, title: "Decision Statement" }],
      version: 1,
      isDefault: false,
      isCustom: false,
      createdAt: "2026-03-16T10:00:00Z",
    });

    const markdown = await service.exportToMarkdown("ctx-123", {
      includeMetadata: false,
    });

    expect(markdown).toMatch(/^---\n/);
    expect(markdown).toContain("decision-id: 5f9f814e-3eda-429a-81d1-222ac47ac6f0");
    expect(markdown).toContain("date: 2026-03-16");
    expect(markdown).toContain("slug: adopt-adr-process");
    expect(markdown).toContain("status: logged");
    expect(markdown).toContain("---\n\n# Decision:");
    // preamble must appear before the heading
    expect(markdown.indexOf("---")).toBeLessThan(markdown.indexOf("# Decision:"));
  });

  it("substitutes {{title}} variable in preamble", async () => {
    mockContextRepo.findById.mockResolvedValue({
      ...context,
      title: "Use PostgreSQL",
    });
    mockTemplateRepo.findById.mockResolvedValue(template);
    mockMeetingRepo.findById.mockResolvedValue(meeting);
    mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue([
      { fieldId: "field-1", order: 0, required: true },
    ]);
    mockFieldRepo.findById.mockResolvedValue(decisionField);
    mockExportTemplateService.getDefaultExportTemplate.mockResolvedValue({
      id: "exp-title",
      deliberationTemplateId: "tpl-123",
      namespace: "core",
      name: "Title Export",
      description: "Export with title var",
      preamble: "title: {{title}}",
      fields: [{ fieldId: "field-1", order: 0 }],
      version: 1,
      isDefault: false,
      isCustom: false,
      createdAt: "2026-03-16T10:00:00Z",
    });

    const markdown = await service.exportToMarkdown("ctx-123", { includeMetadata: false });

    expect(markdown).toContain("title: Use PostgreSQL");
  });

  it("leaves unknown variables unreplaced when preamble contains missing vars", async () => {
    mockContextRepo.findById.mockResolvedValue(context);
    mockTemplateRepo.findById.mockResolvedValue(template);
    mockMeetingRepo.findById.mockResolvedValue(meeting);
    mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue([
      { fieldId: "field-1", order: 0, required: true },
    ]);
    mockFieldRepo.findById.mockResolvedValue(decisionField);
    mockExportTemplateService.getDefaultExportTemplate.mockResolvedValue({
      id: "exp-unknown",
      deliberationTemplateId: "tpl-123",
      namespace: "core",
      name: "Unknown Var Export",
      description: "Has unknown var",
      preamble: "foo: {{unknown-var}}\nbar: {{date}}",
      fields: [{ fieldId: "field-1", order: 0 }],
      version: 1,
      isDefault: false,
      isCustom: false,
      createdAt: "2026-03-16T10:00:00Z",
    });

    const markdown = await service.exportToMarkdown("ctx-123", { includeMetadata: false });

    expect(markdown).toContain("foo: {{unknown-var}}");
    expect(markdown).toContain("bar: 2026-03-15");
  });

  it("does not prepend preamble when template has no preamble field", async () => {
    mockContextRepo.findById.mockResolvedValue(context);
    mockTemplateRepo.findById.mockResolvedValue(template);
    mockMeetingRepo.findById.mockResolvedValue(meeting);
    mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue([
      { fieldId: "field-1", order: 0, required: true },
    ]);
    mockFieldRepo.findById.mockResolvedValue(decisionField);
    mockExportTemplateService.getDefaultExportTemplate.mockResolvedValue({
      id: "exp-default",
      deliberationTemplateId: "tpl-123",
      namespace: "core",
      name: "Standard Decision Default Export",
      description: "Derived default export template for Standard Decision",
      fields: [{ fieldId: "field-1", order: 0, title: "Decision Statement" }],
      version: 1,
      isDefault: true,
      isCustom: false,
      createdAt: "2026-03-15T18:00:00Z",
    });

    const markdown = await service.exportToMarkdown("ctx-123", { includeMetadata: false });

    expect(markdown).toMatch(/^# Decision:/);
  });

  it("uses an explicitly selected export template when exportTemplateId is provided", async () => {
    mockContextRepo.findById.mockResolvedValue(context);
    mockTemplateRepo.findById.mockResolvedValue(template);
    mockMeetingRepo.findById.mockResolvedValue(meeting);
    mockFieldAssignmentRepo.findByTemplateId.mockResolvedValue([
      {
        fieldId: "field-1",
        order: 0,
        required: true,
      },
    ]);
    mockFieldRepo.findById.mockResolvedValue(decisionField);
    mockExportTemplateService.getExportTemplate.mockResolvedValue({
      id: "exp-selected",
      deliberationTemplateId: "tpl-123",
      namespace: "core",
      name: "Compact Summary",
      description: "Explicitly selected export template",
      fields: [
        {
          fieldId: "field-1",
          order: 0,
          title: "Chosen Heading",
        },
      ],
      version: 1,
      isDefault: false,
      isCustom: false,
      createdAt: "2026-03-15T18:00:00Z",
    });

    const markdown = await service.exportToMarkdown("ctx-123", {
      exportTemplateId: "exp-selected",
      includeMetadata: false,
      includeTimestamps: false,
      includeParticipants: false,
    });

    expect(markdown).toContain("## Chosen Heading");
    expect(mockExportTemplateService.getExportTemplate).toHaveBeenCalledWith(
      "tpl-123",
      "exp-selected",
    );
    expect(mockExportTemplateService.getDefaultExportTemplate).not.toHaveBeenCalled();
  });
});
