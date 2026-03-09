/**
 * DrizzleMeetingRepository
 *
 * PostgreSQL-backed implementation of IMeetingRepository using Drizzle ORM.
 */
import { Meeting, CreateMeeting } from '@repo/schema';
export declare class DrizzleMeetingRepository {
    create(data: CreateMeeting): Promise<Meeting>;
    findById(id: string): Promise<Meeting | null>;
    findAll(): Promise<Meeting[]>;
    update(id: string, data: Partial<Pick<CreateMeeting, 'title' | 'participants'>>): Promise<Meeting>;
    updateStatus(id: string, status: 'active' | 'completed'): Promise<Meeting>;
    private mapToMeeting;
}
