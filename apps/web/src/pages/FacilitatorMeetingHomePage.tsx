import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, AlertCircle } from "lucide-react";
import { MainHeader } from "@/components/shared/MainHeader";
import { AgendaItemAddWidget } from "@/components/shared/AgendaItemAddWidget";
import { AgendaList } from "@/components/shared/AgendaList";
import {
  MeetingAttendeesPanel,
  type MeetingAttendeeEvent,
  type MeetingAttendeePresence,
} from "@/components/shared/MeetingAttendeesPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";
import {
  createDecisionContext,
  createFlaggedDecision,
  getMeeting,
  uploadTranscript,
  updateFlaggedDecision,
  updateMeeting,
} from "@/api/endpoints";
import { buildAgendaItems } from "@/api/adapters";
import type { Meeting } from "@/api/types";
import { useMeetingAgenda } from "@/hooks/useMeetingAgenda";
import { useTemplates } from "@/hooks/useTemplates";

function toDateTimeLocalInputValue(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function FacilitatorMeetingHomePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable meeting fields (initialised from API on load)
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");

  const [manualTranscripts, setManualTranscripts] = useState<string[]>([]);
  const [transcriptText, setTranscriptText] = useState("");
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [transcriptUploadError, setTranscriptUploadError] = useState<string | null>(null);

  const [attendees, setAttendees] = useState<MeetingAttendeePresence[]>([]);
  const [attendeeEvents, setAttendeeEvents] = useState<MeetingAttendeeEvent[]>([]);
  const [endingMeeting, setEndingMeeting] = useState(false);
  const [agendaAddError, setAgendaAddError] = useState<string | null>(null);
  const [addingAgendaItem, setAddingAgendaItem] = useState(false);

  const { decisions, refresh: refreshAgenda } = useMeetingAgenda(id ?? "");
  const { templates } = useTemplates();
  const isMeetingCompleted = meeting?.status === "completed";

  // Load meeting from API on mount
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getMeeting(id);
      setMeeting(data);
      setMeetingTitle(data.title);
      setMeetingDate(toDateTimeLocalInputValue(data.date));
      setAttendees(
        data.participants.map((name) => ({
          name,
          status: "present" as const,
          updatedAt: "meeting start",
        })),
      );
      setAttendeeEvents(
        data.participants.map((name, index) => ({
          id: `home-attendee-start-${index}`,
          attendeeName: name,
          action: "entered" as const,
          at: "meeting start",
        })),
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load meeting");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Save title/date on blur
  async function handleTitleBlur() {
    if (isMeetingCompleted) {
      setMeetingTitle(meeting?.title ?? meetingTitle);
      return;
    }
    if (!id || !meetingTitle.trim() || meetingTitle === meeting?.title) return;
    try {
      const updated = await updateMeeting(id, { title: meetingTitle.trim() });
      setMeeting(updated);
    } catch {
      // revert on error
      setMeetingTitle(meeting?.title ?? meetingTitle);
    }
  }

  async function handleDateBlur() {
    if (isMeetingCompleted) {
      setMeetingDate(toDateTimeLocalInputValue(meeting?.date ?? meetingDate));
      return;
    }
    if (!id || !meetingDate) return;
    const nextIso = new Date(meetingDate).toISOString();
    if (nextIso === meeting?.date) return;
    try {
      const updated = await updateMeeting(id, { date: nextIso });
      setMeeting(updated);
      setMeetingDate(toDateTimeLocalInputValue(updated.date));
    } catch {
      setMeetingDate(toDateTimeLocalInputValue(meeting?.date ?? meetingDate));
    }
  }

  async function handleAddAgendaItem(title: string) {
    if (!id) return;
    setAgendaAddError(null);
    setAddingAgendaItem(true);

    const template = templates.find((candidate) => candidate.isDefault) ?? templates[0];
    if (!template) {
      setAgendaAddError("No template available. Seed templates first.");
      setAddingAgendaItem(false);
      return;
    }

    const acceptedDecisions = decisions
      .filter((decision) => decision.status === "accepted")
      .sort((a, b) => a.priority - b.priority);
    const nextPriority =
      acceptedDecisions.length > 0
        ? Math.max(...acceptedDecisions.map((decision) => decision.priority)) + 1
        : 0;

    try {
      const flagged = await createFlaggedDecision(id, {
        suggestedTitle: title,
        contextSummary: "Added from meeting home.",
        confidence: 1,
        chunkIds: [],
        priority: nextPriority,
      });

      await updateFlaggedDecision(flagged.id, {
        status: "accepted",
        priority: nextPriority,
      });

      await createDecisionContext({
        meetingId: id,
        flaggedDecisionId: flagged.id,
        title,
        templateId: template.id,
      });

      await refreshAgenda();
    } catch (err) {
      setAgendaAddError(err instanceof Error ? err.message : "Failed to add agenda item");
    } finally {
      setAddingAgendaItem(false);
    }
  }

  async function handleUploadTranscriptText(content: string, sourceLabel: string) {
    if (!id || !content.trim()) return;
    setTranscriptUploadError(null);
    setUploadingTranscript(true);
    try {
      const response = await uploadTranscript(id, {
        content,
        format: "txt",
        chunkStrategy: "fixed",
      });
      setManualTranscripts((prev) => [
        `${sourceLabel} (${response.chunks.length} chunks)`,
        ...prev,
      ]);
      setTranscriptText("");
    } catch (err) {
      setTranscriptUploadError(err instanceof Error ? err.message : "Failed to upload transcript");
    } finally {
      setUploadingTranscript(false);
    }
  }

  async function handleTranscriptFileSelected(file: File | null) {
    if (!file) return;
    const text = await file.text();
    await handleUploadTranscriptText(text, file.name);
  }

  function toggleAttendeeStatus(name: string) {
    let nextEvent: MeetingAttendeeEvent | null = null;

    setAttendees((prev) =>
      prev.map((attendee) => {
        if (attendee.name !== name) return attendee;
        const nextStatus = attendee.status === "present" ? "left" : "present";
        const updatedAt = new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
        nextEvent = {
          id: `home-attendee-event-${Date.now()}-${name.replace(/\s+/g, "-").toLowerCase()}`,
          attendeeName: name,
          action: nextStatus === "present" ? "entered" : "left",
          at: updatedAt,
        };
        return { ...attendee, status: nextStatus, updatedAt };
      }),
    );

    if (nextEvent) {
      const event = nextEvent;
      setAttendeeEvents((prev) => [event, ...prev].slice(0, 12));
    }
  }

  function addAttendee(name: string) {
    const normalized = name.trim();
    if (!normalized) return false;
    const exists = attendees.some(
      (attendee) => attendee.name.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) return false;

    const updatedAt = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setAttendees((prev) => [...prev, { name: normalized, status: "present", updatedAt }]);
    setAttendeeEvents((prev) =>
      [
        {
          id: `home-attendee-event-${Date.now()}-${normalized.replace(/\s+/g, "-").toLowerCase()}`,
          attendeeName: normalized,
          action: "entered" as const,
          at: updatedAt,
        },
        ...prev,
      ].slice(0, 12),
    );
    return true;
  }

  async function handleEndMeeting() {
    if (!id || !meeting || meeting.status === "completed" || endingMeeting) return;
    const confirmed = window.confirm("End this meeting? This marks it as completed.");
    if (!confirmed) return;

    setEndingMeeting(true);
    try {
      const updated = await updateMeeting(id, { status: "completed" });
      setMeeting(updated);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to end meeting");
    } finally {
      setEndingMeeting(false);
    }
  }

  return (
    <div className="density-facilitator min-h-screen bg-base">
      <MainHeader
        title={meetingTitle || "Meeting"}
        titleTo={id ? `/meetings/${id}/facilitator/home` : undefined}
        subtitle="Meeting home"
        meta={meeting?.date ? new Date(meeting.date).toLocaleString("en-GB") : undefined}
        status={
          meeting?.status
            ? {
                label: meeting.status === "completed" ? "Completed" : "Active",
                tone: meeting.status === "completed" ? "completed" : "active",
              }
            : undefined
        }
        navItems={[{ label: "Meetings", to: "/" }, { label: id ?? "meeting" }]}
        actions={
          id ? (
            <>
              <Button
                onClick={() => void handleEndMeeting()}
                variant="danger"
                disabled={meeting?.status === "completed" || endingMeeting}
              >
                {meeting?.status === "completed"
                  ? "Meeting ended"
                  : endingMeeting
                    ? "Ending…"
                    : "End meeting"}
              </Button>
              <Link
                to={`/meetings/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 rounded border border-border text-fac-meta text-text-muted hover:text-text-primary transition-colors"
              >
                Shared screen
              </Link>
              <Button onClick={() => navigate(`/meetings/${id}/facilitator`)} variant="primary">
                Open facilitator workspace
                <ArrowRight size={13} />
              </Button>
            </>
          ) : undefined
        }
      />

      {loadError && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-card border border-danger/30 bg-danger-dim text-danger text-fac-meta">
          <AlertCircle size={15} className="shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Meeting details" className="flex flex-col gap-3">
          <Input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            onBlur={() => void handleTitleBlur()}
            placeholder="Meeting title"
            className="w-full"
            disabled={isMeetingCompleted}
          />
          <Input
            type="datetime-local"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            onBlur={() => void handleDateBlur()}
            className="w-64"
            disabled={isMeetingCompleted}
          />
          <p className="text-fac-meta text-text-muted">
            Manage attendance in the shared attendee panel below.
          </p>
        </Panel>

        <Panel title="Decision agenda" className="flex flex-col gap-3">
          <AgendaItemAddWidget
            onAdd={handleAddAgendaItem}
            loading={addingAgendaItem}
            error={agendaAddError}
            disabled={meeting?.status === "completed"}
          />
          {buildAgendaItems(decisions).length === 0 ? (
            <p className="text-fac-meta text-text-muted">
              No agenda items yet. Add one to persist it to facilitator workspace.
            </p>
          ) : (
            <AgendaList items={buildAgendaItems(decisions)} />
          )}
        </Panel>

        <Panel title="Meeting transcript" className="flex flex-col gap-3">
          <p className="text-fac-meta text-text-muted">
            Upload or paste transcript text. This is persisted via the API and available in
            facilitator transcript workflows.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".txt,.md,.vtt,.srt"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void handleTranscriptFileSelected(file);
                e.currentTarget.value = "";
              }}
              className="flex-1"
              disabled={uploadingTranscript || meeting?.status === "completed"}
            />
          </div>
          <textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            rows={6}
            placeholder="Paste transcript text..."
            className="w-full p-3 rounded border border-border bg-overlay text-fac-meta text-text-primary resize-y focus:outline-none focus:border-accent placeholder:text-text-muted"
            disabled={uploadingTranscript || meeting?.status === "completed"}
          />
          <div className="flex items-center justify-between">
            <p className="text-fac-meta text-text-muted">
              Plain text is supported now. Background docs are hidden until API support lands.
            </p>
            <Button
              onClick={() => void handleUploadTranscriptText(transcriptText, "Pasted transcript")}
              disabled={
                !transcriptText.trim() || uploadingTranscript || meeting?.status === "completed"
              }
              variant="primary"
              size="sm"
            >
              {uploadingTranscript ? "Uploading…" : "Upload pasted transcript"}
            </Button>
          </div>
          {transcriptUploadError && (
            <p className="text-fac-meta text-danger">{transcriptUploadError}</p>
          )}
          {manualTranscripts.length > 0 && (
            <div className="rounded border border-border bg-overlay/40 p-3">
              {manualTranscripts.map((item) => (
                <p key={`tr-${item}`} className="text-fac-meta text-text-primary">
                  • Uploaded: {item}
                </p>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Attendance and outcomes" className="flex flex-col gap-3">
          <p className="text-fac-meta text-text-muted">
            Track who is/was in the meeting and review decision outcomes when meeting is closed.
          </p>
          <MeetingAttendeesPanel
            attendees={attendees}
            attendeeEvents={attendeeEvents}
            onToggleAttendee={toggleAttendeeStatus}
            onAddAttendee={addAttendee}
          />
          {meeting?.status === "completed" ? (
            <div className="rounded border border-border bg-overlay/40 p-3">
              <p className="text-fac-meta text-text-secondary">Meeting outcomes</p>
              <p className="text-fac-meta text-text-primary mt-1">Meeting closed.</p>
            </div>
          ) : (
            <div className="rounded border border-border bg-overlay/40 p-3">
              <p className="text-fac-meta text-text-muted">
                Outcomes summary appears when the meeting is marked completed.
              </p>
            </div>
          )}
        </Panel>
      </main>
    </div>
  );
}
