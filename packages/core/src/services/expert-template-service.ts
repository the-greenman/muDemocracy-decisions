/**
 * Expert Template Service
 * Manages expert templates with MCP access configuration
 */

import type { 
  ExpertTemplate,
  CreateExpertTemplate,
  UpdateExpertTemplate,
} from '@repo/schema';
import type { IExpertTemplateRepository } from '../interfaces/i-expert-template-repository';
import { logger } from '../logger';

export interface IExpertTemplateService {
  // Basic CRUD operations
  createTemplate(data: CreateExpertTemplate): Promise<ExpertTemplate>;
  getTemplate(id: string): Promise<ExpertTemplate | null>;
  getAllTemplates(): Promise<ExpertTemplate[]>;
  getTemplatesByType(type: string): Promise<ExpertTemplate[]>;
  getActiveTemplates(): Promise<ExpertTemplate[]>;
  updateTemplate(id: string, data: UpdateExpertTemplate): Promise<ExpertTemplate | null>;
  deleteTemplate(id: string): Promise<boolean>;
  
  // Search operations
  searchTemplates(query: string): Promise<ExpertTemplate[]>;
  
  // Bulk operations
  createManyTemplates(templates: CreateExpertTemplate[]): Promise<ExpertTemplate[]>;
  
  // Validation
  validateTemplate(template: CreateExpertTemplate): Promise<{ isValid: boolean; errors: string[] }>;
}

export class ExpertTemplateService implements IExpertTemplateService {
  constructor(private repository: IExpertTemplateRepository) {}

  async createTemplate(data: CreateExpertTemplate): Promise<ExpertTemplate> {
    logger.info('Creating expert template', { name: data.name, type: data.type });
    
    // Validate the template
    const validation = await this.validateTemplate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }
    
    const template = await this.repository.create(data);
    logger.info('Expert template created successfully', { id: template.id });
    
    return template;
  }

  async getTemplate(id: string): Promise<ExpertTemplate | null> {
    logger.debug('Getting expert template', { id });
    return await this.repository.findById(id);
  }

  async getAllTemplates(): Promise<ExpertTemplate[]> {
    logger.debug('Getting all expert templates');
    return await this.repository.findAll();
  }

  async getTemplatesByType(type: string): Promise<ExpertTemplate[]> {
    logger.debug('Getting expert templates by type', { type });
    return await this.repository.findByType(type);
  }

  async getActiveTemplates(): Promise<ExpertTemplate[]> {
    logger.debug('Getting active expert templates');
    return await this.repository.findActive();
  }

  async updateTemplate(id: string, data: UpdateExpertTemplate): Promise<ExpertTemplate | null> {
    logger.info('Updating expert template', { id });
    
    const existing = await this.repository.findById(id);
    if (!existing) {
      logger.warn('Expert template not found for update', { id });
      return null;
    }
    
    const updated = await this.repository.update(id, data);
    if (updated) {
      logger.info('Expert template updated successfully', { id });
    }
    
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    logger.info('Deleting expert template', { id });
    
    const existing = await this.repository.findById(id);
    if (!existing) {
      logger.warn('Expert template not found for deletion', { id });
      return false;
    }
    
    const deleted = await this.repository.delete(id);
    if (deleted) {
      logger.info('Expert template deleted successfully', { id });
    }
    
    return deleted;
  }

  async searchTemplates(query: string): Promise<ExpertTemplate[]> {
    logger.debug('Searching expert templates', { query });
    return await this.repository.search(query);
  }

  async createManyTemplates(templates: CreateExpertTemplate[]): Promise<ExpertTemplate[]> {
    logger.info('Creating multiple expert templates', { count: templates.length });
    
    // Validate all templates
    for (const template of templates) {
      const validation = await this.validateTemplate(template);
      if (!validation.isValid) {
        throw new Error(`Invalid template ${template.name}: ${validation.errors.join(', ')}`);
      }
    }
    
    const created = await this.repository.createMany(templates);
    logger.info('Multiple expert templates created successfully', { count: created.length });
    
    return created;
  }

  async validateTemplate(template: CreateExpertTemplate): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Name validation
    if (!template.name || template.name.trim().length === 0) {
      errors.push('Name is required');
    }
    
    // Type validation
    if (!template.type || !['technical', 'legal', 'stakeholder', 'custom'].includes(template.type)) {
      errors.push('Type must be one of: technical, legal, stakeholder, custom');
    }
    
    // Prompt template validation
    if (!template.promptTemplate || template.promptTemplate.trim().length === 0) {
      errors.push('Prompt template is required');
    }
    
    // MCP access validation - ensure all referenced MCP servers exist
    if (template.mcpAccess && template.mcpAccess.length > 0) {
      // This would require injecting MCP server repository
      // For now, just validate format
      for (const mcpName of template.mcpAccess) {
        if (!mcpName || mcpName.trim().length === 0) {
          errors.push(`Invalid MCP server name: ${mcpName}`);
        }
      }
    }
    
    // Output schema validation if provided
    if (template.outputSchema && typeof template.outputSchema !== 'object') {
      errors.push('Output schema must be an object');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
