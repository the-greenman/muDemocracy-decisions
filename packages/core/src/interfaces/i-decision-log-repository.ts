/**
 * Interface for Decision Log Repository
 * Handles immutable decision recording
 */

import type { DecisionLog, CreateDecisionLog } from "@repo/schema";

export interface IDecisionLogRepository {
  /**
   * Creates a new decision log entry
   */
  create(data: CreateDecisionLog): Promise<DecisionLog>;

  /**
   * Finds a decision log by ID
   */
  findById(id: string): Promise<DecisionLog | null>;

  /**
   * Finds all decision logs for a specific meeting
   */
  findByMeetingId(meetingId: string): Promise<DecisionLog[]>;

  /**
   * Finds all decision logs for a specific decision context
   */
  findByDecisionContextId(decisionContextId: string): Promise<DecisionLog[]>;

  /**
   * Finds all decision logs logged by a specific user
   */
  findByLoggedBy(loggedBy: string): Promise<DecisionLog[]>;

  /**
   * Finds decision logs within a date range
   */
  findByDateRange(startDate: Date, endDate: Date): Promise<DecisionLog[]>;

  /**
   * Counts total decisions logged for a meeting
   */
  countByMeetingId(meetingId: string): Promise<number>;
}
