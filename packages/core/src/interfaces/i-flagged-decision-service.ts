/**
 * Service interface for Flagged Decision operations
 * Follows dependency injection pattern
 */

export interface IFlaggedDecisionService {
  /**
   * Create a new flagged decision
   */
  createFlaggedDecision(data: CreateFlaggedDecision): Promise<FlaggedDecision>;

  /**
   * Get all flagged decisions for a meeting, ordered by priority
   */
  getDecisionsForMeeting(meetingId: string): Promise<FlaggedDecision[]>;

  /**
   * Get a flagged decision by ID
   */
  getDecisionById(id: string): Promise<FlaggedDecision | null>;

  /**
   * Update a flagged decision
   */
  updateDecision(
    id: string,
    data: {
      suggestedTitle?: string;
      contextSummary?: string;
      status?: FlaggedDecision['status'];
      priority?: number;
      chunkIds?: string[];
    }
  ): Promise<FlaggedDecision | null>;

  /**
   * Resolve a sequence-based segment selection spec to persisted transcript chunk IDs.
   */
  resolveChunkIdsFromSequenceSpec(meetingId: string, segmentSpec: string): Promise<string[]>;

  /**
   * Update the status of a flagged decision
   */
  updateDecisionStatus(
    decisionId: string,
    status: FlaggedDecision['status']
  ): Promise<FlaggedDecision>;

  /**
   * Update the priority of a single decision
   */
  updateDecisionPriority(decisionId: string, priority: number): Promise<void>;

  /**
   * Update priorities for multiple decisions
   */
  prioritizeDecisions(
    decisionIds: string[],
    priorities: number[]
  ): Promise<void>;
}

// Import types
import type { FlaggedDecision, CreateFlaggedDecision } from '@repo/schema';
