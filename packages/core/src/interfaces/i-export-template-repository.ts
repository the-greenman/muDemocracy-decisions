import type {
  CreateExportTemplate,
  ExportTemplate,
  ExportTemplateFieldAssignment,
} from "@repo/schema";

export type ExportTemplateFieldAssignmentInsert = {
  exportTemplateId: string;
  fieldId: string;
  order: number;
  title?: string;
};

export interface IExportTemplateRepository {
  create(data: CreateExportTemplate): Promise<ExportTemplate>;
  findById(id: string): Promise<ExportTemplate | null>;
  findByDeliberationTemplateId(deliberationTemplateId: string): Promise<ExportTemplate[]>;
  findDefaultByDeliberationTemplateId(deliberationTemplateId: string): Promise<ExportTemplate | null>;
}

export interface IExportTemplateFieldAssignmentRepository {
  create(data: ExportTemplateFieldAssignmentInsert): Promise<ExportTemplateFieldAssignment>;
  findByExportTemplateId(exportTemplateId: string): Promise<ExportTemplateFieldAssignment[]>;
}
