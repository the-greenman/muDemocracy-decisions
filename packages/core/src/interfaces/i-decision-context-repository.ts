/**
 * Interface for Decision Context repository operations
 * Manages draft state, field locking, and field-specific transcript retrieval
 */

import type { DecisionContext, CreateDecisionContext } from "@repo/schema";

export interface IDecisionContextRepository {
  // Basic CRUD operations
  create(data: CreateDecisionContext): Promise<DecisionContext>;
  findById(id: string): Promise<DecisionContext | null>;
  findByMeetingId(meetingId: string): Promise<DecisionContext[]>;
  findByFlaggedDecisionId(flaggedDecisionId: string): Promise<DecisionContext | null>;
  update(id: string, data: Partial<DecisionContext>): Promise<DecisionContext | null>;

  // Field management
  lockField(id: string, fieldId: string): Promise<DecisionContext | null>;
  unlockField(id: string, fieldId: string): Promise<DecisionContext | null>;
  lockAllFields(id: string): Promise<DecisionContext | null>;
  setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null>;

  // Status management
  updateStatus(id: string, status: DecisionContext["status"]): Promise<DecisionContext | null>;
}
