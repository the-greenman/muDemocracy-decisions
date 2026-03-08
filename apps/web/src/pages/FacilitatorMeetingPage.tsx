import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, CheckSquare, ExternalLink, FilePlus2, Upload, Lightbulb } from 'lucide-react';
import { ACTIVE_CONTEXT, AGENDA_ITEMS, CANDIDATES, SUPPLEMENTARY_ITEMS } from '@/lib/mock-data';
import { FacilitatorFieldCard } from '@/components/facilitator/FacilitatorFieldCard';
import { CandidateCard } from '@/components/facilitator/CandidateCard';
import { AgendaItem } from '@/components/shared/AgendaItem';
import { TagPill } from '@/components/shared/TagPill';
import { FieldZoom } from '@/components/facilitator/FieldZoom';
import { RegenerateDialog } from '@/components/facilitator/RegenerateDialog';
import { FinaliseDialog } from '@/components/facilitator/FinaliseDialog';
import { CreateContextDialog } from '@/components/facilitator/CreateContextDialog';
import { UploadTranscript } from '@/components/facilitator/UploadTranscript';
import type { Field, Candidate, SupplementaryItem, Template, DecisionMethod } from '@/lib/mock-data';

type ModalState =
  | null
  | { type: 'regenerate' }
  | { type: 'finalise' }
  | { type: 'create-context' }
  | { type: 'upload' };

export function FacilitatorMeetingPage() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<Field[]>(ACTIVE_CONTEXT.fields);
  const [candidates, setCandidates] = useState<Candidate[]>(CANDIDATES);
  const [leftTab, setLeftTab] = useState<'candidates' | 'agenda'>('candidates');
  const [zoomedFieldId, setZoomedFieldId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [supplementary, setSupplementary] = useState<SupplementaryItem[]>(SUPPLEMENTARY_ITEMS);
  const [finalised, setFinalised] = useState(false);
  const [transcriptUploaded, setTranscriptUploaded] = useState(false);

  const activeCandidates = candidates.filter((c) => c.status === 'new');
  const unlockedCount = fields.filter((f) => f.status !== 'locked').length;
  const zoomedField = zoomedFieldId ? fields.find((f) => f.id === zoomedFieldId) ?? null : null;

  // ── Field mutations ────────────────────────────────────────────

  function updateField(id: string, patch: Partial<Field>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function handleLock(id: string) {
    updateField(id, { status: 'locked' });
  }

  function handleUnlock(id: string) {
    updateField(id, { status: 'idle' });
  }

  function handleSaveFieldValue(id: string, value: string) {
    updateField(id, { value });
  }

  function handleGuidanceChange(id: string, guidance: string) {
    updateField(id, { guidance });
  }

  // ── Candidate mutations ────────────────────────────────────────

  function handleDismiss(id: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'dismissed' as const } : c))
    );
  }

  // ── Supplementary content ──────────────────────────────────────

  function handleAddSupplementary(item: Omit<SupplementaryItem, 'id' | 'createdAt'>) {
    const newItem: SupplementaryItem = {
      ...item,
      id: `sc-${Date.now()}`,
      createdAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
    setSupplementary((prev) => [...prev, newItem]);
  }

  function handleRemoveSupplementary(id: string) {
    setSupplementary((prev) => prev.filter((s) => s.id !== id));
  }

  // ── Regenerate ─────────────────────────────────────────────────

  function handleRegenerate(focus: string) {
    setModal(null);
    // Simulate regeneration: mark unlocked fields as 'generating', then populate after delay
    setFields((prev) =>
      prev.map((f) => (f.status === 'locked' ? f : { ...f, status: 'generating' }))
    );
    setTimeout(() => {
      setFields((prev) =>
        prev.map((f) =>
          f.status === 'generating'
            ? {
                ...f,
                status: 'idle',
                value: f.value || `[Regenerated${focus ? ` — focus: "${focus}"` : ''}] Sample content for ${f.label}.`,
              }
            : f
        )
      );
    }, 2000);
  }

  // ── Finalise ───────────────────────────────────────────────────

  function handleFinalise(_method: DecisionMethod, _actors: string[], _loggedBy: string) {
    setModal(null);
    setFinalised(true);
    setTimeout(() => navigate('/decisions/dec-1'), 800);
  }

  // ── Create context ─────────────────────────────────────────────

  function handleCreateContext(_title: string, _summary: string, _template: Template) {
    setModal(null);
    // In the prototype we just close — a real implementation would add to agenda
  }

  // ── Upload transcript ──────────────────────────────────────────

  function handleUploadComplete(_filename: string, _rowCount: number) {
    setModal(null);
    setTranscriptUploaded(true);
    setLeftTab('candidates');
  }

  // ── Field zoom ─────────────────────────────────────────────────

  if (zoomedField) {
    return (
      <FieldZoom
        field={zoomedField}
        supplementaryItems={supplementary}
        meetingId="mtg-1"
        contextId={ACTIVE_CONTEXT.id}
        onClose={() => setZoomedFieldId(null)}
        onSave={handleSaveFieldValue}
        onLock={handleLock}
        onUnlock={handleUnlock}
        onGuidanceChange={handleGuidanceChange}
        onAddSupplementary={handleAddSupplementary}
        onRemoveSupplementary={handleRemoveSupplementary}
      />
    );
  }

  return (
    <div className="density-facilitator min-h-screen bg-base flex flex-col">

      {/* ── Modals ──────────────────────────────────────────────── */}
      {modal?.type === 'regenerate' && (
        <RegenerateDialog
          unlockedCount={unlockedCount}
          onConfirm={handleRegenerate}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'finalise' && (
        <FinaliseDialog
          participants={['Alice Chen', 'Bob Marsh', 'Priya Nair']}
          onConfirm={handleFinalise}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'create-context' && (
        <CreateContextDialog
          onConfirm={handleCreateContext}
          onCancel={() => setModal(null)}
        />
      )}

      {/* ── Header strip ────────────────────────────────────────── */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-2 shrink-0">
        <span className="text-fac-field text-text-primary font-medium flex-1 truncate">
          Q4 Architecture Review — Facilitator
          {finalised && <span className="ml-2 text-settled text-fac-meta">✓ Logged</span>}
        </span>

        <Link
          to="/meetings/mtg-1"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
        >
          <ExternalLink size={13} />
          Shared view
        </Link>

        <button
          onClick={() => setModal({ type: 'upload' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
        >
          <Upload size={13} />
          Upload transcript
          {transcriptUploaded && <span className="w-1.5 h-1.5 rounded-full bg-settled" />}
        </button>

        <button
          onClick={() => setModal({ type: 'create-context' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
        >
          <FilePlus2 size={13} />
          New decision
        </button>

        <button
          onClick={() => setModal({ type: 'regenerate' })}
          disabled={unlockedCount === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors disabled:opacity-30"
        >
          <RefreshCw size={13} />
          Regenerate
        </button>

        <button
          onClick={() => setModal({ type: 'finalise' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta bg-settled text-base rounded font-medium hover:bg-settled/90 transition-colors"
        >
          <CheckSquare size={13} />
          Finalise
        </button>
      </header>

      {/* ── Upload inline panel (if modal type upload) ───────────── */}
      {modal?.type === 'upload' && (
        <div className="px-4 py-3 border-b border-border">
          <UploadTranscript
            onComplete={handleUploadComplete}
            onCancel={() => setModal(null)}
          />
        </div>
      )}

      <div className="flex flex-1 min-h-0">

        {/* ── Left panel ──────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r border-border flex flex-col bg-surface">
          <div className="flex border-b border-border">
            <TabButton active={leftTab === 'candidates'} onClick={() => setLeftTab('candidates')}>
              Suggested
              {activeCandidates.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-caution text-base font-bold">
                  {activeCandidates.length}
                </span>
              )}
            </TabButton>
            <TabButton active={leftTab === 'agenda'} onClick={() => setLeftTab('agenda')}>
              Agenda
            </TabButton>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {leftTab === 'candidates' ? (
              <div className="flex flex-col gap-2">
                {activeCandidates.length === 0 ? (
                  <p className="text-fac-meta text-text-muted px-2 py-6 text-center">
                    {transcriptUploaded
                      ? 'All candidates reviewed.'
                      : 'Upload a transcript to detect candidates.'}
                  </p>
                ) : (
                  activeCandidates.map((c) => (
                    <CandidateCard key={c.id} candidate={c} onDismiss={handleDismiss} />
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                {AGENDA_ITEMS.map((item, i) => (
                  <AgendaItem
                    key={item.id}
                    title={item.title}
                    status={item.status}
                    position={i + 1}
                    isActive={item.id === ACTIVE_CONTEXT.id}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-border">
            <Link
              to="/meetings/mtg-1/facilitator/transcript"
              className="flex items-center gap-2 px-3 py-2 rounded text-fac-meta text-text-muted hover:text-text-primary hover:bg-overlay transition-colors w-full"
            >
              <FilePlus2 size={14} />
              Select transcript segments
            </Link>
          </div>
        </aside>

        {/* ── Main workspace ──────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-5">

          {/* Context header */}
          <div className="mb-5">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h1 className="text-fac-title text-text-primary">{ACTIVE_CONTEXT.title}</h1>
                <p className="text-fac-meta text-text-secondary mt-1">{ACTIVE_CONTEXT.summary}</p>
              </div>
              <span className="shrink-0 text-fac-meta text-text-muted border border-border px-2 py-0.5 rounded-badge">
                {ACTIVE_CONTEXT.templateName}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ACTIVE_CONTEXT.tags.map((tag) => (
                <TagPill key={tag.id} name={tag.name} category={tag.category} />
              ))}
            </div>
          </div>

          {/* Hint */}
          <div className="flex items-start gap-2 p-3 rounded-card border border-accent/20 bg-accent-dim/10 mb-5">
            <Lightbulb size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-fac-meta text-text-secondary">
              Click the zoom icon on any field to edit content, add guidance, or paste supplementary evidence.
              Lock fields the group has agreed on.
            </p>
          </div>

          {/* Field cards */}
          <div className="flex flex-col gap-4">
            {fields.map((field) => (
              <FacilitatorFieldCard
                key={field.id}
                field={field}
                onLock={handleLock}
                onUnlock={handleUnlock}
                onZoom={setZoomedFieldId}
                supplementaryCount={
                  supplementary.filter((s) => s.scope === 'field' && s.fieldId === field.id).length
                }
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 px-3 py-2.5 text-fac-meta font-medium border-b-2 transition-colors ${
        active
          ? 'border-accent text-accent'
          : 'border-transparent text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}
