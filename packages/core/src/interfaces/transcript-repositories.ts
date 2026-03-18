/**
 * Repository interfaces for transcript management
 */

import {
  RawTranscript,
  TranscriptChunk,
  ChunkRelevance,
  DecisionContextWindow,
  CreateRawTranscript,
  CreateTranscriptChunk,
} from "@repo/schema";

export interface IRawTranscriptRepository {
  create(data: CreateRawTranscript): Promise<RawTranscript>;
  findByMeetingId(meetingId: string): Promise<RawTranscript[]>;
  findById(id: string): Promise<RawTranscript | null>;
  updateMetadata(id: string, metadata: Record<string, unknown>): Promise<RawTranscript | null>;
}

export interface ITranscriptChunkRepository {
  create(data: CreateTranscriptChunk): Promise<TranscriptChunk>;
  findByMeetingId(meetingId: string): Promise<TranscriptChunk[]>;
  findByContext(contextTag: string): Promise<TranscriptChunk[]>;
  findById(id: string): Promise<TranscriptChunk | null>;
  search(meetingId: string, query: string): Promise<TranscriptChunk[]>;
  findByDecisionContext(decisionContextId: string): Promise<TranscriptChunk[]>;
  addContexts(chunkIds: string[], contexts: string[]): Promise<TranscriptChunk[]>;
  addContextsByTimeRange(meetingId: string, fromMs: number, toMs: number, contexts: string[]): Promise<number>;
}

export interface IStreamingBufferRepository {
  appendEvent(meetingId: string, event: any): Promise<void>;
  getStatus(meetingId: string): Promise<{ status: "active" | "idle"; eventCount: number }>;
  flush(meetingId: string): Promise<TranscriptChunk[]>;
  clear(meetingId: string): Promise<void>;
}

export interface IChunkRelevanceRepository {
  upsert(data: Omit<ChunkRelevance, "id" | "taggedAt">): Promise<ChunkRelevance>;
  findByDecisionField(decisionContextId: string, fieldId: string): Promise<ChunkRelevance[]>;
  deleteByChunk(chunkId: string): Promise<void>;
  findByChunk(chunkId: string): Promise<ChunkRelevance[]>;
}

export interface IDecisionContextWindowRepository {
  createOrUpdate(
    data: Omit<DecisionContextWindow, "id" | "createdAt" | "updatedAt">,
  ): Promise<DecisionContextWindow>;
  findByDecisionContextId(decisionContextId: string): Promise<DecisionContextWindow[]>;
  preview(
    decisionContextId: string,
    strategy: string,
    limit?: number,
  ): Promise<{
    chunks: TranscriptChunk[];
    totalTokens: number;
    estimatedRelevance: Record<string, number>;
  }>;
}
