import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { X, ZoomIn } from 'lucide-react';
import { ACTIVE_CONTEXT, AGENDA_ITEMS } from '@/lib/mock-data';
import { FieldCard } from '@/components/shared/FieldCard';
import { AgendaItem } from '@/components/shared/AgendaItem';
import { TagPill } from '@/components/shared/TagPill';

type FocusPayload = {
  meetingId?: string;
  fieldId?: string | null;
  updatedAt?: string;
};

export function SharedMeetingPage() {
  const { id } = useParams<{ id: string }>();
  const meetingId = id ?? 'mtg-1';
  const ctx = ACTIVE_CONTEXT;
  const focusStorageKey = `dl:meeting-focus:${meetingId}`;

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

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [focusStorageKey]);

  const currentFocusKey = focusedFieldId && focusUpdatedAt ? `${focusedFieldId}:${focusUpdatedAt}` : null;

  // Auto-open overlay whenever facilitator focus changes.
  useEffect(() => {
    if (!focusedFieldId) {
      setZoomedFieldId(null);
      setDismissedFocusKey(null);
      return;
    }
    if (dismissedFocusKey && currentFocusKey === dismissedFocusKey) return;
    setZoomedFieldId(focusedFieldId);
  }, [currentFocusKey, dismissedFocusKey, focusedFieldId]);

  const zoomedField = zoomedFieldId ? ctx.fields.find((field) => field.id === zoomedFieldId) ?? null : null;

  const orderedFields = useMemo(() => {
    if (!focusedFieldId) return ctx.fields;
    const focused = ctx.fields.find((field) => field.id === focusedFieldId);
    if (!focused) return ctx.fields;
    return [focused, ...ctx.fields.filter((field) => field.id !== focusedFieldId)];
  }, [ctx.fields, focusedFieldId]);

  return (
    <div className="density-display min-h-screen bg-base flex relative">
      {zoomedField && (
        <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex items-center justify-center p-8">
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
            <p className="text-display-field text-text-primary leading-relaxed mt-6">
              {zoomedField.value || 'Not yet generated'}
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
          {AGENDA_ITEMS.map((item, i) => (
            <AgendaItem
              key={item.id}
              title={item.title}
              status={item.status}
              position={i + 1}
              isActive={item.id === ctx.id}
            />
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-border">
          <p className="text-fac-meta text-text-muted">Q4 Architecture Review</p>
          <p className="text-fac-meta text-text-muted">8 March 2026</p>
        </div>
      </aside>

      {/* Main — active decision workspace */}
      <main className="flex-1 min-w-0 px-12 py-10 overflow-y-auto">
        {/* Decision header */}
        <div className="mb-8">
          <h1 className="text-display-title text-text-primary">{ctx.title}</h1>
          <p className="text-display-meta text-text-secondary mt-2 max-w-2xl leading-relaxed">
            {ctx.summary}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {ctx.tags.map((tag) => (
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
        <div className="flex flex-col gap-6">
          {orderedFields.map((field) => (
            <button
              key={field.id}
              onClick={() => setZoomedFieldId(field.id)}
              className={`text-left rounded-card transition-colors ${
                field.id === focusedFieldId ? 'ring-2 ring-accent/35' : ''
              }`}
            >
              <FieldCard field={field} density="display" />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
