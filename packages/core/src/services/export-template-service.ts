import type {
  CreateExportTemplate,
  ExportTemplate,
  ExportTemplateDefinitionPackage,
} from "@repo/schema";
import type { IDecisionTemplateRepository, ITemplateFieldAssignmentRepository } from "../interfaces/i-decision-template-repository";
import type {
  IExportTemplateFieldAssignmentRepository,
  IExportTemplateRepository,
} from "../interfaces/i-export-template-repository";
import type { IExportTemplateService } from "../interfaces/i-export-template-service";

export class ExportTemplateService implements IExportTemplateService {
  constructor(
    private deliberationTemplateRepository: IDecisionTemplateRepository,
    private deliberationFieldAssignmentRepository: ITemplateFieldAssignmentRepository,
    private exportTemplateRepository: IExportTemplateRepository,
    private exportTemplateFieldAssignmentRepository: IExportTemplateFieldAssignmentRepository,
  ) {}

  async createExportTemplate(data: CreateExportTemplate): Promise<ExportTemplate> {
    const isValid = await this.validateExportTemplateDefinition(data);
    if (!isValid) {
      throw new Error("Invalid export template definition");
    }

    const { fields } = data;
    const exportTemplate = await this.exportTemplateRepository.create({
      ...data,
      fields: [],
    });

    for (const field of fields) {
      await this.exportTemplateFieldAssignmentRepository.create({
        exportTemplateId: exportTemplate.id,
        fieldId: field.fieldId,
        order: field.order,
        ...(field.title !== undefined ? { title: field.title } : {}),
      });
    }

    const created = await this.exportTemplateRepository.findById(exportTemplate.id);
    if (!created) {
      throw new Error("Failed to load created export template");
    }

    return created;
  }

  async getExportTemplate(
    deliberationTemplateId: string,
    exportTemplateId: string,
  ): Promise<ExportTemplate> {
    if (exportTemplateId.startsWith("derived-default:")) {
      if (exportTemplateId !== `derived-default:${deliberationTemplateId}`) {
        throw new Error("Export template does not belong to the deliberation template");
      }

      return this.getDefaultExportTemplate(deliberationTemplateId);
    }

    const exportTemplate = await this.exportTemplateRepository.findById(exportTemplateId);
    if (!exportTemplate) {
      throw new Error("Invalid export template selection");
    }

    if (exportTemplate.deliberationTemplateId !== deliberationTemplateId) {
      throw new Error("Export template does not belong to the deliberation template");
    }

    return exportTemplate;
  }

  async getExportTemplatesForDeliberationTemplate(
    deliberationTemplateId: string,
  ): Promise<ExportTemplate[]> {
    const persistedTemplates = await this.exportTemplateRepository.findByDeliberationTemplateId(
      deliberationTemplateId,
    );

    if (persistedTemplates.length > 0) {
      return persistedTemplates;
    }

    return [await this.getDefaultExportTemplate(deliberationTemplateId)];
  }

  async getDefaultExportTemplate(deliberationTemplateId: string): Promise<ExportTemplate> {
    const persistedDefault = await this.exportTemplateRepository.findDefaultByDeliberationTemplateId(
      deliberationTemplateId,
    );

    if (persistedDefault) {
      return persistedDefault;
    }

    const parentTemplate =
      await this.deliberationTemplateRepository.findById(deliberationTemplateId);
    if (!parentTemplate) {
      throw new Error("Deliberation template not found");
    }

    const parentAssignments = await this.deliberationFieldAssignmentRepository.findByTemplateId(
      deliberationTemplateId,
    );

    return {
      id: `derived-default:${parentTemplate.id}`,
      deliberationTemplateId: parentTemplate.id,
      namespace: parentTemplate.namespace,
      name: `${parentTemplate.name} Default Export`,
      description: `Derived default export template for ${parentTemplate.name}`,
      fields: parentAssignments.map((assignment) => ({
        fieldId: assignment.fieldId,
        order: assignment.order,
      })),
      version: parentTemplate.version,
      isDefault: true,
      isCustom: false,
      createdAt: parentTemplate.createdAt,
    };
  }

  async validateExportTemplateDefinition(data: CreateExportTemplate): Promise<boolean> {
    if (!data.name?.trim()) {
      return false;
    }

    if (!data.description?.trim()) {
      return false;
    }

    const parentTemplate =
      await this.deliberationTemplateRepository.findById(data.deliberationTemplateId);
    if (!parentTemplate) {
      return false;
    }

    const parentAssignments = await this.deliberationFieldAssignmentRepository.findByTemplateId(
      data.deliberationTemplateId,
    );
    const parentFieldIds = new Set(parentAssignments.map((assignment) => assignment.fieldId));

    const exportFieldIds = data.fields.map((field) => field.fieldId);
    if (exportFieldIds.length !== new Set(exportFieldIds).size) {
      return false;
    }

    const sortedFields = [...data.fields].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedFields.length; i++) {
      const field = sortedFields[i];
      if (!field) {
        return false;
      }

      if (field.order !== i) {
        return false;
      }

      if (!parentFieldIds.has(field.fieldId)) {
        return false;
      }
    }

    return true;
  }

  async validateImportPackage(
    definitionPackage: ExportTemplateDefinitionPackage,
    knownDependencyIds?: {
      deliberationTemplateIds?: string[];
      fieldIds?: string[];
    },
  ): Promise<boolean> {
    if (definitionPackage.mode === "bundled") {
      return true;
    }

    const knownTemplateIds = new Set(knownDependencyIds?.deliberationTemplateIds ?? []);
    const knownFieldIds = new Set(knownDependencyIds?.fieldIds ?? []);

    if (!knownTemplateIds.has(definitionPackage.dependencyRefs.deliberationTemplate.definitionId)) {
      return false;
    }

    for (const fieldRef of definitionPackage.dependencyRefs.fields) {
      if (!knownFieldIds.has(fieldRef.definitionId)) {
        return false;
      }
    }

    return true;
  }
}
