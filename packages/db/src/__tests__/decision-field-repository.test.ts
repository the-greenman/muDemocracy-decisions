/**
 * Unit tests for DrizzleDecisionFieldRepository
 * Following TDD approach - tests written first
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleDecisionFieldRepository } from '../../src/repositories/decision-field-repository';
import { db } from '../../src/client';
import { decisionFields } from '../../src/schema';
import { sql } from 'drizzle-orm';
import { CreateDecisionField } from '@repo/schema';

describe('DrizzleDecisionFieldRepository', () => {
  let repository: DrizzleDecisionFieldRepository;

  beforeEach(async () => {
    repository = new DrizzleDecisionFieldRepository();
    // Clean up any existing test data
    await db.delete(decisionFields).where(sql`name LIKE 'Test%' OR name LIKE 'Minimal%' OR name LIKE 'Find%' OR name LIKE 'B Field%' OR name LIKE 'A Field%' OR name LIKE 'Field%' OR name LIKE 'Original%' OR name LIKE 'Updated%' OR name LIKE 'To Delete%' OR name LIKE 'Batch%' OR name LIKE 'Risk%' OR name LIKE 'Cost%' OR name LIKE 'Timeline%' OR name LIKE 'Text%' OR name LIKE 'Number%'`);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(decisionFields).where(sql`name LIKE 'Test%' OR name LIKE 'Minimal%' OR name LIKE 'Find%' OR name LIKE 'B Field%' OR name LIKE 'A Field%' OR name LIKE 'Field%' OR name LIKE 'Original%' OR name LIKE 'Updated%' OR name LIKE 'To Delete%' OR name LIKE 'Batch%' OR name LIKE 'Risk%' OR name LIKE 'Cost%' OR name LIKE 'Timeline%' OR name LIKE 'Text%' OR name LIKE 'Number%'`);
  });

  describe('create', () => {
    it('should create a decision field', async () => {
      const data: CreateDecisionField = {
        name: 'Test Field',
        description: 'A test field for unit testing',
        category: 'context', // Use valid enum
        fieldType: 'text',
        extractionPrompt: 'Extract the test field value',
        placeholder: 'Enter test value',
        validationRules: [{ type: 'minLength', value: 1 }, { type: 'maxLength', value: 100 }],
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(data.name);
      expect(result.description).toBe(data.description);
      expect(result.category).toBe(data.category);
      expect(result.fieldType).toBe(data.fieldType);
      expect(result.extractionPrompt).toBe(data.extractionPrompt);
      expect(result.placeholder).toBe(data.placeholder);
      expect(result.validationRules).toEqual(data.validationRules);
      expect(result.version).toBe(1);
      expect(result.isCustom).toBe(false);
      expect(result.createdAt).toBeDefined();
    });

    it('should create a field with minimal required fields', async () => {
      const data: CreateDecisionField = {
        name: 'Minimal Field',
        description: 'A minimal field for testing',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract minimal field value',
      };

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.name).toBe(data.name);
      expect(result.category).toBe(data.category);
      expect(result.fieldType).toBe(data.fieldType);
      expect(result.extractionPrompt).toBe(data.extractionPrompt);
      expect(result.description).toBe(data.description);
      expect(result.placeholder).toBeNull();
      expect(result.validationRules).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a field by ID', async () => {
      const created = await repository.create({
        name: 'Find Me',
        description: 'Field to find',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract find me value',
      });

      const result = await repository.findById(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.name).toBe('Find Me');
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.findById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all fields ordered by category then name', async () => {
      // Create fields in different categories
      await repository.create({
        name: 'B Field',
        description: 'Second field',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract B field',
      });

      await repository.create({
        name: 'A Field',
        description: 'First field',
        category: 'evaluation',
        fieldType: 'text',
        extractionPrompt: 'Extract A field',
      });

      await repository.create({
        name: 'A Field',
        description: 'First field alpha',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract A field alpha',
      });

      const results = await repository.findAll();

      expect(results).toHaveLength(3);
      // Should be ordered by category then name
      expect(results[0]!.category).toBe('context');
      expect(results[0]!.name).toBe('A Field');
      expect(results[1]!.category).toBe('context');
      expect(results[1]!.name).toBe('B Field');
      expect(results[2]!.category).toBe('evaluation');
      expect(results[2]!.name).toBe('A Field');
    });
  });

  describe('findByCategory', () => {
    it('should return fields for a specific category', async () => {
      await repository.create({
        name: 'Field 1',
        description: 'First evaluation field',
        category: 'evaluation',
        fieldType: 'text',
        extractionPrompt: 'Extract field 1',
      });

      await repository.create({
        name: 'Field 2',
        description: 'Context field',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract field 2',
      });

      await repository.create({
        name: 'Field 3',
        description: 'Number evaluation field',
        category: 'evaluation',
        fieldType: 'number',
        extractionPrompt: 'Extract field 3',
      });

      const results = await repository.findByCategory('evaluation');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('Field 1');
      expect(results.map(r => r.name)).toContain('Field 3');
      expect(results.every(r => r.category === 'evaluation')).toBe(true);
    });

    it('should return empty array for non-existent category', async () => {
      const results = await repository.findByCategory('outcome'); // Use valid enum that won't exist in test data
      expect(results).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a field', async () => {
      const created = await repository.create({
        name: 'Original Field',
        description: 'Original description',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract original field',
      });

      const updateData = {
        name: 'Updated Field',
        description: 'Updated description',
      };

      const result = await repository.update(created.id, updateData);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.name).toBe('Updated Field');
      expect(result!.description).toBe('Updated description');
      expect(result!.category).toBe('context'); // Unchanged
    });

    it('should return null for non-existent field', async () => {
      const result = await repository.update('00000000-0000-0000-0000-000000000000', {
        name: 'Updated',
      });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a field', async () => {
      const created = await repository.create({
        name: 'To Delete',
        description: 'Field to delete',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract to delete',
      });

      const success = await repository.delete(created.id);
      expect(success).toBe(true);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent field', async () => {
      const success = await repository.delete('00000000-0000-0000-0000-000000000000');
      expect(success).toBe(false);
    });
  });

  describe('createMany', () => {
    it('should create multiple fields', async () => {
      const fields: CreateDecisionField[] = [
        {
          name: 'Batch Field 1',
          description: 'First batch field',
          category: 'context',
          fieldType: 'text',
          extractionPrompt: 'Extract batch field 1',
        },
        {
          name: 'Batch Field 2',
          description: 'Second batch field',
          category: 'context',
          fieldType: 'number',
          extractionPrompt: 'Extract batch field 2',
        },
        {
          name: 'Batch Field 3',
          description: 'Third batch field',
          category: 'outcome',
          fieldType: 'select', // Use valid enum
          extractionPrompt: 'Extract batch field 3',
        },
      ];

      const results = await repository.createMany(fields);

      expect(results).toHaveLength(3);
      expect(results[0]!.name).toBe('Batch Field 1');
      expect(results[1]!.name).toBe('Batch Field 2');
      expect(results[2]!.name).toBe('Batch Field 3');
    });
  });

  describe('search', () => {
    it('should search across name, description, and category', async () => {
      await repository.create({
        name: 'Risk Assessment',
        description: 'Evaluate potential risks',
        category: 'evaluation',
        fieldType: 'text',
        extractionPrompt: 'Extract risk assessment',
      });

      await repository.create({
        name: 'Cost Analysis',
        description: 'Analyze financial costs',
        category: 'metadata', // Use valid enum
        fieldType: 'number',
        extractionPrompt: 'Extract cost analysis',
      });

      await repository.create({
        name: 'Timeline',
        description: 'Project duration',
        category: 'context', // Use valid enum
        fieldType: 'date',
        extractionPrompt: 'Extract timeline',
      });

      // Search by name
      const nameResults = await repository.search('risk');
      expect(nameResults).toHaveLength(1);
      expect(nameResults[0]!.name).toBe('Risk Assessment');

      // Search by description
      const descResults = await repository.search('costs');
      expect(descResults).toHaveLength(1);
      expect(descResults[0]!.name).toBe('Cost Analysis');

      // Search by category
      const catResults = await repository.search('context');
      expect(catResults).toHaveLength(1); // Only Timeline has 'context' in category from this test
      expect(catResults.every(r => r.category.includes('context'))).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const results = await repository.search('non-existent');
      expect(results).toEqual([]);
    });
  });

  describe('findByType', () => {
    it('should return fields of a specific type', async () => {
      await repository.create({
        name: 'Text Field 1',
        description: 'First text field',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract text field 1',
      });

      await repository.create({
        name: 'Number Field',
        description: 'Number field',
        category: 'context',
        fieldType: 'number',
        extractionPrompt: 'Extract number field',
      });

      await repository.create({
        name: 'Text Field 2',
        description: 'Second text field',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract text field 2',
      });

      const results = await repository.findByType('text');

      expect(results).toHaveLength(2); // Two text fields created in this test
      expect(results.every(r => r.fieldType === 'text')).toBe(true);
      expect(results.map(r => r.name)).toContain('Text Field 1');
      expect(results.map(r => r.name)).toContain('Text Field 2');
    });

    it('should return empty array for non-existent type', async () => {
      const results = await repository.findByType('textarea'); // Use valid enum value that won't exist in test data
      expect(results).toEqual([]);
    });
  });
});
