import type { DecisionLog } from '@repo/schema';
import type { LogDecisionOptions } from '../services/decision-log-service';

export interface IDecisionLogGenerator {
  logDecision(decisionContextId: string, options: LogDecisionOptions): Promise<DecisionLog | null>;
}
