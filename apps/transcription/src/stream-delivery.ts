import type { TranscriptEvent } from './providers/interface.js';

export interface StreamDeliveryConfig {
  maxAttempts: number;
  baseBackoffMs: number;
  maxQueueSize: number;
}

/**
 * Thrown by DecisionLoggerApiClient when the server returns a non-2xx response.
 * Carries the HTTP status so callers can distinguish retryable (5xx / network)
 * from non-retryable (4xx) failures.
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Assigns globally-unique sequence numbers to a batch of events, starting
 * from `startAt`. Returns the events with `sequenceNumber` overwritten.
 */
export function normalizeSequenceNumbers(
  events: TranscriptEvent[],
  startAt: number,
): TranscriptEvent[] {
  return events.map((event, index) => ({
    ...event,
    sequenceNumber: startAt + index,
  }));
}

/**
 * Posts a single event to the API, retrying on transient (non-4xx) errors
 * with exponential backoff. Bails immediately on 4xx (bad payload / not found).
 */
export async function postEventWithRetry(
  meetingId: string,
  event: TranscriptEvent,
  send: (meetingId: string, event: TranscriptEvent) => Promise<void>,
  sleep: (ms: number) => Promise<void>,
  config: StreamDeliveryConfig,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    try {
      await send(meetingId, event);
      return;
    } catch (error) {
      lastError = error;

      // 4xx errors will not succeed on retry — bail immediately.
      if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
        throw new Error(
          `Non-retryable error delivering transcript event (HTTP ${error.status}): ${error.message}`,
        );
      }

      if (attempt === config.maxAttempts) {
        break;
      }

      const delay = config.baseBackoffMs * (2 ** (attempt - 1));
      await sleep(delay);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to deliver transcript event after ${config.maxAttempts} attempts: ${message}`);
}

/**
 * Delivers a batch of events sequentially, respecting the queue size limit.
 */
export async function deliverStreamEvents(
  meetingId: string,
  events: TranscriptEvent[],
  send: (meetingId: string, event: TranscriptEvent) => Promise<void>,
  sleep: (ms: number) => Promise<void>,
  config: StreamDeliveryConfig,
): Promise<void> {
  const queue: TranscriptEvent[] = [...events];

  while (queue.length > 0) {
    const pendingBatch = queue.splice(0, config.maxQueueSize);
    for (const next of pendingBatch) {
      await postEventWithRetry(meetingId, next, send, sleep, config);
    }
  }
}
