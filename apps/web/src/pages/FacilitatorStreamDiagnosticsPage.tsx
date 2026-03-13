import { useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useParams } from "react-router-dom";
import {
  getTranscriptionDiagnostics,
  type TranscriptionDiagnosticChunk,
  type TranscriptionDiagnosticDeliveredEvent,
  type TranscriptionDiagnosticWhisperResponse,
  type TranscriptionSessionDiagnostics,
} from "@/api/transcription-client";
import { ContextDisplay } from "@/components/shared/ContextDisplay";
import { MainHeader } from "@/components/shared/MainHeader";

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

type StatusCardProps = {
  title: string;
  children: React.ReactNode;
};

function StatusCard({ title, children }: StatusCardProps) {
  return (
    <div className="rounded border border-border p-4 bg-surface/70">
      <p className="text-fac-label text-text-muted uppercase tracking-wider">{title}</p>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ChunkTraceTable({ items }: { items: TranscriptionDiagnosticChunk[] }) {
  if (items.length === 0) {
    return <p className="text-fac-meta text-text-muted">No chunks received yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="min-w-full text-left text-fac-meta">
        <thead className="bg-overlay/50 text-text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">File</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Original</th>
            <th className="px-3 py-2 font-medium">Normalized</th>
            <th className="px-3 py-2 font-medium">Window</th>
          </tr>
        </thead>
        <tbody>
          {items
            .slice()
            .reverse()
            .map((item) => (
              <tr key={`${item.receivedAt}-${item.filename}`} className="border-t border-border">
                <td className="px-3 py-2 text-text-secondary">{formatTimestamp(item.receivedAt)}</td>
                <td className="px-3 py-2 text-text-primary">{item.filename}</td>
                <td className="px-3 py-2 text-text-secondary">{item.contentType ?? "—"}</td>
                <td className="px-3 py-2 text-text-secondary">{formatBytes(item.originalByteLength)}</td>
                <td className="px-3 py-2 text-text-secondary">{formatBytes(item.normalizedByteLength)}</td>
                <td className="px-3 py-2 text-text-secondary">
                  {item.rollingWindowChunkCount} chunks · {formatBytes(item.rollingWindowAudioBytes)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function WhisperResponseList({ items }: { items: TranscriptionDiagnosticWhisperResponse[] }) {
  if (items.length === 0) {
    return <p className="text-fac-meta text-text-muted">No Whisper responses yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items
        .slice()
        .reverse()
        .map((item) => (
          <div key={`${item.createdAt}-${item.filename}`} className="rounded border border-border bg-overlay/30 p-3">
            <div className="flex flex-wrap items-center gap-2 text-fac-meta">
              <span className="text-text-primary font-medium">{item.filename}</span>
              <span className="text-text-secondary">{formatTimestamp(item.createdAt)}</span>
              <span className="text-text-secondary">{item.eventCount} events</span>
              {item.error && <span className="text-danger">{item.error}</span>}
            </div>
            <p className="mt-2 text-fac-meta text-text-secondary whitespace-pre-wrap break-words">
              {item.textPreview || "No text preview returned"}
            </p>
            <pre className="mt-2 overflow-x-auto rounded border border-border bg-base px-3 py-2 text-[11px] text-text-muted">
              {JSON.stringify(item.rawResponse, null, 2)}
            </pre>
          </div>
        ))}
    </div>
  );
}

function DeliveredEventsList({ items }: { items: TranscriptionDiagnosticDeliveredEvent[] }) {
  if (items.length === 0) {
    return <p className="text-fac-meta text-text-muted">No transcript events delivered yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items
        .slice()
        .reverse()
        .map((item, index) => (
          <div
            key={`${item.createdAt}-${item.event.sequenceNumber ?? index}`}
            className="rounded border border-border bg-overlay/30 px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2 text-fac-meta text-text-secondary">
              <span>{formatTimestamp(item.createdAt)}</span>
              <span>seq {item.event.sequenceNumber ?? "—"}</span>
              <span>{item.event.speaker ?? "speaker unknown"}</span>
              {item.event.startTimeSeconds !== undefined && (
                <span>{item.event.startTimeSeconds.toFixed(1)}s</span>
              )}
            </div>
            <p className="mt-1 text-fac-meta text-text-primary whitespace-pre-wrap break-words">
              {item.event.text}
            </p>
          </div>
        ))}
    </div>
  );
}

function SessionPanel({ session }: { session: TranscriptionSessionDiagnostics }) {
  return (
    <section className="rounded-card border border-border bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <ContextDisplay meetingId={session.meetingId} />
          <div className="flex flex-wrap items-center gap-2 text-fac-meta text-text-secondary">
            <span>session {session.sessionId}</span>
            <span>status {session.status}</span>
            <span>{Math.round(session.windowMs / 1000)}s window</span>
            <span>{Math.round(session.stepMs / 1000)}s step</span>
          </div>
        </div>
        <div className="text-right text-fac-meta text-text-secondary shrink-0">
          <p>started {formatTimestamp(session.startedAt)}</p>
          <p>last chunk {formatTimestamp(session.lastChunkReceivedAt)}</p>
          <p>last whisper {formatTimestamp(session.lastTranscriptionAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <StatusCard title="Session health">
          <p className="text-fac-meta text-text-primary">
            posted {session.postedEvents} · buffered {session.bufferedEvents} · deduped {session.dedupedEvents}
          </p>
          <p className="text-fac-meta text-text-secondary">
            provider events {session.lastProviderEventCount ?? 0}
          </p>
          {session.lastProviderTextPreview && (
            <div className="rounded border border-border bg-overlay/40 px-3 py-2 text-fac-meta text-text-primary whitespace-pre-wrap break-words">
              {session.lastProviderTextPreview}
            </div>
          )}
          {session.lastProviderError && <p className="text-fac-meta text-danger">{session.lastProviderError}</p>}
        </StatusCard>

        <StatusCard title="Active rolling window">
          {session.activeWindowChunks.length === 0 ? (
            <p className="text-fac-meta text-text-muted">No active chunks in the rolling window.</p>
          ) : (
            session.activeWindowChunks.map((chunk) => (
              <div key={`${chunk.receivedAt}-${chunk.filename}`} className="flex items-center justify-between gap-2">
                <span className="text-fac-meta text-text-primary truncate">{chunk.filename}</span>
                <span className="text-fac-meta text-text-secondary shrink-0">
                  {formatTimestamp(chunk.receivedAt)} · {formatBytes(chunk.normalizedByteLength)}
                </span>
              </div>
            ))
          )}
        </StatusCard>
      </div>

      <StatusCard title="Incoming chunk trace">
        <ChunkTraceTable items={session.chunkTrace} />
      </StatusCard>

      <StatusCard title="Whisper responses">
        <WhisperResponseList items={session.whisperResponses} />
      </StatusCard>

      <StatusCard title="Delivered transcript stream events">
        <DeliveredEventsList items={session.deliveredEvents} />
      </StatusCard>
    </section>
  );
}

export function FacilitatorStreamDiagnosticsPage() {
  const { id } = useParams<{ id: string }>();
  const meetingId = id ?? "";
  const [sessions, setSessions] = useState<TranscriptionSessionDiagnostics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDiagnostics(pollOnly = false) {
    if (!meetingId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    if (pollOnly) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await getTranscriptionDiagnostics();
      const filtered = response.sessions
        .filter((session) => session.meetingId === meetingId)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setSessions(filtered);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load diagnostics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDiagnostics();
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) return;
    const timer = window.setInterval(() => {
      void loadDiagnostics(true);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [meetingId]);

  const summary = useMemo(() => {
    const chunkCount = sessions.reduce((total, session) => total + session.chunkTrace.length, 0);
    const whisperCount = sessions.reduce((total, session) => total + session.whisperResponses.length, 0);
    const deliveredCount = sessions.reduce((total, session) => total + session.deliveredEvents.length, 0);
    return { chunkCount, whisperCount, deliveredCount };
  }, [sessions]);

  return (
    <div className="density-facilitator min-h-screen bg-base flex flex-col">
      <MainHeader
        className="px-4 py-3"
        navItems={[{ label: meetingId || "meeting" }, { label: "stream diagnostics" }]}
        title="Stream diagnostics"
        subtitle={`${sessions.length} session${sessions.length !== 1 ? "s" : ""} · ${summary.chunkCount} chunks · ${summary.whisperCount} whisper responses · ${summary.deliveredCount} delivered events`}
        actions={
          <button
            onClick={() => void loadDiagnostics()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
            type="button"
          >
            <RefreshCw size={13} />
            <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
        }
      />

      {error && (
        <div className="mx-4 mt-4 flex items-center gap-3 px-4 py-3 rounded-card border border-danger/30 bg-danger-dim text-danger text-fac-meta">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <main className="max-w-6xl w-full mx-auto px-4 py-5 flex flex-col gap-5">
        {loading ? (
          <div className="rounded-card border border-border bg-surface p-5 text-fac-meta text-text-secondary">
            Loading diagnostics…
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-5 text-fac-meta text-text-secondary">
            No transcription diagnostics are available for this meeting yet.
          </div>
        ) : (
          sessions.map((session) => <SessionPanel key={session.sessionId} session={session} />)
        )}
      </main>
    </div>
  );
}
