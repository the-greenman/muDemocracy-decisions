/**
 * Drizzle implementation of ITranscriptChunkRepository
 */
import { TranscriptChunk } from '@repo/schema';
export declare class DrizzleTranscriptChunkRepository {
    create(data: any): Promise<TranscriptChunk>;
    findByMeetingId(meetingId: string): Promise<TranscriptChunk[]>;
    findByContext(contextTag: string): Promise<TranscriptChunk[]>;
    findById(id: string): Promise<TranscriptChunk | null>;
    search(meetingId: string, query: string): Promise<TranscriptChunk[]>;
    findByDecisionContext(decisionContextId: string): Promise<TranscriptChunk[]>;
    private mapToSchema;
}
