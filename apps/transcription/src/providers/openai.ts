import type { ITranscriptionProvider, TranscriptEvent, TranscriptionResult } from './interface.js';

type FetchLike = typeof fetch;

interface OpenAIVerboseSegment {
  id?: number;
  text?: string;
  start?: number;
  end?: number;
}

interface OpenAIVerboseResponse {
  text?: string;
  segments?: OpenAIVerboseSegment[];
}

export class OpenAIWhisperProvider implements ITranscriptionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    if (!apiKey.trim()) {
      throw new Error('OPENAI_API_KEY is required for the OpenAI provider');
    }
  }

  async transcribe(
    audio: Buffer,
    options: { filename: string; language?: string },
  ): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('file', new Blob([new Uint8Array(audio)]), options.filename);

    if (options.language !== undefined) {
      formData.append('language', options.language);
    }

    const response = await this.fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI transcription failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as OpenAIVerboseResponse;
    const events = this.mapSegments(payload.segments ?? []);

    return {
      events,
      rawResponse: payload,
    };
  }

  private mapSegments(segments: OpenAIVerboseSegment[]): TranscriptEvent[] {
    return segments
      .map((segment) => {
        const event: TranscriptEvent = {
          text: segment.text?.trim() ?? '',
        };
        if (segment.id !== undefined) {
          event.sequenceNumber = segment.id;
        }
        if (segment.start !== undefined) {
          event.startTimeSeconds = segment.start;
        }
        if (segment.end !== undefined) {
          event.endTimeSeconds = segment.end;
        }

        return event;
      })
      .filter((event) => event.text.length > 0);
  }
}
