/**
 * Interface for Expert Template Repository
 * Manages expert templates with MCP access configuration
 */

import type { ExpertTemplate, CreateExpertTemplate, UpdateExpertTemplate } from "@repo/schema";

export interface IExpertTemplateRepository {
  // Basic CRUD operations
  create(data: CreateExpertTemplate): Promise<ExpertTemplate>;
  findById(id: string): Promise<ExpertTemplate | null>;
  findAll(): Promise<ExpertTemplate[]>;
  findByType(type: string): Promise<ExpertTemplate[]>;
  findActive(): Promise<ExpertTemplate[]>;
  update(id: string, data: UpdateExpertTemplate): Promise<ExpertTemplate | null>;
  delete(id: string): Promise<boolean>;

  // Search operations
  search(query: string): Promise<ExpertTemplate[]>;

  // Bulk operations
  createMany(templates: CreateExpertTemplate[]): Promise<ExpertTemplate[]>;
}
