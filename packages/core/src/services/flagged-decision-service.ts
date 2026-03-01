/**
 * Service for managing flagged decisions
 * Implements business logic and validation
 */

import type { IFlaggedDecisionService } from '../interfaces/i-flagged-decision-service';
import type { IFlaggedDecisionRepository } from '../interfaces/i-flagged-decision-repository';
import type { FlaggedDecision, CreateFlaggedDecision } from '@repo/schema';

export class FlaggedDecisionService implements IFlaggedDecisionService {
  constructor(private repository: IFlaggedDecisionRepository) {}

  async createFlaggedDecision(data: CreateFlaggedDecision): Promise<FlaggedDecision> {
    // Validate confidence is between 0 and 1
    if (data.confidence < 0 || data.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    // Validate at least one chunk ID is provided
    if (data.chunkIds.length === 0) {
      throw new Error('At least one chunk ID is required');
    }

    // Create the flagged decision
    return await this.repository.create(data);
  }

  async getDecisionsForMeeting(meetingId: string): Promise<FlaggedDecision[]> {
    return await this.repository.findByMeetingId(meetingId);
  }

  async updateDecisionStatus(
    decisionId: string,
    status: FlaggedDecision['status']
  ): Promise<FlaggedDecision> {
    // Check if decision exists
    const existing = await this.repository.findById(decisionId);
    if (!existing) {
      throw new Error('Decision not found');
    }

    // Update the status
    const updated = await this.repository.updateStatus(decisionId, status);
    if (!updated) {
      throw new Error('Failed to update decision status');
    }

    return updated;
  }

  async prioritizeDecisions(
    decisionIds: string[],
    priorities: number[]
  ): Promise<void> {
    // Validate input arrays match
    if (decisionIds.length !== priorities.length) {
      throw new Error('Decision IDs and priorities must have the same length');
    }

    // Update each decision's priority
    for (let i = 0; i < decisionIds.length; i++) {
      const decisionId = decisionIds[i];
      const priority = priorities[i];
      if (decisionId === undefined || priority === undefined) {
        throw new Error('Decision IDs and priorities must have the same length');
      }

      // Check if decision exists
      const existing = await this.repository.findById(decisionId);
      if (!existing) {
        throw new Error(`Decision with ID ${decisionId} not found`);
      }

      // Update priority
      const updated = await this.repository.updatePriority(decisionId, priority);
      if (!updated) {
        throw new Error(`Failed to update priority for decision ${decisionId}`);
      }
    }
  }
}
