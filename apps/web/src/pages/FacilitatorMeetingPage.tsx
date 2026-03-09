import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  CheckSquare,
  ExternalLink,
  FilePlus2,
  Upload,
  Lightbulb,
  PauseCircle,
  Link2,
  Plus,
  Radio,
  Flag,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  ACTIVE_CONTEXT,
  AGENDA_ITEMS,
  CANDIDATES,
  OPEN_CONTEXTS,
  SUPPLEMENTARY_ITEMS,
  getMockFieldsForTemplate,
} from '@/lib/mock-data';
import { FacilitatorFieldCard } from '@/components/facilitator/FacilitatorFieldCard';
import { CandidateCard } from '@/components/facilitator/CandidateCard';
import { AgendaItem } from '@/components/shared/AgendaItem';
import { TagPill } from '@/components/shared/TagPill';
import { FieldZoom } from '@/components/facilitator/FieldZoom';
import { RegenerateDialog } from '@/components/facilitator/RegenerateDialog';
import { FinaliseDialog } from '@/components/facilitator/FinaliseDialog';
import { CreateContextDialog } from '@/components/facilitator/CreateContextDialog';
import { UploadTranscript } from '@/components/facilitator/UploadTranscript';
import { PromoteCandidateDialog } from '@/components/facilitator/PromoteCandidateDialog';
import { AddExistingContextDialog } from '@/components/facilitator/AddExistingContextDialog';
import type {
  AgendaItemStatus,
  DecisionContext,
  Field,
  Candidate,
  SupplementaryItem,
  Template,
  DecisionMethod,
  OpenContextSummary,
  Tag,
  Relation,
  RelationType,
  TagCategory,
} from '@/lib/mock-data';

type AgendaItemModel = {
  id: string;
  title: string;
  status: AgendaItemStatus;
};

type SegmentSelectionPayload = {
  rowIds: string[];
  chunkIds: string[];
};

type StreamState = 'idle' | 'connecting' | 'live' | 'stopped';
type RelatedMeeting = {
  id: string;
  title: string;
  date: string;
};
type SuggestedTag = {
  id: string;
  name: string;
  category: TagCategory;
  reason: string;
};

type ModalState =
  | null
  | { type: 'regenerate' }
  | { type: 'finalise' }
  | { type: 'create-context' }
  | { type: 'upload' }
  | { type: 'promote'; candidateId: string }
  | { type: 'add-existing-context' }
  | { type: 'add-relation-context' }
  | { type: 'flag-later' };

const RELATION_TYPES: RelationType[] = ['related', 'blocks', 'blocked_by', 'supersedes', 'superseded_by'];
const TAG_CATEGORIES: TagCategory[] = ['topic', 'team', 'project'];

const MOCK_LLM_LOG = [
  { id: 'llm-1', at: '14:12', model: 'claude-opus-4-5', action: 'generate draft', note: 'Initial context generation pass.' },
  { id: 'llm-2', at: '14:24', model: 'claude-opus-4-5', action: 'regenerate options', note: 'Applied facilitator focus note.' },
  { id: 'llm-3', at: '14:31', model: 'claude-opus-4-5', action: 'regenerate rationale', note: 'Incorporated supplementary evidence.' },
];

const SUGGESTED_TAG_SEEDS: Array<Pick<SuggestedTag, 'name' | 'category' | 'reason'>> = [
  { name: 'timeline risk', category: 'topic', reason: 'Repeated delivery date references.' },
  { name: 'architecture', category: 'topic', reason: 'Core platform trade-offs were discussed.' },
  { name: 'finance committee', category: 'team', reason: 'Ownership and follow-up were assigned.' },
  { name: 'Q4 planning', category: 'project', reason: 'Discussion linked to current quarter planning.' },
  { name: 'dependencies', category: 'topic', reason: 'External blockers affected the decision path.' },
];

export function FacilitatorMeetingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeContext, setActiveContext] = useState<DecisionContext>(ACTIVE_CONTEXT);
  const [fields, setFields] = useState<Field[]>(ACTIVE_CONTEXT.fields);
  const [candidates, setCandidates] = useState<Candidate[]>(CANDIDATES);
  const [agendaItems, setAgendaItems] = useState<AgendaItemModel[]>(AGENDA_ITEMS);
  const [deferredItems, setDeferredItems] = useState<AgendaItemModel[]>([]);
  const [relatedMeetings, setRelatedMeetings] = useState<RelatedMeeting[]>([]);
  const [leftTab, setLeftTab] = useState<'candidates' | 'agenda'>('candidates');
  const [zoomedFieldId, setZoomedFieldId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [supplementary, setSupplementary] = useState<SupplementaryItem[]>(SUPPLEMENTARY_ITEMS);
  const [finalised, setFinalised] = useState(false);
  const [transcriptUploaded, setTranscriptUploaded] = useState(false);
  const [selectionToast, setSelectionToast] = useState<{ rows: number; chunks: number } | null>(null);
  const [contextSegmentRowCount, setContextSegmentRowCount] = useState(0);

  const [tagInput, setTagInput] = useState('');
  const [tagCategory, setTagCategory] = useState<TagCategory>('topic');
  const [relationType, setRelationType] = useState<RelationType>('related');

  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [newRowsSinceGeneration, setNewRowsSinceGeneration] = useState(0);

  const [flagLaterTitle, setFlagLaterTitle] = useState('');
  const [showLLMLog, setShowLLMLog] = useState(false);
  const [llmLog, setLlmLog] = useState(MOCK_LLM_LOG);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(ACTIVE_CONTEXT.title);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(ACTIVE_CONTEXT.summary);
  const [suggestedTags, setSuggestedTags] = useState<SuggestedTag[]>([
    {
      id: 'st-1',
      name: 'Q4 planning',
      category: 'project',
      reason: 'The initial draft emphasized Q4 planning constraints.',
    },
    {
      id: 'st-2',
      name: 'architecture',
      category: 'topic',
      reason: 'The draft linked several points to architecture direction.',
    },
  ]);

  const activeCandidates = candidates.filter((c) => c.status === 'new');
  const unlockedCount = fields.filter((f) => f.status !== 'locked').length;
  const zoomedField = zoomedFieldId ? fields.find((f) => f.id === zoomedFieldId) ?? null : null;

  const promoteCandidate =
    modal?.type === 'promote' ? candidates.find((candidate) => candidate.id === modal.candidateId) ?? null : null;
  const currentMeeting = { id: 'mtg-1', title: 'Q4 Architecture Review', date: '2026-03-08' };

  const streamBadgeClass = useMemo(() => {
    if (streamState === 'live') return 'bg-settled';
    if (streamState === 'connecting') return 'bg-caution';
    if (streamState === 'stopped') return 'bg-danger';
    return 'bg-text-muted';
  }, [streamState]);

  // ── Process segment selection returned from transcript page ───────

  useEffect(() => {
    const state = location.state as { segmentSelection?: SegmentSelectionPayload } | null;
    if (!state?.segmentSelection) return;

    const { rowIds, chunkIds } = state.segmentSelection;
    setContextSegmentRowCount((prev) => prev + rowIds.length);
    setSelectionToast({ rows: rowIds.length, chunks: chunkIds.length });

    const timer = setTimeout(() => setSelectionToast(null), 3200);
    navigate(location.pathname, { replace: true, state: null });

    return () => clearTimeout(timer);
  }, [location.pathname, location.state, navigate]);

  // ── Simulate stream rows arriving while live ──────────────────────

  useEffect(() => {
    if (streamState !== 'live') return;

    const timer = setInterval(() => {
      setNewRowsSinceGeneration((prev) => prev + Math.floor(Math.random() * 3) + 1);
    }, 4500);

    return () => clearInterval(timer);
  }, [streamState]);

  // ── Field mutations ────────────────────────────────────────────────

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

  function handleRegenerateSingleField(fieldId: string) {
    updateField(fieldId, { status: 'generating' });

    setTimeout(() => {
      setFields((prev) =>
        prev.map((f) =>
          f.id !== fieldId || f.status === 'locked'
            ? f
            : {
                ...f,
                status: 'idle',
                value: f.value || `[Regenerated field] Updated content for ${f.label}.`,
              },
        ),
      );
    }, 1200);
  }

  // ── Candidate mutations ───────────────────────────────────────────

  function handleDismiss(id: string) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'dismissed' as const } : c)));
  }

  function handleAddFlagForLater() {
    if (!flagLaterTitle.trim()) return;

    const newCandidate: Candidate = {
      id: `cand-${Date.now()}`,
      title: flagLaterTitle.trim(),
      summary: 'Captured quickly for later review.',
      status: 'new',
      detectedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };

    setCandidates((prev) => [newCandidate, ...prev]);
    setFlagLaterTitle('');
    setLeftTab('candidates');
    setModal(null);
  }

  function handlePromoteConfirm(payload: {
    title: string;
    summary: string;
    template: Template;
    insertMode: 'append' | 'before';
    beforeIndex: number;
  }) {
    if (!promoteCandidate) return;

    const promotedContextId = `ctx-${Date.now()}`;
    const promotedItem: AgendaItemModel = {
      id: promotedContextId,
      title: payload.title,
      status: 'active',
    };

    setCandidates((prev) =>
      prev.map((candidate) =>
        candidate.id === promoteCandidate.id ? { ...candidate, status: 'dismissed' as const } : candidate,
      ),
    );

    setAgendaItems((prev) => {
      const demoted = prev.map((item) =>
        item.status === 'active' ? { ...item, status: 'drafted' as const } : item,
      );

      const next = [...demoted];
      const insertAt =
        payload.insertMode === 'append'
          ? next.length
          : Math.max(0, Math.min(next.length, payload.beforeIndex - 1));

      next.splice(insertAt, 0, promotedItem);
      return next;
    });

    const newFields = getMockFieldsForTemplate(payload.template.name);
    setFields(newFields);
    setActiveContext({
      ...ACTIVE_CONTEXT,
      id: promotedContextId,
      title: payload.title,
      summary: payload.summary,
      templateName: payload.template.name,
      status: 'active',
      fields: newFields,
      tags: [],
      relations: [],
    });
    refreshSuggestedTagsFromDraft({
      title: payload.title,
      summary: payload.summary,
      focus: 'initial draft',
      acceptedTags: [],
    });

    setLeftTab('agenda');
    setModal(null);
  }

  // ── Tag + relation mutations ──────────────────────────────────────

  function handleAddTag() {
    const name = tagInput.trim();
    if (!name) return;
    const lower = name.toLowerCase();

    const exists = activeContext.tags.some((tag) => tag.name.toLowerCase() === lower);
    if (exists) {
      setTagInput('');
      return;
    }

    const tag: Tag = {
      id: `tag-${Date.now()}`,
      name,
      category: tagCategory,
    };

    setActiveContext((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    setTagInput('');
  }

  function handleRemoveTag(tagId: string) {
    setActiveContext((prev) => ({ ...prev, tags: prev.tags.filter((tag) => tag.id !== tagId) }));
  }

  function refreshSuggestedTagsFromDraft(params: {
    title: string;
    summary: string;
    focus?: string;
    acceptedTags?: Tag[];
  }) {
    const accepted = params.acceptedTags ?? activeContext.tags;
    const existingAccepted = new Set(accepted.map((tag) => tag.name.toLowerCase()));
    const focusText = `${params.title} ${params.summary} ${params.focus ?? ''}`.toLowerCase();
    const ranked = [...SUGGESTED_TAG_SEEDS].sort((a, b) => {
      const aScore = focusText.includes(a.name.toLowerCase()) ? 1 : 0;
      const bScore = focusText.includes(b.name.toLowerCase()) ? 1 : 0;
      return bScore - aScore;
    });

    const next = ranked
      .filter((tag) => !existingAccepted.has(tag.name.toLowerCase()))
      .slice(0, 3)
      .map((tag) => ({ ...tag, id: `st-${Date.now()}-${tag.name.replace(/\s+/g, '-')}` }));

    setLlmLog((prev) => [
      {
        id: `llm-${Date.now()}`,
        at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        model: 'claude-opus-4-5',
        action: 'suggest tags',
        note:
          next.length > 0
            ? `Generated ${next.length} facilitator-review tags and replaced pending suggestions.`
            : 'No new tag suggestions generated; accepted tags already cover current draft.',
      },
      ...prev,
    ]);

    // Regeneration refreshes pending suggestions only. Accepted tags stay on the context.
    setSuggestedTags(next);
  }

  function handleApproveSuggestedTag(suggestedTagId: string) {
    const match = suggestedTags.find((tag) => tag.id === suggestedTagId);
    if (!match) return;

    const exists = activeContext.tags.some((tag) => tag.name.toLowerCase() === match.name.toLowerCase());
    if (!exists) {
      const tag: Tag = {
        id: `tag-${Date.now()}`,
        name: match.name,
        category: match.category,
      };
      setActiveContext((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }

    setSuggestedTags((prev) => prev.filter((tag) => tag.id !== suggestedTagId));
  }

  function handleDismissSuggestedTag(suggestedTagId: string) {
    setSuggestedTags((prev) => prev.filter((tag) => tag.id !== suggestedTagId));
  }

  function handleStartTitleEdit() {
    setTitleDraft(activeContext.title);
    setEditingTitle(true);
  }

  function handleCancelTitleEdit() {
    setTitleDraft(activeContext.title);
    setEditingTitle(false);
  }

  function handleSaveTitleEdit() {
    const next = titleDraft.trim();
    if (!next) return;
    setActiveContext((prev) => ({ ...prev, title: next }));
    setAgendaItems((prev) => prev.map((item) => (item.id === activeContext.id ? { ...item, title: next } : item)));
    setEditingTitle(false);
  }

  function handleStartSummaryEdit() {
    setSummaryDraft(activeContext.summary);
    setEditingSummary(true);
  }

  function handleCancelSummaryEdit() {
    setSummaryDraft(activeContext.summary);
    setEditingSummary(false);
  }

  function handleSaveSummaryEdit() {
    const next = summaryDraft.trim();
    if (!next) return;
    setActiveContext((prev) => ({ ...prev, summary: next }));
    setEditingSummary(false);
  }

  function ensureMeetingRelation(context: OpenContextSummary) {
    const isCrossMeeting =
      context.sourceMeetingDate !== currentMeeting.date || context.sourceMeetingTitle !== currentMeeting.title;
    if (!isCrossMeeting) return;

    setRelatedMeetings((prev) => {
      const exists = prev.some((meeting) => meeting.title === context.sourceMeetingTitle && meeting.date === context.sourceMeetingDate);
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `rel-mtg-${Date.now()}`,
          title: context.sourceMeetingTitle,
          date: context.sourceMeetingDate,
        },
      ];
    });

    setActiveContext((prev) => {
      const relationLabel = `Meeting: ${context.sourceMeetingTitle} (${context.sourceMeetingDate})`;
      const exists = prev.relations.some(
        (rel) => rel.relationType === 'related' && rel.targetTitle === relationLabel,
      );
      if (exists) return prev;
      return {
        ...prev,
        relations: [
          ...prev.relations,
          {
            id: `rel-${Date.now()}`,
            targetTitle: relationLabel,
            targetId: `meeting-${context.sourceMeetingDate}`,
            relationType: 'related',
          },
        ],
      };
    });
  }

  function handleAddRelationFromContext(context: OpenContextSummary) {
    ensureMeetingRelation(context);

    const relation: Relation = {
      id: `rel-${Date.now()}`,
      targetTitle: context.title,
      targetId: context.id,
      relationType,
    };

    setActiveContext((prev) => {
      const exists = prev.relations.some((rel) => rel.targetId === context.id && rel.relationType === relationType);
      if (exists) return prev;
      return { ...prev, relations: [...prev.relations, relation] };
    });

    setModal(null);
  }

  // ── Supplementary content ────────────────────────────────────────

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

  // ── Context / agenda actions ─────────────────────────────────────

  function handleDeferActiveContext() {
    const target = agendaItems.find((item) => item.id === activeContext.id);
    if (!target) return;

    const deferredItem: AgendaItemModel = { ...target, status: 'deferred' };
    const remaining = agendaItems.filter((item) => item.id !== activeContext.id);

    const normalized = remaining.map((item, idx) =>
      idx === 0 ? { ...item, status: 'active' as const } : item.status === 'active' ? { ...item, status: 'drafted' as const } : item,
    );

    setDeferredItems((prev) => [...prev, deferredItem]);
    setAgendaItems(normalized);

    const nextActive = normalized.find((item) => item.status === 'active') ?? normalized[0] ?? null;

    if (nextActive) {
      setActiveContext((prev) => ({
        ...prev,
        id: nextActive.id,
        title: nextActive.title,
        summary: `Continued discussion context for ${nextActive.title}.`,
        status: nextActive.status,
      }));
    }

    setLeftTab('agenda');
  }

  function handleAddExistingContext(context: OpenContextSummary) {
    ensureMeetingRelation(context);

    const exists =
      agendaItems.some((item) => item.id === context.id) || deferredItems.some((item) => item.id === context.id);

    if (!exists) {
      setAgendaItems((prev) => [...prev, { id: context.id, title: context.title, status: 'pending' }]);
    }

    setLeftTab('agenda');
    setModal(null);
  }

  // ── Stream actions ────────────────────────────────────────────────

  function handleToggleStream() {
    if (streamState === 'live') {
      setStreamState('stopped');
      return;
    }

    setStreamState('connecting');
    setTimeout(() => setStreamState('live'), 700);
  }

  // ── Regenerate ───────────────────────────────────────────────────

  function handleRegenerate(focus: string) {
    setModal(null);
    setNewRowsSinceGeneration(0);

    setFields((prev) => prev.map((f) => (f.status === 'locked' ? f : { ...f, status: 'generating' })));

    setTimeout(() => {
      setFields((prev) =>
        prev.map((f) =>
          f.status === 'generating'
            ? {
                ...f,
                status: 'idle',
                value: f.value || `[Regenerated${focus ? ` — focus: "${focus}"` : ''}] Sample content for ${f.label}.`,
              }
            : f,
        ),
      );
      refreshSuggestedTagsFromDraft({
        title: activeContext.title,
        summary: activeContext.summary,
        focus,
      });
    }, 2000);
  }

  // ── Finalise ─────────────────────────────────────────────────────

  function handleFinalise(_method: DecisionMethod, _actors: string[], _loggedBy: string) {
    setModal(null);
    setFinalised(true);
    setTimeout(() => navigate('/decisions/dec-1'), 800);
  }

  // ── Create context ───────────────────────────────────────────────

  function handleCreateContext(title: string, summary: string, template: Template) {
    const contextId = `ctx-${Date.now()}`;
    const newItem: AgendaItemModel = { id: contextId, title, status: 'active' };

    setAgendaItems((prev) => {
      const demoted = prev.map((item) =>
        item.status === 'active' ? { ...item, status: 'drafted' as const } : item,
      );
      return [newItem, ...demoted];
    });

    const newFields = getMockFieldsForTemplate(template.name);
    setFields(newFields);
    setActiveContext({
      ...ACTIVE_CONTEXT,
      id: contextId,
      title,
      summary,
      templateName: template.name,
      status: 'active',
      fields: newFields,
      tags: [],
      relations: [],
    });
    refreshSuggestedTagsFromDraft({
      title,
      summary,
      focus: 'initial draft',
      acceptedTags: [],
    });

    setModal(null);
    setLeftTab('agenda');
  }

  // ── Upload transcript ────────────────────────────────────────────

  function handleUploadComplete(_filename: string, _rowCount: number) {
    setModal(null);
    setTranscriptUploaded(true);
    setLeftTab('candidates');
  }

  // ── Field zoom ───────────────────────────────────────────────────

  if (zoomedField) {
    return (
      <FieldZoom
        field={zoomedField}
        supplementaryItems={supplementary}
        meetingId="mtg-1"
        contextId={activeContext.id}
        onClose={() => setZoomedFieldId(null)}
        onSave={handleSaveFieldValue}
        onRegenerate={handleRegenerateSingleField}
        onLock={handleLock}
        onUnlock={handleUnlock}
        onGuidanceChange={handleGuidanceChange}
        onAddSupplementary={handleAddSupplementary}
        onRemoveSupplementary={handleRemoveSupplementary}
      />
    );
  }

  return (
    <div className="density-facilitator min-h-screen bg-base flex flex-col relative">
      {selectionToast && (
        <div className="absolute right-4 top-16 z-30 px-3 py-2 rounded-card border border-settled/40 bg-settled-dim/20 text-fac-meta text-text-primary">
          Added {selectionToast.rows} transcript rows ({selectionToast.chunks} chunks) to this context.
        </div>
      )}

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
      {modal?.type === 'promote' && promoteCandidate && (
        <PromoteCandidateDialog
          candidate={promoteCandidate}
          agendaTitles={agendaItems.map((item) => item.title)}
          onConfirm={handlePromoteConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'add-existing-context' && (
        <AddExistingContextDialog
          contexts={OPEN_CONTEXTS}
          currentMeeting={{ title: currentMeeting.title, date: currentMeeting.date }}
          onConfirm={handleAddExistingContext}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'add-relation-context' && (
        <AddExistingContextDialog
          contexts={OPEN_CONTEXTS}
          currentMeeting={{ title: currentMeeting.title, date: currentMeeting.date }}
          onConfirm={handleAddRelationFromContext}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'flag-later' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-border rounded-card shadow-xl p-5 flex flex-col gap-3">
            <h2 className="text-fac-field text-text-primary font-medium">Flag for later</h2>
            <input
              type="text"
              value={flagLaterTitle}
              onChange={(e) => setFlagLaterTitle(e.target.value)}
              placeholder="Decision title"
              className="w-full px-3 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-fac-meta text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFlagForLater}
                disabled={!flagLaterTitle.trim()}
                className="px-4 py-2 text-fac-meta bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
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
        <Link
          to="/meetings/mtg-1/facilitator/home"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
        >
          <ExternalLink size={13} />
          Meeting home
        </Link>

        <button
          onClick={handleToggleStream}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
        >
          <Radio size={13} />
          {streamState === 'live' ? 'Stop stream' : 'Start stream'}
          <span className={`w-1.5 h-1.5 rounded-full ${streamBadgeClass}`} />
        </button>

        <button
          onClick={() => setModal({ type: 'upload' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
        >
          <Upload size={13} />
          Upload transcript
          {transcriptUploaded && <span className="w-1.5 h-1.5 rounded-full bg-settled" />}
        </button>

        <button
          onClick={() => setModal({ type: 'flag-later' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
        >
          <Flag size={13} />
          Flag for later
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
          {newRowsSinceGeneration > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-badge bg-caution-dim text-caution border border-caution/30">
              {newRowsSinceGeneration} new
            </span>
          )}
        </button>

        <button
          onClick={handleDeferActiveContext}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-caution hover:text-caution border border-caution/30 rounded transition-colors"
        >
          <PauseCircle size={13} />
          Defer
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
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      onDismiss={handleDismiss}
                      onPromote={(id) => setModal({ type: 'promote', candidateId: id })}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {agendaItems.map((item, i) => (
                  <AgendaItem
                    key={item.id}
                    title={item.title}
                    status={item.status}
                    position={i + 1}
                    isActive={item.id === activeContext.id}
                  />
                ))}

                {deferredItems.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border">
                    <p className="text-fac-label text-text-muted uppercase tracking-wider px-2 pb-1">Deferred</p>
                    {deferredItems.map((item, i) => (
                      <AgendaItem
                        key={item.id}
                        title={item.title}
                        status="deferred"
                        position={i + 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-border flex flex-col gap-1.5">
            <button
              onClick={() => setModal({ type: 'add-existing-context' })}
              className="flex items-center gap-2 px-3 py-2 rounded text-fac-meta text-text-muted hover:text-text-primary hover:bg-overlay transition-colors w-full"
            >
              <Link2 size={14} />
              Add existing context
            </button>
            <Link
              to="/meetings/mtg-1/facilitator/transcript"
              className="flex items-center gap-2 px-3 py-2 rounded text-fac-meta text-text-muted hover:text-text-primary hover:bg-overlay transition-colors w-full"
            >
              <FilePlus2 size={14} />
              Select transcript segments
              {contextSegmentRowCount > 0 && (
                <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded-badge bg-accent-dim text-accent border border-accent/30">
                  {contextSegmentRowCount}
                </span>
              )}
            </Link>
          </div>
        </aside>

        {/* ── Main workspace ──────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-5">

          {/* Context header */}
          <div className="mb-5">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                {editingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="w-full max-w-2xl px-2.5 py-1.5 rounded border border-border bg-overlay text-fac-title text-text-primary focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleSaveTitleEdit}
                      disabled={!titleDraft.trim()}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-settled/40 text-settled hover:bg-settled/10 disabled:opacity-40"
                      aria-label="Save title"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelTitleEdit}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-border text-text-muted hover:text-text-primary"
                      aria-label="Cancel title edit"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-fac-title text-text-primary">{activeContext.title}</h1>
                    <button
                      onClick={handleStartTitleEdit}
                      className="inline-flex items-center gap-1 text-fac-meta text-text-muted hover:text-text-primary"
                      aria-label="Edit title"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  </div>
                )}
                {editingSummary ? (
                  <div className="mt-1 flex items-start gap-2">
                    <textarea
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                      rows={3}
                      className="w-full max-w-3xl px-2.5 py-2 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent resize-y"
                    />
                    <button
                      onClick={handleSaveSummaryEdit}
                      disabled={!summaryDraft.trim()}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-settled/40 text-settled hover:bg-settled/10 disabled:opacity-40 mt-0.5"
                      aria-label="Save summary"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelSummaryEdit}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-border text-text-muted hover:text-text-primary mt-0.5"
                      aria-label="Cancel summary edit"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-fac-meta text-text-secondary">{activeContext.summary}</p>
                    <button
                      onClick={handleStartSummaryEdit}
                      className="inline-flex items-center gap-1 text-fac-meta text-text-muted hover:text-text-primary"
                      aria-label="Edit summary"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <span className="shrink-0 text-fac-meta text-text-muted border border-border px-2 py-0.5 rounded-badge">
                {activeContext.templateName}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 items-center">
              {activeContext.tags.map((tag) => (
                <span key={tag.id} className="inline-flex items-center gap-1">
                  <TagPill name={tag.name} category={tag.category} />
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    className="text-[11px] text-text-muted hover:text-danger"
                    aria-label={`Remove ${tag.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-2 rounded-card border border-border bg-overlay/30 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-fac-meta text-text-secondary">LLM suggested tags (review required)</p>
                {suggestedTags.length > 0 && (
                  <button
                    onClick={() => suggestedTags.forEach((tag) => handleApproveSuggestedTag(tag.id))}
                    className="text-fac-meta text-accent hover:text-accent/80"
                  >
                    Approve all
                  </button>
                )}
              </div>
              {suggestedTags.length === 0 ? (
                <p className="text-fac-meta text-text-muted mt-1">No pending suggestions.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-1.5">
                  {suggestedTags.map((tag) => (
                    <div key={tag.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5">
                      <TagPill name={tag.name} category={tag.category} />
                      <span className="text-fac-meta text-text-muted flex-1 truncate">{tag.reason}</span>
                      <button
                        onClick={() => handleApproveSuggestedTag(tag.id)}
                        className="text-fac-meta text-settled hover:text-settled/80"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDismissSuggestedTag(tag.id)}
                        className="text-fac-meta text-danger hover:text-danger/80"
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add tag"
                className="w-44 px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
              />
              <select
                value={tagCategory}
                onChange={(e) => setTagCategory(e.target.value as TagCategory)}
                className="px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
              >
                {TAG_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-accent/30 text-accent text-fac-meta hover:bg-accent-dim transition-colors disabled:opacity-40"
              >
                <Plus size={12} />
                Add tag
              </button>
              <button
                onClick={() =>
                  refreshSuggestedTagsFromDraft({
                    title: activeContext.title,
                    summary: activeContext.summary,
                    focus: 'manual request',
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-text-secondary text-fac-meta hover:text-text-primary hover:bg-overlay transition-colors"
              >
                <Lightbulb size={12} />
                Suggest tags
              </button>
            </div>

            <div className="mt-3">
              {relatedMeetings.length > 0 && (
                <div className="mb-2">
                  <p className="text-fac-meta text-text-muted">Related meetings</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {relatedMeetings.map((meeting) => (
                      <p key={meeting.id} className="text-fac-meta text-text-secondary">
                        {meeting.date} · {meeting.title}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value as RelationType)}
                  className="px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
                >
                  {RELATION_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button
                  onClick={() => setModal({ type: 'add-relation-context' })}
                  className="inline-flex items-center gap-1 text-fac-meta text-accent hover:text-accent/80"
                >
                  <Link2 size={13} />
                  Add relation
                </button>
              </div>

              {activeContext.relations.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {activeContext.relations.map((rel) => (
                    <p key={rel.id} className="text-fac-meta text-text-muted">
                      {rel.relationType} · {rel.targetTitle}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Hint */}
          <div className="flex items-start gap-2 p-3 rounded-card border border-accent/20 bg-accent-dim/10 mb-5">
            <Lightbulb size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-fac-meta text-text-secondary">
              Click the zoom icon on any field to edit content, regenerate the field, add guidance, or paste supplementary evidence.
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

        <aside className="w-80 shrink-0 border-l border-border bg-surface flex flex-col">
          <button
            onClick={() => setShowLLMLog((v) => !v)}
            className="flex items-center gap-2 px-4 py-3 border-b border-border text-fac-meta text-text-secondary hover:text-text-primary"
          >
            {showLLMLog ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            LLM interaction log
          </button>

          {showLLMLog && (
            <div className="p-3 flex flex-col gap-2 overflow-y-auto">
              {llmLog.map((entry) => (
                <article key={entry.id} className="rounded-card border border-border p-3 bg-overlay/30">
                  <div className="flex items-center justify-between">
                    <span className="text-fac-meta text-text-primary font-medium">{entry.action}</span>
                    <span className="text-fac-meta text-text-muted">{entry.at}</span>
                  </div>
                  <p className="text-fac-meta text-text-muted mt-1">{entry.model}</p>
                  <p className="text-fac-meta text-text-secondary mt-2">{entry.note}</p>
                </article>
              ))}
            </div>
          )}
        </aside>
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
