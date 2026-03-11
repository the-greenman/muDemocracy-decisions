import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  RefreshCw,
  Undo2,
  CheckSquare,
  ExternalLink,
  Home,
  FilePlus2,
  Upload,
  Lightbulb,
  PauseCircle,
  Link2,
  Plus,
  Radio,
  Flag,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useMeeting } from "@/hooks/useMeeting";
import { useMeetingAgenda } from "@/hooks/useMeetingAgenda";
import { useDecisionContext } from "@/hooks/useDecisionContext";
import { useTemplates } from "@/hooks/useTemplates";
import {
  lockField,
  unlockField,
  updateFieldValue,
  changeDecisionContextTemplate,
  regenerateField,
  regenerateDraft,
  logDecision,
  updateMeeting,
  createDecisionContext,
  updateFlaggedDecision,
  createFlaggedDecision,
  listLLMInteractions,
  getTranscriptReading,
  listMeetingChunks,
  setActiveMeeting,
  setActiveDecision,
  setActiveField,
  clearActiveField,
  clearActiveDecision,
  getApiStatus,
} from "@/api/endpoints";
import {
  createTranscriptionSession,
  uploadTranscriptionSessionChunk,
  stopTranscriptionSession,
  getTranscriptionServiceStatus,
  type TranscriptionServiceStatus,
} from "@/api/transcription-client";
import type { ApiStatus, LLMInteraction } from "@/api/types";
import { buildCandidates, buildAgendaItems } from "@/api/adapters";
import { FacilitatorFieldCard } from "@/components/facilitator/FacilitatorFieldCard";
import { CandidateCard } from "@/components/facilitator/CandidateCard";
import { AgendaList } from "@/components/shared/AgendaList";
import { AgendaItemAddWidget } from "@/components/shared/AgendaItemAddWidget";
import { MeetingAttendeesPanel } from "@/components/shared/MeetingAttendeesPanel";
import { MainHeader } from "@/components/shared/MainHeader";
import { RelationsAccordion } from "@/components/shared/RelationsAccordion";
import { TagPill } from "@/components/shared/TagPill";
import { FieldZoom } from "@/components/facilitator/FieldZoom";
import { RegenerateDialog } from "@/components/facilitator/RegenerateDialog";
import { FinaliseDialog } from "@/components/facilitator/FinaliseDialog";
import { CreateContextDialog } from "@/components/facilitator/CreateContextDialog";
import { ChangeTemplateDialog } from "@/components/facilitator/ChangeTemplateDialog";
import { UploadTranscript } from "@/components/facilitator/UploadTranscript";
import { PromoteCandidateDialog } from "@/components/facilitator/PromoteCandidateDialog";
import { AddExistingContextDialog } from "@/components/facilitator/AddExistingContextDialog";
import { IconButton } from "@/components/ui/IconButton";
import { TabButton } from "@/components/ui/Tabs";
import { OPEN_CONTEXTS } from "@/lib/mock-data";
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
} from "@/lib/mock-data";

type AgendaItemModel = {
  id: string;
  title: string;
  status: AgendaItemStatus;
  /** Corresponding API DecisionContext id, null if context not yet created */
  contextId?: string | null;
};

const EMPTY_CONTEXT: DecisionContext = {
  id: "",
  title: "",
  summary: "",
  templateName: "",
  fields: [],
  tags: [],
  relations: [],
  status: "pending",
};

type SegmentSelectionPayload = {
  rowIds: string[];
  chunkIds: string[];
  decisionContextId?: string;
  fieldId?: string;
  scope?: "meeting" | "decision" | "field";
};

type CreateContextDraftPayload = {
  title?: string;
  summary?: string;
  relation?: {
    targetId: string;
    targetTitle: string;
    relationType: RelationType;
  };
};

type StreamState = "idle" | "connecting" | "live" | "stopped";
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

type AttendeePresence = {
  name: string;
  status: "present" | "left";
  updatedAt: string;
};

type AttendeeEvent = {
  id: string;
  attendeeName: string;
  action: "entered" | "left";
  at: string;
};

type ModalState =
  | null
  | { type: "regenerate" }
  | { type: "finalise" }
  | { type: "create-context" }
  | { type: "change-template" }
  | { type: "upload" }
  | { type: "promote"; candidateId: string }
  | { type: "add-existing-context" }
  | { type: "add-relation-context" }
  | { type: "flag-later" }
  | { type: "system-status" };

const RELATION_TYPES: RelationType[] = [
  "related",
  "blocks",
  "blocked_by",
  "supersedes",
  "superseded_by",
];
const TAG_CATEGORIES: TagCategory[] = ["topic", "team", "project"];
const DECISION_METHOD_MAP: Record<DecisionMethod, "consensus" | "vote" | "authority" | "manual"> = {
  consensus: "consensus",
  unanimous_vote: "vote",
  majority_vote: "vote",
  executive: "authority",
  delegated: "manual",
};

const SUGGESTED_TAG_SEEDS: Array<Pick<SuggestedTag, "name" | "category" | "reason">> = [
  { name: "timeline risk", category: "topic", reason: "Repeated delivery date references." },
  { name: "architecture", category: "topic", reason: "Core platform trade-offs were discussed." },
  { name: "finance committee", category: "team", reason: "Ownership and follow-up were assigned." },
  {
    name: "Q4 planning",
    category: "project",
    reason: "Discussion linked to current quarter planning.",
  },
  {
    name: "dependencies",
    category: "topic",
    reason: "External blockers affected the decision path.",
  },
];

export function FacilitatorMeetingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: meetingId = "" } = useParams<{ id: string }>();

  // ── API data ──────────────────────────────────────────────────────
  const [activeApiContextId, setActiveApiContextId] = useState<string | null>(null);
  const { meeting: apiMeeting, refresh: refreshMeeting } = useMeeting(meetingId);
  const { decisions: apiDecisions, refresh: refreshAgenda } = useMeetingAgenda(meetingId);
  const {
    context: apiContext,
    fields: apiContextFields,
    templateFields,
    refresh: refreshContext,
  } = useDecisionContext(activeApiContextId);
  const { templates } = useTemplates();
  const currentMeeting = useMemo(
    () => ({
      title: apiMeeting?.title ?? "Current meeting",
      date: apiMeeting?.date ?? "",
    }),
    [apiMeeting],
  );

  const [activeContext, setActiveContext] = useState<DecisionContext>(EMPTY_CONTEXT);
  const [fields, setFields] = useState<Field[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItemModel[]>([]);
  const [deferredItems, setDeferredItems] = useState<AgendaItemModel[]>([]);
  const [relatedMeetings, setRelatedMeetings] = useState<RelatedMeeting[]>([]);
  const [createContextDraft, setCreateContextDraft] = useState<CreateContextDraftPayload | null>(
    null,
  );
  const [leftTab, setLeftTab] = useState<"candidates" | "agenda">("agenda");
  const [zoomedFieldId, setZoomedFieldId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [supplementary, setSupplementary] = useState<SupplementaryItem[]>([]);
  const [finalised, setFinalised] = useState(false);
  const [transcriptUploaded, setTranscriptUploaded] = useState(false);
  const [selectionToast, setSelectionToast] = useState<{ rows: number; chunks: number } | null>(
    null,
  );
  const [contextSegmentRowCount, setContextSegmentRowCount] = useState(0);

  const [tagInput, setTagInput] = useState("");
  const [tagCategory, setTagCategory] = useState<TagCategory>("topic");
  const [relationType, setRelationType] = useState<RelationType>("related");

  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [newRowsSinceGeneration, setNewRowsSinceGeneration] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("");
  const [transcriptRowCount, setTranscriptRowCount] = useState(0);
  const [contextTaggedChunkCount, setContextTaggedChunkCount] = useState(0);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionServiceStatus | null>(
    null,
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderSegmentTimerRef = useRef<number | null>(null);
  const streamShouldContinueRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingChunkUploadsRef = useRef<Promise<void>[]>([]);

  const [flagLaterTitle, setFlagLaterTitle] = useState("");
  const [showLLMLog, setShowLLMLog] = useState(false);
  const [llmLog, setLlmLog] = useState<LLMInteraction[]>([]);
  const [selectedLlmInteractionId, setSelectedLlmInteractionId] = useState<string | null>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(288);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [dragState, setDragState] = useState<null | {
    side: "left" | "right";
    startX: number;
    startWidth: number;
  }>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<SuggestedTag[]>([]);
  const [endingMeeting, setEndingMeeting] = useState(false);

  const [attendees, setAttendees] = useState<AttendeePresence[]>([]);
  const [attendeeEvents, setAttendeeEvents] = useState<AttendeeEvent[]>([]);
  const [agendaAddError, setAgendaAddError] = useState<string | null>(null);
  const [addingAgendaItem, setAddingAgendaItem] = useState(false);
  const leftTabInitializedRef = useRef(false);

  const meetingFocusKey = `dl:meeting-focus:${meetingId}`;
  const meetingFieldKey = `dl:meeting-fields:${meetingId}`;
  const activeContextKey = `dl:fac:active-context:${meetingId}`;
  const meetingSharedPath = `/meetings/${meetingId}`;
  const meetingHomePath = `/meetings/${meetingId}/facilitator/home`;
  const transcriptQuery = new URLSearchParams();
  if (activeApiContextId) transcriptQuery.set("decisionContextId", activeApiContextId);
  if (activeApiContextId && zoomedFieldId) transcriptQuery.set("fieldId", zoomedFieldId);
  const meetingTranscriptPath = `/meetings/${meetingId}/facilitator/transcript${
    transcriptQuery.toString() ? `?${transcriptQuery.toString()}` : ""
  }`;
  const leftPanelWidthKey = `dl:fac:left-width:${meetingId}`;
  const rightPanelWidthKey = `dl:fac:right-width:${meetingId}`;
  const leftPanelCollapsedKey = `dl:fac:left-collapsed:${meetingId}`;
  const rightPanelCollapsedKey = `dl:fac:right-collapsed:${meetingId}`;

  const activeCandidates = candidates.filter((c) => c.status === "new");
  const hasSelectedContext = Boolean(activeApiContextId);
  const isClosedContext = hasSelectedContext && activeContext.status === "logged";
  const activeApiTemplate = useMemo(
    () => templates.find((t) => t.id === apiContext?.templateId) ?? null,
    [templates, apiContext?.templateId],
  );
  const selectedLlmInteraction =
    llmLog.find((entry) => entry.id === selectedLlmInteractionId) ?? null;
  const isMeetingCompleted = apiMeeting?.status === "completed";
  const unlockedCount = fields.filter((f) => f.status !== "locked").length;
  const zoomedField = zoomedFieldId ? (fields.find((f) => f.id === zoomedFieldId) ?? null) : null;

  const promoteCandidate =
    modal?.type === "promote"
      ? (candidates.find((candidate) => candidate.id === modal.candidateId) ?? null)
      : null;

  const streamBadgeClass = useMemo(() => {
    if (streamState === "live") return "bg-settled";
    if (streamState === "connecting") return "bg-caution";
    if (streamState === "stopped") return "bg-danger";
    return "bg-text-muted";
  }, [streamState]);

  useEffect(() => {
    if (!dragState) return;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - dragState.startX;

      if (dragState.side === "left") {
        setLeftPanelWidth(clamp(dragState.startWidth + delta, 240, 460));
        return;
      }

      setRightPanelWidth(clamp(dragState.startWidth - delta, 260, 520));
    };

    const handleMouseUp = () => setDragState(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState]);

  useEffect(() => {
    try {
      const savedLeftWidth = Number(localStorage.getItem(leftPanelWidthKey));
      const savedRightWidth = Number(localStorage.getItem(rightPanelWidthKey));
      const savedLeftCollapsed = localStorage.getItem(leftPanelCollapsedKey);
      const savedRightCollapsed = localStorage.getItem(rightPanelCollapsedKey);
      const savedActiveContextId = localStorage.getItem(activeContextKey);

      if (!Number.isNaN(savedLeftWidth) && savedLeftWidth > 0) setLeftPanelWidth(savedLeftWidth);
      if (!Number.isNaN(savedRightWidth) && savedRightWidth > 0)
        setRightPanelWidth(savedRightWidth);
      if (savedLeftCollapsed === "true") setLeftPanelCollapsed(true);
      if (savedRightCollapsed === "true") setRightPanelCollapsed(true);
      if (savedActiveContextId) setActiveApiContextId(savedActiveContextId);
    } catch {
      // noop for prototype safety
    }
  }, [
    activeContextKey,
    leftPanelCollapsedKey,
    leftPanelWidthKey,
    rightPanelCollapsedKey,
    rightPanelWidthKey,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(leftPanelWidthKey, String(leftPanelWidth));
      localStorage.setItem(rightPanelWidthKey, String(rightPanelWidth));
      localStorage.setItem(leftPanelCollapsedKey, String(leftPanelCollapsed));
      localStorage.setItem(rightPanelCollapsedKey, String(rightPanelCollapsed));
    } catch {
      // noop for prototype safety
    }
  }, [
    leftPanelCollapsed,
    leftPanelCollapsedKey,
    leftPanelWidth,
    leftPanelWidthKey,
    rightPanelCollapsed,
    rightPanelCollapsedKey,
    rightPanelWidth,
    rightPanelWidthKey,
  ]);

  useEffect(() => {
    try {
      if (activeApiContextId) {
        localStorage.setItem(activeContextKey, activeApiContextId);
      } else {
        localStorage.removeItem(activeContextKey);
      }
    } catch {
      // noop for prototype safety
    }
  }, [activeApiContextId, activeContextKey]);

  // ── Process segment selection returned from transcript page ───────

  useEffect(() => {
    const state = location.state as { segmentSelection?: SegmentSelectionPayload } | null;
    if (!state?.segmentSelection) return;

    const { rowIds, chunkIds, decisionContextId, fieldId, scope } = state.segmentSelection;
    setContextSegmentRowCount((prev) => prev + rowIds.length);
    setSelectionToast({ rows: rowIds.length, chunks: chunkIds.length });

    if (decisionContextId) {
      setActiveApiContextId(decisionContextId);
      setLeftTab("agenda");
    }
    if (scope === "field" && fieldId) {
      setZoomedFieldId(fieldId);
    }

    const timer = setTimeout(() => setSelectionToast(null), 3200);
    navigate(location.pathname, { replace: true, state: null });

    return () => clearTimeout(timer);
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const state = location.state as { createContextDraft?: CreateContextDraftPayload } | null;
    if (!state?.createContextDraft) return;

    setCreateContextDraft(state.createContextDraft);
    setModal({ type: "create-context" });
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  // ── Device + context + transcript live state ──────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadAudioInputs() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const inputs = devices.filter((device) => device.kind === "audioinput");
        setAudioDevices(inputs);
        if (!selectedAudioDeviceId && inputs[0]?.deviceId) {
          setSelectedAudioDeviceId(inputs[0].deviceId);
        }
      } catch {
        if (!cancelled) setAudioDevices([]);
      }
    }

    void loadAudioInputs();
    return () => {
      cancelled = true;
    };
  }, [selectedAudioDeviceId]);

  useEffect(() => {
    if (!meetingId) return;
    void setActiveMeeting(meetingId).catch(() => {
      // ignore sync failures
    });
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) return;
    if (!activeApiContextId) {
      void clearActiveDecision(meetingId).catch(() => {
        // no-op
      });
      return;
    }

    const selectedDecision = apiDecisions.find((decision) => decision.contextId === activeApiContextId);
    if (!selectedDecision) return;
    void setActiveDecision(
      meetingId,
      selectedDecision.id,
      selectedDecision.suggestedTemplateId ?? undefined,
    ).catch(() => {
      // no-op
    });
  }, [activeApiContextId, apiDecisions, meetingId]);

  useEffect(() => {
    if (!meetingId) return;
    if (!activeApiContextId || !zoomedFieldId) {
      void clearActiveField(meetingId).catch(() => {
        // no-op
      });
      return;
    }

    void setActiveField(meetingId, zoomedFieldId).catch(() => {
      // no-op
    });
  }, [activeApiContextId, meetingId, zoomedFieldId]);

  useEffect(() => {
    if (!meetingId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pollMs = streamState === "live" ? 2000 : 5000;
    const decisionTagPrefix = activeApiContextId ? `decision:${activeApiContextId}` : null;
    const fieldTag =
      activeApiContextId && zoomedFieldId ? `decision:${activeApiContextId}:${zoomedFieldId}` : null;
    const meetingTag = `meeting:${meetingId}`;

    async function pollTranscript() {
      try {
        const [reading, chunkData] = await Promise.all([
          getTranscriptReading(meetingId),
          listMeetingChunks(meetingId),
        ]);

        if (cancelled) return;

        const totalRows = reading.rows.length > 0 ? reading.rows.length : chunkData.chunks.length;
        setTranscriptRowCount(totalRows);

        const scoped = chunkData.chunks.filter((chunk) => {
          if (fieldTag) return chunk.contexts.includes(fieldTag);
          if (decisionTagPrefix) {
            return chunk.contexts.some(
              (context) => context === decisionTagPrefix || context.startsWith(`${decisionTagPrefix}:`),
            );
          }
          return chunk.contexts.includes(meetingTag);
        });
        setContextTaggedChunkCount(scoped.length);
      } catch {
        if (!cancelled) {
          setTranscriptRowCount(0);
          setContextTaggedChunkCount(0);
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(() => {
            void pollTranscript();
          }, pollMs);
        }
      }
    }

    void pollTranscript();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeApiContextId, meetingId, streamState, zoomedFieldId]);

  // ── Broadcast focused field for shared-display sync ──────────────
  useEffect(() => {
    try {
      localStorage.setItem(
        meetingFocusKey,
        JSON.stringify({
          meetingId,
          fieldId: zoomedFieldId,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // noop for prototype safety
    }
  }, [meetingId, meetingFocusKey, zoomedFieldId]);

  // ── Broadcast field values for shared-display sync ───────────────
  useEffect(() => {
    try {
      localStorage.setItem(
        meetingFieldKey,
        JSON.stringify({
          meetingId,
          fields,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // noop for prototype safety
    }
  }, [meetingId, fields, meetingFieldKey]);

  // ── Sync API meeting participants to attendees ─────────────────────
  useEffect(() => {
    if (!apiMeeting?.participants?.length) return;
    setAttendees(
      apiMeeting.participants.map((name) => ({
        name,
        status: "present" as const,
        updatedAt: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      })),
    );
    setAttendeeEvents(
      apiMeeting.participants.map((name, index) => ({
        id: `attendee-start-${index}`,
        attendeeName: name,
        action: "entered" as const,
        at: "meeting start",
      })),
    );
  }, [apiMeeting]);

  // ── Sync API flagged decisions to candidates and agenda ───────────
  useEffect(() => {
    setCandidates(buildCandidates(apiDecisions));
    const builtItems = buildAgendaItems(apiDecisions);
    const mappedAgendaItems = builtItems.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      contextId: item.contextId,
    }));
    setAgendaItems(mappedAgendaItems);

    const hasSelectedContext = activeApiContextId
      ? mappedAgendaItems.some((item) => item.contextId === activeApiContextId)
      : false;

    if (!hasSelectedContext) {
      const fallbackItem = mappedAgendaItems.find((item) => item.contextId) ?? null;
      if (fallbackItem?.contextId) {
        setActiveApiContextId(fallbackItem.contextId);
        setActiveContext((prev) => ({
          ...prev,
          id: fallbackItem.id,
          title: fallbackItem.title,
          summary: `Active discussion context for ${fallbackItem.title}.`,
          status: fallbackItem.status === "logged" ? "logged" : "active",
        }));
        setFinalised(fallbackItem.status === "logged");
      } else {
        setActiveApiContextId(null);
        setActiveContext(EMPTY_CONTEXT);
        setFinalised(false);
      }
    }

    if (!leftTabInitializedRef.current) {
      setLeftTab("agenda");
      leftTabInitializedRef.current = true;
    }
  }, [activeApiContextId, apiDecisions]);

  // ── Sync API context fields to local fields state ─────────────────
  useEffect(() => {
    if (!apiContext) return;
    const activeTemplate = templates.find((template) => template.id === apiContext.templateId);
    setFields(apiContextFields);
    setActiveContext((prev) => ({
      ...prev,
      id: apiContext.id,
      title: apiContext.title,
      templateName: activeTemplate?.name ?? prev.templateName,
      status: apiContext.status === "logged" ? "logged" : "active",
    }));
    setTitleDraft(apiContext.title);
  }, [apiContext, apiContextFields, templates]);

  // ── Load LLM log when panel opens ────────────────────────────────
  useEffect(() => {
    if (!showLLMLog) return;
    if (!activeApiContextId) {
      setLlmLog([]);
      setSelectedLlmInteractionId(null);
      return;
    }
    void listLLMInteractions(activeApiContextId)
      .then(({ interactions }) => {
        setLlmLog(interactions);
        setSelectedLlmInteractionId(interactions[interactions.length - 1]?.id ?? null);
      })
      .catch(() => {
        setLlmLog([]);
        setSelectedLlmInteractionId(null);
      });
  }, [showLLMLog, activeApiContextId]);

  // ── Field mutations ────────────────────────────────────────────────

  function updateField(id: string, patch: Partial<Field>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function handleLock(id: string) {
    if (isClosedContext || !activeApiContextId) return;
    updateField(id, { status: "locked" }); // optimistic
    try {
      const updated = await lockField(activeApiContextId, id);
      setFields((prev) =>
        prev.map((f) => {
          const locked = updated.lockedFields.includes(f.id);
          return { ...f, status: locked ? "locked" : f.status === "locked" ? "idle" : f.status };
        }),
      );
    } catch {
      updateField(id, { status: "idle" }); // revert
    }
  }

  async function handleUnlock(id: string) {
    if (isClosedContext || !activeApiContextId) return;
    updateField(id, { status: "idle" }); // optimistic
    try {
      const updated = await unlockField(activeApiContextId, id);
      setFields((prev) =>
        prev.map((f) => {
          const locked = updated.lockedFields.includes(f.id);
          return { ...f, status: locked ? "locked" : f.status === "locked" ? "idle" : f.status };
        }),
      );
    } catch {
      updateField(id, { status: "locked" }); // revert
    }
  }

  async function handleSaveFieldValue(id: string, value: string) {
    if (isClosedContext || !activeApiContextId) return;
    updateField(id, { value }); // optimistic
    try {
      await updateFieldValue(activeApiContextId, id, value);
    } catch {
      // field value will be out of sync — refreshContext on next render
      void refreshContext();
    }
  }

  function handleGuidanceChange(id: string, guidance: string) {
    if (isClosedContext) return;
    updateField(id, { guidance });
  }

  async function handleRegenerateSingleField(fieldId: string) {
    if (isClosedContext || !activeApiContextId) return;
    updateField(fieldId, { status: "generating" });
    try {
      const { value } = await regenerateField(activeApiContextId, fieldId);
      updateField(fieldId, { status: "idle", value });
    } catch {
      updateField(fieldId, { status: "idle" });
    }
  }

  // ── Candidate mutations ───────────────────────────────────────────

  async function handleDismiss(id: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "dismissed" as const } : c)),
    );
    try {
      await updateFlaggedDecision(id, { status: "dismissed" });
      await refreshAgenda();
    } catch {
      void refreshAgenda(); // restore from server
    }
  }

  async function handleAddFlagForLater() {
    if (!flagLaterTitle.trim()) return;
    const title = flagLaterTitle.trim();
    setFlagLaterTitle("");
    setLeftTab("candidates");
    setModal(null);
    try {
      await createFlaggedDecision(meetingId, {
        suggestedTitle: title,
        contextSummary: "Captured quickly for later review.",
        confidence: 1.0,
        chunkIds: [],
        priority: candidates.length,
      });
      await refreshAgenda();
    } catch {
      void refreshAgenda();
    }
  }

  function toggleAttendeeStatus(name: string) {
    let nextEvent: AttendeeEvent | null = null;

    setAttendees((prev) =>
      prev.map((attendee) => {
        if (attendee.name !== name) return attendee;

        const nextStatus = attendee.status === "present" ? "left" : "present";
        const updatedAt = new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
        nextEvent = {
          id: `attendee-event-${Date.now()}-${name.replace(/\s+/g, "-").toLowerCase()}`,
          attendeeName: name,
          action: nextStatus === "present" ? "entered" : "left",
          at: updatedAt,
        };
        return {
          ...attendee,
          status: nextStatus,
          updatedAt,
        };
      }),
    );

    if (nextEvent) {
      const event = nextEvent;
      setAttendeeEvents((prev) => [event, ...prev].slice(0, 12));
    }
  }

  function handleAddAttendee(name: string) {
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
          id: `attendee-event-${Date.now()}-${normalized.replace(/\s+/g, "-").toLowerCase()}`,
          attendeeName: normalized,
          action: "entered" as const,
          at: updatedAt,
        },
        ...prev,
      ].slice(0, 12),
    );

    return true;
  }

  async function handlePromoteConfirm(payload: {
    title: string;
    summary: string;
    template: Template;
    insertMode: "append" | "before";
    beforeIndex: number;
  }) {
    if (!promoteCandidate) return;
    setLeftTab("agenda");
    setModal(null);

    const resolvedTemplate =
      templates.find((template) => template.name === payload.template.name) ?? templates[0];
    if (!resolvedTemplate) return;

    const acceptedDecisions = apiDecisions
      .filter((decision) => decision.status === "accepted")
      .sort((a, b) => a.priority - b.priority);
    const insertAt =
      payload.insertMode === "append"
        ? acceptedDecisions.length
        : Math.max(0, Math.min(acceptedDecisions.length, payload.beforeIndex - 1));
    const before = acceptedDecisions[insertAt];
    const targetPriority = before?.priority ?? acceptedDecisions.length;

    try {
      await updateFlaggedDecision(promoteCandidate.id, {
        suggestedTitle: payload.title,
        contextSummary: payload.summary,
        status: "accepted",
        priority: targetPriority,
      });

      const createdContext = await createDecisionContext({
        meetingId,
        flaggedDecisionId: promoteCandidate.id,
        title: payload.title,
        templateId: resolvedTemplate.id,
      });

      setActiveApiContextId(createdContext.id);
      await refreshAgenda();
      void refreshContext();
      setFinalised(false);

      refreshSuggestedTagsFromDraft({
        title: payload.title,
        summary: payload.summary,
        focus: "initial draft",
        acceptedTags: [],
      });
    } catch {
      await refreshAgenda();
    }
  }

  // ── Tag + relation mutations ──────────────────────────────────────

  function handleAddTag() {
    if (isClosedContext) return;
    const name = tagInput.trim();
    if (!name) return;
    const lower = name.toLowerCase();

    const exists = activeContext.tags.some((tag) => tag.name.toLowerCase() === lower);
    if (exists) {
      setTagInput("");
      return;
    }

    const tag: Tag = {
      id: `tag-${Date.now()}`,
      name,
      category: tagCategory,
    };

    setActiveContext((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    setTagInput("");
  }

  function handleRemoveTag(tagId: string) {
    if (isClosedContext) return;
    setActiveContext((prev) => ({ ...prev, tags: prev.tags.filter((tag) => tag.id !== tagId) }));
  }

  function handleRemoveRelation(relationId: string) {
    if (isClosedContext) return;
    setActiveContext((prev) => ({
      ...prev,
      relations: prev.relations.filter((relation) => relation.id !== relationId),
    }));
  }

  function refreshSuggestedTagsFromDraft(params: {
    title: string;
    summary: string;
    focus?: string;
    acceptedTags?: Tag[];
  }) {
    const accepted = params.acceptedTags ?? activeContext.tags;
    const existingAccepted = new Set(accepted.map((tag) => tag.name.toLowerCase()));
    const focusText = `${params.title} ${params.summary} ${params.focus ?? ""}`.toLowerCase();
    const ranked = [...SUGGESTED_TAG_SEEDS].sort((a, b) => {
      const aScore = focusText.includes(a.name.toLowerCase()) ? 1 : 0;
      const bScore = focusText.includes(b.name.toLowerCase()) ? 1 : 0;
      return bScore - aScore;
    });

    const next = ranked
      .filter((tag) => !existingAccepted.has(tag.name.toLowerCase()))
      .slice(0, 3)
      .map((tag) => ({ ...tag, id: `st-${Date.now()}-${tag.name.replace(/\s+/g, "-")}` }));

    // Regeneration refreshes pending suggestions only. Accepted tags stay on the context.
    setSuggestedTags(next);
  }

  function handleApproveSuggestedTag(suggestedTagId: string) {
    if (isClosedContext) return;
    const match = suggestedTags.find((tag) => tag.id === suggestedTagId);
    if (!match) return;

    const exists = activeContext.tags.some(
      (tag) => tag.name.toLowerCase() === match.name.toLowerCase(),
    );
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
    if (isClosedContext) return;
    setSuggestedTags((prev) => prev.filter((tag) => tag.id !== suggestedTagId));
  }

  function handleStartTitleEdit() {
    if (isClosedContext) return;
    setTitleDraft(activeContext.title);
    setEditingTitle(true);
  }

  function handleCancelTitleEdit() {
    setTitleDraft(activeContext.title);
    setEditingTitle(false);
  }

  function handleSaveTitleEdit() {
    if (isClosedContext) return;
    const next = titleDraft.trim();
    if (!next) return;
    setActiveContext((prev) => ({ ...prev, title: next }));
    setAgendaItems((prev) =>
      prev.map((item) => (item.id === activeContext.id ? { ...item, title: next } : item)),
    );
    setEditingTitle(false);
  }

  function handleStartSummaryEdit() {
    if (isClosedContext) return;
    setSummaryDraft(activeContext.summary);
    setEditingSummary(true);
  }

  function handleCancelSummaryEdit() {
    setSummaryDraft(activeContext.summary);
    setEditingSummary(false);
  }

  function handleSaveSummaryEdit() {
    if (isClosedContext) return;
    const next = summaryDraft.trim();
    if (!next) return;
    setActiveContext((prev) => ({ ...prev, summary: next }));
    setEditingSummary(false);
  }

  function ensureMeetingRelation(context: OpenContextSummary) {
    const isCrossMeeting =
      context.sourceMeetingDate !== currentMeeting.date ||
      context.sourceMeetingTitle !== currentMeeting.title;
    if (!isCrossMeeting) return;

    setRelatedMeetings((prev) => {
      const exists = prev.some(
        (meeting) =>
          meeting.title === context.sourceMeetingTitle &&
          meeting.date === context.sourceMeetingDate,
      );
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
        (rel) => rel.relationType === "related" && rel.targetTitle === relationLabel,
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
            relationType: "related",
          },
        ],
      };
    });
  }

  function handleAddRelationFromContext(context: OpenContextSummary) {
    if (isClosedContext) return;
    ensureMeetingRelation(context);

    const relation: Relation = {
      id: `rel-${Date.now()}`,
      targetTitle: context.title,
      targetId: context.id,
      relationType,
    };

    setActiveContext((prev) => {
      const exists = prev.relations.some(
        (rel) => rel.targetId === context.id && rel.relationType === relationType,
      );
      if (exists) return prev;
      return { ...prev, relations: [...prev.relations, relation] };
    });

    setModal(null);
  }

  // ── Supplementary content ────────────────────────────────────────

  function handleAddSupplementary(item: Omit<SupplementaryItem, "id" | "createdAt">) {
    const newItem: SupplementaryItem = {
      ...item,
      id: `sc-${Date.now()}`,
      createdAt: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    };
    setSupplementary((prev) => [...prev, newItem]);
  }

  function handleRemoveSupplementary(id: string) {
    setSupplementary((prev) => prev.filter((s) => s.id !== id));
  }

  // ── Context / agenda actions ─────────────────────────────────────

  function handleDeferActiveContext() {
    if (isClosedContext) return;
    const target = agendaItems.find((item) => item.id === activeContext.id);
    if (!target) return;

    const deferredItem: AgendaItemModel = { ...target, status: "deferred" };
    const remaining = agendaItems.filter((item) => item.id !== activeContext.id);

    const normalized = remaining.map((item, idx) =>
      idx === 0
        ? { ...item, status: "active" as const }
        : item.status === "active"
          ? { ...item, status: "drafted" as const }
          : item,
    );

    setDeferredItems((prev) => [...prev, deferredItem]);
    setAgendaItems(normalized);

    const nextActive = normalized.find((item) => item.status === "active") ?? normalized[0] ?? null;

    if (nextActive) {
      setActiveContext((prev) => ({
        ...prev,
        id: nextActive.id,
        title: nextActive.title,
        summary: `Continued discussion context for ${nextActive.title}.`,
        status: nextActive.status,
      }));
    }

    setLeftTab("agenda");
  }

  function handleAddExistingContext(context: OpenContextSummary) {
    ensureMeetingRelation(context);

    const exists =
      agendaItems.some((item) => item.id === context.id) ||
      deferredItems.some((item) => item.id === context.id);

    if (!exists) {
      setAgendaItems((prev) => [
        ...prev,
        { id: context.id, title: context.title, status: "pending" },
      ]);
    }

    setLeftTab("agenda");
    setModal(null);
  }

  function handleReturnDeferredContext(contextId: string) {
    const target = deferredItems.find((item) => item.id === contextId);
    if (!target) return;

    setDeferredItems((prev) => prev.filter((item) => item.id !== contextId));

    const hasActiveAgendaItem = agendaItems.some((item) => item.status === "active");
    const nextStatus: AgendaItemStatus = hasActiveAgendaItem ? "pending" : "active";

    setAgendaItems((prev) => {
      if (prev.some((item) => item.id === contextId)) return prev;
      return [...prev, { ...target, status: nextStatus }];
    });

    if (!hasActiveAgendaItem) {
      setActiveContext((prev) => ({
        ...prev,
        id: target.id,
        title: target.title,
        summary: `Continued discussion context for ${target.title}.`,
        status: "active",
      }));
      setFinalised(false);
    }

    setLeftTab("agenda");
  }

  function handleSelectAgendaItem(itemId: string) {
    const target = agendaItems.find((item) => item.id === itemId);
    if (!target) return;

    if (target.status !== "logged") {
      setAgendaItems((prev) =>
        prev.map((item) => {
          if (item.id === target.id) return { ...item, status: "active" as const };
          if (item.status === "active") return { ...item, status: "drafted" as const };
          return item;
        }),
      );
    }

    // Load the API decision context for this agenda item
    setActiveApiContextId(target.contextId ?? null);

    setActiveContext((prev) => ({
      ...prev,
      id: target.id,
      title: target.title,
      summary:
        target.status === "logged"
          ? `Reviewing logged decision context for ${target.title}.`
          : `Active discussion context for ${target.title}.`,
      status: target.status === "logged" ? "logged" : "active",
    }));

    setFinalised(target.status === "logged");
    setLeftTab("agenda");
  }

  function handleSelectDeferredItem(itemId: string) {
    const target = deferredItems.find((item) => item.id === itemId);
    if (!target) return;

    setActiveContext((prev) => ({
      ...prev,
      id: target.id,
      title: target.title,
      summary: `Deferred context review for ${target.title}.`,
      status: "deferred",
    }));
    setFinalised(false);
    setLeftTab("agenda");
  }

  function handleMoveAgendaItem(itemId: string, direction: "up" | "down") {
    setAgendaItems((prev) => {
      const movable = prev
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.status !== "logged");

      const current = movable.findIndex(({ item }) => item.id === itemId);
      if (current === -1) return prev;

      const target = direction === "up" ? current - 1 : current + 1;
      if (target < 0 || target >= movable.length) return prev;

      const sourceIndex = movable[current]?.index;
      const targetIndex = movable[target]?.index;
      if (sourceIndex === undefined || targetIndex === undefined) return prev;

      const next = [...prev];
      [next[sourceIndex], next[targetIndex]] = [next[targetIndex]!, next[sourceIndex]!];
      return next;
    });
  }

  function openCreateContextDialog() {
    if (isClosedContext) {
      setCreateContextDraft({
        title: `Follow-up: ${activeContext.title}`,
        summary: `Follow-up context linked to closed decision \"${activeContext.title}\".`,
        relation: {
          targetId: activeContext.id,
          targetTitle: activeContext.title,
          relationType: "related",
        },
      });
    } else {
      setCreateContextDraft(null);
    }
    setModal({ type: "create-context" });
  }

  // ── Stream actions ────────────────────────────────────────────────

  function getRecorderMimeType(): string | undefined {
    const options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"];
    return options.find((value) => MediaRecorder.isTypeSupported(value));
  }

  function extensionForMimeType(mimeType: string | undefined): string {
    if (!mimeType) return "webm";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("ogg") || mimeType.includes("oga")) return "ogg";
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
    if (mimeType.includes("mpeg") || mimeType.includes("mp3") || mimeType.includes("mpga")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("flac")) return "flac";
    return "webm";
  }

  function clearRecorderSegmentTimer() {
    if (recorderSegmentTimerRef.current !== null) {
      window.clearTimeout(recorderSegmentTimerRef.current);
      recorderSegmentTimerRef.current = null;
    }
  }

  async function stopBrowserStream() {
    streamShouldContinueRef.current = false;
    clearRecorderSegmentTimer();
    const recorder = recorderRef.current;
    const sessionId = sessionIdRef.current;
    setStreamState("stopped");

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else if (sessionId) {
      await Promise.allSettled(pendingChunkUploadsRef.current);
      try {
        await stopTranscriptionSession(sessionId);
      } catch (error) {
        setStreamError(error instanceof Error ? error.message : "Failed to stop session");
      }
      sessionIdRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function startBrowserStream() {
    if (!meetingId) return;
    setStreamError(null);
    setStreamState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioDeviceId
          ? { deviceId: { exact: selectedAudioDeviceId } }
          : true,
      });
      mediaStreamRef.current = stream;

      const session = await createTranscriptionSession(meetingId);
      sessionIdRef.current = session.sessionId;
      streamShouldContinueRef.current = true;

      const mimeType = getRecorderMimeType();
      pendingChunkUploadsRef.current = [];

      const startSegment = () => {
        if (!streamShouldContinueRef.current || !sessionIdRef.current || !mediaStreamRef.current) {
          return;
        }

        const recorder = new MediaRecorder(mediaStreamRef.current, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (!sessionIdRef.current || event.data.size === 0) return;
          const currentSessionId = sessionIdRef.current;
          if (!currentSessionId) return;
          const chunkMimeType = event.data.type || mimeType || "audio/webm";
          const extension = extensionForMimeType(chunkMimeType);
          const upload = event.data
            .arrayBuffer()
            .then((buffer) =>
              uploadTranscriptionSessionChunk(
                currentSessionId,
                buffer,
                `chunk-${Date.now()}.${extension}`,
                chunkMimeType,
              ),
            );
          pendingChunkUploadsRef.current.push(upload);
          void upload
            .catch((error) => {
              setStreamError(error instanceof Error ? error.message : "Failed to upload audio chunk");
            })
            .finally(() => {
              pendingChunkUploadsRef.current = pendingChunkUploadsRef.current.filter(
                (item) => item !== upload,
              );
            });
        };

        recorder.onstop = () => {
          const finalizeSegment = async () => {
            await Promise.allSettled(pendingChunkUploadsRef.current);
            if (!streamShouldContinueRef.current) {
              if (sessionIdRef.current) {
                try {
                  await stopTranscriptionSession(sessionIdRef.current);
                } catch (error) {
                  setStreamError(error instanceof Error ? error.message : "Failed to flush stream");
                }
              }
              sessionIdRef.current = null;
              recorderRef.current = null;
              if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                mediaStreamRef.current = null;
              }
              return;
            }
            startSegment();
          };
          void finalizeSegment();
        };

        recorder.onerror = () => {
          setStreamError("Recorder error while capturing audio");
          void stopBrowserStream();
        };

        recorder.start();
        clearRecorderSegmentTimer();
        recorderSegmentTimerRef.current = window.setTimeout(() => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }, 10_000);
      };

      startSegment();
      setStreamState("live");
    } catch (error) {
      setStreamState("stopped");
      setStreamError(
        error instanceof Error ? error.message : "Unable to start browser audio stream",
      );
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      streamShouldContinueRef.current = false;
      clearRecorderSegmentTimer();
    }
  }

  function handleToggleStream() {
    if (streamState === "connecting") return;
    if (streamState === "live") {
      void stopBrowserStream();
      return;
    }
    void startBrowserStream();
  }

  // ── Regenerate ───────────────────────────────────────────────────

  async function handleRegenerate(_focus: string) {
    if (isClosedContext || !activeApiContextId) return;
    setModal(null);
    setNewRowsSinceGeneration(0);

    setFields((prev) =>
      prev.map((f) => (f.status === "locked" ? f : { ...f, status: "generating" })),
    );

    try {
      const updated = await regenerateDraft(activeApiContextId);
      setFields(
        templateFields.map((f) => ({
          id: f.id,
          label: f.name
            .split("_")
            .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
            .join(" "),
          value: updated.draftData?.[f.id] ?? "",
          status: updated.lockedFields.includes(f.id) ? ("locked" as const) : ("idle" as const),
          required: false,
        })),
      );
    } catch {
      setFields((prev) =>
        prev.map((f) => (f.status === "generating" ? { ...f, status: "idle" } : f)),
      );
    }
  }

  // ── Finalise ─────────────────────────────────────────────────────

  async function handleFinalise(method: DecisionMethod, actors: string[], loggedBy: string) {
    if (isClosedContext || !activeApiContextId) return;
    setModal(null);
    try {
      const logged = await logDecision(activeApiContextId, {
        loggedBy,
        decisionMethod: {
          type: DECISION_METHOD_MAP[method],
          ...(actors.length > 0 ? { details: `Actors: ${actors.join(", ")}` } : {}),
        },
      });
      await refreshAgenda();
      setFinalised(true);
      setLeftTab("agenda");
      navigate(`/decisions/${logged.id}`);
    } catch {
      await refreshAgenda();
    }
  }

  // ── Create context ───────────────────────────────────────────────

  async function handleCreateContext(
    title: string,
    summary: string,
    template: Template,
    relationTypeOverride?: RelationType,
  ) {
    setModal(null);
    setLeftTab("agenda");
    const resolvedTemplate =
      templates.find((candidateTemplate) => candidateTemplate.name === template.name) ??
      templates[0];
    if (!resolvedTemplate) return;

    try {
      const createdDecision = await createFlaggedDecision(meetingId, {
        suggestedTitle: title,
        contextSummary: summary || "Manually created decision context.",
        confidence: 1,
        chunkIds: [],
        priority: apiDecisions.filter((decision) => decision.status === "accepted").length,
      });

      await updateFlaggedDecision(createdDecision.id, {
        status: "accepted",
        priority: createdDecision.priority,
      });

      const createdContext = await createDecisionContext({
        meetingId,
        flaggedDecisionId: createdDecision.id,
        title,
        templateId: resolvedTemplate.id,
      });

      setActiveApiContextId(createdContext.id);
      setCreateContextDraft(null);
      await refreshAgenda();
      void refreshContext();
      setFinalised(false);

      refreshSuggestedTagsFromDraft({
        title,
        summary,
        focus: relationTypeOverride ? `relation:${relationTypeOverride}` : "initial draft",
        acceptedTags: [],
      });
    } catch {
      await refreshAgenda();
    }
  }

  async function handleAddAgendaItem(title: string) {
    if (!meetingId || isMeetingCompleted) return;
    setAgendaAddError(null);
    setAddingAgendaItem(true);

    const template = templates.find((candidate) => candidate.isDefault) ?? templates[0];
    if (!template) {
      setAgendaAddError("No template available. Seed templates first.");
      setAddingAgendaItem(false);
      return;
    }

    const acceptedDecisions = apiDecisions
      .filter((decision) => decision.status === "accepted")
      .sort((a, b) => a.priority - b.priority);
    const nextPriority =
      acceptedDecisions.length > 0
        ? Math.max(...acceptedDecisions.map((decision) => decision.priority)) + 1
        : 0;

    try {
      const flagged = await createFlaggedDecision(meetingId, {
        suggestedTitle: title,
        contextSummary: "Added from facilitator workspace.",
        confidence: 1,
        chunkIds: [],
        priority: nextPriority,
      });

      await updateFlaggedDecision(flagged.id, {
        status: "accepted",
        priority: nextPriority,
      });

      const createdContext = await createDecisionContext({
        meetingId,
        flaggedDecisionId: flagged.id,
        title,
        templateId: template.id,
      });

      setActiveApiContextId(createdContext.id);
      setLeftTab("agenda");
      setFinalised(false);
      await refreshAgenda();
      void refreshContext();
    } catch (err) {
      setAgendaAddError(err instanceof Error ? err.message : "Failed to add agenda item");
      await refreshAgenda();
    } finally {
      setAddingAgendaItem(false);
    }
  }

  async function handleChangeTemplate(newTemplateId: string, fieldValues: Record<string, string>) {
    if (isClosedContext || !activeApiContextId) return;

    // Switch template via dedicated endpoint
    await changeDecisionContextTemplate(activeApiContextId, newTemplateId);

    // Save any carried-over field values
    const entries = Object.entries(fieldValues).filter(([, v]) => v.trim());
    await Promise.all(
      entries.map(([fieldId, value]) => updateFieldValue(activeApiContextId, fieldId, value)),
    );

    setZoomedFieldId(null);
    setModal(null);
    refreshContext();
  }

  // ── Upload transcript ────────────────────────────────────────────

  function handleUploadComplete(_filename: string, _rowCount: number) {
    setModal(null);
    setTranscriptUploaded(true);
    setLeftTab("candidates");
  }

  function handleSelectFieldTranscript(fieldId: string) {
    const query = new URLSearchParams();
    if (activeApiContextId) query.set("decisionContextId", activeApiContextId);
    query.set("fieldId", fieldId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const url = `/meetings/${meetingId}/facilitator/transcript${suffix}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      navigate(url);
    }
  }

  async function handleEndMeeting() {
    if (!meetingId || isMeetingCompleted || endingMeeting) return;
    const confirmed = window.confirm("End this meeting? This marks it as completed.");
    if (!confirmed) return;

    setEndingMeeting(true);
    try {
      await updateMeeting(meetingId, { status: "completed" });
      await refreshMeeting();
    } finally {
      setEndingMeeting(false);
    }
  }

  async function refreshSystemStatus() {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const [api, transcription] = await Promise.all([
        getApiStatus(),
        getTranscriptionServiceStatus(),
      ]);
      setApiStatus(api);
      setTranscriptionStatus(transcription);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Failed to load system status");
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    if (modal?.type !== "system-status") return;
    void refreshSystemStatus();
  }, [modal]);

  useEffect(() => {
    return () => {
      streamShouldContinueRef.current = false;
      clearRecorderSegmentTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      recorderRef.current = null;
      mediaStreamRef.current = null;
      sessionIdRef.current = null;
      pendingChunkUploadsRef.current = [];
    };
  }, []);

  // ── Field zoom ───────────────────────────────────────────────────

  if (zoomedField) {
    return (
      <FieldZoom
        field={zoomedField}
        supplementaryItems={supplementary}
        meetingId={meetingId}
        contextId={activeContext.id}
        onClose={() => setZoomedFieldId(null)}
        onSave={handleSaveFieldValue}
        onRegenerate={handleRegenerateSingleField}
        onLock={handleLock}
        onUnlock={handleUnlock}
        onGuidanceChange={handleGuidanceChange}
        onAddSupplementary={handleAddSupplementary}
        onRemoveSupplementary={handleRemoveSupplementary}
        onSelectTranscript={handleSelectFieldTranscript}
      />
    );
  }

  const movableAgendaIds = agendaItems
    .filter((item) => item.status !== "logged")
    .map((item) => item.id);

  return (
    <div className="density-facilitator min-h-screen bg-base flex flex-col relative">
      {selectionToast && (
        <div className="absolute right-4 top-16 z-30 px-3 py-2 rounded-card border border-settled/40 bg-settled-dim/20 text-fac-meta text-text-primary">
          Added {selectionToast.rows} transcript rows ({selectionToast.chunks} chunks) to this
          context.
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────── */}
      {modal?.type === "regenerate" && (
        <RegenerateDialog
          unlockedCount={unlockedCount}
          onConfirm={handleRegenerate}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "finalise" && (
        <FinaliseDialog
          participants={attendees.map((attendee) => attendee.name)}
          onConfirm={handleFinalise}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "create-context" && (
        <CreateContextDialog
          onConfirm={handleCreateContext}
          onCancel={() => {
            setModal(null);
            setCreateContextDraft(null);
          }}
          initialTitle={createContextDraft?.title}
          initialSummary={createContextDraft?.summary}
          relationTargetTitle={createContextDraft?.relation?.targetTitle}
          initialRelationType={createContextDraft?.relation?.relationType}
        />
      )}
      {modal?.type === "change-template" && (
        <ChangeTemplateDialog
          templates={templates}
          currentTemplateId={apiContext?.templateId ?? null}
          currentFields={fields}
          onConfirm={handleChangeTemplate}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "promote" && promoteCandidate && (
        <PromoteCandidateDialog
          candidate={promoteCandidate}
          agendaTitles={agendaItems.map((item) => item.title)}
          onConfirm={handlePromoteConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "add-existing-context" && (
        <AddExistingContextDialog
          contexts={OPEN_CONTEXTS}
          currentMeeting={{ title: currentMeeting.title, date: currentMeeting.date }}
          onConfirm={handleAddExistingContext}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "add-relation-context" && (
        <AddExistingContextDialog
          contexts={OPEN_CONTEXTS}
          currentMeeting={{ title: currentMeeting.title, date: currentMeeting.date }}
          onConfirm={handleAddRelationFromContext}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "flag-later" && (
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
      {modal?.type === "system-status" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-border rounded-card shadow-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-fac-field text-text-primary font-medium">System status</h2>
              <button
                onClick={() => setModal(null)}
                className="inline-flex items-center justify-center w-8 h-8 rounded border border-border text-text-muted hover:text-text-primary"
                aria-label="Close status modal"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void refreshSystemStatus()}
                disabled={statusLoading}
                className="px-3 py-1.5 text-fac-meta border border-border rounded text-text-secondary hover:text-text-primary disabled:opacity-40"
              >
                {statusLoading ? "Refreshing…" : "Refresh"}
              </button>
              {statusError && <span className="text-fac-meta text-danger">{statusError}</span>}
            </div>

            <div className="rounded border border-border p-3">
              <p className="text-fac-label text-text-muted uppercase tracking-wider">Core API</p>
              <p className="text-fac-meta text-text-primary mt-1">{apiStatus ? "online" : "unknown"}</p>
              {apiStatus && (
                <p className="text-fac-meta text-text-secondary mt-1">
                  db: {apiStatus.databaseConfigured ? "configured" : "missing"} · llm:{" "}
                  {apiStatus.llm.mode}/{apiStatus.llm.provider}:{apiStatus.llm.model}
                </p>
              )}
            </div>

            <div className="rounded border border-border p-3">
              <p className="text-fac-label text-text-muted uppercase tracking-wider">Transcription service</p>
              <p className="text-fac-meta text-text-primary mt-1">
                {transcriptionStatus ? "online" : "unknown"}
              </p>
              {transcriptionStatus && (
                <>
                  <p className="text-fac-meta text-text-secondary mt-1">
                    provider: {transcriptionStatus.provider} · sessions: {transcriptionStatus.sessionCount}
                  </p>
                  <p className="text-fac-meta text-text-secondary mt-1">
                    api bridge: {transcriptionStatus.api.ok ? "ok" : "error"}
                    {transcriptionStatus.api.error ? ` (${transcriptionStatus.api.error})` : ""}
                  </p>
                  <p className="text-fac-meta text-text-secondary mt-1">
                    whisper:{" "}
                    {!transcriptionStatus.whisper.enabled
                      ? "disabled"
                      : transcriptionStatus.whisper.ok
                        ? "ok"
                        : `error${transcriptionStatus.whisper.error ? ` (${transcriptionStatus.whisper.error})` : ""}`}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Header strip ────────────────────────────────────────── */}
      <MainHeader
        className="px-4 py-3"
        navItems={[{ label: "Meetings", to: "/" }, { label: meetingId }]}
        title={apiMeeting?.title ?? currentMeeting.title}
        titleTo={meetingHomePath}
        subtitle={finalised ? "Facilitator workspace · Logged" : "Facilitator workspace"}
        meta={
          (apiMeeting?.date ?? currentMeeting.date)
            ? new Date(apiMeeting?.date ?? currentMeeting.date).toLocaleString("en-GB")
            : undefined
        }
        status={
          apiMeeting?.status
            ? {
                label: apiMeeting.status === "completed" ? "Completed" : "Active",
                tone: apiMeeting.status === "completed" ? "completed" : "active",
              }
            : undefined
        }
        actions={
          <>
            <Link
              to={meetingSharedPath}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
              title="Open shared view"
            >
              <ExternalLink size={13} />
              <span className="hidden xl:inline">Shared view</span>
            </Link>
            <Link
              to={meetingHomePath}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
              title="Open meeting home"
            >
              <Home size={13} />
              <span>Meeting home</span>
            </Link>

            <button
              onClick={handleToggleStream}
              disabled={isMeetingCompleted}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
              title={streamState === "live" ? "Stop stream" : "Start stream"}
              aria-label={streamState === "live" ? "Stop stream" : "Start stream"}
            >
              <Radio size={13} />
              <span className="hidden xl:inline">
                {streamState === "live" ? "Stop stream" : "Start stream"}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${streamBadgeClass}`} />
            </button>

            <label className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary border border-border rounded">
              Mic
              <select
                value={selectedAudioDeviceId}
                onChange={(event) => setSelectedAudioDeviceId(event.target.value)}
                disabled={streamState === "live" || streamState === "connecting"}
                className="bg-transparent text-text-primary focus:outline-none max-w-[170px]"
                title="Select microphone"
              >
                {audioDevices.length === 0 && <option value="">Default microphone</option>}
                {audioDevices.map((device, index) => (
                  <option key={device.deviceId || `mic-${index}`} value={device.deviceId}>
                    {device.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>

            <span className="hidden xl:inline text-[11px] px-1.5 py-0.5 rounded-badge bg-overlay border border-border text-text-muted">
              {transcriptRowCount} rows · {contextTaggedChunkCount} tagged
            </span>

            <Link
              to={meetingTranscriptPath}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
              title="Open transcript"
            >
              <FilePlus2 size={13} />
              <span>Open transcript</span>
            </Link>

            <button
              onClick={() => setModal({ type: "upload" })}
              disabled={isMeetingCompleted}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
              title="Upload transcript"
              aria-label="Upload transcript"
            >
              <Upload size={13} />
              <span className="hidden xl:inline">Upload transcript</span>
              {transcriptUploaded && <span className="w-1.5 h-1.5 rounded-full bg-settled" />}
            </button>

            <button
              onClick={() => setModal({ type: "flag-later" })}
              disabled={isMeetingCompleted}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
              title="Flag for later"
              aria-label="Flag for later"
            >
              <Flag size={13} />
              <span className="hidden xl:inline">Flag for later</span>
            </button>

            <button
              onClick={() => setModal({ type: "system-status" })}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
              title="System status"
              aria-label="System status"
            >
              <Radio size={13} />
              <span className="hidden xl:inline">System status</span>
            </button>

            <button
              onClick={openCreateContextDialog}
              disabled={isMeetingCompleted}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
              title="New decision"
              aria-label="New decision"
            >
              <FilePlus2 size={13} />
              <span className="hidden xl:inline">New decision</span>
            </button>

            <button
              onClick={() => setModal({ type: "regenerate" })}
              disabled={
                unlockedCount === 0 || isClosedContext || isMeetingCompleted || !hasSelectedContext
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-text-secondary hover:text-text-primary border border-border rounded transition-colors disabled:opacity-30"
              title="Regenerate"
              aria-label="Regenerate"
            >
              <RefreshCw size={13} />
              <span className="hidden xl:inline">Regenerate</span>
              {newRowsSinceGeneration > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-badge bg-caution-dim text-caution border border-caution/30">
                  {newRowsSinceGeneration} new
                </span>
              )}
            </button>

            <button
              onClick={handleDeferActiveContext}
              disabled={isClosedContext || isMeetingCompleted || !hasSelectedContext}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-fac-meta text-caution hover:text-caution border border-caution/30 rounded transition-colors disabled:opacity-30"
              title="Defer"
              aria-label="Defer"
            >
              <PauseCircle size={13} />
              <span className="hidden xl:inline">Defer</span>
            </button>

            <button
              onClick={() => setModal({ type: "finalise" })}
              disabled={isClosedContext || isMeetingCompleted || !hasSelectedContext}
              className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta bg-settled text-base rounded font-medium hover:bg-settled/90 transition-colors disabled:opacity-30"
              title="Finalise"
              aria-label="Finalise"
            >
              <CheckSquare size={13} />
              <span className="hidden xl:inline">Finalise</span>
            </button>

            <button
              onClick={() => void handleEndMeeting()}
              disabled={isMeetingCompleted || endingMeeting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-fac-meta border border-danger/30 text-danger rounded transition-colors hover:bg-danger-dim/30 disabled:opacity-30"
              title="End meeting"
              aria-label="End meeting"
            >
              <X size={13} />
              <span className="hidden xl:inline">
                {isMeetingCompleted ? "Meeting ended" : endingMeeting ? "Ending…" : "End meeting"}
              </span>
            </button>
          </>
        }
      />

      {streamError && (
        <div className="px-4 py-2 border-b border-danger/30 bg-danger-dim/20 text-fac-meta text-danger">
          {streamError}
        </div>
      )}

      {/* ── Upload inline panel (if modal type upload) ───────────── */}
      {modal?.type === "upload" && (
        <div className="px-4 py-3 border-b border-border">
          <UploadTranscript onComplete={handleUploadComplete} onCancel={() => setModal(null)} />
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ── Left panel ──────────────────────────────────────────── */}
        {!leftPanelCollapsed ? (
          <aside
            className="shrink-0 border-r border-border flex flex-col bg-surface"
            style={{ width: `${leftPanelWidth}px` }}
          >
            <section className="border-b border-border px-3 py-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-fac-label text-text-secondary uppercase tracking-wider">
                  Attendees
                </p>
                <button
                  onClick={() => setLeftPanelCollapsed(true)}
                  className="shrink-0 p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-overlay border border-border"
                  aria-label="Collapse meeting context panel"
                  title="Collapse meeting context panel"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>

              <MeetingAttendeesPanel
                attendees={attendees}
                attendeeEvents={attendeeEvents}
                onToggleAttendee={toggleAttendeeStatus}
                onAddAttendee={handleAddAttendee}
              />
            </section>

            <div className="flex border-b border-border">
              <TabButton active={leftTab === "candidates"} onClick={() => setLeftTab("candidates")}>
                Suggested
                {activeCandidates.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-caution text-base font-bold">
                    {activeCandidates.length}
                  </span>
                )}
              </TabButton>
              <TabButton active={leftTab === "agenda"} onClick={() => setLeftTab("agenda")}>
                Agenda
              </TabButton>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {leftTab === "candidates" ? (
                <div className="flex flex-col gap-2">
                  {activeCandidates.length === 0 ? (
                    <p className="text-fac-meta text-text-muted px-2 py-6 text-center">
                      {transcriptUploaded
                        ? "All candidates reviewed."
                        : "Upload a transcript to detect candidates."}
                    </p>
                  ) : (
                    activeCandidates.map((c) => (
                      <CandidateCard
                        key={c.id}
                        candidate={c}
                        onDismiss={handleDismiss}
                        onPromote={(id) => setModal({ type: "promote", candidateId: id })}
                      />
                    ))
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-fac-meta text-text-muted px-2">
                    Click an agenda item to review or jump ahead. Reorder non-finalised items with
                    arrows.
                  </p>
                  <AgendaList
                    items={agendaItems}
                    activeId={activeContext.id}
                    onSelectItem={handleSelectAgendaItem}
                    renderItemActions={(item) => {
                      if (item.status === "logged") return null;

                      const index = movableAgendaIds.indexOf(item.id);
                      const canMoveUp = index > 0;
                      const canMoveDown = index >= 0 && index < movableAgendaIds.length - 1;

                      return (
                        <>
                          <IconButton
                            onClick={() => handleMoveAgendaItem(item.id, "up")}
                            disabled={!canMoveUp}
                            className="w-7 h-7"
                            aria-label={`Move ${item.title} up`}
                          >
                            <ArrowUp size={12} />
                          </IconButton>
                          <IconButton
                            onClick={() => handleMoveAgendaItem(item.id, "down")}
                            disabled={!canMoveDown}
                            className="w-7 h-7"
                            aria-label={`Move ${item.title} down`}
                          >
                            <ArrowDown size={12} />
                          </IconButton>
                        </>
                      );
                    }}
                  />

                  {deferredItems.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border">
                      <p className="text-fac-label text-text-muted uppercase tracking-wider px-2 pb-1">
                        Deferred
                      </p>
                      <AgendaList
                        items={deferredItems.map((item) => ({
                          ...item,
                          status: "deferred" as const,
                        }))}
                        activeId={
                          activeContext.status === "deferred" ? activeContext.id : undefined
                        }
                        onSelectItem={handleSelectDeferredItem}
                        renderItemActions={(item) => (
                          <IconButton
                            onClick={() => handleReturnDeferredContext(item.id)}
                            className="w-7 h-7"
                            aria-label={`Return ${item.title} to agenda`}
                          >
                            <Undo2 size={12} />
                          </IconButton>
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-2 border-t border-border flex flex-col gap-1.5">
              <AgendaItemAddWidget
                onAdd={handleAddAgendaItem}
                loading={addingAgendaItem}
                error={agendaAddError}
                disabled={isMeetingCompleted}
                placeholder="New agenda item..."
                buttonLabel="Add"
              />
              <button
                onClick={() => setModal({ type: "add-existing-context" })}
                className="flex items-center gap-2 px-3 py-2 rounded text-fac-meta text-text-muted hover:text-text-primary hover:bg-overlay transition-colors w-full"
              >
                <Link2 size={14} />
                Add existing context
              </button>
              <Link
                to={meetingTranscriptPath}
                target="_blank"
                rel="noopener noreferrer"
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
        ) : (
          <div className="w-8 shrink-0 border-r border-border bg-surface flex items-start justify-center pt-2">
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-overlay"
              aria-label="Expand agenda sidebar"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {!leftPanelCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize agenda sidebar"
            onMouseDown={(event) =>
              setDragState({
                side: "left",
                startX: event.clientX,
                startWidth: leftPanelWidth,
              })
            }
            className={`w-1.5 shrink-0 cursor-col-resize bg-border/40 hover:bg-accent/40 transition-colors ${
              dragState?.side === "left" ? "bg-accent/50" : ""
            }`}
          />
        )}

        {/* ── Main workspace ──────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
          {!hasSelectedContext ? (
            <div className="mb-5 rounded-card border border-border bg-overlay/30 p-4">
              <h2 className="text-fac-field text-text-primary">No decision selected</h2>
              {agendaItems.length > 0 ? (
                <p className="text-fac-meta text-text-muted mt-1">
                  Select an item from the Agenda tab to start editing this decision context.
                </p>
              ) : (
                <p className="text-fac-meta text-text-muted mt-1">
                  Add your first agenda item from the left panel to begin.
                </p>
              )}
            </div>
          ) : (
            <>
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
                          disabled={isClosedContext}
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
                          disabled={isClosedContext}
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
                    {activeApiTemplate?.name ?? activeContext.templateName}
                  </span>
                  {!isClosedContext && (
                    <button
                      onClick={() => setModal({ type: "change-template" })}
                      className="shrink-0 text-fac-meta text-accent hover:text-accent/80"
                    >
                      Change template
                    </button>
                  )}
                </div>
                {activeApiTemplate?.description && (
                  <p className="text-fac-meta text-text-muted mt-1 max-w-2xl">
                    {activeApiTemplate.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {activeContext.tags.map((tag) => (
                    <span key={tag.id} className="inline-flex items-center gap-1">
                      <TagPill name={tag.name} category={tag.category} />
                      <button
                        onClick={() => handleRemoveTag(tag.id)}
                        disabled={isClosedContext}
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
                    <p className="text-fac-meta text-text-secondary">
                      LLM suggested tags (review required)
                    </p>
                    {suggestedTags.length > 0 && (
                      <button
                        onClick={() =>
                          suggestedTags.forEach((tag) => handleApproveSuggestedTag(tag.id))
                        }
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
                        <div
                          key={tag.id}
                          className="flex items-center gap-2 rounded border border-border px-2 py-1.5"
                        >
                          <TagPill name={tag.name} category={tag.category} />
                          <span className="text-fac-meta text-text-muted flex-1 truncate">
                            {tag.reason}
                          </span>
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
                    disabled={isClosedContext}
                    className="w-44 px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
                  />
                  <select
                    value={tagCategory}
                    onChange={(e) => setTagCategory(e.target.value as TagCategory)}
                    disabled={isClosedContext}
                    className="px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
                  >
                    {TAG_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddTag}
                    disabled={!tagInput.trim() || isClosedContext}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-accent/30 text-accent text-fac-meta hover:bg-accent-dim transition-colors disabled:opacity-40"
                  >
                    <Plus size={12} />
                    Add tag
                  </button>
                </div>

                {isClosedContext && (
                  <div className="mt-3 rounded-card border border-settled/35 bg-settled-dim/20 p-3 flex items-center justify-between gap-3">
                    <p className="text-fac-meta text-text-primary">
                      This decision context is closed and read-only. Open a fresh context to
                      continue the meeting.
                    </p>
                    <button
                      onClick={openCreateContextDialog}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-white text-fac-meta hover:bg-accent/90"
                    >
                      <FilePlus2 size={13} />
                      Open fresh context
                    </button>
                  </div>
                )}

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
                      disabled={isClosedContext}
                      className="px-2 py-1.5 rounded border border-border bg-overlay text-fac-meta text-text-primary focus:outline-none focus:border-accent"
                    >
                      {RELATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setModal({ type: "add-relation-context" })}
                      disabled={isClosedContext}
                      className="inline-flex items-center gap-1 text-fac-meta text-accent hover:text-accent/80 disabled:opacity-40"
                    >
                      <Link2 size={13} />
                      Add relation
                    </button>
                  </div>

                  {activeContext.relations.length > 0 && (
                    <RelationsAccordion
                      relations={activeContext.relations}
                      className="mt-2"
                      onRemoveRelation={isClosedContext ? undefined : handleRemoveRelation}
                    />
                  )}
                </div>
              </div>

              {/* Hint */}
              <div className="flex items-start gap-2 p-3 rounded-card border border-accent/20 bg-accent-dim/10 mb-5">
                <Lightbulb size={14} className="text-accent shrink-0 mt-0.5" />
                <p className="text-fac-meta text-text-secondary">
                  Click the zoom icon on any field to edit content, regenerate the field, add
                  guidance, or paste supplementary evidence.
                </p>
              </div>

              {/* Field cards */}
              <div className="flex flex-col gap-4">
                {fields.map((field) => (
                  <FacilitatorFieldCard
                    key={field.id}
                    field={field}
                    onLock={isClosedContext ? undefined : handleLock}
                    onUnlock={isClosedContext ? undefined : handleUnlock}
                    onRegenerate={isClosedContext ? undefined : handleRegenerateSingleField}
                    onZoom={isClosedContext ? undefined : setZoomedFieldId}
                    supplementaryCount={
                      supplementary.filter((s) => s.scope === "field" && s.fieldId === field.id)
                        .length
                    }
                  />
                ))}
              </div>
            </>
          )}
        </main>

        {!rightPanelCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize LLM log sidebar"
            onMouseDown={(event) =>
              setDragState({
                side: "right",
                startX: event.clientX,
                startWidth: rightPanelWidth,
              })
            }
            className={`w-1.5 shrink-0 cursor-col-resize bg-border/40 hover:bg-accent/40 transition-colors ${
              dragState?.side === "right" ? "bg-accent/50" : ""
            }`}
          />
        )}

        {!rightPanelCollapsed ? (
          <aside
            className="shrink-0 border-l border-border bg-surface flex flex-col"
            style={{ width: `${rightPanelWidth}px` }}
          >
            <div className="flex items-center border-b border-border">
              <button
                onClick={() => setShowLLMLog((v) => !v)}
                className="flex-1 flex items-center gap-2 px-4 py-3 text-fac-meta text-text-secondary hover:text-text-primary"
              >
                {showLLMLog ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                LLM interaction log
              </button>
              <button
                onClick={() => setRightPanelCollapsed(true)}
                className="shrink-0 px-2 text-text-muted hover:text-text-primary border-l border-border"
                aria-label="Collapse LLM log sidebar"
                title="Collapse LLM log sidebar"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {showLLMLog && (
              <div className="p-3 flex flex-col gap-2 overflow-y-auto">
                {llmLog.length === 0 ? (
                  <p className="text-fac-meta text-text-muted">
                    No LLM interactions recorded for this context yet.
                  </p>
                ) : (
                  <>
                    {llmLog.map((entry) => {
                      const totalTokens =
                        (entry.tokenCount?.input ?? 0) + (entry.tokenCount?.output ?? 0);
                      const createdAt = new Date(entry.createdAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const isSelected = selectedLlmInteractionId === entry.id;

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setSelectedLlmInteractionId(entry.id)}
                          className={`rounded-card border p-3 bg-overlay/30 text-left ${
                            isSelected ? "border-accent bg-accent/10" : "border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-fac-meta text-text-primary font-medium">
                              {entry.operation}
                            </span>
                            <span className="text-fac-meta text-text-muted">{createdAt}</span>
                          </div>
                          <p className="text-fac-meta text-text-muted mt-1">
                            {entry.provider}/{entry.model}
                          </p>
                          <p className="text-fac-meta text-text-secondary mt-2">
                            {totalTokens} tokens · {entry.latencyMs ?? 0}ms
                          </p>
                        </button>
                      );
                    })}

                    {selectedLlmInteraction && (
                      <article className="rounded-card border border-border p-3 bg-background">
                        <div className="flex items-center justify-between">
                          <h3 className="text-fac-meta font-medium text-text-primary">
                            Selected interaction
                          </h3>
                          <span className="text-fac-meta text-text-muted">
                            {new Date(selectedLlmInteraction.createdAt).toLocaleString("en-GB")}
                          </span>
                        </div>
                        <p className="text-fac-meta text-text-secondary mt-1">
                          {selectedLlmInteraction.operation} · {selectedLlmInteraction.provider}/
                          {selectedLlmInteraction.model}
                        </p>

                        <h4 className="mt-3 text-fac-meta font-medium text-text-primary">Prompt</h4>
                        <pre className="mt-1 max-h-56 overflow-auto rounded border border-border bg-overlay/20 p-2 text-xs text-text-secondary whitespace-pre-wrap">
                          {selectedLlmInteraction.promptText}
                        </pre>

                        <h4 className="mt-3 text-fac-meta font-medium text-text-primary">
                          Response
                        </h4>
                        <pre className="mt-1 max-h-56 overflow-auto rounded border border-border bg-overlay/20 p-2 text-xs text-text-secondary whitespace-pre-wrap">
                          {selectedLlmInteraction.responseText}
                        </pre>
                      </article>
                    )}
                  </>
                )}
              </div>
            )}
          </aside>
        ) : (
          <div className="w-8 shrink-0 border-l border-border bg-surface flex items-start justify-center pt-2">
            <button
              onClick={() => setRightPanelCollapsed(false)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-overlay"
              aria-label="Expand LLM log sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
