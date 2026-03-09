/**
 * Drizzle implementation of IRawTranscriptRepository
 */
import { RawTranscript, CreateRawTranscript } from '@repo/schema';
export declare class DrizzleRawTranscriptRepository {
    create(data: CreateRawTranscript): Promise<RawTranscript>;
    findByMeetingId(meetingId: string): Promise<RawTranscript[]>;
    findById(id: string): Promise<RawTranscript | null>;
    updateMetadata(id: string, metadata: Record<string, unknown>): Promise<RawTranscript | null>;
    private mapToSchema;
}
