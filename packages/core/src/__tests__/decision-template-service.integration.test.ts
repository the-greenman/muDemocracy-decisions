/**
 * Integration Tests for Decision Template Service
 * Tests the service with actual database operations
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { DecisionTemplateService } from '../services/decision-template-service';
import { DrizzleDecisionTemplateRepository, DrizzleTemplateFieldAssignmentRepository } from '../../../db/src/repositories/decision-template-repository';
import { DrizzleDecisionFieldRepository } from '../../../db/src/repositories/decision-field-repository';
import { db } from '../../../db/src/client';
import { decisionTemplates, templateFieldAssignments, decisionFields } from '../../../db/src/schema';
import type { 
  CreateDecisionTemplate,
  CreateTemplateFieldAssignment
} from '../index';

describe('DecisionTemplateService Integration Tests', () => {
  let service: DecisionTemplateService;
  let templateRepo: DrizzleDecisionTemplateRepository;
  let fieldAssignmentRepo: DrizzleTemplateFieldAssignmentRepository;
  let fieldRepo: DrizzleDecisionFieldRepository;
  let testFieldIds: string[] = [];

  beforeAll(async () => {
    // Initialize repositories and service
    templateRepo = new DrizzleDecisionTemplateRepository();
    fieldAssignmentRepo = new DrizzleTemplateFieldAssignmentRepository();
    fieldRepo = new DrizzleDecisionFieldRepository();
    service = new DecisionTemplateService(templateRepo, fieldAssignmentRepo);
    
    // Create test decision fields
    for (let i = 0; i < 10; i++) {
      const field = await fieldRepo.create({
        name: `Test Field ${i + 1}`,
        description: `Test field number ${i + 1}`,
        category: 'context',
        extractionPrompt: `Extract ${i + 1} from the decision`,
        fieldType: 'text',
      });
      testFieldIds.push(field.id);
    }
  });

  beforeEach(async () => {
    // Clean up before each test
    await db.delete(templateFieldAssignments);
    await db.delete(decisionTemplates);
  });

  afterAll(async () => {
    // Clean up after all tests
    await db.delete(templateFieldAssignments);
    await db.delete(decisionTemplates);
    await db.delete(decisionFields);
  });

  describe('Template CRUD Operations', () => {
    it('should create a template with fields', async () => {
      const fieldId1 = testFieldIds[0];
      const fieldId2 = testFieldIds[1];
      
      if (!fieldId1 || !fieldId2) {
        throw new Error('Test field IDs not properly initialized');
      }
      
      const templateData: CreateDecisionTemplate = {
        name: 'Test Template',
        description: 'A test template for integration testing',
        category: 'standard',
        fields: [
          {
            fieldId: fieldId1!,
            order: 0,
            required: true,
            customLabel: 'Custom Field 1',
          },
          {
            fieldId: fieldId2!,
            order: 1,
            required: false,
          },
        ],
      };

      const result = await service.createTemplate(templateData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(templateData.name);
      expect(result.description).toBe(templateData.description);
      expect(result.category).toBe(templateData.category);
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0]?.fieldId).toBe(fieldId1);
      expect(result.fields[0]?.customLabel || undefined).toBe('Custom Field 1');
      expect(result.fields[1]?.fieldId).toBe(fieldId2);
    });

    it('should retrieve a template by ID', async () => {
      // Create a template first
      const created = await service.createTemplate({
        name: 'Test Template',
        description: 'A test template',
        category: 'technology',
        fields: [],
      });

      // Retrieve it
      const retrieved = await service.getTemplate(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(created.name);
    });

    it('should update a template and its fields', async () => {
      // Create a template
      const fieldId1 = testFieldIds[0];
      const fieldId2 = testFieldIds[1];
      
      const created = await service.createTemplate({
        name: 'Original Template',
        description: 'Original description',
        category: 'standard',
        fields: [
          {
            fieldId: fieldId1!,
            order: 0,
            required: true,
          },
        ],
      });

      // Update it
      const updated = await service.updateTemplate(created.id, {
        name: 'Updated Template',
        description: 'Updated description',
        fields: [
          {
            fieldId: fieldId1!,
            order: 0,
            required: false, // Changed from true
          },
          {
            fieldId: fieldId2!,
            order: 1,
            required: true, // New field
          },
        ],
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Template');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.fields).toHaveLength(2);
      expect(updated?.fields[0]?.required).toBe(false);
      expect(updated?.fields[1]?.fieldId).toBe(fieldId2);
    });

    it('should set and get default template', async () => {
      // Create two templates
      const template1 = await service.createTemplate({
        name: 'Template 1',
        description: 'First template',
        category: 'standard',
        fields: [],
      });

      const template2 = await service.createTemplate({
        name: 'Template 2',
        description: 'Second template',
        category: 'technology',
        fields: [],
      });

      // Set template2 as default
      const defaultTemplate = await service.setDefaultTemplate(template2.id);

      expect(defaultTemplate.id).toBe(template2.id);
      expect(defaultTemplate.isDefault).toBe(true);

      // Verify it's returned as default
      const retrievedDefault = await service.getDefaultTemplate();
      expect(retrievedDefault?.id).toBe(template2.id);

      // Verify template1 is no longer default
      const template1Updated = await service.getTemplate(template1.id);
      expect(template1Updated?.isDefault).toBe(false);
    });

    it('should delete a template and its field assignments', async () => {
      const fieldId1 = testFieldIds[0];
      
      // Create a template with fields
      const created = await service.createTemplate({
        name: 'Template to Delete',
        description: 'Will be deleted',
        category: 'standard',
        fields: [
          {
            fieldId: fieldId1!,
            order: 0,
            required: true,
          },
        ],
      });

      // Verify field assignments exist
      const fieldsBefore = await fieldAssignmentRepo.findByTemplateId(created.id);
      expect(fieldsBefore).toHaveLength(1);

      // Delete the template
      const deleted = await service.deleteTemplate(created.id);
      expect(deleted).toBe(true);

      // Verify template is gone
      const retrieved = await service.getTemplate(created.id);
      expect(retrieved).toBeNull();

      // Verify field assignments are gone
      const fieldsAfter = await fieldAssignmentRepo.findByTemplateId(created.id);
      expect(fieldsAfter).toHaveLength(0);
    });

    it('should prevent deletion of default template', async () => {
      // Create and set as default
      const template = await service.createTemplate({
        name: 'Default Template',
        description: 'Cannot be deleted',
        category: 'standard',
        fields: [],
      });

      await service.setDefaultTemplate(template.id);

      // Try to delete
      await expect(service.deleteTemplate(template.id)).rejects.toThrow(
        'Cannot delete the default template'
      );
    });
  });

  describe('Field Assignment Operations', () => {
    it('should add a field to an existing template', async () => {
      const fieldId1 = testFieldIds[0];
      
      // Create template without fields
      const template = await service.createTemplate({
        name: 'Template',
        description: 'Test template',
        category: 'standard',
        fields: [],
      });

      // Add a field
      const fieldAssignment = await service.addFieldToTemplate(template.id, {
        fieldId: fieldId1!,
        order: 0,
        required: true,
        customLabel: 'New Field',
      });

      expect(fieldAssignment.fieldId).toBe(fieldId1);
      expect(fieldAssignment.customLabel || undefined).toBe('New Field');

      // Verify it's in the template
      const updatedTemplate = await service.getTemplate(template.id);
      expect(updatedTemplate?.fields).toHaveLength(1);
    });

    it('should remove a field from a template', async () => {
      const fieldId1 = testFieldIds[0];
      
      // Create template with field
      const template = await service.createTemplate({
        name: 'Template',
        description: 'Test template',
        category: 'standard',
        fields: [
          {
            fieldId: fieldId1!,
            order: 0,
            required: true,
          },
        ],
      });

      // Remove the field
      const removed = await service.removeFieldFromTemplate(template.id, fieldId1!);
      expect(removed).toBe(true);

      // Verify it's gone
      const updatedTemplate = await service.getTemplate(template.id);
      expect(updatedTemplate?.fields).toHaveLength(0);
    });

    it('should reorder fields in a template', async () => {
      const fieldId1 = testFieldIds[0];
      const fieldId2 = testFieldIds[1];
      const fieldId3 = testFieldIds[2];
      
      // Create template with multiple fields
      const template = await service.createTemplate({
        name: 'Template',
        description: 'Test template',
        category: 'standard',
        fields: [
          {
            fieldId: fieldId1!,
            order: 0,
            required: true,
          },
          {
            fieldId: fieldId2!,
            order: 1,
            required: true,
          },
          {
            fieldId: fieldId3!,
            order: 2,
            required: true,
          },
        ],
      });

      // Reorder fields
      await service.reorderTemplateFields(template.id, [
        { fieldId: fieldId1!, order: 2 },
        { fieldId: fieldId2!, order: 0 },
        { fieldId: fieldId3!, order: 1 },
      ]);

      // Verify new order
      const updatedTemplate = await service.getTemplate(template.id);
      const fields = updatedTemplate!.fields.sort((a, b) => a.order - b.order);
      expect(fields[0].fieldId).toBe(fieldId2);
      expect(fields[1].fieldId).toBe(fieldId3);
      expect(fields[2].fieldId).toBe(fieldId1);
    });
  });

  describe('Query Operations', () => {
    it('should get templates by category', async () => {
      // Create templates in different categories
      await service.createTemplate({
        name: 'Tech Template 1',
        description: 'First tech template',
        category: 'technology',
        fields: [],
      });

      await service.createTemplate({
        name: 'Tech Template 2',
        description: 'Second tech template',
        category: 'technology',
        fields: [],
      });

      await service.createTemplate({
        name: 'Standard Template',
        description: 'A standard template',
        category: 'standard',
        fields: [],
      });

      // Query by category
      const techTemplates = await service.getTemplatesByCategory('technology');
      expect(techTemplates).toHaveLength(2);
      expect(techTemplates.every(t => t.category === 'technology')).toBe(true);

      const standardTemplates = await service.getTemplatesByCategory('standard');
      expect(standardTemplates).toHaveLength(1);
      expect(standardTemplates[0]?.category).toBe('standard');
    });

    it('should search templates by name', async () => {
      // Create templates
      await service.createTemplate({
        name: 'Technology Decision Template',
        description: 'For tech decisions',
        category: 'technology',
        fields: [],
      });

      await service.createTemplate({
        name: 'Strategic Template',
        description: 'For strategy',
        category: 'strategy',
        fields: [],
      });

      // Search
      const results = await service.searchTemplates('Technology');
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toContain('Technology');

      const results2 = await service.searchTemplates('Template');
      expect(results2).toHaveLength(2);
    });

    it('should get all unique categories', async () => {
      // Create templates in various categories
      await service.createTemplate({
        name: 'Template 1',
        description: 'Tech template',
        category: 'technology',
        fields: [],
      });

      await service.createTemplate({
        name: 'Template 2',
        description: 'Another tech template',
        category: 'technology',
        fields: [],
      });

      await service.createTemplate({
        name: 'Template 3',
        description: 'Standard template',
        category: 'standard',
        fields: [],
      });

      await service.createTemplate({
        name: 'Template 4',
        description: 'Strategy template',
        category: 'strategy',
        fields: [],
      });

      // Get categories
      const categories = await service.getTemplateCategories();
      expect(categories).toEqual(['standard', 'strategy', 'technology']);
    });
  });

  describe('Bulk Operations', () => {
    it('should create a template with multiple fields in one operation', async () => {
      const fieldId1 = testFieldIds[0];
      const fieldId2 = testFieldIds[1];
      const fieldId3 = testFieldIds[2];
      
      const templateData: CreateDecisionTemplate = {
        name: 'Complex Template',
        description: 'Template with many fields',
        category: 'standard',
        fields: [],
      };

      const fieldAssignments: CreateTemplateFieldAssignment[] = [
        {
          fieldId: fieldId1!,
          order: 0,
          required: true,
        },
        {
          fieldId: fieldId2!,
          order: 1,
          required: false,
        },
        {
          fieldId: fieldId3!,
          order: 2,
          required: true,
        },
      ];

      const result = await service.createTemplateWithFields(templateData, fieldAssignments);

      expect(result.fields).toHaveLength(3);
      expect(result.fields[0]?.fieldId).toBe(fieldId1);
      expect(result.fields[1]?.fieldId).toBe(fieldId2);
      expect(result.fields[2]?.fieldId).toBe(fieldId3);
    });
  });

  describe('Validation', () => {
    it('should reject invalid template definitions', async () => {
      // Empty name
      await expect(
        service.createTemplate({
          name: '',
          description: 'Invalid template',
          category: 'standard',
          fields: [],
        })
      ).rejects.toThrow('Invalid template definition');

      // Invalid category
      await expect(
        service.createTemplate({
          name: 'Invalid Template',
          description: 'Has invalid category',
          category: 'invalid' as any,
          fields: [],
        })
      ).rejects.toThrow('Invalid template definition');

      // Non-sequential field orders
      const fieldId1 = testFieldIds[0];
      const fieldId2 = testFieldIds[1];
      
      await expect(
        service.createTemplate({
          name: 'Bad Order Template',
          description: 'Fields not sequential',
          category: 'standard',
          fields: [
            {
              fieldId: fieldId1!,
              order: 0,
              required: true,
            },
            {
              fieldId: fieldId2!,
              order: 2, // Should be 1
              required: true,
            },
          ],
        })
      ).rejects.toThrow('Invalid template definition');
    });
  });
});
