/**
 * Interface for Expert Advice History Repository
 * Manages historical record of expert advice for decisions
 */

import type { ExpertAdvice, CreateExpertAdvice } from "@repo/schema";

export interface IExpertAdviceHistoryRepository {
  // Basic operations
  create(data: CreateExpertAdvice): Promise<ExpertAdvice>;
  findByDecisionContextId(decisionContextId: string): Promise<ExpertAdvice[]>;
  findByExpertId(expertId: string): Promise<ExpertAdvice[]>;
  findById(id: string): Promise<ExpertAdvice | null>;

  // Query operations
  findByDateRange(startDate: Date, endDate: Date): Promise<ExpertAdvice[]>;
  findRecent(limit: number): Promise<ExpertAdvice[]>;

  // Analytics
  getAdviceCountByExpert(expertId: string): Promise<number>;
  getAdviceCountByDecision(decisionContextId: string): Promise<number>;
}
