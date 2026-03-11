import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type MeetingAttendeePresence = {
  name: string;
  status: "present" | "left";
  updatedAt: string;
};

export type MeetingAttendeeEvent = {
  id: string;
  attendeeName: string;
  action: "entered" | "left";
  at: string;
};

interface MeetingAttendeesPanelProps {
  attendees: MeetingAttendeePresence[];
  attendeeEvents: MeetingAttendeeEvent[];
  onToggleAttendee: (name: string) => void;
  onAddAttendee: (name: string) => boolean;
}

export function MeetingAttendeesPanel({
  attendees,
  attendeeEvents,
  onToggleAttendee,
  onAddAttendee,
}: MeetingAttendeesPanelProps) {
  const [expanded, setExpanded] = useState(attendees.length <= 8);
  const [newAttendeeName, setNewAttendeeName] = useState("");

  const presentCount = attendees.filter((attendee) => attendee.status === "present").length;
  const leftCount = attendees.length - presentCount;

  return (
    <div className="rounded border border-border bg-overlay/30 p-2.5">
      <button
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse attendee panel" : "Expand attendee panel"}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown size={13} className="text-text-muted" />
          ) : (
            <ChevronRight size={13} className="text-text-muted" />
          )}
          <p className="text-fac-meta text-text-secondary">Attendee presence</p>
        </div>
        <span className="text-fac-meta text-text-muted">
          {presentCount}/{attendees.length} present
        </span>
      </button>

      {!expanded && (
        <div className="mt-2 text-[10px] text-text-muted">
          {leftCount} marked left. Expand to manage attendee entry and exit.
        </div>
      )}

      {expanded && (
        <>
          <div className="mt-2 flex flex-col gap-1.5 max-h-52 overflow-y-auto">
            {attendees.map((attendee) => (
              <div
                key={attendee.name}
                className="flex items-center gap-2 rounded border border-border bg-surface px-2 py-1.5"
              >
                <span className="text-fac-meta text-text-primary flex-1 truncate">
                  {attendee.name}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-badge border ${
                    attendee.status === "present"
                      ? "border-settled/30 bg-settled-dim/20 text-settled"
                      : "border-caution/30 bg-caution-dim/20 text-caution"
                  }`}
                >
                  {attendee.status}
                </span>
                <button
                  onClick={() => onToggleAttendee(attendee.name)}
                  className="text-fac-meta text-accent hover:text-accent/80"
                >
                  {attendee.status === "present" ? "Mark left" : "Mark back"}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-text-muted">
            <span>{leftCount} marked left</span>
            <span>last update: {attendeeEvents[0]?.at ?? "none"}</span>
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-text-secondary">
            Entry / exit log
          </p>
          <div className="mt-1 flex flex-col gap-1 max-h-24 overflow-y-auto">
            {attendeeEvents.length === 0 ? (
              <p className="text-[10px] text-text-muted">No attendee movement recorded.</p>
            ) : (
              attendeeEvents.map((event) => (
                <p key={event.id} className="text-[10px] text-text-muted">
                  {event.at} · {event.attendeeName} {event.action}
                </p>
              ))
            )}
          </div>
          <p className="mt-1 text-[10px] text-text-muted">
            Use this panel to track who is in the room while you facilitate.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={newAttendeeName}
              onChange={(event) => setNewAttendeeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                const added = onAddAttendee(newAttendeeName);
                if (added) setNewAttendeeName("");
              }}
              placeholder="Add attendee"
              className="flex-1 px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => {
                const added = onAddAttendee(newAttendeeName);
                if (added) setNewAttendeeName("");
              }}
              disabled={!newAttendeeName.trim()}
              className="px-2.5 py-1.5 rounded border border-accent/30 text-accent text-fac-meta hover:bg-accent-dim transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
