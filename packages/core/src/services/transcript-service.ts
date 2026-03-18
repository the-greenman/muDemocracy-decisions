/**
 * TranscriptService - Business logic for transcript management
 */

import { logger } from "../logger/index.js";
import {
  IRawTranscriptRepository,
  ITranscriptChunkRepository,
  IStreamingBufferRepository,
  IChunkRelevanceRepository,
  IDecisionContextWindowRepository,
} from "../interfaces/transcript-repositories.js";
import {
  RawTranscript,
  ReadableTranscriptRow,
  TranscriptChunk,
  CreateRawTranscript,
  CreateTranscriptChunk,
  ChunkRelevance,
  DecisionContextWindow,
} from "@repo/schema";
import {
  createDefaultTranscriptPreprocessorRegistry,
  type CanonicalTranscriptSegment,
  type TranscriptPreprocessorRegistry,
} from "../transcript-preprocessing.js";

export interface TranscriptUploadData {
  meetingId: string;
  source: "upload" | "stream" | "import";
  format: "json" | "txt" | "vtt" | "srt" | "chat-json" | "chat-txt";
  content: string;
  metadata?: Record<string, any>;
  uploadedBy?: string;
  streamEpochMs?: number;
}

export interface StreamEventData {
  type: "text" | "metadata";
  data: {
    text?: string;
    speaker?: string;
    startTime?: string;
    endTime?: string;
    rawTranscriptId?: string;
    contexts?: string[];
    topics?: string[];
    streamSource?: string;
    [key: string]: any;
  };
}

export interface ChunkCreationOptions {
  strategy: "fixed" | "semantic" | "speaker" | "streaming";
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
  contentType?: "speech" | "message";
  startTimeMs?: number;
  endTimeMs?: number;
  messageId?: string;
  threadId?: string;
}

export interface AssignChunkContextsData {
  meetingId: string;
  chunkIds: string[];
  contexts: string[];
}

export class TranscriptService {
  constructor(
    private rawTranscriptRepo: IRawTranscriptRepository,
    private chunkRepo: ITranscriptChunkRepository,
    private streamingBuffer: IStreamingBufferRepository,
    private relevanceRepo: IChunkRelevanceRepository,
    private contextWindowRepo: IDecisionContextWindowRepository,
    private preprocessorRegistry: TranscriptPreprocessorRegistry = createDefaultTranscriptPreprocessorRegistry(),
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
      ...(data.streamEpochMs !== undefined ? { streamEpochMs: data.streamEpochMs } : {}),
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
      source: "stream",
      format: "txt",
      content: data.text,
      uploadedBy: data.uploadedBy,
      metadata: {
        incremental: true,
      },
    });

    const existingChunks = await this.chunkRepo.findByMeetingId(data.meetingId);
    const nextSequenceNumber =
      existingChunks.length === 0
        ? 1
        : Math.max(...existingChunks.map((chunk) => chunk.sequenceNumber)) + 1;

    const contexts = Array.from(new Set([`meeting:${data.meetingId}`, ...(data.contexts ?? [])]));

    return this.addChunk({
      meetingId: data.meetingId,
      rawTranscriptId: transcript.id,
      sequenceNumber: nextSequenceNumber,
      text: data.text,
      speaker: data.speaker,
      startTime: data.startTime,
      endTime: data.endTime,
      chunkStrategy: "streaming",
      tokenCount: this.estimateTokens(data.text),
      wordCount: data.text.split(/\s+/).filter(Boolean).length,
      contexts,
      topics: data.topics,
      contentType: data.contentType ?? "speech",
      startTimeMs: data.startTimeMs,
      endTimeMs: data.endTimeMs,
      messageId: data.messageId,
      threadId: data.threadId,
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

  async assignContextsToChunks(data: AssignChunkContextsData): Promise<TranscriptChunk[]> {
    const chunkIds = Array.from(new Set(data.chunkIds));
    if (chunkIds.length === 0) {
      throw new Error("At least one chunk ID is required");
    }

    const contexts = Array.from(
      new Set(
        data.contexts.map((context) => context.trim()).filter((context) => context.length > 0),
      ),
    );
    if (contexts.length === 0) {
      throw new Error("At least one context tag is required");
    }

    const meetingChunkIds = new Set(
      (await this.chunkRepo.findByMeetingId(data.meetingId)).map((chunk) => chunk.id),
    );
    const missing = chunkIds.filter((chunkId) => !meetingChunkIds.has(chunkId));
    if (missing.length > 0) {
      throw new Error(`Chunk ${missing[0]} not found for meeting ${data.meetingId}`);
    }

    return this.chunkRepo.addContexts(chunkIds, contexts);
  }

  async searchChunks(meetingId: string, query: string): Promise<TranscriptChunk[]> {
    return this.chunkRepo.search(meetingId, query);
  }

  async tagChunksByTimeRange(
    meetingId: string,
    fromMs: number,
    toMs: number,
    contexts: string[],
  ): Promise<number> {
    return this.chunkRepo.addContextsByTimeRange(meetingId, fromMs, toMs, contexts);
  }

  async processTranscript(
    rawTranscriptId: string,
    options: ChunkCreationOptions = { strategy: "fixed" },
  ): Promise<TranscriptChunk[]> {
    return this.chunkTranscript(rawTranscriptId, options);
  }

  private async chunkTranscript(
    rawTranscriptId: string,
    options: ChunkCreationOptions,
  ): Promise<TranscriptChunk[]> {
    const rawTranscript = await this.rawTranscriptRepo.findById(rawTranscriptId);
    if (!rawTranscript) {
      throw new Error("Raw transcript not found");
    }

    const chunks: TranscriptChunk[] = [];
    const { strategy, maxTokens = 500, overlap = 50 } = options;
    const preprocessResult = await this.preprocessorRegistry.preprocess(rawTranscript);
    const normalizedContent = preprocessResult.segments.map((segment) => segment.text).join("\n\n");

    const existingMetadata = rawTranscript.metadata ?? {};
    await this.rawTranscriptRepo.updateMetadata(rawTranscript.id, {
      ...existingMetadata,
      preprocessing: {
        processorId: preprocessResult.processorId,
        processorVersion: preprocessResult.processorVersion,
        warnings: preprocessResult.warnings,
        stats: preprocessResult.stats,
      },
    });

    logger.info("Transcript preprocessing completed", {
      rawTranscriptId,
      processorId: preprocessResult.processorId,
      warnings: preprocessResult.warnings,
      inputUnits: preprocessResult.stats.inputUnitCount,
      outputSegments: preprocessResult.stats.outputSegmentCount,
      durationMs: preprocessResult.stats.durationMs,
    });

    // Two strategies:
    // - fixed: token/word-count based chunks
    // - semantic: sentence-boundary aware chunks (still bounded by maxTokens)
    if (strategy === "semantic") {
      const sentences = normalizedContent
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
          const chunkText = currentParts.join(" ");
          const chunk = await this.addChunk({
            meetingId: rawTranscript.meetingId,
            rawTranscriptId,
            sequenceNumber: sequenceNumber++,
            text: chunkText,
            chunkStrategy: strategy,
            tokenCount: this.estimateTokens(chunkText),
            wordCount: chunkText.split(/\s+/).filter(Boolean).length,
            contexts: [`meeting:${rawTranscript.meetingId}`],
            contentType: "speech",
          });
          chunks.push(chunk);

          // Sentence overlap is applied as an approximation using last N sentences.
          const overlapSentences = Math.max(0, Math.floor(overlap / 25));
          currentParts = overlapSentences > 0 ? currentParts.slice(-overlapSentences) : [];
          currentTokens = this.estimateTokens(currentParts.join(" "));
        }

        currentParts.push(sentence);
        currentTokens += sentenceTokens;
      }

      if (currentParts.length > 0) {
        const chunkText = currentParts.join(" ");
        const chunk = await this.addChunk({
          meetingId: rawTranscript.meetingId,
          rawTranscriptId,
          sequenceNumber,
          text: chunkText,
          chunkStrategy: strategy,
          tokenCount: this.estimateTokens(chunkText),
          wordCount: chunkText.split(/\s+/).filter(Boolean).length,
          contexts: [`meeting:${rawTranscript.meetingId}`],
          contentType: "speech",
        });
        chunks.push(chunk);
      }
    } else {
      const words = normalizedContent.split(/\s+/).filter(Boolean);
      let currentChunk: string[] = [];
      let currentTokens = 0;
      let sequenceNumber = 1;

      for (const word of words) {
        currentChunk.push(word);
        currentTokens++;

        if (currentTokens >= maxTokens) {
          const chunkText = currentChunk.join(" ");
          const chunk = await this.addChunk({
            meetingId: rawTranscript.meetingId,
            rawTranscriptId,
            sequenceNumber: sequenceNumber++,
            text: chunkText,
            chunkStrategy: strategy,
            tokenCount: this.estimateTokens(chunkText),
            wordCount: currentChunk.length,
            contexts: [`meeting:${rawTranscript.meetingId}`],
            contentType: "speech",
          });
          chunks.push(chunk);

          currentChunk = currentChunk.slice(-Math.floor(overlap));
          currentTokens = currentChunk.length;
        }
      }

      if (currentChunk.length > 0) {
        const chunkText = currentChunk.join(" ");
        const chunk = await this.addChunk({
          meetingId: rawTranscript.meetingId,
          rawTranscriptId,
          sequenceNumber,
          text: chunkText,
          chunkStrategy: strategy,
          tokenCount: this.estimateTokens(chunkText),
          wordCount: currentChunk.length,
          contexts: [`meeting:${rawTranscript.meetingId}`],
          contentType: "speech",
        });
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  async preprocessTranscript(rawTranscriptId: string): Promise<CanonicalTranscriptSegment[]> {
    const rawTranscript = await this.rawTranscriptRepo.findById(rawTranscriptId);
    if (!rawTranscript) {
      throw new Error("Raw transcript not found");
    }

    const result = await this.preprocessorRegistry.preprocess(rawTranscript);
    return result.segments;
  }

  async getReadableTranscriptRows(meetingId: string): Promise<ReadableTranscriptRow[]> {
    const transcripts = await this.rawTranscriptRepo.findByMeetingId(meetingId);
    const chunks = await this.chunkRepo.findByMeetingId(meetingId);
    const chunksByTranscriptId = new Map<string, TranscriptChunk[]>();
    for (const chunk of chunks) {
      const existingChunks = chunksByTranscriptId.get(chunk.rawTranscriptId) ?? [];
      existingChunks.push(chunk);
      chunksByTranscriptId.set(chunk.rawTranscriptId, existingChunks);
    }

    const rowsByTranscript = await Promise.all(
      transcripts.map(async (rawTranscript) => {
        const result = await this.preprocessorRegistry.preprocess(rawTranscript);
        const transcriptChunks = chunksByTranscriptId.get(rawTranscript.id) ?? [];
        return result.segments.map((segment) =>
          this.toReadableTranscriptRow(rawTranscript, segment, transcriptChunks),
        );
      }),
    );

    return rowsByTranscript.flat().sort((left, right) => {
      if (left.rawTranscriptUploadedAt !== right.rawTranscriptUploadedAt) {
        return left.rawTranscriptUploadedAt.localeCompare(right.rawTranscriptUploadedAt);
      }

      return left.sequenceNumber - right.sequenceNumber;
    });
  }

  private toReadableTranscriptRow(
    rawTranscript: RawTranscript,
    segment: CanonicalTranscriptSegment,
    transcriptChunks: TranscriptChunk[],
  ): ReadableTranscriptRow {
    const row: ReadableTranscriptRow = {
      id: `${rawTranscript.id}:${segment.sequenceNumber}`,
      meetingId: rawTranscript.meetingId,
      rawTranscriptId: rawTranscript.id,
      rawTranscriptUploadedAt: rawTranscript.uploadedAt,
      rawTranscriptFormat: rawTranscript.format,
      sequenceNumber: segment.sequenceNumber ?? 0,
      displayText: segment.text,
      chunkIds: this.resolveChunkIdsForSegment(segment, transcriptChunks),
    };

    if (segment.speaker !== undefined) {
      row.speaker = segment.speaker;
    } else {
      const matchingChunk = transcriptChunks.find((c) => row.chunkIds.includes(c.id));
      if (matchingChunk?.speaker) {
        row.speaker = matchingChunk.speaker;
      }
    }

    const startTime = this.formatTimestamp(segment.startTimeMs);
    if (startTime !== undefined) {
      row.startTime = startTime;
    }

    const endTime = this.formatTimestamp(segment.endTimeMs);
    if (endTime !== undefined) {
      row.endTime = endTime;
    }

    if (segment.sourceMetadata !== undefined) {
      row.sourceMetadata = segment.sourceMetadata;
    }

    return row;
  }

  private resolveChunkIdsForSegment(
    segment: CanonicalTranscriptSegment,
    chunks: TranscriptChunk[],
  ): string[] {
    if (chunks.length === 0) {
      return [];
    }

    const normalizedSegmentText = this.normalizeTranscriptText(segment.text);
    if (!normalizedSegmentText) {
      return [];
    }

    const directMatches = chunks.filter((chunk) => {
      const normalizedChunkText = this.normalizeTranscriptText(chunk.text);
      return normalizedChunkText.includes(normalizedSegmentText);
    });
    if (directMatches.length > 0) {
      return directMatches.map((chunk) => chunk.id);
    }

    const segmentTokens = normalizedSegmentText.split(" ").filter(Boolean);
    if (segmentTokens.length === 0) {
      return [];
    }

    const significantTokenSample = segmentTokens
      .slice(0, Math.min(8, segmentTokens.length))
      .join(" ");
    return chunks
      .filter((chunk) => this.normalizeTranscriptText(chunk.text).includes(significantTokenSample))
      .map((chunk) => chunk.id);
  }

  private normalizeTranscriptText(text: string): string {
    return text.replace(/\s+/g, " ").trim().toLowerCase();
  }

  private formatTimestamp(timeMs: number | undefined): string | undefined {
    if (timeMs === undefined) {
      return undefined;
    }

    const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
  }

  // Streaming buffer management
  async addStreamEvent(meetingId: string, event: StreamEventData): Promise<void> {
    await this.streamingBuffer.appendEvent(meetingId, event);
  }

  async getStreamStatus(meetingId: string): Promise<{ status: "active" | "idle"; eventCount: number }> {
    return this.streamingBuffer.getStatus(meetingId);
  }

  async flushStream(meetingId: string): Promise<TranscriptChunk[]> {
    return this.streamingBuffer.flush(meetingId);
  }

  async clearStream(meetingId: string): Promise<void> {
    await this.streamingBuffer.clear(meetingId);
  }

  // Chunk relevance management
  async tagChunkRelevance(data: Omit<ChunkRelevance, "id" | "taggedAt">): Promise<ChunkRelevance> {
    return this.relevanceRepo.upsert(data);
  }

  async getRelevantChunks(decisionContextId: string, fieldId: string): Promise<ChunkRelevance[]> {
    return this.relevanceRepo.findByDecisionField(decisionContextId, fieldId);
  }

  // Context window management
  async createContextWindow(
    decisionContextId: string,
    strategy: "recent" | "relevant" | "weighted",
    usedFor: "draft" | "regenerate" | "field-specific",
  ): Promise<DecisionContextWindow> {
    // Get relevant chunks based on strategy
    const preview = await this.contextWindowRepo.preview(decisionContextId, strategy);

    return this.contextWindowRepo.createOrUpdate({
      decisionContextId,
      chunkIds: preview.chunks.map((c) => c.id),
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

  async previewContextWindow(
    decisionContextId: string,
    strategy: "all" | "recent" | "relevant" | "weighted",
    limit: number = 10,
  ): Promise<{
    chunks: TranscriptChunk[];
    totalTokens: number;
    estimatedRelevance: Record<string, number>;
  }> {
    return this.contextWindowRepo.preview(decisionContextId, strategy, limit);
  }

  // Utility methods
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
