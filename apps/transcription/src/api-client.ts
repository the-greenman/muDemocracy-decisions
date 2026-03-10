import type { TranscriptEvent } from './providers/interface.js';
import { formatSecondsAsTimestamp } from './time.js';

type FetchLike = typeof fetch;

interface UploadTranscriptResponse {
  transcript: { id: string };
  chunks: Array<{ id: string }>;
}

export class DecisionLoggerApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async postStreamEvent(meetingId: string, event: TranscriptEvent): Promise<void> {
    await this.request(`/api/meetings/${meetingId}/transcripts/stream`, {
      method: 'POST',
      body: {
        text: event.text,
        speaker: event.speaker,
        timestamp:
          event.startTimeSeconds === undefined
            ? undefined
            : formatSecondsAsTimestamp(event.startTimeSeconds),
        sequenceNumber: event.sequenceNumber,
      },
    });
  }

  async flushStream(meetingId: string): Promise<void> {
    await this.request(`/api/meetings/${meetingId}/streaming/flush`, {
      method: 'POST',
      body: {},
    });
  }

  async uploadWhisperJson(
    meetingId: string,
    rawResponse: unknown,
    chunkStrategy: 'fixed' | 'semantic' | 'speaker' | 'streaming' = 'speaker',
  ): Promise<UploadTranscriptResponse> {
    return this.request<UploadTranscriptResponse>(`/api/meetings/${meetingId}/transcripts/upload`, {
      method: 'POST',
      body: {
        content: JSON.stringify(rawResponse),
        format: 'json',
        chunkStrategy,
      },
    });
  }

  private async request<T>(
    path: string,
    options: {
      method: 'POST';
      body: Record<string, unknown>;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (this.apiKey !== undefined) {
      headers['x-api-key'] = this.apiKey;
    }

    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      method: options.method,
      headers,
      body: JSON.stringify(options.body),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Core API request failed (${response.status}) for ${path}: ${body}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
