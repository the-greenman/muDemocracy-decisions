import type { ITranscriptionProvider, TranscriptionResult } from "./interface.js";

type FetchLike = typeof fetch;

interface LocalWhisperSegment {
  id?: number;
  text?: string;
  start?: number;
  end?: number;
}

interface LocalWhisperResponse {
  text?: string;
  segments?: LocalWhisperSegment[];
}

export class LocalWhisperProvider implements ITranscriptionProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    if (!baseUrl.trim()) {
      throw new Error("WHISPER_LOCAL_URL is required for the local provider");
    }
  }

  async transcribe(
    audio: Buffer,
    options: { filename: string; language?: string },
  ): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append("audio_file", new Blob([new Uint8Array(audio)]), options.filename);

    if (options.language !== undefined) {
      formData.append("language", options.language);
    }

    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/asr?output=json`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Local Whisper transcription failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as LocalWhisperResponse;
    const events = (payload.segments ?? [])
      .map((segment, index) => ({
        text: segment.text?.trim() ?? "",
        sequenceNumber: index + 1,
        ...(segment.start === undefined ? {} : { startTimeSeconds: segment.start }),
        ...(segment.end === undefined ? {} : { endTimeSeconds: segment.end }),
      }))
      .filter((event) => event.text.length > 0);

    return {
      events,
      rawResponse: payload,
    };
  }
}
