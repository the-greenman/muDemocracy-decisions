/**
 * Interface for Decision Context Service
 * Manages draft state, field locking, and field-specific transcript retrieval
 */

import type { DecisionContext, CreateDecisionContext } from '@repo/core';

export interface IDecisionContextService {
  // Context management
  createContext(data: CreateDecisionContext): Promise<DecisionContext>;
  updateDraftData(id: string, data: Record<string, any>): Promise<DecisionContext | null>;
  
  // Field management
  lockField(id: string, fieldId: string): Promise<DecisionContext | null>;
  unlockField(id: string, fieldId: string): Promise<DecisionContext | null>;
  setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null>;
  
  // Status transitions
  submitForReview(id: string): Promise<DecisionContext | null>;
  approveAndLock(id: string): Promise<DecisionContext | null>;
  reopenForEditing(id: string): Promise<DecisionContext | null>;
  
  // Queries
  getContextByFlaggedDecision(flaggedDecisionId: string): Promise<DecisionContext | null>;
  getAllContextsForMeeting(meetingId: string): Promise<DecisionContext[]>;
}
