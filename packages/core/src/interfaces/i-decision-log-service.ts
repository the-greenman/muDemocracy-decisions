/**
 * Interface for Decision Log Service
 */

import type { DecisionLog } from "@repo/schema";

export interface IDecisionLogService {
  /**
   * Logs a final decision from a decision context
   */
  logDecision(
    decisionContextId: string,
    options: {
      loggedBy: string;
      decisionMethod: {
        type: "consensus" | "vote" | "authority" | "defer" | "reject" | "manual" | "ai_assisted";
        details?: string;
      };
      context?: {
        correlationId?: string;
        requestId?: string;
        clientInfo?: string;
      };
    },
  ): Promise<DecisionLog | null>;

  /**
   * Retrieves a decision log by ID
   */
  getDecisionLog(id: string): Promise<DecisionLog | null>;

  /**
   * Gets all decision logs for a meeting
   */
  getMeetingDecisionLogs(meetingId: string): Promise<DecisionLog[]>;

  /**
   * Gets all decision logs for a specific decision context
   */
  getDecisionContextLogs(decisionContextId: string): Promise<DecisionLog[]>;

  /**
   * Gets all decision logs logged by a specific user
   */
  getUserDecisionLogs(loggedBy: string): Promise<DecisionLog[]>;

  /**
   * Gets decision logs within a date range
   */
  getDecisionLogsByDateRange(startDate: Date, endDate: Date): Promise<DecisionLog[]>;

  /**
   * Gets statistics about decisions for a meeting
   */
  getMeetingDecisionStats(meetingId: string): Promise<{
    totalDecisions: number;
    decisionsByMethod: Record<string, number>;
    decisionsByUser: Record<string, number>;
  }>;
}
