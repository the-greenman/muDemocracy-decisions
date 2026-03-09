/**
 * Drizzle implementation of IDecisionContextWindowRepository
 */
import { DecisionContextWindow, TranscriptChunk } from '@repo/schema';
export declare class DrizzleDecisionContextWindowRepository {
    createOrUpdate(data: Omit<DecisionContextWindow, 'id' | 'createdAt' | 'updatedAt'>): Promise<DecisionContextWindow>;
    findByDecisionContextId(decisionContextId: string): Promise<DecisionContextWindow[]>;
    preview(decisionContextId: string, _strategy: string, limit?: number): Promise<{
        chunks: TranscriptChunk[];
        totalTokens: number;
        estimatedRelevance: Record<string, number>;
    }>;
    private mapToSchema;
    private mapChunkToSchema;
}
