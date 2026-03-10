/**
 * Repository interface for Flagged Decision operations
 */

import { FlaggedDecision, CreateFlaggedDecision } from '@repo/schema';

export interface IFlaggedDecisionRepository {
  // Create operations
  create(data: CreateFlaggedDecision): Promise<FlaggedDecision>;

  // Read operations
  findByMeetingId(meetingId: string): Promise<FlaggedDecision[]>;
  findById(id: string): Promise<FlaggedDecision | null>;

  // Update operations
  update(id: string, data: Partial<Omit<CreateFlaggedDecision, 'meetingId'>>): Promise<FlaggedDecision | null>;
  updatePriority(id: string, priority: number): Promise<FlaggedDecision | null>;
  updateStatus(id: string, status: FlaggedDecision['status']): Promise<FlaggedDecision | null>;
  delete(id: string): Promise<boolean>;
}
