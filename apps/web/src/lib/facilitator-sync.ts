export type StreamState = "idle" | "connecting" | "live" | "stopped";
export type TranscriptScope = "meeting" | "decision" | "field";

export type StreamStatusPayload = {
  meetingId: string;
  streamState: StreamState;
  error: string | null;
  activeSessionId: string | null;
  updatedAt: string;
};

export type TranscriptTargetPayload = {
  meetingId: string;
  decisionContextId: string | null;
  fieldId: string | null;
  updatedAt: string;
};

export type TranscriptSelectionPayload = {
  meetingId: string;
  rowIds: string[];
  chunkIds: string[];
  decisionContextId?: string;
  fieldId?: string;
  scope?: TranscriptScope;
  createdAt: string;
};

export function activeContextStorageKey(meetingId: string) {
  return `dl:fac:active-context:${meetingId}`;
}

export function meetingFocusStorageKey(meetingId: string) {
  return `dl:meeting-focus:${meetingId}`;
}

export function meetingFieldStorageKey(meetingId: string) {
  return `dl:meeting-fields:${meetingId}`;
}

export function streamStatusStorageKey(meetingId: string) {
  return `dl:fac:stream-status:${meetingId}`;
}

export function transcriptTargetStorageKey(meetingId: string) {
  return `dl:fac:transcript-target:${meetingId}`;
}

export function transcriptSelectionStorageKey(meetingId: string) {
  return `dl:fac:transcript-selection:${meetingId}`;
}

export function readStoredJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStoredJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}
