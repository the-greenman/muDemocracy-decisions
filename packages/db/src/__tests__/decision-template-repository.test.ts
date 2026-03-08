/**
 * Unit Tests for Decision Template Repository
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrizzleDecisionTemplateRepository, DrizzleTemplateFieldAssignmentRepository } from '../repositories/decision-template-repository';
import { db } from '../client';
import type { 
  CreateDecisionTemplate,
  CreateTemplateFieldAssignment 
} from '@repo/core';

// Mock the database
vi.mock('../client', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  ilike: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
}));

describe('DrizzleDecisionTemplateRepository', () => {
  let repository: DrizzleDecisionTemplateRepository;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DrizzleDecisionTemplateRepository();
    mockDb = vi.mocked(db);
  });

  describe('create', () => {
    it('should create a decision template', async () => {
      const data: CreateDecisionTemplate = {
        namespace: 'core',
        name: 'Test Template',
        description: 'A test template for unit testing',
        category: 'standard',
        fields: [],
      };

      const expectedRow = {
        id: 'tpl-123',
        namespace: 'core',
        name: data.name,
        description: data.description,
        category: data.category,
        version: 1,
        isDefault: false,
        isCustom: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expectedRow]),
        }),
      });
      mockDb.insert = mockInsert;

      const result = await repository.create(data);

      expect(result).toBeDefined();
      expect(result.id).toBe(expectedRow.id);
      expect(result.name).toBe(data.name);
      expect(result.description).toBe(data.description);
      expect(result.category).toBe(data.category);
      expect(result.fields).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return null if template not found', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.select = mockSelect;

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should return null for non-existent template', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.update = mockUpdate;

      const result = await repository.update('non-existent', { name: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a template', async () => {
      const templateId = 'tpl-123';
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: templateId }]),
        }),
      });
      mockDb.delete = mockDelete;

      const result = await repository.delete(templateId);

      expect(result).toBe(true);
    });

    it('should return false for non-existent template', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });
      mockDb.delete = mockDelete;

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });
});

describe('DrizzleTemplateFieldAssignmentRepository', () => {
  let repository: DrizzleTemplateFieldAssignmentRepository;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new DrizzleTemplateFieldAssignmentRepository();
    mockDb = vi.mocked(db);
  });

  describe('create', () => {
    it('should create a field assignment', async () => {
      const data: CreateTemplateFieldAssignment = {
        fieldId: 'field-123',
        order: 0,
        required: true,
      };

      // The service adds templateId to the data before passing to repository
      const dataWithTemplateId = {
        templateId: 'tpl-123',
        fieldId: data.fieldId,
        order: data.order,
        required: data.required,
      };

      const expectedRow = {
        id: 'tfa-123',
        ...dataWithTemplateId,
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([expectedRow]),
        }),
      });
      mockDb.insert = mockInsert;

      const result = await repository.create(dataWithTemplateId);

      expect(result).toBeDefined();
      expect(result.fieldId).toBe(data.fieldId);
      expect(result.order).toBe(data.order);
      expect(result.required).toBe(data.required);
    });
  });

  describe('findByTemplateId', () => {
    it('should return field assignments by template ID', async () => {
      const templateId = 'tpl-123';
      const expectedRows = [
        {
          id: 'tfa-1',
          templateId,
          fieldId: 'field-1',
          order: 0,
          required: true,
        },
        {
          id: 'tfa-2',
          templateId,
          fieldId: 'field-2',
          order: 1,
          required: false,
        },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(expectedRows),
          }),
        }),
      });
      mockDb.select = mockSelect;

      const result = await repository.findByTemplateId(templateId);

      expect(result).toHaveLength(2);
      expect(result[0]).toBeDefined();
      expect(result[1]).toBeDefined();
      expect(result[0]!.fieldId).toBe('field-1');
      expect(result[1]!.fieldId).toBe('field-2');
      expect(result[0]!.order).toBe(0);
      expect(result[1]!.order).toBe(1);
    });
  });

  describe('update', () => {
    it('should update a field assignment', async () => {
      const templateId = 'tpl-123';
      const fieldId = 'field-123';
      const updateData = {
        order: 1,
        required: false,
      };

      const expectedRow = {
        id: 'tfa-123',
        templateId,
        fieldId,
        order: 1,
        required: false,
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([expectedRow]),
          }),
        }),
      });
      mockDb.update = mockUpdate;

      const result = await repository.update(templateId, fieldId, updateData);

      expect(result).toBeDefined();
      expect(result!.order).toBe(1);
      expect(result!.required).toBe(false);
    });

    it('should return null for non-existent assignment', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.update = mockUpdate;

      const result = await repository.update('tpl-123', 'field-123', { order: 1 });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a field assignment', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'tfa-123' }]),
        }),
      });
      mockDb.delete = mockDelete;

      const result = await repository.delete('tpl-123', 'field-123');

      expect(result).toBe(true);
    });

    it('should return false for non-existent assignment', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });
      mockDb.delete = mockDelete;

      const result = await repository.delete('tpl-123', 'field-123');

      expect(result).toBe(false);
    });
  });

  describe('updateOrder', () => {
    it('should update the order of multiple field assignments', async () => {
      const templateId = 'tpl-123';
      const assignments = [
        { fieldId: 'field-1', order: 1 },
        { fieldId: 'field-2', order: 0 },
      ];

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };
        await callback(tx);
      });
      mockDb.transaction = mockTransaction;

      await repository.updateOrder(templateId, assignments);

      expect(mockTransaction).toHaveBeenCalled();
    });
  });
});
