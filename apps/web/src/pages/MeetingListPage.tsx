import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Plus,
  FolderOpen,
  CalendarDays,
  Users,
  X,
  Trash2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Compass,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ContextDisplay } from "@/components/shared/ContextDisplay";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";
import { ParticipantAddWidget } from "@/components/shared/ParticipantAddWidget";
import { MainHeader } from "@/components/shared/MainHeader";
import { listMeetings, createMeeting } from "@/api/endpoints";
import { useConnectionContext } from "@/context/ConnectionContext";
import type { Meeting } from "@/api/types";

function nowAsLocalDateTimeInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

type MeetingLifecycle = "proposed" | "in_session" | "ended";

function getMeetingLifecycle(meeting: Meeting): MeetingLifecycle {
  return meeting.status;
}

function formatMeetingDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MeetingListPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { globalContext } = useConnectionContext();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { meetings: data } = await listMeetings();
      setMeetings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedMeetings = useMemo(
    () => [...meetings].sort((a, b) => b.date.localeCompare(a.date)),
    [meetings],
  );
  const currentContext = globalContext;
  const activeMeetingPath = currentContext?.activeMeetingId
    ? `/meetings/${currentContext.activeMeetingId}/facilitator/home`
    : null;
  const activeWorkspacePath = currentContext?.activeMeetingId
    ? `/meetings/${currentContext.activeMeetingId}/facilitator`
    : null;

  return (
    <div className="density-facilitator min-h-screen bg-base">
      <MainHeader title="μ democracy" subtitle="Meeting sessions" />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-card border border-danger/30 bg-danger-dim text-danger text-fac-meta">
            <AlertCircle size={15} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <Button onClick={load} variant="ghost" size="sm" className="text-danger gap-1.5">
              <RefreshCw size={13} />
              Retry
            </Button>
          </div>
        )}

        <div className="mb-8 rounded-card border border-accent/30 bg-accent-dim/10 px-6 py-7 text-center">
          <p className="text-fac-field text-text-primary font-medium">Start here</p>
          <p className="text-fac-meta text-text-secondary mt-1">
            Create a meeting to begin facilitation.
          </p>
          <div className="mt-4">
            <Button
              onClick={() => setShowCreate((prev) => !prev)}
              variant="primary"
              className="text-fac-field font-medium"
            >
              <Plus size={16} />
              {showCreate ? "Close" : "New meeting"}
            </Button>
          </div>
        </div>

        {showCreate && (
          <div className="mb-6">
            <NewMeetingForm onCancel={() => setShowCreate(false)} onCreated={load} />
          </div>
        )}

        <Panel title="Current active context" className="mb-5">
          {currentContext?.activeMeetingId ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-fac-field text-text-primary font-medium">
                  <Compass size={16} className="text-accent" />
                  <span>{currentContext.activeMeeting?.title ?? "Active meeting selected"}</span>
                </div>
                <ContextDisplay meetingId={currentContext.activeMeetingId} />
                {currentContext.activeDecisionContextId && (
                  <ContextDisplay
                    meetingId={currentContext.activeMeetingId}
                    decisionContextId={currentContext.activeDecisionContextId}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeMeetingPath && (
                  <Link to={activeMeetingPath}>
                    <Button variant="outline-accent">Open meeting home</Button>
                  </Link>
                )}
                {activeWorkspacePath && (
                  <Link to={activeWorkspacePath}>
                    <Button variant="primary">
                      Resume active workspace
                      <ArrowRight size={13} />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <p className="text-fac-meta text-text-muted">
              No active meeting context is selected yet.
            </p>
          )}
        </Panel>

        <Panel title="Meetings" className="mb-5">
          {loading ? (
            <MeetingSkeletons count={3} />
          ) : orderedMeetings.length === 0 ? (
            <p className="text-fac-meta text-text-muted">No meetings created yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {orderedMeetings.map((meeting) => (
                <MeetingRow
                  key={meeting.id}
                  meeting={meeting}
                  isActiveContext={meeting.id === currentContext?.activeMeetingId}
                />
              ))}
            </div>
          )}
        </Panel>
      </main>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────

function MeetingSkeletons({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-card border border-border bg-surface animate-pulse-slow"
        />
      ))}
    </div>
  );
}

// ── New meeting form ─────────────────────────────────────────────

function NewMeetingForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [meetingAt, setMeetingAt] = useState(nowAsLocalDateTimeInputValue());
  const [participants, setParticipants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function addParticipant(name: string) {
    const normalized = name.trim();
    if (!normalized) return false;

    const exists = participants.some(
      (participant) => participant.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) return false;

    setParticipants((prev) => [...prev, normalized]);
    return true;
  }

  function removeParticipant(name: string) {
    setParticipants((prev) => prev.filter((p) => p !== name));
  }

  async function handleCreate() {
    if (!title.trim()) return;
    if (participants.length === 0) {
      setFormError("Add at least one participant");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const parsedMeetingAt = meetingAt ? new Date(meetingAt) : new Date();
      if (Number.isNaN(parsedMeetingAt.getTime())) {
        setFormError("Enter a valid date and time");
        setSaving(false);
        return;
      }
      const meeting = await createMeeting({
        title: title.trim(),
        date: parsedMeetingAt.toISOString(),
        participants,
      });
      onCreated();
      navigate(`/meetings/${meeting.id}/facilitator/home`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create meeting");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-accent/30 bg-accent-dim/10 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-fac-field text-text-primary font-medium">New meeting</span>
        <Button onClick={onCancel} variant="ghost" size="sm" className="p-0">
          <X size={15} />
        </Button>
      </div>

      {formError && <p className="text-fac-meta text-danger">{formError}</p>}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-fac-label text-text-secondary uppercase tracking-wider">
          Title <span className="text-danger">*</span>
        </label>
        <Input
          type="text"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
          placeholder="e.g. Q4 Architecture Review"
          className="w-full bg-surface text-fac-field"
        />
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-fac-label text-text-secondary uppercase tracking-wider">
          Date and time
        </label>
        <Input
          type="datetime-local"
          value={meetingAt}
          onChange={(e) => setMeetingAt(e.target.value)}
          className="w-64 bg-surface text-fac-field"
        />
      </div>

      {/* Participants */}
      <div className="flex flex-col gap-2">
        <label className="text-fac-label text-text-secondary uppercase tracking-wider">
          Participants
        </label>
        <div className="flex flex-col gap-1">
          {participants.map((p) => (
            <div
              key={p}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-surface/60"
            >
              <span className="text-fac-meta text-text-primary flex-1">{p}</span>
              <button
                onClick={() => removeParticipant(p)}
                className="text-text-muted hover:text-danger transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <ParticipantAddWidget
          onAdd={addParticipant}
          placeholder="Name..."
          buttonLabel="Add"
          size="sm"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={onCancel} variant="ghost">
          Cancel
        </Button>
        <Button
          onClick={() => void handleCreate()}
          disabled={!title.trim() || participants.length === 0 || saving}
          variant="primary"
        >
          <Plus size={13} />
          {saving ? "Creating…" : "Create meeting"}
        </Button>
      </div>
    </div>
  );
}

// ── Meeting row ──────────────────────────────────────────────────

function MeetingRow({ meeting, isActiveContext }: { meeting: Meeting; isActiveContext: boolean }) {
  const lifecycle = getMeetingLifecycle(meeting);
  const lifecycleBadgeClass =
    lifecycle === "proposed"
      ? "bg-caution-dim text-caution border-caution/30"
      : lifecycle === "in_session"
        ? "bg-accent-dim text-accent border-accent/30"
        : "bg-overlay text-text-muted border-border";
  const lifecycleLabel =
    lifecycle === "proposed" ? "Proposed" : lifecycle === "in_session" ? "In session" : "Ended";

  return (
    <Link
      to={`/meetings/${meeting.id}/facilitator/home`}
      className={`block p-4 rounded-card border bg-surface transition-colors ${
        isActiveContext
          ? "border-accent/50 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]"
          : "border-border hover:border-border-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-accent shrink-0" />
            <span className="text-fac-field text-text-primary font-medium truncate">
              {meeting.title}
            </span>
            {isActiveContext && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-badge text-[11px] border font-medium bg-accent-dim/60 text-accent border-accent/40">
                Active context
              </span>
            )}
            <span
              className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-badge text-[11px] border font-medium ${lifecycleBadgeClass}`}
            >
              {lifecycleLabel}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-fac-meta text-text-muted">
              <CalendarDays size={12} />
              {formatMeetingDate(meeting.date)}
            </span>
            <span className="flex items-center gap-1 text-fac-meta text-text-muted">
              <Users size={12} />
              {meeting.participants.length} participants
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
