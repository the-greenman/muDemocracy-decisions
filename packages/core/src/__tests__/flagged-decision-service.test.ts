/**
 * Unit tests for FlaggedDecisionService
 * Following TDD approach - tests written first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlaggedDecisionService } from '../../src/services/flagged-decision-service';
import type { FlaggedDecision, CreateFlaggedDecision } from '@repo/schema';
import { randomUUID } from 'crypto';

// Mock repository for testing
const mockRepository = {
  create: vi.fn(),
  findByMeetingId: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  updatePriority: vi.fn(),
  updateStatus: vi.fn(),
} as any; // Using any for simplicity since we're testing

describe('FlaggedDecisionService', () => {
  let service: FlaggedDecisionService;
  let testMeetingId: string;

  beforeEach(() => {
    service = new FlaggedDecisionService(mockRepository);
    testMeetingId = randomUUID();
    vi.clearAllMocks();
  });

  describe('createFlaggedDecision', () => {
    it('should create a flagged decision with valid data', async () => {
      const data: CreateFlaggedDecision = {
        meetingId: testMeetingId,
        suggestedTitle: 'Important Decision',
        contextSummary: 'This decision affects the architecture',
        confidence: 0.9,
        chunkIds: [randomUUID(), randomUUID()],
        priority: 5,
      };

      const expected: FlaggedDecision = {
        id: randomUUID(),
        ...data,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.create.mockResolvedValue(expected);

      const result = await service.createFlaggedDecision(data);

      expect(result).toEqual(expected);
      expect(mockRepository.create).toHaveBeenCalledWith(data);
    });

    it('should throw error for invalid confidence value', async () => {
      const data: CreateFlaggedDecision = {
        meetingId: testMeetingId,
        suggestedTitle: 'Decision',
        contextSummary: 'Context',
        confidence: 1.5, // Invalid: > 1
        chunkIds: [randomUUID()],
        priority: 3,
      };

      await expect(service.createFlaggedDecision(data)).rejects.toThrow(
        'Confidence must be between 0 and 1'
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for empty chunk IDs', async () => {
      const data: CreateFlaggedDecision = {
        meetingId: testMeetingId,
        suggestedTitle: 'Decision',
        contextSummary: 'Context',
        confidence: 0.8,
        chunkIds: [], // Invalid: empty array
        priority: 3,
      };

      await expect(service.createFlaggedDecision(data)).rejects.toThrow(
        'At least one chunk ID is required'
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getDecisionsForMeeting', () => {
    it('should return all decisions for a meeting ordered by priority', async () => {
      const decisions: FlaggedDecision[] = [
        {
          id: randomUUID(),
          meetingId: testMeetingId,
          suggestedTitle: 'High Priority',
          contextSummary: 'Context 1',
          confidence: 0.9,
          chunkIds: [randomUUID()],
          status: 'pending',
          priority: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: randomUUID(),
          meetingId: testMeetingId,
          suggestedTitle: 'Low Priority',
          contextSummary: 'Context 2',
          confidence: 0.7,
          chunkIds: [randomUUID()],
          status: 'pending',
          priority: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockRepository.findByMeetingId.mockResolvedValue(decisions);

      const result = await service.getDecisionsForMeeting(testMeetingId);

      expect(result).toEqual(decisions);
      expect(mockRepository.findByMeetingId).toHaveBeenCalledWith(testMeetingId);
    });

    it('should return empty array for meeting with no decisions', async () => {
      mockRepository.findByMeetingId.mockResolvedValue([]);

      const result = await service.getDecisionsForMeeting(testMeetingId);

      expect(result).toEqual([]);
      expect(mockRepository.findByMeetingId).toHaveBeenCalledWith(testMeetingId);
    });
  });

  describe('updateDecisionStatus', () => {
    it('should update decision status', async () => {
      const decisionId = randomUUID();
      const newStatus = 'accepted' as const;

      const existing: FlaggedDecision = {
        id: decisionId,
        meetingId: testMeetingId,
        suggestedTitle: 'Decision',
        contextSummary: 'Context',
        confidence: 0.8,
        chunkIds: [randomUUID()],
        status: 'pending',
        priority: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated: FlaggedDecision = {
        ...existing,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.updateStatus.mockResolvedValue(updated);

      const result = await service.updateDecisionStatus(decisionId, newStatus);

      expect(result).toEqual(updated);
      expect(mockRepository.findById).toHaveBeenCalledWith(decisionId);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(decisionId, newStatus);
    });

    it('should throw error for non-existent decision', async () => {
      const decisionId = randomUUID();

      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateDecisionStatus(decisionId, 'accepted')
      ).rejects.toThrow('Decision not found');
      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('prioritizeDecisions', () => {
    it('should update priority of multiple decisions', async () => {
      const decisionIds = [randomUUID(), randomUUID(), randomUUID()];
      const priorities = [10, 5, 1];

      for (let i = 0; i < decisionIds.length; i++) {
        const decisionId = decisionIds[i];
        const priority = priorities[i];
        if (decisionId === undefined || priority === undefined) {
          throw new Error('Decision IDs and priorities must have the same length');
        }

        const decision: FlaggedDecision = {
          id: decisionId,
          meetingId: testMeetingId,
          suggestedTitle: `Decision ${i}`,
          contextSummary: `Context ${i}`,
          confidence: 0.8,
          chunkIds: [randomUUID()],
          status: 'pending',
          priority: priority,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        mockRepository.findById.mockResolvedValueOnce(decision);
        mockRepository.updatePriority.mockResolvedValueOnce(decision);
      }

      await service.prioritizeDecisions(decisionIds, priorities);

      for (let i = 0; i < decisionIds.length; i++) {
        expect(mockRepository.findById).toHaveBeenCalledWith(decisionIds[i]);
        expect(mockRepository.updatePriority).toHaveBeenCalledWith(
          decisionIds[i],
          priorities[i]
        );
      }
    });

    it('should throw error for mismatched arrays', async () => {
      const decisionIds = [randomUUID(), randomUUID()];
      const priorities = [10]; // Mismatched length

      await expect(
        service.prioritizeDecisions(decisionIds, priorities)
      ).rejects.toThrow('Decision IDs and priorities must have the same length');
    });
  });

  describe('getDecisionById', () => {
    it('should return a decision when found', async () => {
      const decisionId = randomUUID();
      const expected: FlaggedDecision = {
        id: decisionId,
        meetingId: testMeetingId,
        suggestedTitle: 'Test Decision',
        contextSummary: 'Test Context',
        confidence: 0.8,
        chunkIds: [randomUUID()],
        status: 'pending',
        priority: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(expected);

      const result = await service.getDecisionById(decisionId);

      expect(mockRepository.findById).toHaveBeenCalledWith(decisionId);
      expect(result).toEqual(expected);
    });

    it('should return null when decision not found', async () => {
      const decisionId = randomUUID();
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getDecisionById(decisionId);

      expect(mockRepository.findById).toHaveBeenCalledWith(decisionId);
      expect(result).toBeNull();
    });
  });

  describe('updateDecision', () => {
    it('should update only allowed fields', async () => {
      const decisionId = randomUUID();
      const existing: FlaggedDecision = {
        id: decisionId,
        meetingId: testMeetingId,
        suggestedTitle: 'Original Title',
        contextSummary: 'Original Context',
        confidence: 0.8,
        chunkIds: [randomUUID()],
        status: 'pending',
        priority: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated: FlaggedDecision = {
        ...existing,
        suggestedTitle: 'Updated Title',
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateDecision(decisionId, {
        suggestedTitle: 'Updated Title',
        status: 'accepted',
      });

      expect(mockRepository.findById).toHaveBeenCalledWith(decisionId);
      expect(mockRepository.update).toHaveBeenCalledWith(decisionId, {
        suggestedTitle: 'Updated Title',
        status: 'accepted',
      });
      expect(result).toEqual(updated);
    });

    it('should throw error when decision not found', async () => {
      const decisionId = randomUUID();
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateDecision(decisionId, { suggestedTitle: 'New Title' })
      ).rejects.toThrow('Decision not found');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateDecisionPriority', () => {
    it('should update priority of a single decision', async () => {
      const decisionId = randomUUID();
      const existing: FlaggedDecision = {
        id: decisionId,
        meetingId: testMeetingId,
        suggestedTitle: 'Test Decision',
        contextSummary: 'Test Context',
        confidence: 0.8,
        chunkIds: [randomUUID()],
        status: 'pending',
        priority: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.updatePriority.mockResolvedValue(existing);

      await service.updateDecisionPriority(decisionId, 5);

      expect(mockRepository.findById).toHaveBeenCalledWith(decisionId);
      expect(mockRepository.updatePriority).toHaveBeenCalledWith(decisionId, 5);
    });

    it('should throw error for invalid priority', async () => {
      const decisionId = randomUUID();

      await expect(
        service.updateDecisionPriority(decisionId, 0)
      ).rejects.toThrow('Priority must be between 1 and 5');

      await expect(
        service.updateDecisionPriority(decisionId, 6)
      ).rejects.toThrow('Priority must be between 1 and 5');
    });

    it('should throw error when decision not found', async () => {
      const decisionId = randomUUID();
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateDecisionPriority(decisionId, 3)
      ).rejects.toThrow('Decision not found');
      expect(mockRepository.updatePriority).not.toHaveBeenCalled();
    });
  });
});
