import type { RawTranscript } from "@repo/schema";

export interface CanonicalTranscriptSegment {
  sequenceNumber: number;
  text: string;
  speaker?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  sourceMetadata?: Record<string, unknown>;
}

export interface TranscriptPreprocessResult {
  processorId: string;
  processorVersion: string;
  segments: CanonicalTranscriptSegment[];
  warnings: string[];
  stats: {
    inputUnitCount: number;
    outputSegmentCount: number;
    durationMs: number;
  };
}

export interface TranscriptPreprocessor {
  id: string;
  version: string;
  canProcess(input: RawTranscript): boolean;
  process(input: RawTranscript): Promise<TranscriptPreprocessResult>;
}

type WhisperLikeSegment = {
  text?: string;
  speaker?: string | null;
  start?: number;
  end?: number;
  startTimeMs?: number;
  endTimeMs?: number;
  start_ms?: number;
  end_ms?: number;
  [key: string]: unknown;
};

class WhisperTranscriptPreprocessor implements TranscriptPreprocessor {
  id = "whisper_canonical";
  version = "1";

  canProcess(input: RawTranscript): boolean {
    if (input.format !== "json") {
      return false;
    }

    const parsed = this.tryParse(input.content);
    if (!parsed) {
      return false;
    }

    const segments = this.extractSegments(parsed);
    return (
      segments.length > 0 &&
      segments.every(
        (segment) => typeof segment.text === "string" && segment.text.trim().length > 0,
      )
    );
  }

  async process(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const startedAt = Date.now();
    const parsed = this.tryParse(input.content);
    if (!parsed) {
      throw new Error("Invalid JSON transcript payload");
    }

    const rawSegments = this.extractSegments(parsed);
    if (rawSegments.length === 0) {
      throw new Error("JSON transcript payload does not contain any transcript segments");
    }

    const segments = rawSegments
      .map((segment, index) => this.toCanonicalSegment(segment, index))
      .filter((segment): segment is CanonicalTranscriptSegment => segment !== null);

    if (segments.length === 0) {
      throw new Error("JSON transcript payload does not contain any non-empty transcript segments");
    }

    return {
      processorId: this.id,
      processorVersion: this.version,
      segments,
      warnings: [],
      stats: {
        inputUnitCount: rawSegments.length,
        outputSegmentCount: segments.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  private tryParse(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private extractSegments(parsed: unknown): WhisperLikeSegment[] {
    if (Array.isArray(parsed)) {
      return parsed as WhisperLikeSegment[];
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { segments?: unknown }).segments)
    ) {
      return (parsed as { segments: WhisperLikeSegment[] }).segments;
    }

    return [];
  }

  private toCanonicalSegment(
    segment: WhisperLikeSegment,
    index: number,
  ): CanonicalTranscriptSegment | null {
    const text = typeof segment.text === "string" ? segment.text.trim() : "";
    if (!text) {
      return null;
    }

    const startTimeMs = this.normalizeTime(
      segment.startTimeMs ?? segment.start_ms ?? segment.start,
    );
    const endTimeMs = this.normalizeTime(segment.endTimeMs ?? segment.end_ms ?? segment.end);

    const canonicalSegment: CanonicalTranscriptSegment = {
      sequenceNumber: index + 1,
      text,
      sourceMetadata: {
        originalIndex: index,
      },
    };

    if (typeof segment.speaker === "string" && segment.speaker.trim().length > 0) {
      canonicalSegment.speaker = segment.speaker.trim();
    }
    if (startTimeMs !== undefined) {
      canonicalSegment.startTimeMs = startTimeMs;
    }
    if (endTimeMs !== undefined) {
      canonicalSegment.endTimeMs = endTimeMs;
    }

    return canonicalSegment;
  }

  private normalizeTime(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }

    return value >= 1000 ? Math.round(value) : Math.round(value * 1000);
  }
}

class PlainTextTranscriptPreprocessor implements TranscriptPreprocessor {
  id = "plain_text_blocks";
  version = "1";
  private readonly maxCharactersPerSegment = 420;
  private readonly minCharactersPerSegment = 80;

  canProcess(input: RawTranscript): boolean {
    return ["txt", "srt", "vtt"].includes(input.format);
  }

  async process(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    const blocks = input.content
      .split(/\n\s*\n+/)
      .map((block) => this.normalizeWhitespace(block))
      .filter((block) => block.length > 0);

    const sourceBlocks =
      blocks.length > 0 ? blocks : [this.normalizeWhitespace(input.content)].filter(Boolean);
    const segments = sourceBlocks.flatMap((block, index) => this.splitBlock(block, index));

    if (segments.length === 0) {
      throw new Error("Transcript content is empty after normalization");
    }

    if (segments.length > sourceBlocks.length) {
      warnings.push("Oversized transcript blocks were split into multiple normalized segments");
    }

    return {
      processorId: this.id,
      processorVersion: this.version,
      segments,
      warnings,
      stats: {
        inputUnitCount: sourceBlocks.length,
        outputSegmentCount: segments.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  private splitBlock(block: string, blockIndex: number): CanonicalTranscriptSegment[] {
    if (block.length <= this.maxCharactersPerSegment) {
      return [
        {
          sequenceNumber: blockIndex + 1,
          text: block,
          sourceMetadata: {
            sourceBlockIndex: blockIndex,
          },
        },
      ];
    }

    const sentences = block
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => this.normalizeWhitespace(sentence))
      .filter(Boolean);

    if (sentences.length <= 1) {
      return this.splitByLength(block, blockIndex);
    }

    const segments: CanonicalTranscriptSegment[] = [];
    let current = "";
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (
        candidate.length <= this.maxCharactersPerSegment ||
        current.length < this.minCharactersPerSegment
      ) {
        current = candidate;
        continue;
      }

      segments.push({
        sequenceNumber: segments.length + 1,
        text: current,
        sourceMetadata: {
          sourceBlockIndex: blockIndex,
          splitStrategy: "sentence",
          chunkIndex,
        },
      });
      current = sentence;
      chunkIndex += 1;
    }

    if (current) {
      segments.push({
        sequenceNumber: segments.length + 1,
        text: current,
        sourceMetadata: {
          sourceBlockIndex: blockIndex,
          splitStrategy: "sentence",
          chunkIndex,
        },
      });
    }

    return segments;
  }

  private splitByLength(block: string, blockIndex: number): CanonicalTranscriptSegment[] {
    const words = block.split(/\s+/).filter(Boolean);
    const segments: CanonicalTranscriptSegment[] = [];
    let currentWords: string[] = [];
    let chunkIndex = 0;

    for (const word of words) {
      const candidate = [...currentWords, word].join(" ");
      if (candidate.length <= this.maxCharactersPerSegment || currentWords.length === 0) {
        currentWords.push(word);
        continue;
      }

      segments.push({
        sequenceNumber: segments.length + 1,
        text: currentWords.join(" "),
        sourceMetadata: {
          sourceBlockIndex: blockIndex,
          splitStrategy: "length",
          chunkIndex,
        },
      });
      currentWords = [word];
      chunkIndex += 1;
    }

    if (currentWords.length > 0) {
      segments.push({
        sequenceNumber: segments.length + 1,
        text: currentWords.join(" "),
        sourceMetadata: {
          sourceBlockIndex: blockIndex,
          splitStrategy: "length",
          chunkIndex,
        },
      });
    }

    return segments;
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }
}

export class TranscriptPreprocessorRegistry {
  constructor(private preprocessors: TranscriptPreprocessor[]) {}

  preprocess(input: RawTranscript): Promise<TranscriptPreprocessResult> {
    const preprocessor = this.preprocessors.find((candidate) => candidate.canProcess(input));
    if (!preprocessor) {
      throw new Error(`No transcript preprocessor available for format ${input.format}`);
    }

    return preprocessor.process(input);
  }
}

export function createDefaultTranscriptPreprocessorRegistry(): TranscriptPreprocessorRegistry {
  return new TranscriptPreprocessorRegistry([
    new WhisperTranscriptPreprocessor(),
    new PlainTextTranscriptPreprocessor(),
  ]);
}
