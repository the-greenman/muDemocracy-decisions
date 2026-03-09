/**
 * Drizzle implementation of IDecisionLogRepository
 */
import { DecisionLog } from '@repo/schema';
type CreateDecisionLog = Omit<DecisionLog, 'id' | 'loggedAt'>;
interface IDecisionLogRepository {
    create(data: CreateDecisionLog): Promise<DecisionLog>;
    findById(id: string): Promise<DecisionLog | null>;
    findByMeetingId(meetingId: string): Promise<DecisionLog[]>;
    findByDecisionContextId(decisionContextId: string): Promise<DecisionLog[]>;
    findByLoggedBy(loggedBy: string): Promise<DecisionLog[]>;
    findByDateRange(startDate: Date, endDate: Date): Promise<DecisionLog[]>;
    countByMeetingId(meetingId: string): Promise<number>;
}
export declare class DrizzleDecisionLogRepository implements IDecisionLogRepository {
    create(data: CreateDecisionLog): Promise<DecisionLog>;
    findById(id: string): Promise<DecisionLog | null>;
    findByMeetingId(meetingId: string): Promise<DecisionLog[]>;
    findByDecisionContextId(decisionContextId: string): Promise<DecisionLog[]>;
    findByLoggedBy(loggedBy: string): Promise<DecisionLog[]>;
    findByDateRange(startDate: Date, endDate: Date): Promise<DecisionLog[]>;
    countByMeetingId(meetingId: string): Promise<number>;
    private mapToSchema;
}
export {};
