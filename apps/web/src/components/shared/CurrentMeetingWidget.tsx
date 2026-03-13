import { CalendarDays, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

type CurrentMeetingWidgetProps = {
  meetingId: string;
  title: string;
  date: string;
  status?: "proposed" | "in_session" | "ended";
  subtitle: string;
  titleTo?: string;
};

function formatMeetingDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "Date not set";
  return parsed.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CurrentMeetingWidget({
  meetingId,
  title,
  date,
  status = "proposed",
  subtitle,
  titleTo,
}: CurrentMeetingWidgetProps) {
  const statusLabel =
    status === "proposed" ? "Proposed" : status === "in_session" ? "In session" : "Ended";
  const statusClass =
    status === "proposed"
      ? "bg-caution-dim text-caution border-caution/30"
      : status === "in_session"
        ? "bg-accent-dim text-accent border-accent/30"
        : "bg-overlay text-text-muted border-border";

  return (
    <div className="flex-1 min-w-[280px]">
      <div className="flex items-center gap-2 mb-1.5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border text-fac-meta text-text-muted hover:text-text-primary transition-colors"
          title="Back to meeting list"
        >
          <ChevronLeft size={13} />
          <span>Meetings</span>
        </Link>
        <span className="text-fac-meta text-text-muted">/</span>
        <span className="text-fac-meta text-text-secondary truncate max-w-[220px]">
          {meetingId}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {titleTo ? (
          <Link
            to={titleTo}
            className="text-fac-title text-text-primary truncate hover:text-accent transition-colors"
            title="Open meeting home"
          >
            {title || "Loading…"}
          </Link>
        ) : (
          <h1 className="text-fac-title text-text-primary truncate">{title || "Loading…"}</h1>
        )}
        <span
          className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-badge text-[11px] border font-medium ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>
      <p className="text-fac-meta text-text-secondary mt-0.5 flex items-center gap-1.5">
        <CalendarDays size={12} />
        <span>{subtitle}</span>
        <span>·</span>
        <span>{formatMeetingDateTime(date)}</span>
      </p>
    </div>
  );
}
