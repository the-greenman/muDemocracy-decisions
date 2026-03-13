import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { ParticipantAddWidget } from "@/components/shared/ParticipantAddWidget";

interface MeetingAttendeesPanelProps {
  attendees: string[];
  onAddAttendee: (name: string) => boolean | Promise<boolean>;
  onRemoveAttendee: (name: string) => void | Promise<void>;
  disabled?: boolean;
}

export function MeetingAttendeesPanel({
  attendees,
  onAddAttendee,
  onRemoveAttendee,
  disabled = false,
}: MeetingAttendeesPanelProps) {
  const [expanded, setExpanded] = useState(attendees.length <= 8);

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
          <p className="text-fac-meta text-text-secondary">Participants</p>
        </div>
        <span className="text-fac-meta text-text-muted">{attendees.length} total</span>
      </button>

      {!expanded && (
        <div className="mt-2 text-[10px] text-text-muted">Expand to manage participants.</div>
      )}

      {expanded && (
        <>
          <div className="mt-2 flex flex-col gap-1.5 max-h-52 overflow-y-auto">
            {attendees.length === 0 ? (
              <p className="text-[10px] text-text-muted">No participants added yet.</p>
            ) : (
              attendees.map((attendee) => (
                <div
                  key={attendee}
                  className="flex items-center gap-2 rounded border border-border bg-surface px-2 py-1.5"
                >
                  <span className="text-fac-meta text-text-primary flex-1 truncate">{attendee}</span>
                  <button
                    onClick={() => void onRemoveAttendee(attendee)}
                    disabled={disabled || attendees.length <= 1}
                    className="text-text-muted hover:text-danger transition-colors disabled:opacity-40"
                    aria-label={`Remove ${attendee}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="mt-2 text-[10px] text-text-muted">
            Add or remove participants for this meeting.
          </p>
          <div className="mt-2">
            <ParticipantAddWidget
              onAdd={onAddAttendee}
              disabled={disabled}
              placeholder="Add attendee"
              buttonLabel="Add"
              size="sm"
            />
          </div>
        </>
      )}
    </div>
  );
}
