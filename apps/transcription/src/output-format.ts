import type { TranscriptEvent } from './providers/interface.js';
import { formatSecondsAsTimestamp } from './time.js';

function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.floor(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
}

function inferEndTime(event: TranscriptEvent, fallbackSeconds: number): number {
  if (event.endTimeSeconds !== undefined) {
    return event.endTimeSeconds;
  }

  if (event.startTimeSeconds !== undefined) {
    return event.startTimeSeconds + fallbackSeconds;
  }

  return fallbackSeconds;
}

export function formatEventsAsText(events: TranscriptEvent[]): string {
  return events.map((event) => event.text.trim()).filter(Boolean).join('\n');
}

export function formatEventsAsSrt(events: TranscriptEvent[]): string {
  const lines: string[] = [];

  for (const [index, event] of events.entries()) {
    const text = event.text.trim();
    if (!text) {
      continue;
    }

    const startSeconds = event.startTimeSeconds ?? 0;
    const endSeconds = inferEndTime(event, 2);

    lines.push(String(index + 1));
    lines.push(`${formatSrtTimestamp(startSeconds)} --> ${formatSrtTimestamp(endSeconds)}`);
    lines.push(text);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function formatEventPreviewLine(index: number, event: TranscriptEvent): string {
  const start = event.startTimeSeconds === undefined
    ? '??:??:??'
    : formatSecondsAsTimestamp(event.startTimeSeconds);
  const end = event.endTimeSeconds === undefined
    ? '??:??:??'
    : formatSecondsAsTimestamp(event.endTimeSeconds);

  return `${index}. [${start} -> ${end}] ${event.text}`;
}
