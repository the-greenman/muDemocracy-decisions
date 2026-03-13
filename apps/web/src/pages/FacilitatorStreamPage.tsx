import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ExternalLink, Radio, RefreshCw } from "lucide-react";
import { ContextDisplay } from "@/components/shared/ContextDisplay";
import { MainHeader } from "@/components/shared/MainHeader";
import { getApiStatus, getTranscriptReading, listMeetingChunks } from "@/api/endpoints";
import {
  createTranscriptionSession,
  getTranscriptionServiceStatus,
  getTranscriptionSessionStatus,
  stopTranscriptionSession,
  uploadTranscriptionSessionChunk,
  type TranscriptionServiceStatus,
  type TranscriptionSessionStatus,
} from "@/api/transcription-client";
import type { ApiStatus } from "@/api/types";
import {
  type StreamState,
  type StreamStatusPayload,
  type TranscriptTargetPayload,
  streamStatusStorageKey,
  transcriptTargetStorageKey,
  readStoredJson,
  writeStoredJson,
} from "@/lib/facilitator-sync";

type StatusCardProps = {
  title: string;
  children: React.ReactNode;
};

function StatusCard({ title, children }: StatusCardProps) {
  return (
    <div className="rounded border border-border p-4 bg-surface/70">
      <p className="text-fac-label text-text-muted uppercase tracking-wider">{title}</p>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

export function FacilitatorStreamPage() {
  const { id } = useParams<{ id: string }>();
  const meetingId = id ?? "";
  const streamStorageKey = streamStatusStorageKey(meetingId);
  const transcriptTargetKey = transcriptTargetStorageKey(meetingId);
  const diagnosticsPath = `/meetings/${meetingId}/facilitator/stream/diagnostics`;
  const transcriptPath = `/meetings/${meetingId}/facilitator/transcript`;
  const sharedPath = `/meetings/${meetingId}`;

  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("");
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionServiceStatus | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionStatus, setActiveSessionStatus] = useState<TranscriptionSessionStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderSegmentTimerRef = useRef<number | null>(null);
  const streamShouldContinueRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingChunkUploadsRef = useRef<Promise<void>[]>([]);
  const streamStepMsRef = useRef<number>(10_000);
  const previousTranscriptRowCountRef = useRef<number>(0);
  const [transcriptTarget, setTranscriptTarget] = useState<TranscriptTargetPayload | null>(null);
  const [transcriptRowCount, setTranscriptRowCount] = useState(0);
  const [transcriptChunkCount, setTranscriptChunkCount] = useState(0);
  const [transcriptGrowth, setTranscriptGrowth] = useState(0);
  const [transcriptLastUpdatedAt, setTranscriptLastUpdatedAt] = useState<string | null>(null);
  const [transcriptMonitorError, setTranscriptMonitorError] = useState<string | null>(null);

  const streamBadgeClass = useMemo(() => {
    if (streamState === "live") return "bg-settled";
    if (streamState === "connecting") return "bg-caution";
    if (streamState === "stopped") return "bg-danger";
    return "bg-text-muted";
  }, [streamState]);

  function handleCloseWindow() {
    window.close();
  }

  useEffect(() => {
    const payload: StreamStatusPayload = {
      meetingId,
      streamState,
      error: streamError,
      activeSessionId,
      updatedAt: new Date().toISOString(),
    };
    writeStoredJson(streamStorageKey, payload);
  }, [activeSessionId, meetingId, streamError, streamState, streamStorageKey]);

  useEffect(() => {
    const applyTarget = () => {
      setTranscriptTarget(readStoredJson<TranscriptTargetPayload>(transcriptTargetKey));
    };

    applyTarget();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== transcriptTargetKey) return;
      applyTarget();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [transcriptTargetKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadAudioInputs() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const inputs = devices.filter((device) => device.kind === "audioinput");
        setAudioDevices(inputs);
        if (!selectedAudioDeviceId && inputs[0]?.deviceId) {
          setSelectedAudioDeviceId(inputs[0].deviceId);
        }
      } catch {
        if (!cancelled) setAudioDevices([]);
      }
    }

    void loadAudioInputs();
    return () => {
      cancelled = true;
    };
  }, [selectedAudioDeviceId]);

  useEffect(() => {
    if (!activeSessionId) {
      setActiveSessionStatus(null);
      return;
    }
    const sessionId = activeSessionId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function pollSessionStatus() {
      try {
        const status = await getTranscriptionSessionStatus(sessionId);
        if (cancelled) return;
        setActiveSessionStatus(status);
      } catch {
        if (cancelled) return;
        setActiveSessionStatus(null);
      } finally {
        if (!cancelled && streamState === "live") {
          timer = setTimeout(() => {
            void pollSessionStatus();
          }, 2000);
        }
      }
    }

    void pollSessionStatus();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeSessionId, streamState]);

  async function refreshSystemStatus() {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const [api, transcription] = await Promise.all([getApiStatus(), getTranscriptionServiceStatus()]);
      setApiStatus(api);
      setTranscriptionStatus(transcription);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Failed to load system status");
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    void refreshSystemStatus();
  }, []);

  useEffect(() => {
    if (!meetingId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function pollTranscriptMonitor() {
      try {
        const [reading, chunkData] = await Promise.all([
          getTranscriptReading(meetingId),
          listMeetingChunks(meetingId),
        ]);
        if (cancelled) return;

        const nextRowCount = reading.rows.length > 0 ? reading.rows.length : chunkData.chunks.length;
        const previousCount = previousTranscriptRowCountRef.current;
        if (previousCount > 0 && nextRowCount > previousCount) {
          setTranscriptGrowth((value) => value + (nextRowCount - previousCount));
        }
        previousTranscriptRowCountRef.current = nextRowCount;
        setTranscriptRowCount(nextRowCount);
        setTranscriptChunkCount(chunkData.chunks.length);
        setTranscriptLastUpdatedAt(new Date().toISOString());
        setTranscriptMonitorError(null);
      } catch (error) {
        if (cancelled) return;
        setTranscriptMonitorError(
          error instanceof Error ? error.message : "Failed to read transcript activity",
        );
      } finally {
        if (!cancelled) {
          timer = setTimeout(
            () => {
              void pollTranscriptMonitor();
            },
            streamState === "live" ? 2000 : 5000,
          );
        }
      }
    }

    void pollTranscriptMonitor();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [meetingId, streamState]);

  function getRecorderMimeType(): string | undefined {
    const options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"];
    return options.find((value) => MediaRecorder.isTypeSupported(value));
  }

  function extensionForMimeType(mimeType: string | undefined): string {
    if (!mimeType) return "webm";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("ogg") || mimeType.includes("oga")) return "ogg";
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
    if (mimeType.includes("mpeg") || mimeType.includes("mp3") || mimeType.includes("mpga")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("flac")) return "flac";
    return "webm";
  }

  function clearRecorderSegmentTimer() {
    if (recorderSegmentTimerRef.current !== null) {
      window.clearTimeout(recorderSegmentTimerRef.current);
      recorderSegmentTimerRef.current = null;
    }
  }

  async function stopBrowserStream() {
    streamShouldContinueRef.current = false;
    clearRecorderSegmentTimer();
    const recorder = recorderRef.current;
    const sessionId = sessionIdRef.current;
    setStreamState("stopped");

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else if (sessionId) {
      await Promise.allSettled(pendingChunkUploadsRef.current);
      try {
        await stopTranscriptionSession(sessionId);
      } catch (error) {
        setStreamError(error instanceof Error ? error.message : "Failed to stop session");
      }
      sessionIdRef.current = null;
      setActiveSessionId(null);
      setActiveSessionStatus(null);
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function startBrowserStream() {
    if (!meetingId) return;
    setStreamError(null);
    setStreamState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
      });
      mediaStreamRef.current = stream;

      const sessionOptions = transcriptionStatus
        ? {
            windowMs: transcriptionStatus.defaults.windowMs,
            stepMs: transcriptionStatus.defaults.stepMs,
            dedupeHorizonMs: transcriptionStatus.defaults.dedupeHorizonMs,
          }
        : undefined;
      const session = await createTranscriptionSession(meetingId, undefined, sessionOptions);
      sessionIdRef.current = session.sessionId;
      setActiveSessionId(session.sessionId);
      setActiveSessionStatus({
        status: "active",
        bufferedEvents: 0,
        postedEvents: 0,
        dedupedEvents: 0,
        windowMs: session.windowMs,
        stepMs: session.stepMs,
        dedupeHorizonMs: session.dedupeHorizonMs,
      });
      streamStepMsRef.current = Math.max(1000, session.stepMs);
      streamShouldContinueRef.current = true;

      const mimeType = getRecorderMimeType();
      pendingChunkUploadsRef.current = [];

      const startSegment = () => {
        if (!streamShouldContinueRef.current || !sessionIdRef.current || !mediaStreamRef.current) {
          return;
        }

        const recorder = new MediaRecorder(mediaStreamRef.current, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (!sessionIdRef.current || event.data.size === 0) return;
          const currentSessionId = sessionIdRef.current;
          if (!currentSessionId) return;
          const chunkMimeType = event.data.type || mimeType || "audio/webm";
          const extension = extensionForMimeType(chunkMimeType);
          const upload = event.data
            .arrayBuffer()
            .then((buffer) =>
              uploadTranscriptionSessionChunk(
                currentSessionId,
                buffer,
                `chunk-${Date.now()}.${extension}`,
                chunkMimeType,
              ),
            );
          pendingChunkUploadsRef.current.push(upload);
          void upload
            .catch((error) => {
              setStreamError(error instanceof Error ? error.message : "Failed to upload audio chunk");
            })
            .finally(() => {
              pendingChunkUploadsRef.current = pendingChunkUploadsRef.current.filter((item) => item !== upload);
            });
        };

        recorder.onstop = () => {
          const finalizeSegment = async () => {
            await Promise.allSettled(pendingChunkUploadsRef.current);
            if (!streamShouldContinueRef.current) {
              if (sessionIdRef.current) {
                try {
                  await stopTranscriptionSession(sessionIdRef.current);
                } catch (error) {
                  setStreamError(error instanceof Error ? error.message : "Failed to flush stream");
                }
              }
              sessionIdRef.current = null;
              setActiveSessionId(null);
              setActiveSessionStatus(null);
              recorderRef.current = null;
              if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                mediaStreamRef.current = null;
              }
              return;
            }
            startSegment();
          };
          void finalizeSegment();
        };

        recorder.onerror = () => {
          setStreamError("Recorder error while capturing audio");
          void stopBrowserStream();
        };

        recorder.start();
        clearRecorderSegmentTimer();
        recorderSegmentTimerRef.current = window.setTimeout(() => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }, streamStepMsRef.current);
      };

      startSegment();
      setStreamState("live");
    } catch (error) {
      setStreamState("stopped");
      setStreamError(error instanceof Error ? error.message : "Unable to start browser audio stream");
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      streamShouldContinueRef.current = false;
      setActiveSessionId(null);
      setActiveSessionStatus(null);
      clearRecorderSegmentTimer();
    }
  }

  function handleToggleStream() {
    if (streamState === "connecting") return;
    if (streamState === "live") {
      void stopBrowserStream();
      return;
    }
    void startBrowserStream();
  }

  useEffect(() => {
    return () => {
      streamShouldContinueRef.current = false;
      clearRecorderSegmentTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      recorderRef.current = null;
      mediaStreamRef.current = null;
      sessionIdRef.current = null;
      pendingChunkUploadsRef.current = [];
    };
  }, []);

  return (
    <div className="density-facilitator min-h-screen bg-base flex flex-col">
      <MainHeader
        className="px-4 py-3"
        navItems={[{ label: meetingId || "meeting" }]}
        title="Streaming control"
        subtitle="Persistent live capture and system health"
        actions={
          <button
            onClick={handleCloseWindow}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
            type="button"
          >
            <span>Close window</span>
          </button>
        }
      />

      {streamError && (
        <div className="mx-4 mt-4 flex items-center gap-3 px-4 py-3 rounded-card border border-danger/30 bg-danger-dim text-danger text-fac-meta">
          <AlertCircle size={15} className="shrink-0" />
          <span>{streamError}</span>
        </div>
      )}

      <main className="max-w-5xl w-full mx-auto px-4 py-5 grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <section className="rounded-card border border-border bg-surface p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-fac-field text-text-primary font-medium">Browser stream</h2>
              <p className="text-fac-meta text-text-secondary mt-1">
                Keep this tab open during the meeting for the most stable capture session.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-badge border border-border bg-overlay px-2 py-1 text-[11px] text-text-muted">
              <span className={`w-2 h-2 rounded-full ${streamBadgeClass}`} />
              {streamState}
            </span>
          </div>

          <div className="flex flex-col gap-3 rounded border border-border bg-overlay/40 p-4">
            <label className="flex flex-col gap-1.5 text-fac-meta text-text-secondary">
              Microphone
              <select
                value={selectedAudioDeviceId}
                onChange={(event) => setSelectedAudioDeviceId(event.target.value)}
                disabled={streamState === "live" || streamState === "connecting"}
                className="px-3 py-2 rounded border border-border bg-surface text-text-primary focus:outline-none"
                title="Select microphone"
              >
                {audioDevices.length === 0 && <option value="">Default microphone</option>}
                {audioDevices.map((device, index) => (
                  <option key={device.deviceId || `mic-${index}`} value={device.deviceId}>
                    {device.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleToggleStream}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-fac-meta rounded bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                <Radio size={14} />
                {streamState === "live" ? "Stop stream" : streamState === "connecting" ? "Connecting…" : "Start stream"}
              </button>
              <button
                onClick={() => void refreshSystemStatus()}
                disabled={statusLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-fac-meta border border-border rounded text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
              >
                <RefreshCw size={14} />
                {statusLoading ? "Refreshing…" : "Refresh status"}
              </button>
              <Link
                to={diagnosticsPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-fac-meta border border-border rounded text-text-secondary hover:text-text-primary transition-colors"
              >
                <ExternalLink size={14} />
                Diagnostics
              </Link>
              <Link
                to={transcriptPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-fac-meta border border-border rounded text-text-secondary hover:text-text-primary transition-colors"
              >
                <ExternalLink size={14} />
                Open transcript
              </Link>
              <Link
                to={sharedPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-fac-meta border border-border rounded text-text-secondary hover:text-text-primary transition-colors"
              >
                <ExternalLink size={14} />
                Shared view
              </Link>
            </div>
          </div>

          <StatusCard title="Live session">
            <p className="text-fac-meta text-text-primary">State: {streamState}</p>
            <p className="text-fac-meta text-text-secondary">Session: {activeSessionId ?? "none"}</p>
            {activeSessionStatus && (
              <>
                <p className="text-fac-meta text-text-secondary">
                  {Math.round(activeSessionStatus.windowMs / 1000)}s window · {Math.round(activeSessionStatus.stepMs / 1000)}s step · posted {activeSessionStatus.postedEvents} · deduped {activeSessionStatus.dedupedEvents}
                </p>
                <p className="text-fac-meta text-text-secondary">
                  buffered {activeSessionStatus.bufferedEvents} · session status {activeSessionStatus.status}
                </p>
                <p className="text-fac-meta text-text-secondary">
                  provider events {activeSessionStatus.lastProviderEventCount ?? 0}
                  {activeSessionStatus.lastChunkReceivedAt
                    ? ` · last chunk ${new Date(activeSessionStatus.lastChunkReceivedAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}`
                    : " · waiting for first chunk"}
                </p>
                <p className="text-fac-meta text-text-secondary">
                  {activeSessionStatus.lastTranscriptionAt
                    ? `last whisper update ${new Date(activeSessionStatus.lastTranscriptionAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}`
                    : "No whisper response yet"}
                </p>
                {activeSessionStatus.lastProviderTextPreview && (
                  <div className="rounded border border-border bg-overlay/40 px-3 py-2 text-fac-meta text-text-primary whitespace-pre-wrap break-words">
                    {activeSessionStatus.lastProviderTextPreview}
                  </div>
                )}
                {activeSessionStatus.lastProviderError && (
                  <p className="text-fac-meta text-danger">
                    Whisper/provider error: {activeSessionStatus.lastProviderError}
                  </p>
                )}
              </>
            )}
          </StatusCard>

          <StatusCard title="Transcript target">
            <ContextDisplay
              meetingId={meetingId}
              decisionContextId={transcriptTarget?.decisionContextId}
              fieldId={transcriptTarget?.fieldId}
            />
            <p className="text-fac-meta text-text-secondary">
              Transcript window follows the active facilitator target automatically.
            </p>
            {transcriptTarget?.updatedAt && (
              <p className="text-fac-meta text-text-secondary">
                target updated {new Date(transcriptTarget.updatedAt).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}
          </StatusCard>

          <StatusCard title="Incoming transcript activity">
            <p className="text-fac-meta text-text-primary">
              {transcriptRowCount} rows · {transcriptChunkCount} chunks
            </p>
            <p className="text-fac-meta text-text-secondary">
              {transcriptGrowth > 0 ? `+${transcriptGrowth} new rows since this page opened` : "No new rows observed yet"}
            </p>
            <p className="text-fac-meta text-text-secondary">
              {transcriptLastUpdatedAt
                ? `last checked ${new Date(transcriptLastUpdatedAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}`
                : "Waiting for first transcript check"}
            </p>
            {transcriptMonitorError && (
              <p className="text-fac-meta text-danger">{transcriptMonitorError}</p>
            )}
          </StatusCard>
        </section>

        <section className="flex flex-col gap-4">
          {statusError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-danger/30 bg-danger-dim/20 text-fac-meta text-danger">
              <AlertCircle size={14} className="shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          <StatusCard title="Core API">
            <p className="text-fac-meta text-text-primary">{apiStatus ? "online" : "unknown"}</p>
            {apiStatus && (
              <p className="text-fac-meta text-text-secondary">
                db: {apiStatus.databaseConfigured ? "configured" : "missing"} · llm: {apiStatus.llm.mode}/{apiStatus.llm.provider}:{apiStatus.llm.model}
              </p>
            )}
          </StatusCard>

          <StatusCard title="Transcription service">
            <p className="text-fac-meta text-text-primary">{transcriptionStatus ? "online" : "unknown"}</p>
            {transcriptionStatus && (
              <>
                <p className="text-fac-meta text-text-secondary">
                  provider: {transcriptionStatus.provider} · sessions: {transcriptionStatus.sessionCount}
                </p>
                <p className="text-fac-meta text-text-secondary">
                  defaults: {Math.round(transcriptionStatus.defaults.windowMs / 1000)}s window · {Math.round(transcriptionStatus.defaults.stepMs / 1000)}s step · {Math.round(transcriptionStatus.defaults.dedupeHorizonMs / 1000)}s dedupe horizon
                </p>
                <p className="text-fac-meta text-text-secondary">
                  api bridge: {transcriptionStatus.api.ok ? "ok" : "error"}
                  {transcriptionStatus.api.error ? ` (${transcriptionStatus.api.error})` : ""}
                </p>
                <p className="text-fac-meta text-text-secondary">
                  whisper: {!transcriptionStatus.whisper.enabled ? "disabled" : transcriptionStatus.whisper.ok ? "ok" : `error${transcriptionStatus.whisper.error ? ` (${transcriptionStatus.whisper.error})` : ""}`}
                </p>
              </>
            )}
          </StatusCard>
        </section>
      </main>
    </div>
  );
}
