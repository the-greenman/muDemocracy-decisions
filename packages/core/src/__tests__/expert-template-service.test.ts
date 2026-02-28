/**
 * Unit tests for Expert Template Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpertTemplateService } from '../services/expert-template-service';
import type { 
  IExpertTemplateRepository,
  ExpertTemplate,
  CreateExpertTemplate,
  UpdateExpertTemplate
} from '@repo/core';

describe('ExpertTemplateService', () => {
  let service: ExpertTemplateService;
  let mockRepository: IExpertTemplateRepository;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      findByType: vi.fn(),
      findActive: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      createMany: vi.fn(),
    };

    service = new ExpertTemplateService(mockRepository);
    vi.clearAllMocks();
  });

  describe('createTemplate', () => {
    it('should create a valid template', async () => {
      const data: CreateExpertTemplate = {
        name: 'Test Expert',
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: ['github'],
        isActive: true,
      };

      const expectedTemplate: ExpertTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        name: data.name,
        displayName: data.name,
        description: undefined,
        type: data.type,
        promptTemplate: data.promptTemplate,
        mcpAccess: data.mcpAccess,
        outputSchema: undefined,
        isActive: true,
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockRepository.create).mockResolvedValue(expectedTemplate);

      const result = await service.createTemplate(data);

      expect(result).toEqual(expectedTemplate);
      expect(mockRepository.create).toHaveBeenCalledWith(data);
    });

    it('should throw error for invalid template', async () => {
      const data: CreateExpertTemplate = {
        name: '',
        type: 'technical', // Will be caught by validation
        promptTemplate: '',
        mcpAccess: [''],
        isActive: true,
      };

      await expect(service.createTemplate(data)).rejects.toThrow(
        'Invalid template: Name is required, Type must be one of: technical, legal, stakeholder, custom, Prompt template is required, Invalid MCP server name: '
      );
    });
  });

  describe('getTemplate', () => {
    it('should return a template by ID', async () => {
      const template: ExpertTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        name: 'Test Expert',
        displayName: 'Test Expert',
        description: undefined,
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: [],
        outputSchema: undefined,
        isActive: true,
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(template);

      const result = await service.getTemplate('550e8400-e29b-41d4-a716-446655440010');

      expect(result).toEqual(template);
      expect(mockRepository.findById).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440010');
    });
  });

  describe('updateTemplate', () => {
    it('should update an existing template', async () => {
      const existingTemplate: ExpertTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        name: 'Test Expert',
        displayName: 'Test Expert',
        description: undefined,
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: [],
        outputSchema: undefined,
        isActive: true,
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      const updateData: UpdateExpertTemplate = {
        name: 'Updated Expert',
        isActive: false,
      };

      const updatedTemplate: ExpertTemplate = {
        ...existingTemplate,
        name: updateData.name,
        isActive: updateData.isActive,
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(existingTemplate);
      vi.mocked(mockRepository.update).mockResolvedValue(updatedTemplate);

      const result = await service.updateTemplate('550e8400-e29b-41d4-a716-446655440010', updateData);

      expect(result).toEqual(updatedTemplate);
      expect(mockRepository.update).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440010', updateData);
    });

    it('should return null for non-existent template', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await service.updateTemplate('non-existent', { name: 'Updated' });

      expect(result).toBeNull();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete an existing template', async () => {
      const existingTemplate: ExpertTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        name: 'Test Expert',
        displayName: 'Test Expert',
        description: undefined,
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: [],
        outputSchema: undefined,
        isActive: true,
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(existingTemplate);
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteTemplate('550e8400-e29b-41d4-a716-446655440010');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440010');
    });

    it('should return false for non-existent template', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await service.deleteTemplate('non-existent');

      expect(result).toBe(false);
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('validateTemplate', () => {
    it('should validate a correct template', async () => {
      const data: CreateExpertTemplate = {
        name: 'Technical Architect',
        type: 'technical',
        promptTemplate: 'You are a technical architect. Review this decision...',
        mcpAccess: ['github', 'jira'],
        isActive: true,
      };

      const result = await service.validateTemplate(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid template', async () => {
      const data: CreateExpertTemplate = {
        name: '',
        type: 'technical' as any, // Will pass type check but fail validation
        promptTemplate: '',
        mcpAccess: [''],
        outputSchema: 'invalid' as any,
      };

      const result = await service.validateTemplate(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
      expect(result.errors).toContain('Type must be one of: technical, legal, stakeholder, custom');
      expect(result.errors).toContain('Prompt template is required');
      expect(result.errors).toContain('Invalid MCP server name: ');
      expect(result.errors).toContain('Output schema must be an object');
    });
  });

  describe('createManyTemplates', () => {
    it('should create multiple valid templates', async () => {
      const templates: CreateExpertTemplate[] = [
        {
          name: 'Expert 1',
          type: 'technical',
          promptTemplate: 'You are expert 1',
          mcpAccess: [],
          isActive: true,
        },
        {
          name: 'Expert 2',
          type: 'legal',
          promptTemplate: 'You are expert 2',
          mcpAccess: [],
          isActive: true,
        },
      ];

      const createdTemplates: ExpertTemplate[] = templates.map((t, i) => ({
        id: `550e8400-e29b-41d4-a716-44665544001${i}`,
        name: t.name,
        displayName: t.name,
        description: undefined,
        type: t.type,
        promptTemplate: t.promptTemplate,
        mcpAccess: t.mcpAccess,
        outputSchema: undefined,
        isActive: t.isActive,
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      }));

      vi.mocked(mockRepository.createMany).mockResolvedValue(createdTemplates);

      const result = await service.createManyTemplates(templates);

      expect(result).toEqual(createdTemplates);
      expect(mockRepository.createMany).toHaveBeenCalledWith(templates);
    });

    it('should throw error if any template is invalid', async () => {
      const templates: CreateExpertTemplate[] = [
        {
          name: 'Expert 1',
          type: 'technical',
          promptTemplate: 'You are expert 1',
          mcpAccess: [],
          isActive: true,
        },
        {
          name: '',
          type: 'legal',
          promptTemplate: 'You are expert 2',
          mcpAccess: [],
          isActive: true,
        },
      ];

      await expect(service.createManyTemplates(templates)).rejects.toThrow(
        'Invalid template : Name is required'
      );
      expect(mockRepository.createMany).not.toHaveBeenCalled();
    });
  });
});
