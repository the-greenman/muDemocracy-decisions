import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Check,
  Hash,
  Link as LinkIcon,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  assignDecisionTranscriptChunks,
  assignFieldTranscriptChunks,
  getFieldTranscriptChunks,
  getTranscriptReading,
  listMeetingChunks,
} from "@/api/endpoints";
import type { ReadableTranscriptRow, TranscriptChunk } from "@/api/types";
import { ContextDisplay } from "@/components/shared/ContextDisplay";
import { MainHeader } from "@/components/shared/MainHeader";
import {
  type TranscriptScope,
  type TranscriptSelectionPayload,
  type TranscriptTargetPayload,
  transcriptSelectionStorageKey,
  transcriptTargetStorageKey,
  readStoredJson,
  writeStoredJson,
} from "@/lib/facilitator-sync";

type TranscriptRowModel = {
  id: string;
  seq: number;
  meetingId: string;
  speaker: string | null;
  text: string;
  chunkIds: string[];
};

const POLL_INTERVAL_MS = 2500;

function mapReadableRows(rows: ReadableTranscriptRow[]): TranscriptRowModel[] {
  return rows
    .map((row) => ({
      id: row.id,
      seq: row.sequenceNumber,
      meetingId: row.meetingId,
      speaker: row.speaker,
      text: row.displayText,
      chunkIds: row.chunkIds,
    }))
    .sort((a, b) => a.seq - b.seq);
}

function mapChunkRows(chunks: TranscriptChunk[]): TranscriptRowModel[] {
  return chunks
    .map((chunk) => ({
      id: `chunk-row-${chunk.id}`,
      seq: chunk.sequenceNumber,
      meetingId: chunk.meetingId,
      speaker: chunk.speaker,
      text: chunk.text,
      chunkIds: [chunk.id],
    }))
    .sort((a, b) => a.seq - b.seq);
}

export function TranscriptPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const meetingId = id ?? "";
  const transcriptTargetKey = transcriptTargetStorageKey(meetingId);
  const transcriptSelectionKey = transcriptSelectionStorageKey(meetingId);
  const decisionContextId = searchParams.get("decisionContextId") ?? "";
  const fieldId = searchParams.get("fieldId") ?? "";
  const defaultScope: TranscriptScope =
    fieldId && decisionContextId ? "field" : decisionContextId ? "decision" : "meeting";

  const [rows, setRows] = useState<TranscriptRowModel[]>([]);
  const [assignedChunkIds, setAssignedChunkIds] = useState<string[]>([]);
  const [scope, setScope] = useState<TranscriptScope>(defaultScope);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [newRowsSinceOpen, setNewRowsSinceOpen] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [jumpInput, setJumpInput] = useState("");
  const [includeRelatedMeetings, setIncludeRelatedMeetings] = useState(false);

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragState = useRef<{
    active: boolean;
    anchorIndex: number;
    targetValue: boolean;
    touchedIds: Set<string>;
  }>({
    active: false,
    anchorIndex: 0,
    targetValue: false,
    touchedIds: new Set<string>(),
  });
  const previousRowCountRef = useRef(0);

  useEffect(() => {
    setScope(defaultScope);
  }, [defaultScope]);

  useEffect(() => {
    const applyTarget = () => {
      const payload = readStoredJson<TranscriptTargetPayload>(transcriptTargetKey);
      if (!payload || payload.meetingId !== meetingId) return;
      const nextParams = new URLSearchParams(searchParams);

      if (payload.decisionContextId) nextParams.set("decisionContextId", payload.decisionContextId);
      else nextParams.delete("decisionContextId");

      if (payload.fieldId) nextParams.set("fieldId", payload.fieldId);
      else nextParams.delete("fieldId");

      const current = searchParams.toString();
      const next = nextParams.toString();
      if (current !== next) {
        setSearchParams(nextParams, { replace: true });
      }
    };

    applyTarget();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== transcriptTargetKey) return;
      applyTarget();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [meetingId, searchParams, setSearchParams, transcriptTargetKey]);

  const loadRows = useCallback(
    async (pollOnly = false) => {
      if (!meetingId) {
        setRows([]);
        setLoading(false);
        return;
      }

      if (pollOnly) setRefreshing(true);
      else setLoading(true);
      if (!pollOnly) setError(null);

      try {
        const reading = await getTranscriptReading(meetingId);
        let meetingRows: TranscriptRowModel[];
        if (reading.rows.length > 0) {
          meetingRows = mapReadableRows(reading.rows);
        } else {
          const chunkData = await listMeetingChunks(meetingId);
          meetingRows = mapChunkRows(chunkData.chunks);
        }

        const nextRowCount = meetingRows.length;
        const previousRowCount = previousRowCountRef.current;
        if (pollOnly && previousRowCount > 0 && nextRowCount > previousRowCount) {
          setNewRowsSinceOpen((value) => value + (nextRowCount - previousRowCount));
        }
        previousRowCountRef.current = nextRowCount;
        setRows(meetingRows);

        if (scope === "field") {
          if (!decisionContextId || !fieldId) {
            setAssignedChunkIds([]);
            setError("Field scope needs a decision context and field.");
            return;
          }
          const fieldChunks = await getFieldTranscriptChunks(decisionContextId, fieldId);
          setAssignedChunkIds(fieldChunks.chunks.map((chunk) => chunk.id));
        } else if (scope === "decision") {
          const chunkData = await listMeetingChunks(meetingId);
          const decisionTagPrefix = `decision:${decisionContextId}`;
          const decisionChunks = chunkData.chunks.filter((chunk) =>
            chunk.contexts.some(
              (context) =>
                context === decisionTagPrefix || context.startsWith(`${decisionTagPrefix}:`),
            ),
          );
          setAssignedChunkIds(decisionChunks.map((chunk) => chunk.id));
        } else {
          setAssignedChunkIds([]);
        }
        setError(null);
        setLastUpdatedAt(new Date().toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load transcript rows");
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [decisionContextId, fieldId, meetingId, scope],
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!meetingId) return;
    const interval = setInterval(() => {
      void loadRows(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadRows, meetingId]);

  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const available = new Set(rows.map((row) => row.id));
      const next = new Set(Array.from(prev).filter((id) => available.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const scopedRows = useMemo(
    () => (includeRelatedMeetings ? rows : rows.filter((row) => row.meetingId === meetingId)),
    [includeRelatedMeetings, meetingId, rows],
  );

  const filtered = scopedRows.filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const speakerText = r.speaker?.toLowerCase() ?? "speaker unknown";
    return r.text.toLowerCase().includes(q) || speakerText.includes(q);
  });

  const assignedChunkIdSet = useMemo(() => new Set(assignedChunkIds), [assignedChunkIds]);
  const isContextScope = scope === "decision" || scope === "field";
  const assignedRows = useMemo(
    () => filtered.filter((row) => row.chunkIds.some((chunkId) => assignedChunkIdSet.has(chunkId))),
    [assignedChunkIdSet, filtered],
  );
  const unassignedRows = useMemo(
    () =>
      filtered.filter((row) => row.chunkIds.every((chunkId) => !assignedChunkIdSet.has(chunkId))),
    [assignedChunkIdSet, filtered],
  );

  function toggleRow(idToToggle: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idToToggle)) next.delete(idToToggle);
      else next.add(idToToggle);
      return next;
    });
  }

  function handleJump() {
    const n = parseInt(jumpInput, 10);
    if (!n) return;
    const row = scopedRows.find((r) => r.seq === n);
    if (!row) return;
    const el = rowRefs.current.get(row.id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-accent");
      setTimeout(() => el.classList.remove("ring-2", "ring-accent"), 1500);
    }
    setJumpInput("");
  }

  function applyRangeSelection(fromIndex: number, toIndex: number, value: boolean) {
    const min = Math.min(fromIndex, toIndex);
    const max = Math.max(fromIndex, toIndex);

    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = min; i <= max; i += 1) {
        const row = filtered[i];
        if (!row) continue;
        if (value) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function beginDragSelection(rowId: string) {
    const anchorIndex = filtered.findIndex((row) => row.id === rowId);
    if (anchorIndex < 0) return;
    const shouldSelect = !selected.has(rowId);

    dragState.current.active = true;
    dragState.current.anchorIndex = anchorIndex;
    dragState.current.targetValue = shouldSelect;
    dragState.current.touchedIds = new Set([rowId]);
    applyRangeSelection(anchorIndex, anchorIndex, shouldSelect);
  }

  function updateDragSelection(rowId: string) {
    if (!dragState.current.active) return;
    if (dragState.current.touchedIds.has(rowId)) return;

    const index = filtered.findIndex((row) => row.id === rowId);
    if (index < 0) return;

    dragState.current.touchedIds.add(rowId);
    applyRangeSelection(dragState.current.anchorIndex, index, dragState.current.targetValue);
  }

  function endDragSelection() {
    dragState.current.active = false;
    dragState.current.touchedIds.clear();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current.active) return;
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const rowEl = el?.closest("[data-row-id]") as HTMLDivElement | null;
    if (!rowEl?.dataset.rowId) return;
    updateDragSelection(rowEl.dataset.rowId);
  }

  async function handleConfirm() {
    const rowIds = Array.from(selected);
    const selectedRowMap = new Map(filtered.map((row) => [row.id, row]));
    const chunkIdSet = new Set<string>();

    for (const rowId of rowIds) {
      const row = selectedRowMap.get(rowId);
      if (!row) continue;
      for (const chunkId of row.chunkIds) {
        chunkIdSet.add(chunkId);
      }
    }

    const chunkIds = Array.from(chunkIdSet);
    if (chunkIds.length === 0) return;

    setConfirming(true);
    setError(null);

    try {
      if (scope === "field") {
        if (!decisionContextId || !fieldId) {
          throw new Error("Field scope needs both decision context and field.");
        }
        await assignFieldTranscriptChunks(decisionContextId, fieldId, chunkIds);
      } else if (scope === "decision") {
        if (!decisionContextId) {
          throw new Error("Decision scope needs a decision context.");
        }
        await assignDecisionTranscriptChunks(decisionContextId, chunkIds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign transcript chunks");
      setConfirming(false);
      return;
    }

    const selectionPayload: TranscriptSelectionPayload = {
      meetingId,
      rowIds,
      chunkIds,
      decisionContextId: decisionContextId || undefined,
      fieldId: fieldId || undefined,
      scope,
      createdAt: new Date().toISOString(),
    };
    writeStoredJson(transcriptSelectionKey, selectionPayload);
    setSelected(new Set());
    setConfirming(false);
  }

  return (
    <div className="density-facilitator min-h-screen bg-base flex flex-col">
      <MainHeader
        className="px-4 py-3 shrink-0"
        title="Transcript window"
        subtitle={`${selected.size} row${selected.size !== 1 ? "s" : ""} selected`}
        actions={
          <button
            disabled={selected.size === 0 || confirming}
            onClick={() => void handleConfirm()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta bg-settled text-base rounded font-medium hover:bg-settled/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={13} />
            {confirming ? "Saving…" : "Send selection"}
          </button>
        }
      />

      {error && (
        <div className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-card border border-danger/30 bg-danger-dim text-danger text-fac-meta">
          <AlertCircle size={15} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => void loadRows()}
            className="flex items-center gap-1.5 text-fac-meta hover:underline"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-3 shrink-0">
        <ContextDisplay meetingId={meetingId} decisionContextId={decisionContextId} fieldId={fieldId} />
        <div className="flex items-center gap-1 rounded border border-border p-1 bg-surface">
          <button
            onClick={() => setScope("meeting")}
            className={`px-2 py-1 rounded text-fac-meta ${
              scope === "meeting"
                ? "bg-accent-dim text-accent"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Meeting
          </button>
          <button
            onClick={() => setScope("decision")}
            disabled={!decisionContextId}
            className={`px-2 py-1 rounded text-fac-meta ${
              scope === "decision"
                ? "bg-accent-dim text-accent"
                : "text-text-muted hover:text-text-primary"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Decision
          </button>
          <button
            onClick={() => setScope("field")}
            disabled={!decisionContextId || !fieldId}
            className={`px-2 py-1 rounded text-fac-meta ${
              scope === "field"
                ? "bg-accent-dim text-accent"
                : "text-text-muted hover:text-text-primary"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Field
          </button>
        </div>

        {/* Text search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search transcript…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-1.5 pl-8 text-fac-field text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Jump to row — G3 */}
        <div className="flex items-center gap-1.5 border border-border rounded overflow-hidden bg-surface">
          <span className="pl-3 text-text-muted flex items-center">
            <Hash size={13} />
          </span>
          <input
            type="number"
            min={1}
            max={Math.max(scopedRows.length, 1)}
            placeholder="Row…"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJump()}
            className="w-16 py-1.5 bg-transparent text-fac-meta text-text-primary focus:outline-none placeholder:text-text-muted"
          />
          <button
            onClick={handleJump}
            disabled={!jumpInput}
            className="px-2.5 py-1.5 text-fac-meta text-text-muted hover:text-accent transition-colors disabled:opacity-30"
            title="Jump to row"
          >
            <LinkIcon size={13} />
          </button>
        </div>

        <span className="text-fac-meta text-text-muted shrink-0">
          {filtered.length} / {scopedRows.length} rows
        </span>
        <span className="text-fac-meta text-text-muted shrink-0">
          {newRowsSinceOpen > 0 ? `+${newRowsSinceOpen} new since open` : "No new rows yet"}
        </span>
        {isContextScope && (
          <span className="text-fac-meta text-text-muted shrink-0">
            {assignedRows.length} linked · {unassignedRows.length} available
          </span>
        )}
        <span className="text-fac-meta text-text-muted shrink-0">
          {refreshing ? "Updating…" : "Live"}
          {lastUpdatedAt
            ? ` · ${new Date(lastUpdatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : ""}
        </span>
        <label className="flex items-center gap-2 text-fac-meta text-text-secondary">
          <input
            type="checkbox"
            checked={includeRelatedMeetings}
            onChange={(e) => setIncludeRelatedMeetings(e.target.checked)}
            className="accent-accent"
            disabled
          />
          Include related meetings (planned)
        </label>
      </div>

      {/* Transcript rows */}
      <main
        className="flex-1 overflow-y-auto px-4 py-3"
        onPointerMove={handlePointerMove}
        onPointerUp={endDragSelection}
        onPointerCancel={endDragSelection}
      >
        {loading ? (
          <div className="max-w-3xl flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded border border-border bg-surface animate-pulse-slow"
              />
            ))}
          </div>
        ) : isContextScope ? (
          <div className="flex flex-col gap-4 max-w-3xl">
            <div>
              <p className="px-1 pb-1 text-fac-meta text-text-secondary">
                Already linked to this context
              </p>
              <div className="flex flex-col gap-0.5">
                {assignedRows.map((row) => (
                  <TranscriptRow
                    key={row.id}
                    row={row}
                    isSelected={selected.has(row.id)}
                    onToggle={() => toggleRow(row.id)}
                    onBeginDrag={() => beginDragSelection(row.id)}
                    showMeetingLabel={row.meetingId !== meetingId}
                    rowRef={(el) => {
                      if (el) rowRefs.current.set(row.id, el);
                      else rowRefs.current.delete(row.id);
                    }}
                  />
                ))}
                {assignedRows.length === 0 && (
                  <p className="px-2 py-4 text-fac-meta text-text-muted">
                    No transcript rows linked yet.
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="px-1 pb-1 text-fac-meta text-text-secondary">
                Other meeting transcript (available to add)
              </p>
              <div className="flex flex-col gap-0.5">
                {unassignedRows.map((row) => (
                  <TranscriptRow
                    key={row.id}
                    row={row}
                    isSelected={selected.has(row.id)}
                    onToggle={() => toggleRow(row.id)}
                    onBeginDrag={() => beginDragSelection(row.id)}
                    showMeetingLabel={row.meetingId !== meetingId}
                    rowRef={(el) => {
                      if (el) rowRefs.current.set(row.id, el);
                      else rowRefs.current.delete(row.id);
                    }}
                  />
                ))}
                {unassignedRows.length === 0 && (
                  <p className="px-2 py-4 text-fac-meta text-text-muted">
                    No additional rows available in this scope.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 max-w-3xl">
            {filtered.map((row) => (
              <TranscriptRow
                key={row.id}
                row={row}
                isSelected={selected.has(row.id)}
                onToggle={() => toggleRow(row.id)}
                onBeginDrag={() => beginDragSelection(row.id)}
                showMeetingLabel={row.meetingId !== meetingId}
                rowRef={(el) => {
                  if (el) rowRefs.current.set(row.id, el);
                  else rowRefs.current.delete(row.id);
                }}
              />
            ))}
            {!error && filtered.length === 0 && (
              <p className="px-2 py-8 text-fac-meta text-text-muted text-center">
                No transcript rows available for this meeting yet.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function TranscriptRow({
  row,
  isSelected,
  onToggle,
  onBeginDrag,
  showMeetingLabel,
  rowRef,
}: {
  row: TranscriptRowModel;
  isSelected: boolean;
  onToggle: () => void;
  onBeginDrag: () => void;
  showMeetingLabel: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={rowRef}
      data-row-id={row.id}
      onClick={onToggle}
      onPointerDown={onBeginDrag}
      className={`flex gap-3 px-3 py-2.5 rounded cursor-pointer select-none transition-colors transition-shadow ${
        isSelected
          ? "bg-accent-dim/40 border border-accent/30"
          : "hover:bg-surface border border-transparent"
      }`}
    >
      <span className="text-fac-meta text-text-muted w-8 text-right shrink-0 mt-0.5 tabular-nums">
        {row.seq}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-fac-meta text-text-secondary font-medium mr-2">
            {row.speaker ?? "Speaker unknown"}:
          </span>
          {showMeetingLabel && (
            <span className="text-[11px] text-text-muted border border-border px-1.5 py-0.5 rounded-badge">
              {row.meetingId}
            </span>
          )}
        </div>
        <span className="text-fac-field text-text-primary">{row.text}</span>
      </div>
    </div>
  );
}
