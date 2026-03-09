/**
 * Drizzle implementation of IStreamingBufferRepository
 *
 * Note: This is a simplified implementation that stores events in memory
 * and creates chunks when flushed. In a production environment, this might
 * use Redis or another streaming solution.
 */
import { TranscriptChunk } from '@repo/schema';
export declare class DrizzleStreamingBufferRepository {
    appendEvent(meetingId: string, event: any): Promise<void>;
    getStatus(meetingId: string): Promise<{
        status: string;
        eventCount: number;
    }>;
    flush(meetingId: string): Promise<TranscriptChunk[]>;
    clear(meetingId: string): Promise<void>;
    private estimateTokenCount;
    private countWords;
    private mapToSchema;
}
