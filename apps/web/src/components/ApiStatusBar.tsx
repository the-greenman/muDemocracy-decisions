import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getApiStatus, getStreamingStatus } from "@/api/endpoints";
import { BASE_URL } from "@/api/client";
import { useConnectionContext } from "@/context/ConnectionContext";
import type { ApiStatus, StreamStatus } from "@/api/types";

// ── Types ──────────────────────────────────────────────────────────

type ApiState = { kind: "loading" } | { kind: "up"; data: ApiStatus } | { kind: "down" };

const COLLAPSED_KEY = "dl:status-bar-collapsed";

// ── Helpers ────────────────────────────────────────────────────────

function formatAge(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Sub-chips ──────────────────────────────────────────────────────

function ApiChip({ state }: { state: ApiState }) {
  if (state.kind === "loading") {
    return <span className="text-text-muted">API …</span>;
  }
  if (state.kind === "down") {
    return (
      <span className="flex items-center gap-1.5 text-caution">
        <span className="w-1.5 h-1.5 rounded-full bg-caution shrink-0" />
        <span>
          API unreachable &middot;{" "}
          <span className="font-mono text-[10px]">{BASE_URL}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-settled">
      <span className="w-1.5 h-1.5 rounded-full bg-settled shrink-0" />
      <span>
        API v{state.data.version} &middot; started {formatAge(state.data.startedAt)}
      </span>
    </span>
  );
}

function LlmChip({ data }: { data: ApiStatus }) {
  const isMock = data.llm.mode === "mock";
  return (
    <span
      className={`flex items-center gap-1.5 ${isMock ? "text-caution" : "text-accent"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMock ? "bg-caution" : "bg-accent"}`}
      />
      {isMock ? (
        <span>mock mode</span>
      ) : (
        <span className="font-mono text-[10px]">{data.llm.model}</span>
      )}
    </span>
  );
}

function StreamChip({ stream }: { stream: StreamStatus }) {
  const active = stream.status === "active";
  return (
    <span
      className={`flex items-center gap-1.5 ${active ? "text-caution" : "text-text-muted"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-caution animate-pulse" : "bg-text-muted/40"}`}
      />
      {active ? (
        <span>
          stream active &middot; {stream.eventCount}{" "}
          {stream.eventCount === 1 ? "event" : "events"}
        </span>
      ) : (
        <span>stream idle</span>
      )}
    </span>
  );
}

// ── Collapsed indicator dots ───────────────────────────────────────

function CollapsedBar({
  apiState,
  llmData,
  stream,
  onExpand,
}: {
  apiState: ApiState;
  llmData: ApiStatus | null;
  stream: StreamStatus | null;
  onExpand: () => void;
}) {
  const apiDot =
    apiState.kind === "up"
      ? "bg-settled"
      : apiState.kind === "down"
        ? "bg-caution"
        : "bg-text-muted/40";
  const llmDot =
    llmData == null
      ? null
      : llmData.llm.mode === "mock"
        ? "bg-caution"
        : "bg-accent";
  const streamDot =
    stream?.status === "active" ? "bg-caution animate-pulse" : null;

  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center gap-1.5 px-4 py-0.5 border-b border-border bg-base hover:bg-surface/60 transition-colors"
      aria-label="Expand status bar"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${apiDot}`} />
      {llmDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${llmDot}`} />}
      {streamDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${streamDot}`} />}
      <ChevronDown size={10} className="ml-auto text-text-muted" />
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────

export function ApiStatusBar() {
  const { globalContext } = useConnectionContext();
  const activeMeetingId = globalContext?.activeMeetingId ?? null;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [apiState, setApiState] = useState<ApiState>({ kind: "loading" });
  const [stream, setStream] = useState<StreamStatus | null>(null);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Poll API status every 60s + on window focus
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await getApiStatus();
        if (!cancelled) setApiState({ kind: "up", data });
      } catch {
        if (!cancelled) setApiState({ kind: "down" });
      }
    }
    poll();
    const interval = setInterval(poll, 60_000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Poll streaming status every 10s when there's an active meeting
  useEffect(() => {
    if (!activeMeetingId) {
      setStream(null);
      return;
    }
    let cancelled = false;
    async function poll() {
      if (!activeMeetingId) return;
      try {
        const data = await getStreamingStatus(activeMeetingId);
        if (!cancelled) setStream(data);
      } catch {
        if (!cancelled) setStream(null);
      }
    }
    poll();
    const interval = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeMeetingId]);

  const llmData = apiState.kind === "up" ? apiState.data : null;

  if (collapsed) {
    return (
      <CollapsedBar
        apiState={apiState}
        llmData={llmData}
        stream={stream}
        onExpand={toggleCollapsed}
      />
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border bg-surface text-fac-meta text-text-secondary">
      <ApiChip state={apiState} />

      {llmData && (
        <>
          <span className="text-border">·</span>
          <LlmChip data={llmData} />
        </>
      )}

      {stream && (
        <>
          <span className="text-border">·</span>
          <StreamChip stream={stream} />
        </>
      )}

      <button
        onClick={toggleCollapsed}
        className="ml-auto flex items-center gap-1 text-text-muted hover:text-text-secondary transition-colors"
        aria-label="Collapse status bar"
      >
        <ChevronUp size={12} />
      </button>
    </div>
  );
}
