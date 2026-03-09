/**
 * Drizzle implementation of IChunkRelevanceRepository
 */
import { ChunkRelevance } from '@repo/schema';
export declare class DrizzleChunkRelevanceRepository {
    upsert(data: Omit<ChunkRelevance, 'id' | 'taggedAt'>): Promise<ChunkRelevance>;
    findByDecisionField(decisionContextId: string, fieldId: string): Promise<ChunkRelevance[]>;
    deleteByChunk(chunkId: string): Promise<void>;
    findByChunk(chunkId: string): Promise<ChunkRelevance[]>;
    private mapToSchema;
}
