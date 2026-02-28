/**
 * Unit tests for Expert Advice Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpertAdviceService } from '../services/expert-advice-service';
import type { 
  IExpertAdviceHistoryRepository,
  IExpertTemplateRepository,
  ExpertAdvice,
  CreateExpertAdvice,
  ExpertTemplate
} from '@repo/core';

describe('ExpertAdviceService', () => {
  let service: ExpertAdviceService;
  let mockAdviceRepository: IExpertAdviceHistoryRepository;
  let mockExpertTemplateRepository: IExpertTemplateRepository;

  beforeEach(() => {
    mockAdviceRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByDecisionContextId: vi.fn(),
      findByExpertId: vi.fn(),
      findByDateRange: vi.fn(),
      findRecent: vi.fn(),
      getAdviceCountByExpert: vi.fn(),
      getAdviceCountByDecision: vi.fn(),
    };

    mockExpertTemplateRepository = {
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

    service = new ExpertAdviceService(
      mockAdviceRepository,
      mockExpertTemplateRepository
    );
    vi.clearAllMocks();
  });

  describe('createAdvice', () => {
    it('should create valid advice', async () => {
      const expert: ExpertTemplate = {
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

      const data: CreateExpertAdvice = {
        decisionContextId: '550e8400-e29b-41d4-a716-446655440004',
        expertId: expert.id,
        expertName: expert.name,
        request: 'Please review this decision',
        response: {
          suggestions: ['Consider option A'],
          concerns: ['Risk: High cost'],
        },
      };

      const expectedAdvice: ExpertAdvice = {
        id: '550e8400-e29b-41d4-a716-446655440012',
        decisionContextId: data.decisionContextId,
        expertId: data.expertId,
        expertName: data.expertName,
        advice: data.response,
        confidence: undefined,
        reasoning: undefined,
        mcpToolsUsed: undefined,
        createdAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockExpertTemplateRepository.findById).mockResolvedValue(expert);
      vi.mocked(mockAdviceRepository.create).mockResolvedValue(expectedAdvice);

      const result = await service.createAdvice(data);

      expect(result).toEqual(expectedAdvice);
      expect(mockExpertTemplateRepository.findById).toHaveBeenCalledWith(data.expertId);
      expect(mockAdviceRepository.create).toHaveBeenCalledWith(data);
    });

    it('should throw error for invalid advice', async () => {
      const data: CreateExpertAdvice = {
        decisionContextId: '',
        expertId: '',
        expertName: '',
        request: '',
        response: null as any,
      };

      await expect(service.createAdvice(data)).rejects.toThrow(
        'Invalid advice: Decision context ID is required, Expert ID is required, Expert name is required, Request is required, Response is required'
      );
    });

    it('should throw error if expert is not active', async () => {
      const expert: ExpertTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        name: 'Test Expert',
        displayName: 'Test Expert',
        description: undefined,
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: [],
        outputSchema: undefined,
        isActive: false, // Inactive
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      const data: CreateExpertAdvice = {
        decisionContextId: '550e8400-e29b-41d4-a716-446655440004',
        expertId: expert.id,
        expertName: expert.name,
        request: 'Please review this decision',
        response: { suggestions: ['Consider option A'] },
      };

      vi.mocked(mockExpertTemplateRepository.findById).mockResolvedValue(expert);

      await expect(service.createAdvice(data)).rejects.toThrow(
        'Invalid advice: Expert is not active: Test Expert'
      );
    });
  });

  describe('consultExpert', () => {
    it('should create advice from expert consultation', async () => {
      const expert: ExpertTemplate = {
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

      const expertId = expert.id;
      const decisionContextId = '550e8400-e29b-41d4-a716-446655440004';
      const request = 'Should we use microservices?';

      const expectedAdvice: ExpertAdvice = {
        id: '550e8400-e29b-41d4-a716-446655440012',
        decisionContextId,
        expertId,
        expertName: expert.name,
        advice: {
          suggestions: [
            `Based on the request: "${request}", I recommend considering the following options...`,
            'Please review the implications of each option carefully.'
          ],
          concerns: [
            'Ensure all stakeholders are consulted before making a final decision.'
          ],
          questions: [
            'What is the timeline for this decision?',
            'What resources are available?'
          ]
        },
        confidence: undefined,
        reasoning: undefined,
        mcpToolsUsed: [],
        createdAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockExpertTemplateRepository.findById).mockResolvedValue(expert);
      vi.mocked(mockAdviceRepository.create).mockResolvedValue(expectedAdvice);

      const result = await service.consultExpert(expertId, decisionContextId, request);

      expect(result).toEqual(expectedAdvice);
      expect(mockExpertTemplateRepository.findById).toHaveBeenCalledWith(expertId);
      expect(mockAdviceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          decisionContextId,
          expertId,
          expertName: expert.name,
          request,
        })
      );
    });

    it('should throw error if expert not found', async () => {
      vi.mocked(mockExpertTemplateRepository.findById).mockResolvedValue(null);

      await expect(
        service.consultExpert('non-existent', 'decision-123', 'Test request')
      ).rejects.toThrow('Expert template not found: non-existent');
    });

    it('should throw error if expert is not active', async () => {
      const expert: ExpertTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        name: 'Test Expert',
        displayName: 'Test Expert',
        description: undefined,
        type: 'technical',
        promptTemplate: 'You are a technical expert',
        mcpAccess: [],
        outputSchema: undefined,
        isActive: false,
        createdAt: '2026-02-27T10:00:00Z',
        updatedAt: '2026-02-27T10:00:00Z',
      };

      vi.mocked(mockExpertTemplateRepository.findById).mockResolvedValue(expert);

      await expect(
        service.consultExpert(expert.id, 'decision-123', 'Test request')
      ).rejects.toThrow('Expert is not active: Test Expert');
    });
  });

  describe('getAdviceByDecisionContext', () => {
    it('should return advice by decision context', async () => {
      const advice: ExpertAdvice[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440012',
          decisionContextId: 'decision-123',
          expertId: 'expert-1',
          expertName: 'Expert 1',
          advice: { suggestions: ['Option A'] },
          confidence: undefined,
          reasoning: undefined,
          mcpToolsUsed: undefined,
          createdAt: '2026-02-27T10:00:00Z',
        },
      ];

      vi.mocked(mockAdviceRepository.findByDecisionContextId).mockResolvedValue(advice);

      const result = await service.getAdviceByDecisionContext('decision-123');

      expect(result).toEqual(advice);
      expect(mockAdviceRepository.findByDecisionContextId).toHaveBeenCalledWith('decision-123');
    });
  });

  describe('getAdviceByExpert', () => {
    it('should return advice by expert', async () => {
      const advice: ExpertAdvice[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440012',
          decisionContextId: 'decision-123',
          expertId: 'expert-1',
          expertName: 'Expert 1',
          advice: { suggestions: ['Option A'] },
          confidence: undefined,
          reasoning: undefined,
          mcpToolsUsed: undefined,
          createdAt: '2026-02-27T10:00:00Z',
        },
      ];

      vi.mocked(mockAdviceRepository.findByExpertId).mockResolvedValue(advice);

      const result = await service.getAdviceByExpert('expert-1');

      expect(result).toEqual(advice);
      expect(mockAdviceRepository.findByExpertId).toHaveBeenCalledWith('expert-1');
    });
  });

  describe('getRecentAdvice', () => {
    it('should return recent advice with default limit', async () => {
      const advice: ExpertAdvice[] = [];

      vi.mocked(mockAdviceRepository.findRecent).mockResolvedValue(advice);

      const result = await service.getRecentAdvice();

      expect(result).toEqual(advice);
      expect(mockAdviceRepository.findRecent).toHaveBeenCalledWith(10);
    });

    it('should return recent advice with custom limit', async () => {
      const advice: ExpertAdvice[] = [];

      vi.mocked(mockAdviceRepository.findRecent).mockResolvedValue(advice);

      const result = await service.getRecentAdvice(5);

      expect(result).toEqual(advice);
      expect(mockAdviceRepository.findRecent).toHaveBeenCalledWith(5);
    });
  });

  describe('getAdviceCountByExpert', () => {
    it('should return advice count by expert', async () => {
      vi.mocked(mockAdviceRepository.getAdviceCountByExpert).mockResolvedValue(5);

      const result = await service.getAdviceCountByExpert('expert-1');

      expect(result).toBe(5);
      expect(mockAdviceRepository.getAdviceCountByExpert).toHaveBeenCalledWith('expert-1');
    });
  });

  describe('getAdviceCountByDecision', () => {
    it('should return advice count by decision', async () => {
      vi.mocked(mockAdviceRepository.getAdviceCountByDecision).mockResolvedValue(3);

      const result = await service.getAdviceCountByDecision('decision-123');

      expect(result).toBe(3);
      expect(mockAdviceRepository.getAdviceCountByDecision).toHaveBeenCalledWith('decision-123');
    });
  });
});
