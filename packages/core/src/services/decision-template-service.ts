/**
 * Decision Template Service
 * Manages decision templates and their field assignments
 */

import type { 
  DecisionTemplate,
  CreateDecisionTemplate,
  TemplateFieldAssignment,
  CreateTemplateFieldAssignment
} from '@repo/schema';
import type { IDecisionTemplateService } from '../interfaces/i-decision-template-service';
import type { IDecisionTemplateRepository, ITemplateFieldAssignmentRepository } from '../interfaces/i-decision-template-repository';
import type { TemplateFieldAssignmentInsert } from '@repo/db';

export class DecisionTemplateService implements IDecisionTemplateService {
  constructor(
    private templateRepository: IDecisionTemplateRepository,
    private fieldAssignmentRepository: ITemplateFieldAssignmentRepository
  ) {}

  async createTemplate(data: CreateDecisionTemplate): Promise<DecisionTemplate> {
    // Validate template definition
    const isValid = await this.validateTemplateDefinition(data);
    if (!isValid) {
      throw new Error('Invalid template definition');
    }

    // Create template without fields first
    const { fields, ...templateData } = data;
    const template = await this.templateRepository.create({
      ...templateData,
      fields: [], // Always provide empty fields array for creation
    });

    // If fields are provided, create them
    if (fields && fields.length > 0) {
      const fieldAssignments: TemplateFieldAssignmentInsert[] = fields.map(field => ({
        fieldId: field.fieldId,
        order: field.order,
        required: field.required,
        templateId: template.id,
        customLabel: field.customLabel ?? null,
        customDescription: field.customDescription ?? null,
      }));
      await this.fieldAssignmentRepository.createMany(fieldAssignments);
      
      // Return template with fields
      return await this.templateRepository.findById(template.id) as DecisionTemplate;
    }

    return template;
  }

  async getTemplate(id: string): Promise<DecisionTemplate | null> {
    const template = await this.templateRepository.findById(id);
    return template;
  }

  async getAllTemplates(): Promise<DecisionTemplate[]> {
    return await this.templateRepository.findAll();
  }

  async getDefaultTemplate(): Promise<DecisionTemplate | null> {
    return await this.templateRepository.findDefault();
  }

  async setDefaultTemplate(id: string): Promise<DecisionTemplate> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    return await this.templateRepository.setDefault(id);
  }

  async updateTemplate(id: string, data: Partial<CreateDecisionTemplate>): Promise<DecisionTemplate | null> {
    // Get existing template
    const existing = await this.templateRepository.findById(id);
    if (!existing) {
      return null;
    }

    // Validate updated data
    const updatedData = { ...existing, ...data };
    const isValid = await this.validateTemplateDefinition(updatedData as CreateDecisionTemplate);
    if (!isValid) {
      throw new Error('Invalid template definition');
    }

    // Update template
    const { fields, ...templateData } = data;
    const template = await this.templateRepository.update(id, templateData);

    // If fields are provided, update them
    if (fields) {
      // Delete existing field assignments
      await this.fieldAssignmentRepository.deleteByTemplateId(id);
      
      // Create new field assignments
      if (fields.length > 0) {
        const fieldAssignments: TemplateFieldAssignmentInsert[] = fields.map(field => ({
          fieldId: field.fieldId,
          order: field.order,
          required: field.required,
          templateId: id,
          customLabel: field.customLabel ?? null,
          customDescription: field.customDescription ?? null,
        }));
        await this.fieldAssignmentRepository.createMany(fieldAssignments);
      }
      
      // Return updated template with fields
      return await this.templateRepository.findById(id) as DecisionTemplate;
    }

    return template;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    // Check if template exists
    const template = await this.templateRepository.findById(id);
    if (!template) {
      return false;
    }

    // Check if it's the default template
    if (template.isDefault) {
      throw new Error('Cannot delete the default template');
    }

    // Delete field assignments first
    await this.fieldAssignmentRepository.deleteByTemplateId(id);

    // Delete template
    const success = await this.templateRepository.delete(id);
    return success;
  }

  async getTemplatesByCategory(category: string): Promise<DecisionTemplate[]> {
    return await this.templateRepository.findByCategory(category);
  }

  async searchTemplates(query: string): Promise<DecisionTemplate[]> {
    return await this.templateRepository.search(query);
  }

  async getTemplateCategories(): Promise<string[]> {
    const templates = await this.templateRepository.findAll();
    const categories = [...new Set(templates.map(t => t.category))].sort();
    return categories;
  }

  async addFieldToTemplate(
    templateId: string,
    assignment: CreateTemplateFieldAssignment
  ): Promise<TemplateFieldAssignment> {
    // Check if template exists
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Check if field already exists in template
    const existing = await this.fieldAssignmentRepository.findByTemplateId(templateId);
    if (existing.some(a => a.fieldId === assignment.fieldId)) {
      throw new Error('Field already exists in template');
    }

    // Add field assignment
    return await this.fieldAssignmentRepository.create({
      fieldId: assignment.fieldId,
      order: assignment.order,
      required: assignment.required,
      templateId,
      customLabel: assignment.customLabel ?? null,
      customDescription: assignment.customDescription ?? null,
    });
  }

  async removeFieldFromTemplate(templateId: string, fieldId: string): Promise<boolean> {
    // Check if template exists
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      return false;
    }

    return await this.fieldAssignmentRepository.delete(templateId, fieldId);
  }

  async updateFieldAssignment(
    templateId: string,
    fieldId: string,
    data: Partial<CreateTemplateFieldAssignment>
  ): Promise<TemplateFieldAssignment | null> {
    const updateData: Partial<TemplateFieldAssignmentInsert> = {};

    if (data.fieldId !== undefined) {
      updateData.fieldId = data.fieldId;
    }
    if (data.order !== undefined) {
      updateData.order = data.order;
    }
    if (data.required !== undefined) {
      updateData.required = data.required;
    }
    if ('customLabel' in data) {
      updateData.customLabel = data.customLabel ?? null;
    }
    if ('customDescription' in data) {
      updateData.customDescription = data.customDescription ?? null;
    }

    return await this.fieldAssignmentRepository.update(templateId, fieldId, updateData);
  }

  async getTemplateFields(templateId: string): Promise<TemplateFieldAssignment[]> {
    return await this.fieldAssignmentRepository.findByTemplateId(templateId);
  }

  async reorderTemplateFields(
    templateId: string,
    fieldOrders: { fieldId: string; order: number }[]
  ): Promise<void> {
    // Validate all field IDs exist in template
    const existingFields = await this.fieldAssignmentRepository.findByTemplateId(templateId);
    const existingFieldIds = new Set(existingFields.map(f => f.fieldId));
    
    for (const { fieldId } of fieldOrders) {
      if (!existingFieldIds.has(fieldId)) {
        throw new Error(`Field ${fieldId} not found in template`);
      }
    }

    await this.fieldAssignmentRepository.updateOrder(templateId, fieldOrders);
  }

  async createTemplateWithFields(
    templateData: CreateDecisionTemplate,
    fieldAssignments: CreateTemplateFieldAssignment[]
  ): Promise<DecisionTemplate> {
    // Validate template
    const isValid = await this.validateTemplateDefinition(templateData);
    if (!isValid) {
      throw new Error('Invalid template definition');
    }

    // Validate field assignments
    const areFieldsValid = await this.validateFieldAssignments(fieldAssignments);
    if (!areFieldsValid) {
      throw new Error('Invalid field assignments');
    }

    // Create template
    const template = await this.templateRepository.create(templateData);

    // Create field assignments
    if (fieldAssignments.length > 0) {
      const assignments: TemplateFieldAssignmentInsert[] = fieldAssignments.map(field => ({
        fieldId: field.fieldId,
        order: field.order,
        required: field.required,
        templateId: template.id,
        customLabel: field.customLabel ?? null,
        customDescription: field.customDescription ?? null,
      }));
      await this.fieldAssignmentRepository.createMany(assignments);
    }

    // Return template with fields
    return await this.templateRepository.findById(template.id) as DecisionTemplate;
  }

  async validateTemplateDefinition(template: CreateDecisionTemplate): Promise<boolean> {
    // Basic validation
    if (!template.name?.trim()) {
      return false;
    }

    if (!template.description?.trim()) {
      return false;
    }

    if (!template.category?.trim()) {
      return false;
    }

    // Validate category is one of the allowed values
    const validCategories = ['standard', 'technology', 'strategy', 'budget', 'policy', 'proposal'];
    if (!validCategories.includes(template.category)) {
      return false;
    }

    // Validate fields if provided
    if (template.fields) {
      // Check for duplicate field IDs
      const fieldIds = template.fields.map(f => f.fieldId);
      const uniqueFieldIds = new Set(fieldIds);
      if (fieldIds.length !== uniqueFieldIds.size) {
        return false;
      }

      // Check orders are sequential and start at 0
      const sortedFields = [...template.fields].sort((a, b) => a.order - b.order);
      for (let i = 0; i < sortedFields.length; i++) {
        if (sortedFields[i]!.order !== i) {
          return false;
        }
      }
    }

    return true;
  }

  async validateFieldAssignments(assignments: CreateTemplateFieldAssignment[]): Promise<boolean> {
    // Check for duplicate field IDs
    const fieldIds = assignments.map(a => a.fieldId);
    const uniqueFieldIds = new Set(fieldIds);
    if (fieldIds.length !== uniqueFieldIds.size) {
      return false;
    }

    // Check orders are non-negative
    for (const assignment of assignments) {
      if (assignment.order < 0) {
        return false;
      }
    }

    return true;
  }

  async seedTemplates(templates: CreateDecisionTemplate[]): Promise<DecisionTemplate[]> {
    // Validate all templates
    for (const template of templates) {
      const isValid = await this.validateTemplateDefinition(template);
      if (!isValid) {
        throw new Error(`Invalid template definition: ${template.name}`);
      }
    }

    return await this.templateRepository.createMany(templates);
  }
}
