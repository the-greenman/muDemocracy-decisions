import { useEffect, useMemo, useState } from "react";
import { formatFieldName } from "@/api/adapters";
import { getDecisionContext, getMeeting, getTemplateFields } from "@/api/endpoints";

interface ContextDisplayProps {
  meetingId: string;
  decisionContextId?: string | null;
  fieldId?: string | null;
  className?: string;
}

type ContextKind = "meeting" | "decision" | "field";

export function ContextDisplay({
  meetingId,
  decisionContextId = null,
  fieldId = null,
  className = "",
}: ContextDisplayProps) {
  const [meetingName, setMeetingName] = useState<string | null>(null);
  const [decisionName, setDecisionName] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadNames() {
      setMeetingName(null);
      setDecisionName(null);
      setFieldName(null);

      if (!meetingId) {
        return;
      }

      try {
        const meeting = await getMeeting(meetingId);
        if (!cancelled) {
          setMeetingName(meeting.title);
        }
      } catch {
        if (!cancelled) {
          setMeetingName(null);
        }
      }

      if (!decisionContextId) {
        return;
      }

      try {
        const context = await getDecisionContext(decisionContextId);
        if (cancelled) return;
        setDecisionName(context.title);

        if (!fieldId) {
          return;
        }

        const { fields } = await getTemplateFields(context.templateId);
        if (cancelled) return;
        const field = fields.find((item) => item.id === fieldId) ?? null;
        setFieldName(field ? formatFieldName(field.name) : null);
      } catch {
        if (!cancelled) {
          setDecisionName(null);
          setFieldName(null);
        }
      }
    }

    void loadNames();

    return () => {
      cancelled = true;
    };
  }, [decisionContextId, fieldId, meetingId]);

  const kind: ContextKind = fieldId ? "field" : decisionContextId ? "decision" : "meeting";
  const name =
    kind === "field"
      ? fieldName ?? fieldId ?? "Unknown field"
      : kind === "decision"
        ? decisionName ?? decisionContextId ?? "Unknown decision"
        : meetingName ?? meetingId ?? "Unknown meeting";

  const hoverTitle = useMemo(() => {
    const parts = [`${kind}: ${name}`];
    if (meetingId) parts.push(`meeting id: ${meetingId}`);
    if (decisionContextId) parts.push(`decision id: ${decisionContextId}`);
    if (fieldId) parts.push(`field id: ${fieldId}`);
    return parts.join("\n");
  }, [decisionContextId, fieldId, kind, meetingId, name]);

  return (
    <div
      className={`inline-flex min-w-0 items-center gap-2 rounded-badge border border-border bg-surface px-2 py-1 ${className}`.trim()}
      title={hoverTitle}
    >
      <span className="inline-flex items-center rounded-badge border border-border bg-overlay px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {kind}
      </span>
      <span className="truncate text-fac-meta text-text-primary">{name}</span>
    </div>
  );
}
