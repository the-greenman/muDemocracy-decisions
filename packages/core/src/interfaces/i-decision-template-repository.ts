/**
 * Interface for Decision Template Repository
 * Manages decision templates with field assignments
 */

import type { 
  DecisionTemplate,
  CreateDecisionTemplate,
  TemplateFieldAssignment
} from '@repo/schema';
import type { TemplateFieldAssignmentInsert } from '@repo/db';

export type DecisionTemplateIdentityLookup = {
  namespace?: string;
  name: string;
  version?: number;
};

export interface IDecisionTemplateRepository {
  // Basic CRUD operations
  create(data: CreateDecisionTemplate): Promise<DecisionTemplate>;
  findById(id: string): Promise<DecisionTemplate | null>;
  findByIdentity(identity: DecisionTemplateIdentityLookup): Promise<DecisionTemplate | null>;
  findAll(): Promise<DecisionTemplate[]>;
  findDefault(): Promise<DecisionTemplate | null>;
  setDefault(id: string): Promise<DecisionTemplate>;
  update(id: string, data: Partial<CreateDecisionTemplate>): Promise<DecisionTemplate | null>;
  delete(id: string): Promise<boolean>;
  
  // Query operations
  findByCategory(category: string): Promise<DecisionTemplate[]>;
  findByName(name: string): Promise<DecisionTemplate | null>;
  search(query: string): Promise<DecisionTemplate[]>;
  
  // Bulk operations
  createMany(templates: CreateDecisionTemplate[]): Promise<DecisionTemplate[]>;
}

export interface ITemplateFieldAssignmentRepository {
  // Field assignment operations
  create(data: TemplateFieldAssignmentInsert): Promise<TemplateFieldAssignment>;
  findByTemplateId(templateId: string): Promise<TemplateFieldAssignment[]>;
  findByFieldId(fieldId: string): Promise<TemplateFieldAssignment[]>;
  update(templateId: string, fieldId: string, data: Partial<TemplateFieldAssignmentInsert>): Promise<TemplateFieldAssignment | null>;
  delete(templateId: string, fieldId: string): Promise<boolean>;
  deleteByTemplateId(templateId: string): Promise<boolean>;
  
  // Bulk operations
  createMany(assignments: TemplateFieldAssignmentInsert[]): Promise<TemplateFieldAssignment[]>;
  updateOrder(templateId: string, assignments: { fieldId: string; order: number }[]): Promise<void>;
}
