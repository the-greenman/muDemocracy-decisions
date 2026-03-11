/**
 * Interface for Decision Template Service
 * Manages decision templates and their field assignments
 */

import type {
  DecisionTemplate,
  CreateDecisionTemplate,
  TemplateFieldAssignment,
  CreateTemplateFieldAssignment,
} from "@repo/schema";
import type { DecisionTemplateIdentityLookup } from "./i-decision-template-repository";

export interface IDecisionTemplateService {
  // Template CRUD operations
  createTemplate(data: CreateDecisionTemplate): Promise<DecisionTemplate>;
  getTemplate(id: string): Promise<DecisionTemplate | null>;
  getTemplateByIdentity(identity: DecisionTemplateIdentityLookup): Promise<DecisionTemplate | null>;
  getAllTemplates(): Promise<DecisionTemplate[]>;
  getDefaultTemplate(): Promise<DecisionTemplate | null>;
  setDefaultTemplate(id: string): Promise<DecisionTemplate>;
  updateTemplate(
    id: string,
    data: Partial<CreateDecisionTemplate>,
  ): Promise<DecisionTemplate | null>;
  deleteTemplate(id: string): Promise<boolean>;

  // Template queries
  getTemplatesByCategory(category: string): Promise<DecisionTemplate[]>;
  searchTemplates(query: string): Promise<DecisionTemplate[]>;
  getTemplateCategories(): Promise<string[]>;

  // Field assignment operations
  addFieldToTemplate(
    templateId: string,
    assignment: CreateTemplateFieldAssignment,
  ): Promise<TemplateFieldAssignment>;
  removeFieldFromTemplate(templateId: string, fieldId: string): Promise<boolean>;
  updateFieldAssignment(
    templateId: string,
    fieldId: string,
    data: Partial<CreateTemplateFieldAssignment>,
  ): Promise<TemplateFieldAssignment | null>;
  getTemplateFields(templateId: string): Promise<TemplateFieldAssignment[]>;
  reorderTemplateFields(
    templateId: string,
    fieldOrders: { fieldId: string; order: number }[],
  ): Promise<void>;

  // Bulk operations
  createTemplateWithFields(
    templateData: CreateDecisionTemplate,
    fieldAssignments: CreateTemplateFieldAssignment[],
  ): Promise<DecisionTemplate>;

  // Validation
  validateTemplateDefinition(template: CreateDecisionTemplate): Promise<boolean>;
  validateFieldAssignments(assignments: CreateTemplateFieldAssignment[]): Promise<boolean>;

  // Seeding
  seedTemplates(templates: CreateDecisionTemplate[]): Promise<DecisionTemplate[]>;
}
