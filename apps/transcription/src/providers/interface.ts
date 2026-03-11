export interface TranscriptEvent {
  text: string;
  speaker?: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  sequenceNumber?: number;
}

export interface TranscriptionResult {
  events: TranscriptEvent[];
  rawResponse: unknown;
}

export interface ITranscriptionProvider {
  transcribe(
    audio: Buffer,
    options: { filename: string; language?: string },
  ): Promise<TranscriptionResult>;
}
