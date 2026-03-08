/**
 * TranscriptService - Business logic for transcript management
 */

import {
  IRawTranscriptRepository,
  ITranscriptChunkRepository,
  IStreamingBufferRepository,
  IChunkRelevanceRepository,
  IDecisionContextWindowRepository,
} from '../interfaces/transcript-repositories';
import {
  RawTranscript,
  TranscriptChunk,
  CreateRawTranscript,
  CreateTranscriptChunk,
  ChunkRelevance,
  DecisionContextWindow,
} from '@repo/schema';

export interface TranscriptUploadData {
  meetingId: string;
  source: 'upload' | 'stream' | 'import';
  format: 'json' | 'txt' | 'vtt' | 'srt';
  content: string;
  metadata?: Record<string, any>;
  uploadedBy?: string;
}

export interface StreamEventData {
  type: 'text' | 'metadata';
  data: {
    text?: string;
    speaker?: string;
    startTime?: string;
    endTime?: string;
    rawTranscriptId?: string;
    contexts?: string[];
    topics?: string[];
    [key: string]: any;
  };
}

export interface ChunkCreationOptions {
  strategy: 'fixed' | 'semantic' | 'speaker' | 'streaming';
  maxTokens?: number;
  overlap?: number;
  minChunkSize?: number;
}

export interface AddTranscriptTextData {
  meetingId: string;
  text: string;
  speaker?: string;
  startTime?: string;
  endTime?: string;
  contexts?: string[];
  topics?: string[];
  uploadedBy?: string;
}

export class TranscriptService {
  constructor(
    private rawTranscriptRepo: IRawTranscriptRepository,
    private chunkRepo: ITranscriptChunkRepository,
    private streamingBuffer: IStreamingBufferRepository,
    private relevanceRepo: IChunkRelevanceRepository,
    private contextWindowRepo: IDecisionContextWindowRepository,
  ) {}

  // Raw transcript management
  async uploadTranscript(data: TranscriptUploadData): Promise<RawTranscript> {
    const createData: CreateRawTranscript = {
      meetingId: data.meetingId,
      source: data.source,
      format: data.format,
      content: data.content,
      metadata: data.metadata,
      uploadedBy: data.uploadedBy,
    };

    const transcript = await this.rawTranscriptRepo.create(createData);

    return transcript;
  }

  async getTranscriptsByMeeting(meetingId: string): Promise<RawTranscript[]> {
    return this.rawTranscriptRepo.findByMeetingId(meetingId);
  }

  async addTranscriptText(data: AddTranscriptTextData): Promise<TranscriptChunk> {
    const transcript = await this.rawTranscriptRepo.create({
      meetingId: data.meetingId,
      source: 'stream',
      format: 'txt',
      content: data.text,
      uploadedBy: data.uploadedBy,
      metadata: {
        incremental: true,
      },
    });

    const existingChunks = await this.chunkRepo.findByMeetingId(data.meetingId);
    const nextSequenceNumber = existingChunks.length === 0
      ? 1
      : Math.max(...existingChunks.map((chunk) => chunk.sequenceNumber)) + 1;

    const contexts = Array.from(new Set([
      `meeting:${data.meetingId}`,
      ...(data.contexts ?? []),
    ]));

    return this.addChunk({
      meetingId: data.meetingId,
      rawTranscriptId: transcript.id,
      sequenceNumber: nextSequenceNumber,
      text: data.text,
      speaker: data.speaker,
      startTime: data.startTime,
      endTime: data.endTime,
      chunkStrategy: 'streaming',
      tokenCount: this.estimateTokens(data.text),
      wordCount: data.text.split(/\s+/).filter(Boolean).length,
      contexts,
      topics: data.topics,
    });
  }

  // Chunk management
  async addChunk(data: CreateTranscriptChunk): Promise<TranscriptChunk> {
    // Auto-tag with meeting context
    if (!data.contexts) {
      data.contexts = [`meeting:${data.meetingId}`];
    } else if (!data.contexts.includes(`meeting:${data.meetingId}`)) {
      data.contexts.push(`meeting:${data.meetingId}`);
    }

    return this.chunkRepo.create(data);
  }

  async getChunksByMeeting(meetingId: string): Promise<TranscriptChunk[]> {
    return this.chunkRepo.findByMeetingId(meetingId);
  }

  async getChunksByContext(contextTag: string): Promise<TranscriptChunk[]> {
    return this.chunkRepo.findByContext(contextTag);
  }

  async searchChunks(meetingId: string, query: string): Promise<TranscriptChunk[]> {
    return this.chunkRepo.search(meetingId, query);
  }

  async processTranscript(
    rawTranscriptId: string,
    options: ChunkCreationOptions = { strategy: 'fixed' }
  ): Promise<TranscriptChunk[]> {
    return this.chunkTranscript(rawTranscriptId, options);
  }

  private async chunkTranscript(
    rawTranscriptId: string,
    options: ChunkCreationOptions
  ): Promise<TranscriptChunk[]> {
    const rawTranscript = await this.rawTranscriptRepo.findById(rawTranscriptId);
    if (!rawTranscript) {
      throw new Error('Raw transcript not found');
    }

    const chunks: TranscriptChunk[] = [];
    const { strategy, maxTokens = 500, overlap = 50 } = options;

    // Two strategies:
    // - fixed: token/word-count based chunks
    // - semantic: sentence-boundary aware chunks (still bounded by maxTokens)
    if (strategy === 'semantic') {
      const sentences = rawTranscript.content
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      let currentParts: string[] = [];
      let currentTokens = 0;
      let sequenceNumber = 1;

      for (const sentence of sentences) {
        const sentenceTokens = this.estimateTokens(sentence);

        // If adding this sentence would exceed the chunk budget, flush first.
        if (currentParts.length > 0 && currentTokens + sentenceTokens > maxTokens) {
          const chunkText = currentParts.join(' ');
          const chunk = await this.addChunk({
            meetingId: rawTranscript.meetingId,
            rawTranscriptId,
            sequenceNumber: sequenceNumber++,
            text: chunkText,
            chunkStrategy: strategy,
            tokenCount: this.estimateTokens(chunkText),
            wordCount: chunkText.split(/\s+/).filter(Boolean).length,
            contexts: [`meeting:${rawTranscript.meetingId}`],
          });
          chunks.push(chunk);

          // Sentence overlap is applied as an approximation using last N sentences.
          const overlapSentences = Math.max(0, Math.floor(overlap / 25));
          currentParts = overlapSentences > 0 ? currentParts.slice(-overlapSentences) : [];
          currentTokens = this.estimateTokens(currentParts.join(' '));
        }

        currentParts.push(sentence);
        currentTokens += sentenceTokens;
      }

      if (currentParts.length > 0) {
        const chunkText = currentParts.join(' ');
        const chunk = await this.addChunk({
          meetingId: rawTranscript.meetingId,
          rawTranscriptId,
          sequenceNumber,
          text: chunkText,
          chunkStrategy: strategy,
          tokenCount: this.estimateTokens(chunkText),
          wordCount: chunkText.split(/\s+/).filter(Boolean).length,
          contexts: [`meeting:${rawTranscript.meetingId}`],
        });
        chunks.push(chunk);
      }
    } else {
      const words = rawTranscript.content.split(/\s+/).filter(Boolean);
      let currentChunk: string[] = [];
      let currentTokens = 0;
      let sequenceNumber = 1;

      for (const word of words) {
        currentChunk.push(word);
        currentTokens++;

        if (currentTokens >= maxTokens) {
          const chunkText = currentChunk.join(' ');
          const chunk = await this.addChunk({
            meetingId: rawTranscript.meetingId,
            rawTranscriptId,
            sequenceNumber: sequenceNumber++,
            text: chunkText,
            chunkStrategy: strategy,
            tokenCount: this.estimateTokens(chunkText),
            wordCount: currentChunk.length,
            contexts: [`meeting:${rawTranscript.meetingId}`],
          });
          chunks.push(chunk);

          currentChunk = currentChunk.slice(-Math.floor(overlap));
          currentTokens = currentChunk.length;
        }
      }

      if (currentChunk.length > 0) {
        const chunkText = currentChunk.join(' ');
        const chunk = await this.addChunk({
          meetingId: rawTranscript.meetingId,
          rawTranscriptId,
          sequenceNumber,
          text: chunkText,
          chunkStrategy: strategy,
          tokenCount: this.estimateTokens(chunkText),
          wordCount: currentChunk.length,
          contexts: [`meeting:${rawTranscript.meetingId}`],
        });
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  // Streaming buffer management
  async addStreamEvent(meetingId: string, event: StreamEventData): Promise<void> {
    await this.streamingBuffer.appendEvent(meetingId, event);
  }

  async getStreamStatus(meetingId: string): Promise<{ status: string; eventCount: number }> {
    return this.streamingBuffer.getStatus(meetingId);
  }

  async flushStream(meetingId: string): Promise<TranscriptChunk[]> {
    return this.streamingBuffer.flush(meetingId);
  }

  async clearStream(meetingId: string): Promise<void> {
    await this.streamingBuffer.clear(meetingId);
  }

  // Chunk relevance management
  async tagChunkRelevance(data: Omit<ChunkRelevance, 'id' | 'taggedAt'>): Promise<ChunkRelevance> {
    return this.relevanceRepo.upsert(data);
  }

  async getRelevantChunks(decisionContextId: string, fieldId: string): Promise<ChunkRelevance[]> {
    return this.relevanceRepo.findByDecisionField(decisionContextId, fieldId);
  }

  // Context window management
  async createContextWindow(
    decisionContextId: string,
    strategy: 'recent' | 'relevant' | 'weighted',
    usedFor: 'draft' | 'regenerate' | 'field-specific'
  ): Promise<DecisionContextWindow> {
    // Get relevant chunks based on strategy
    const preview = await this.contextWindowRepo.preview(decisionContextId, strategy);
    
    return this.contextWindowRepo.createOrUpdate({
      decisionContextId,
      chunkIds: preview.chunks.map(c => c.id),
      selectionStrategy: strategy,
      totalTokens: preview.totalTokens,
      totalChunks: preview.chunks.length,
      relevanceScores: preview.estimatedRelevance,
      usedFor,
    });
  }

  async getContextWindows(decisionContextId: string): Promise<DecisionContextWindow[]> {
    return this.contextWindowRepo.findByDecisionContextId(decisionContextId);
  }

  // Utility methods
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
