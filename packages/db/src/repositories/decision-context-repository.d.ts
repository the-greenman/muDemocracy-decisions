/**
 * Drizzle implementation of IDecisionContextRepository
 */
import { DecisionContext, CreateDecisionContext } from '@repo/schema';
interface IDecisionContextRepository {
    create(data: CreateDecisionContext): Promise<DecisionContext>;
    findById(id: string): Promise<DecisionContext | null>;
    findByMeetingId(meetingId: string): Promise<DecisionContext[]>;
    findByFlaggedDecisionId(flaggedDecisionId: string): Promise<DecisionContext | null>;
    update(id: string, data: Partial<DecisionContext>): Promise<DecisionContext | null>;
    lockField(id: string, fieldId: string): Promise<DecisionContext | null>;
    unlockField(id: string, fieldId: string): Promise<DecisionContext | null>;
    lockAllFields(id: string): Promise<DecisionContext | null>;
    setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null>;
    updateStatus(id: string, status: DecisionContext['status']): Promise<DecisionContext | null>;
}
export declare class DrizzleDecisionContextRepository implements IDecisionContextRepository {
    create(data: CreateDecisionContext): Promise<DecisionContext>;
    findById(id: string): Promise<DecisionContext | null>;
    findByMeetingId(meetingId: string): Promise<DecisionContext[]>;
    findByFlaggedDecisionId(flaggedDecisionId: string): Promise<DecisionContext | null>;
    update(id: string, data: Partial<DecisionContext>): Promise<DecisionContext | null>;
    lockField(id: string, fieldId: string): Promise<DecisionContext | null>;
    unlockField(id: string, fieldId: string): Promise<DecisionContext | null>;
    lockAllFields(id: string): Promise<DecisionContext | null>;
    setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null>;
    updateStatus(id: string, status: DecisionContext['status']): Promise<DecisionContext | null>;
    private mapToSchema;
}
export {};
