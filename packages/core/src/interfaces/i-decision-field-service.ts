/**
 * Interface for Decision Field Service
 * Manages the field library with extraction prompts and validation rules
 */

import { DecisionField, CreateDecisionField } from "@repo/schema";
import type { DecisionFieldIdentityLookup } from "./i-decision-field-repository";

export interface IDecisionFieldService {
  // Field management
  createField(data: CreateDecisionField): Promise<DecisionField>;
  getField(id: string): Promise<DecisionField | null>;
  getFieldByIdentity(identity: DecisionFieldIdentityLookup): Promise<DecisionField | null>;
  getAllFields(): Promise<DecisionField[]>;
  getFieldsByCategory(category: string): Promise<DecisionField[]>;
  getFieldsByType(type: string): Promise<DecisionField[]>;

  // Field updates
  updateField(id: string, data: Partial<CreateDecisionField>): Promise<DecisionField | null>;
  deleteField(id: string): Promise<boolean>;

  // Search and discovery
  searchFields(query: string): Promise<DecisionField[]>;
  getFieldCategories(): Promise<string[]>;
  getFieldTypes(): Promise<string[]>;

  // Bulk operations for seeding
  seedFields(fields: CreateDecisionField[]): Promise<DecisionField[]>;

  // Field validation
  validateFieldDefinition(field: CreateDecisionField): Promise<boolean>;
  getValidationSchema(fieldId: string): Promise<any>;
}
