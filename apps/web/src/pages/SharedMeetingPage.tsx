import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { X, ZoomIn } from "lucide-react";
import { FieldCard } from "@/components/shared/FieldCard";
import { AgendaList } from "@/components/shared/AgendaList";
import { TagPill } from "@/components/shared/TagPill";
import { useMeeting } from "@/hooks/useMeeting";
import { useMeetingAgenda } from "@/hooks/useMeetingAgenda";
import { useTemplates } from "@/hooks/useTemplates";
import { getTemplateFields } from "@/api/endpoints";
import { buildUIFields, buildAgendaItems } from "@/api/adapters";
import type { DecisionContext, DecisionField } from "@/api/types";
import type { Field } from "@/lib/ui-models";

type FocusPayload = {
  meetingId?: string;
  fieldId?: string | null;
  updatedAt?: string;
};

type FieldSyncPayload = {
  meetingId?: string;
  fields?: Field[];
  updatedAt?: string;
};

export function SharedMeetingPage() {
  const { id } = useParams<{ id: string }>();
  const meetingId = id ?? "";
  const focusStorageKey = `dl:meeting-focus:${meetingId}`;
  const fieldStorageKey = `dl:meeting-fields:${meetingId}`;

  // API data
  const { meeting } = useMeeting(meetingId);
  const { decisions, contexts } = useMeetingAgenda(meetingId, { poll: true });
  const { templates } = useTemplates();

  // Template fields cache keyed by templateId
  const templateFieldsRef = useRef<Record<string, DecisionField[]>>({});
  const [templateFields, setTemplateFields] = useState<DecisionField[]>([]);

  // Derived: active context = most recently updated non-logged context
  const activeContext = useMemo<DecisionContext | null>(() => {
    const live = contexts.filter((c) => c.status !== "logged");
    if (live.length === 0) return null;
    return live.reduce((latest, c) =>
      new Date(c.updatedAt) > new Date(latest.updatedAt) ? c : latest,
    );
  }, [contexts]);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeContext?.templateId) ?? null,
    [templates, activeContext?.templateId],
  );

  // Load template fields when activeContext.templateId changes
  const loadTemplateFields = useCallback(async (templateId: string) => {
    const cached = templateFieldsRef.current[templateId];
    if (cached) {
      setTemplateFields(cached);
      return;
    }
    try {
      const { fields } = await getTemplateFields(templateId);
      templateFieldsRef.current[templateId] = fields;
      setTemplateFields(fields);
    } catch {
      // keep previous fields on error
    }
  }, []);

  useEffect(() => {
    if (activeContext?.templateId) {
      void loadTemplateFields(activeContext.templateId);
    }
  }, [activeContext?.templateId, loadTemplateFields]);

  // Fields from API (rebuilt each poll cycle)
  const apiFields = useMemo<Field[]>(() => {
    if (!activeContext || templateFields.length === 0) return [];
    return buildUIFields(templateFields, activeContext);
  }, [activeContext, templateFields]);

  // localStorage field sync (facilitator writes, we read for instant overlay)
  const [displayFields, setDisplayFields] = useState<Field[]>([]);

  useEffect(() => {
    const applyLocalStorage = () => {
      try {
        const raw = localStorage.getItem(fieldStorageKey);
        if (!raw) {
          setDisplayFields(apiFields);
          return;
        }
        const parsed = JSON.parse(raw) as FieldSyncPayload;
        if (!parsed.fields || parsed.fields.length === 0) {
          setDisplayFields(apiFields);
          return;
        }
        // Overlay localStorage values on API fields (API is authoritative for lock status)
        const lsMap = new Map(parsed.fields.map((f) => [f.id, f.value]));
        setDisplayFields(
          apiFields.map((f) => ({
            ...f,
            value: lsMap.get(f.id) ?? f.value,
          })),
        );
      } catch {
        setDisplayFields(apiFields);
      }
    };

    applyLocalStorage();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== fieldStorageKey) return;
      applyLocalStorage();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [apiFields, fieldStorageKey]);

  // Focus sync from localStorage
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [focusUpdatedAt, setFocusUpdatedAt] = useState<string | null>(null);
  const [zoomedFieldId, setZoomedFieldId] = useState<string | null>(null);
  const [dismissedFocusKey, setDismissedFocusKey] = useState<string | null>(null);

  useEffect(() => {
    const hydrateFromStorage = () => {
      try {
        const raw = localStorage.getItem(focusStorageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as FocusPayload;
        setFocusedFieldId(parsed.fieldId ?? null);
        setFocusUpdatedAt(parsed.updatedAt ?? null);
      } catch {
        setFocusedFieldId(null);
        setFocusUpdatedAt(null);
      }
    };

    hydrateFromStorage();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== focusStorageKey) return;
      hydrateFromStorage();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [focusStorageKey]);

  const currentFocusKey =
    focusedFieldId && focusUpdatedAt ? `${focusedFieldId}:${focusUpdatedAt}` : null;

  useEffect(() => {
    if (!focusedFieldId) {
      setZoomedFieldId(null);
      setDismissedFocusKey(null);
      return;
    }
    if (dismissedFocusKey && currentFocusKey === dismissedFocusKey) return;
    setZoomedFieldId(focusedFieldId);
  }, [currentFocusKey, dismissedFocusKey, focusedFieldId]);

  const zoomedField = zoomedFieldId
    ? (displayFields.find((field) => field.id === zoomedFieldId) ?? null)
    : null;

  const orderedFields = useMemo(() => {
    if (!focusedFieldId) return displayFields;
    const focused = displayFields.find((field) => field.id === focusedFieldId);
    if (!focused) return displayFields;
    return [focused, ...displayFields.filter((field) => field.id !== focusedFieldId)];
  }, [displayFields, focusedFieldId]);

  // Agenda items for sidebar
  const agendaItems = useMemo(() => buildAgendaItems(decisions), [decisions]);

  // Which agenda item is active (whose context matches the live active context)
  const activeAgendaItemId = useMemo(() => {
    if (!activeContext) return undefined;
    return decisions.find((d) => d.contextId === activeContext.id)?.id;
  }, [activeContext, decisions]);

  // Context summary from the corresponding flagged decision
  const activeDecisionSummary = useMemo(() => {
    if (!activeContext) return "";
    return decisions.find((d) => d.contextId === activeContext.id)?.contextSummary ?? "";
  }, [activeContext, decisions]);

  return (
    <div className="density-display min-h-screen bg-base flex relative">
      {zoomedField && (
        <div className="fixed inset-0 z-30 bg-black/75 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="w-full max-w-5xl rounded-card border border-border bg-surface p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-display-title text-text-primary">{zoomedField.label}</h2>
              <button
                onClick={() => {
                  setZoomedFieldId(null);
                  if (currentFocusKey) setDismissedFocusKey(currentFocusKey);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded border border-border text-fac-meta text-text-muted hover:text-text-primary"
              >
                <X size={14} />
                Close
              </button>
            </div>
            {zoomedField.instructions && (
              <p className="text-display-meta text-text-muted leading-snug mt-4">
                {zoomedField.instructions}
              </p>
            )}
            <p className="text-display-field text-text-primary leading-relaxed mt-4">
              {zoomedField.value || "Not yet generated"}
            </p>
          </div>
        </div>
      )}

      {/* Sidebar — agenda */}
      <aside className="w-72 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-fac-title text-text-secondary uppercase tracking-widest text-xs">
            Agenda
          </h2>
        </div>
        <nav className="flex-1 px-2 py-2 overflow-y-auto">
          <AgendaList items={agendaItems} activeId={activeAgendaItemId} />
        </nav>
        <div className="px-6 py-4 border-t border-border">
          {meeting && (
            <>
              <p className="text-fac-meta text-text-muted">{meeting.title}</p>
              <p className="text-fac-meta text-text-muted">{meeting.date}</p>
            </>
          )}
        </div>
      </aside>

      {/* Main — active decision workspace */}
      <main className="flex-1 min-w-0 px-12 py-10 overflow-y-auto">
        {activeContext ? (
          <>
            {/* Decision header */}
            <div className="mb-8">
              <h1 className="text-display-title text-text-primary">{activeContext.title}</h1>
              {activeDecisionSummary && (
                <p className="text-display-meta text-text-secondary mt-2 max-w-2xl leading-relaxed">
                  {activeDecisionSummary}
                </p>
              )}

              {/* Template overview */}
              {activeTemplate && (
                <div className="mt-4 flex flex-col gap-0.5">
                  <span className="text-display-meta text-text-muted uppercase tracking-widest text-xs">
                    {activeTemplate.name}
                  </span>
                  {activeTemplate.description && (
                    <p className="text-display-meta text-text-secondary max-w-2xl leading-relaxed">
                      {activeTemplate.description}
                    </p>
                  )}
                </div>
              )}

              {/* Tags placeholder — no tags in API yet */}
              <div className="flex flex-wrap gap-2 mt-4">
                {(
                  [] as Array<{ id: string; name: string; category: "topic" | "team" | "project" }>
                ).map((tag) => (
                  <TagPill key={tag.id} name={tag.name} category={tag.category} />
                ))}
              </div>

              {focusedFieldId && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded border border-accent/40 bg-accent-dim/15 text-fac-meta text-accent">
                  <ZoomIn size={13} />
                  Facilitator focus active
                </div>
              )}
            </div>

            {/* Fields — display density, read-only */}
            {displayFields.length > 0 ? (
              <div className="flex flex-col gap-6">
                {orderedFields.map((field) => (
                  <button
                    key={field.id}
                    onClick={() => setZoomedFieldId(field.id)}
                    className={`text-left rounded-card transition-colors ${
                      field.id === focusedFieldId ? "ring-2 ring-accent/35" : ""
                    }`}
                  >
                    <FieldCard field={field} density="display" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-display-meta text-text-muted">
                Waiting for facilitator to generate draft…
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4">
            <p className="text-display-title text-text-muted">No active decision</p>
            <p className="text-display-meta text-text-secondary">
              The facilitator will select a decision to work on.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
