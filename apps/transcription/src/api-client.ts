import type { TranscriptEvent } from "./providers/interface.js";
import { ApiRequestError } from "./stream-delivery.js";
import { formatSecondsAsTimestamp } from "./time.js";

type FetchLike = typeof fetch;

interface UploadTranscriptResponse {
  transcript: { id: string };
  chunks: Array<{ id: string }>;
}

interface CreateMeetingResponse {
  id: string;
}

interface TranscriptReadingResponse {
  rows: Array<{ id: string; displayText: string; startTime?: string; endTime?: string }>;
}

export class DecisionLoggerApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async postStreamEvent(meetingId: string, event: TranscriptEvent): Promise<void> {
    await this.request(`/api/meetings/${meetingId}/transcripts/stream`, {
      method: "POST",
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
      method: "POST",
      body: {},
    });
  }

  async createMeeting(payload: {
    title: string;
    date: string;
    participants: string[];
  }): Promise<CreateMeetingResponse> {
    return this.request<CreateMeetingResponse>("/api/meetings", {
      method: "POST",
      body: payload,
    });
  }

  async uploadWhisperJson(
    meetingId: string,
    rawResponse: unknown,
    chunkStrategy: "fixed" | "semantic" | "speaker" | "streaming" = "speaker",
  ): Promise<UploadTranscriptResponse> {
    return this.request<UploadTranscriptResponse>(`/api/meetings/${meetingId}/transcripts/upload`, {
      method: "POST",
      body: {
        content: JSON.stringify(rawResponse),
        format: "json",
        chunkStrategy,
      },
    });
  }

  async getTranscriptReading(meetingId: string): Promise<TranscriptReadingResponse> {
    return this.request<TranscriptReadingResponse>(
      `/api/meetings/${meetingId}/transcript-reading`,
      {
        method: "GET",
      },
    );
  }

  private async request<T>(
    path: string,
    options: {
      method: "GET" | "POST";
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.apiKey !== undefined) {
      headers["x-api-key"] = this.apiKey;
    }

    const requestInit: RequestInit = {
      method: options.method,
      headers,
    };
    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}${path}`, requestInit);

    if (!response.ok) {
      const body = await response.text();
      throw new ApiRequestError(
        `Core API request failed (${response.status}) for ${path}: ${body}`,
        response.status,
        path,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
