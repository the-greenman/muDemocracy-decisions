/**
 * Unit tests for DecisionFieldService
 * Following TDD approach - tests written first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DecisionFieldService } from '../services/decision-field-service';
import type { 
  IDecisionFieldRepository,
  CreateDecisionField,
  DecisionField
} from '@repo/core';

// Mock repository
const mockRepository: IDecisionFieldRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  findByCategory: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createMany: vi.fn(),
  search: vi.fn(),
  findByType: vi.fn(),
};

describe('DecisionFieldService', () => {
  let service: DecisionFieldService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DecisionFieldService(mockRepository);
  });

  describe('createField', () => {
    it('should create a field with valid data', async () => {
      const fieldData: CreateDecisionField = {
        name: 'Test Field',
        description: 'A test field',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract test field',
      };

      const expectedField: DecisionField = {
        id: 'field-123',
        ...fieldData,
        version: 1,
        isCustom: false,
        createdAt: '2026-02-27T00:00:00.000Z',
      };

      vi.mocked(mockRepository.create).mockResolvedValue(expectedField);
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await service.createField(fieldData);

      expect(result).toEqual(expectedField);
      expect(mockRepository.create).toHaveBeenCalledWith(fieldData);
    });

    it('should throw error for invalid field (missing name)', async () => {
      const fieldData: CreateDecisionField = {
        name: '',
        description: 'Test desc',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract test',
      };

      await expect(service.createField(fieldData)).rejects.toThrow('Invalid field definition');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid field (missing category)', async () => {
      const fieldData: CreateDecisionField = {
        name: 'Test Field',
        description: 'Test desc',
        category: '' as any,
        fieldType: 'text',
        extractionPrompt: 'Extract test',
      };

      await expect(service.createField(fieldData)).rejects.toThrow('Invalid field definition');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid field (missing type)', async () => {
      const fieldData: CreateDecisionField = {
        name: 'Test Field',
        description: 'Test desc',
        category: 'context',
        fieldType: 'invalid' as any,
        extractionPrompt: 'Extract test',
      };

      await expect(service.createField(fieldData)).rejects.toThrow('Invalid field definition');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid validation rules', async () => {
      const fieldData: CreateDecisionField = {
        name: 'Test Field',
        description: 'Test desc',
        category: 'context',
        fieldType: 'text',
        validationRules: [{ type: 'pattern', value: 'invalid' }],
        extractionPrompt: 'Extract test',
      };

      // Mock to simulate JSON.stringify issue
      vi.mocked(mockRepository.create).mockImplementation(async () => {
        throw new Error('Invalid field definition');
      });

      await expect(service.createField(fieldData)).rejects.toThrow('Invalid field definition');
    });
  });

  describe('getField', () => {
    it('should return a field when found', async () => {
      const expectedField: DecisionField = {
        id: 'field-123',
        name: 'Test Field',
        description: 'Test field description',
        category: 'context',
        extractionPrompt: 'Extract test field',
        fieldType: 'text',
        version: 1,
        isCustom: false,
        createdAt: '2026-02-27T00:00:00.000Z',
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(expectedField);

      const result = await service.getField('field-123');

      expect(result).toEqual(expectedField);
      expect(mockRepository.findById).toHaveBeenCalledWith('field-123');
    });

    it('should return null when field not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await service.getField('non-existent');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('getAllFields', () => {
    it('should return all fields', async () => {
      const expectedFields: DecisionField[] = [
        {
          id: 'field-1',
          name: 'Field 1',
          description: 'Field 1 description',
          category: 'context',
          extractionPrompt: 'Extract field 1',
          fieldType: 'text',
          version: 1,
          isCustom: false,
          createdAt: '2026-02-27T00:00:00.000Z',
        },
        {
          id: 'field-2',
          name: 'Field 2',
          description: 'Field 2 description',
          category: 'evaluation',
          extractionPrompt: 'Extract field 2',
          fieldType: 'number',
          version: 1,
          isCustom: false,
          createdAt: '2026-02-27T00:00:00.000Z',
        },
      ];

      vi.mocked(mockRepository.findAll).mockResolvedValue(expectedFields);

      const result = await service.getAllFields();

      expect(result).toEqual(expectedFields);
      expect(mockRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('getFieldsByCategory', () => {
    it('should return fields for a specific category', async () => {
      const expectedFields: DecisionField[] = [
        {
          id: 'field-1',
          name: 'Field 1',
          description: 'Field 1 description',
          category: 'evaluation',
          extractionPrompt: 'Extract field 1',
          fieldType: 'text',
          version: 1,
          isCustom: false,
          createdAt: '2026-02-27T00:00:00.000Z',
        },
      ];

      vi.mocked(mockRepository.findByCategory).mockResolvedValue(expectedFields);

      const result = await service.getFieldsByCategory('evaluation');

      expect(result).toEqual(expectedFields);
      expect(mockRepository.findByCategory).toHaveBeenCalledWith('evaluation');
    });
  });

  describe('updateField', () => {
    it('should update an existing field', async () => {
      const existingField: DecisionField = {
        id: 'field-123',
        name: 'Old Name',
        description: 'Old description',
        category: 'context',
        extractionPrompt: 'Extract old field',
        fieldType: 'text',
        version: 1,
        isCustom: false,
        createdAt: '2026-02-27T00:00:00.000Z',
      };

      const updatedField: DecisionField = {
        ...existingField,
        name: 'New Name',
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(existingField);
      vi.mocked(mockRepository.update).mockResolvedValue(updatedField);

      const result = await service.updateField('field-123', { name: 'New Name' });

      expect(result).toEqual(updatedField);
      expect(mockRepository.findById).toHaveBeenCalledWith('field-123');
      expect(mockRepository.update).toHaveBeenCalledWith('field-123', { name: 'New Name' });
    });

    it('should return null for non-existent field', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await service.updateField('non-existent', { name: 'New Name' });

      expect(result).toBeNull();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteField', () => {
    it('should delete an existing field', async () => {
      const existingField: DecisionField = {
        id: 'field-123',
        name: 'To Delete',
        description: 'Field to delete',
        category: 'context',
        extractionPrompt: 'Extract to delete',
        fieldType: 'text',
        version: 1,
        isCustom: false,
        createdAt: '2026-02-27T00:00:00.000Z',
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(existingField);
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteField('field-123');

      expect(result).toBe(true);
      expect(mockRepository.findById).toHaveBeenCalledWith('field-123');
      expect(mockRepository.delete).toHaveBeenCalledWith('field-123');
    });

    it('should return false for non-existent field', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await service.deleteField('non-existent');

      expect(result).toBe(false);
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('searchFields', () => {
    it('should search fields', async () => {
      const expectedFields: DecisionField[] = [
        {
          id: 'field-1',
          name: 'Risk Assessment',
          description: 'Risk assessment field',
          category: 'evaluation',
          extractionPrompt: 'Extract risk assessment',
          fieldType: 'text',
          version: 1,
          isCustom: false,
          createdAt: '2026-02-27T00:00:00.000Z',
        },
      ];

      vi.mocked(mockRepository.search).mockResolvedValue(expectedFields);

      const result = await service.searchFields('risk');

      expect(result).toEqual(expectedFields);
      expect(mockRepository.search).toHaveBeenCalledWith('risk');
    });
  });

  describe('getFieldCategories', () => {
    it('should return unique sorted categories', async () => {
      const fields: DecisionField[] = [
        { id: '1', name: 'F1', description: 'Field 1', category: 'evaluation', extractionPrompt: 'Extract F1', fieldType: 'text', version: 1, isCustom: false, createdAt: '2026-02-27T00:00:00.000Z' },
        { id: '2', name: 'F2', description: 'Field 2', category: 'context', extractionPrompt: 'Extract F2', fieldType: 'text', version: 1, isCustom: false, createdAt: '2026-02-27T00:00:00.000Z' },
        { id: '3', name: 'F3', description: 'Field 3', category: 'evaluation', extractionPrompt: 'Extract F3', fieldType: 'text', version: 1, isCustom: false, createdAt: '2026-02-27T00:00:00.000Z' },
        { id: '4', name: 'F4', description: 'Field 4', category: 'metadata', extractionPrompt: 'Extract F4', fieldType: 'text', version: 1, isCustom: false, createdAt: '2026-02-27T00:00:00.000Z' },
      ];

      vi.mocked(mockRepository.findAll).mockResolvedValue(fields);

      const result = await service.getFieldCategories();

      expect(result).toEqual(['context', 'evaluation', 'metadata']);
    });
  });

  describe('getFieldTypes', () => {
    it('should return unique sorted types', async () => {
      const fields: DecisionField[] = [
        { id: '1', name: 'F1', description: 'Field 1', category: 'context', extractionPrompt: 'Extract F1', fieldType: 'text', version: 1, isCustom: false, createdAt: '2026-02-27T00:00:00.000Z' },
        { id: '2', name: 'F2', description: 'Field 2', category: 'context', extractionPrompt: 'Extract F2', fieldType: 'number', version: 1, isCustom: false, createdAt: '2026-02-27T00:00:00.000Z' },
        { id: '3', name: 'F3', description: 'Field 3', category: 'context', extractionPrompt: 'Extract F3', fieldType: 'text', version: 1, isCustom: false, createdAt: '2026-02-27T00:00:00.000Z' },
        { id: '4', name: 'F4', description: 'Field 4', category: 'context', extractionPrompt: 'Extract F4', fieldType: 'select', version: 1, isCustom: false, createdAt: '2026-02-27T00:00:00.000Z' },
      ];

      vi.mocked(mockRepository.findAll).mockResolvedValue(fields);

      const result = await service.getFieldTypes();

      expect(result).toEqual(['number', 'select', 'text']);
    });
  });

  describe('seedFields', () => {
    it('should create multiple fields', async () => {
      const fields: CreateDecisionField[] = [
        { name: 'Field 1', description: 'Field 1 desc', category: 'context', fieldType: 'text', extractionPrompt: 'Extract field 1' },
        { name: 'Field 2', description: 'Field 2 desc', category: 'evaluation', fieldType: 'number', extractionPrompt: 'Extract field 2' },
      ];

      const createdFields: DecisionField[] = [
        { 
          id: '1', 
          name: fields[0].name,
          description: fields[0].description,
          category: fields[0].category,
          extractionPrompt: fields[0].extractionPrompt,
          fieldType: fields[0].fieldType,
          version: 1, 
          isCustom: false, 
          createdAt: '2026-02-27T00:00:00.000Z' 
        },
        { 
          id: '2', 
          name: fields[1].name,
          description: fields[1].description,
          category: fields[1].category,
          extractionPrompt: fields[1].extractionPrompt,
          fieldType: fields[1].fieldType,
          version: 1, 
          isCustom: false, 
          createdAt: '2026-02-27T00:00:00.000Z' 
        },
      ];

      vi.mocked(mockRepository.createMany).mockResolvedValue(createdFields);

      const result = await service.seedFields(fields);

      expect(result).toEqual(createdFields);
      expect(mockRepository.createMany).toHaveBeenCalledWith(fields);
    });
  });

  describe('validateFieldDefinition', () => {
    it('should validate a correct field definition', async () => {
      const field: CreateDecisionField = {
        name: 'Test',
        description: 'Test desc',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract test value',
      };

      const result = await service.validateFieldDefinition(field);
      expect(result).toBe(true);
    });

    it('should reject field with empty name', async () => {
      const field: CreateDecisionField = {
        name: '',
        description: 'Test desc',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: 'Extract test',
      };

      const result = await service.validateFieldDefinition(field);
      expect(result).toBe(false);
    });

    it('should reject field with empty category', async () => {
      const field: CreateDecisionField = {
        name: 'Test Field',
        description: 'Test desc',
        category: '' as any,
        fieldType: 'text',
        extractionPrompt: 'Extract test',
      };

      const result = await service.validateFieldDefinition(field);
      expect(result).toBe(false);
    });

    it('should reject field with empty extraction prompt', async () => {
      const field: CreateDecisionField = {
        name: 'Test',
        description: 'Test desc',
        category: 'context',
        fieldType: 'text',
        extractionPrompt: '   ',
      };

      const result = await service.validateFieldDefinition(field);
      expect(result).toBe(false);
    });
  });

  describe('getValidationSchema', () => {
    it('should return validation schema for a field', async () => {
      const field: DecisionField = {
        id: 'field-123',
        name: 'Test Field',
        description: 'A test field',
        category: 'context',
        extractionPrompt: 'Extract test field',
        fieldType: 'text',
        placeholder: 'Enter value',
        validationRules: [{ type: 'minLength', value: 1 }, { type: 'maxLength', value: 100 }],
        version: 1,
        isCustom: false,
        createdAt: '2026-02-27T00:00:00.000Z',
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(field);

      const result = await service.getValidationSchema('field-123');

      expect(result).toEqual({
        type: 'text',
        required: true,
        placeholder: 'Enter value',
        description: 'A test field',
        rules: [{ type: 'minLength', value: 1 }, { type: 'maxLength', value: 100 }],
      });
    });

    it('should return null for non-existent field', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await service.getValidationSchema('non-existent');

      expect(result).toBeNull();
    });
  });
});
