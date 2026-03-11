/**
 * Interface for Decision Context Service
 * Manages draft state, field locking, and field-specific transcript retrieval
 */

import type { DecisionContext, CreateDecisionContext, UpdateDecisionContext } from '@repo/schema';

export interface DraftVersionSummary {
  version: number;
  savedAt: string;
  fieldCount: number;
}

export interface IDecisionContextService {
  // Context management
  createContext(data: CreateDecisionContext): Promise<DecisionContext>;
  changeTemplate(id: string, templateId: string): Promise<DecisionContext | null>;
  updateDraftData(id: string, data: Record<string, any>): Promise<DecisionContext | null>;
  setFieldValue(id: string, fieldId: string, value: unknown): Promise<DecisionContext | null>;
  saveSnapshot(id: string): Promise<DecisionContext | null>;
  rollback(id: string, version: number): Promise<DecisionContext | null>;
  listVersions(id: string): Promise<DraftVersionSummary[]>;
  
  // Field management
  lockField(id: string, fieldId: string): Promise<DecisionContext | null>;
  unlockField(id: string, fieldId: string): Promise<DecisionContext | null>;
  setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null>;
  
  // Status transitions
  submitForReview(id: string): Promise<DecisionContext | null>;
  approveAndLock(id: string): Promise<DecisionContext | null>;
  reopenForEditing(id: string): Promise<DecisionContext | null>;
  
  // Queries
  getById(id: string): Promise<DecisionContext | null>;
  getContextByFlaggedDecision(flaggedDecisionId: string): Promise<DecisionContext | null>;
  getAllContextsForMeeting(meetingId: string): Promise<DecisionContext[]>;

  // Meta updates
  updateMeta(id: string, data: UpdateDecisionContext): Promise<DecisionContext | null>;
}
