/**
 * Interface for Decision Field Repository
 * Manages the field library with extraction prompts and validation rules
 */

import { DecisionField, CreateDecisionField } from '@repo/schema';

export type DecisionFieldIdentityLookup = {
  namespace?: string;
  name: string;
  version?: number;
};

export interface IDecisionFieldRepository {
  // Basic CRUD operations
  create(data: CreateDecisionField): Promise<DecisionField>;
  findById(id: string): Promise<DecisionField | null>;
  findByIdentity(identity: DecisionFieldIdentityLookup): Promise<DecisionField | null>;
  findAll(): Promise<DecisionField[]>;
  findByCategory(category: string): Promise<DecisionField[]>;
  
  // Update operations
  update(id: string, data: Partial<CreateDecisionField>): Promise<DecisionField | null>;
  delete(id: string): Promise<boolean>;
  
  // Bulk operations
  createMany(fields: CreateDecisionField[]): Promise<DecisionField[]>;
  
  // Search and filter
  search(query: string): Promise<DecisionField[]>;
  findByType(type: string): Promise<DecisionField[]>;
}
