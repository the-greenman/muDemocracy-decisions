/**
 * Drizzle implementation of IFlaggedDecisionRepository
 */
import type { FlaggedDecision, CreateFlaggedDecision } from '@repo/schema';
interface IFlaggedDecisionRepository {
    create(data: CreateFlaggedDecision): Promise<FlaggedDecision>;
    findById(id: string): Promise<FlaggedDecision | null>;
    findByMeetingId(meetingId: string): Promise<FlaggedDecision[]>;
    update(id: string, data: Partial<Omit<CreateFlaggedDecision, 'meetingId'>>): Promise<FlaggedDecision | null>;
    updateStatus(id: string, status: FlaggedDecision['status']): Promise<FlaggedDecision | null>;
}
export declare class DrizzleFlaggedDecisionRepository implements IFlaggedDecisionRepository {
    create(data: CreateFlaggedDecision): Promise<FlaggedDecision>;
    findByMeetingId(meetingId: string): Promise<FlaggedDecision[]>;
    findById(id: string): Promise<FlaggedDecision | null>;
    update(id: string, data: Partial<Omit<CreateFlaggedDecision, 'meetingId'>>): Promise<FlaggedDecision | null>;
    updatePriority(id: string, priority: number): Promise<FlaggedDecision | null>;
    updateStatus(id: string, status: FlaggedDecision['status']): Promise<FlaggedDecision | null>;
    private mapToSchema;
}
export {};
