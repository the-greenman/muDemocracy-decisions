import type { RawTranscript, TranscriptChunk, ChunkRelevance, DecisionContextWindow } from '@repo/schema';
import type { CreateTranscriptChunk } from '@repo/schema';
import type { TranscriptUploadData, AddTranscriptTextData, ChunkCreationOptions, StreamEventData } from '../services/transcript-service';

export interface DecisionContextWindowPreview {
  chunks: TranscriptChunk[];
  totalTokens: number;
  estimatedRelevance: Record<string, number>;
}

export interface ITranscriptManager {
  uploadTranscript(data: TranscriptUploadData): Promise<RawTranscript>;
  getTranscriptsByMeeting(meetingId: string): Promise<RawTranscript[]>;
  addTranscriptText(data: AddTranscriptTextData): Promise<TranscriptChunk>;
  addChunk(data: CreateTranscriptChunk): Promise<TranscriptChunk>;
  getChunksByMeeting(meetingId: string): Promise<TranscriptChunk[]>;
  getChunksByContext(contextTag: string): Promise<TranscriptChunk[]>;
  searchChunks(meetingId: string, query: string): Promise<TranscriptChunk[]>;
  processTranscript(rawTranscriptId: string, options?: ChunkCreationOptions): Promise<TranscriptChunk[]>;
  addStreamEvent(meetingId: string, event: StreamEventData): Promise<void>;
  getStreamStatus(meetingId: string): Promise<{ status: string; eventCount: number }>;
  flushStream(meetingId: string): Promise<TranscriptChunk[]>;
  clearStream(meetingId: string): Promise<void>;
  tagChunkRelevance(data: Omit<ChunkRelevance, 'id' | 'taggedAt'>): Promise<ChunkRelevance>;
  createContextWindow(
    decisionContextId: string,
    selectionStrategy: DecisionContextWindow['selectionStrategy'],
    usedFor: DecisionContextWindow['usedFor'],
    maxTokens?: number,
    fieldId?: string,
  ): Promise<DecisionContextWindow>;
  getContextWindows(decisionContextId: string): Promise<DecisionContextWindow[]>;
  previewContextWindow(
    decisionContextId: string,
    selectionStrategy: DecisionContextWindow['selectionStrategy'],
    limit?: number,
  ): Promise<DecisionContextWindowPreview>;
}
