import type {
  CreateExportTemplate,
  ExportTemplate,
  ExportTemplateDefinitionPackage,
} from "@repo/schema";

export interface IExportTemplateService {
  createExportTemplate(data: CreateExportTemplate): Promise<ExportTemplate>;
  getExportTemplate(
    deliberationTemplateId: string,
    exportTemplateId: string,
  ): Promise<ExportTemplate>;
  getDefaultExportTemplate(deliberationTemplateId: string): Promise<ExportTemplate>;
  getExportTemplatesForDeliberationTemplate(deliberationTemplateId: string): Promise<ExportTemplate[]>;
  validateImportPackage(
    definitionPackage: ExportTemplateDefinitionPackage,
    knownDependencyIds?: {
      deliberationTemplateIds?: string[];
      fieldIds?: string[];
    },
  ): Promise<boolean>;
  validateExportTemplateDefinition(data: CreateExportTemplate): Promise<boolean>;
}
