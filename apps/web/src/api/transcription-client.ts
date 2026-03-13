const TRANSCRIPTION_BASE_URL =
  (import.meta.env.VITE_TRANSCRIPTION_URL as string | undefined) ?? "http://localhost:8788";

type SessionCreateResponse = {
  sessionId: string;
  meetingId: string;
  startedAt: string;
  windowMs: number;
  stepMs: number;
  dedupeHorizonMs: number;
};

type SessionCreateRequest = {
  meetingId: string;
  language?: string;
  windowMs?: number;
  stepMs?: number;
  dedupeHorizonMs?: number;
};

type SessionStopResponse = {
  flushed: boolean;
  chunksPersisted?: number;
};

export type TranscriptionServiceStatus = {
  status: "ok";
  provider: "openai" | "local" | string;
  api: {
    url: string;
    ok: boolean;
    error?: string;
  };
  whisper: {
    enabled: boolean;
    url?: string;
    ok?: boolean;
    error?: string;
  };
  sessionCount: number;
  defaults: {
    windowMs: number;
    stepMs: number;
    dedupeHorizonMs: number;
    autoFlushMs: number;
  };
};

export type TranscriptionSessionStatus = {
  status: "active" | "stopping" | "stopped";
  bufferedEvents: number;
  postedEvents: number;
  dedupedEvents: number;
  windowMs: number;
  stepMs: number;
  dedupeHorizonMs: number;
  lastChunkReceivedAt?: string;
  lastTranscriptionAt?: string;
  lastProviderEventCount?: number;
  lastProviderTextPreview?: string;
  lastProviderError?: string;
};

export type TranscriptionDiagnosticTranscriptEvent = {
  text: string;
  speaker?: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  sequenceNumber?: number;
};

export type TranscriptionDiagnosticChunk = {
  receivedAt: string;
  filename: string;
  contentType?: string;
  originalByteLength: number;
  normalizedByteLength: number;
  rollingWindowChunkCount: number;
  rollingWindowAudioBytes: number;
};

export type TranscriptionDiagnosticActiveWindowChunk = {
  receivedAt: string;
  filename: string;
  normalizedByteLength: number;
};

export type TranscriptionDiagnosticWhisperResponse = {
  createdAt: string;
  filename: string;
  eventCount: number;
  textPreview: string;
  rawResponse: unknown;
  error?: string;
};

export type TranscriptionDiagnosticDeliveredEvent = {
  createdAt: string;
  meetingId: string;
  event: TranscriptionDiagnosticTranscriptEvent;
};

export type TranscriptionSessionDiagnostics = {
  sessionId: string;
  meetingId: string;
  status: "active" | "stopping" | "stopped";
  startedAt: string;
  stoppedAt?: string;
  windowMs: number;
  stepMs: number;
  dedupeHorizonMs: number;
  bufferedEvents: number;
  postedEvents: number;
  dedupedEvents: number;
  lastChunkReceivedAt?: string;
  lastTranscriptionAt?: string;
  lastProviderEventCount?: number;
  lastProviderTextPreview?: string;
  lastProviderError?: string;
  activeWindowChunks: TranscriptionDiagnosticActiveWindowChunk[];
  chunkTrace: TranscriptionDiagnosticChunk[];
  whisperResponses: TranscriptionDiagnosticWhisperResponse[];
  deliveredEvents: TranscriptionDiagnosticDeliveredEvent[];
};

export type TranscriptionDiagnosticsResponse = {
  status: "ok";
  sessions: TranscriptionSessionDiagnostics[];
};

async function transcriptionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${TRANSCRIPTION_BASE_URL}${path}`, init);
  if (!response.ok) {
    let message = `Transcription service error: ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore parse failures and keep fallback
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function createTranscriptionSession(
  meetingId: string,
  language?: string,
  options?: { windowMs?: number; stepMs?: number; dedupeHorizonMs?: number },
) {
  const payload: SessionCreateRequest = {
    meetingId,
    ...(language ? { language } : {}),
    ...(options?.windowMs === undefined ? {} : { windowMs: options.windowMs }),
    ...(options?.stepMs === undefined ? {} : { stepMs: options.stepMs }),
    ...(options?.dedupeHorizonMs === undefined
      ? {}
      : { dedupeHorizonMs: options.dedupeHorizonMs }),
  };
  return transcriptionFetch<SessionCreateResponse>("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadTranscriptionSessionChunk(
  sessionId: string,
  chunk: ArrayBuffer,
  filename: string,
  contentType?: string,
): Promise<void> {
  await transcriptionFetch<{ accepted: boolean; eventCount: number }>(
    `/sessions/${sessionId}/chunks?filename=${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: {
        "content-type": contentType?.trim() ? contentType : "application/octet-stream",
        "x-audio-filename": filename,
      },
      body: chunk,
    },
  );
}

export function stopTranscriptionSession(sessionId: string) {
  return transcriptionFetch<SessionStopResponse>(`/sessions/${sessionId}/stop`, {
    method: "POST",
  });
}

export function getTranscriptionSessionStatus(sessionId: string) {
  return transcriptionFetch<TranscriptionSessionStatus>(`/sessions/${sessionId}/status`);
}

export function getTranscriptionServiceStatus() {
  return transcriptionFetch<TranscriptionServiceStatus>("/status");
}

export function getTranscriptionDiagnostics() {
  return transcriptionFetch<TranscriptionDiagnosticsResponse>("/diagnostics");
}
