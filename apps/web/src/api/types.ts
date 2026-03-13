// ── API response type interfaces ──────────────────────────────────
// These mirror the shapes returned by apps/api/. No Zod — the web
// layer does not import from packages/schema.

export type MeetingStatus = "proposed" | "in_session" | "ended";

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  status: MeetingStatus;
  createdAt: string;
}

export interface MeetingSummary {
  decisionCount: number;
  draftCount: number;
  loggedCount: number;
}

// Base flagged decision (returned by POST / single-item endpoints)
export interface FlaggedDecision {
  id: string;
  meetingId: string;
  suggestedTitle: string;
  contextSummary: string;
  confidence: number;
  chunkIds: string[];
  suggestedTemplateId: string | null;
  templateConfidence: number | null;
  status: "pending" | "accepted" | "rejected" | "dismissed";
  priority: number;
  createdAt: string;
  updatedAt: string;
}

// Enriched version returned by GET /api/meetings/:id/flagged-decisions
export interface FlaggedDecisionListItem extends FlaggedDecision {
  contextId: string | null;
  contextStatus: string | null;
  hasDraft: boolean;
  draftFieldCount: number;
  versionCount: number;
}

export interface DecisionContext {
  id: string;
  meetingId: string;
  flaggedDecisionId: string | null;
  title: string;
  templateId: string;
  activeField: string | null;
  lockedFields: string[];
  draftData: Record<string, string>;
  draftVersions: Array<{
    version: number;
    data: Record<string, string>;
    savedAt: string;
  }>;
  status: "drafting" | "reviewing" | "locked" | "logged";
  createdAt: string;
  updatedAt: string;
}

export interface DecisionField {
  id: string;
  namespace: string;
  name: string;
  description: string;
  instructions?: string;
  category: string;
  extractionPrompt: string;
  fieldType: string;
  placeholder: string;
  validationRules: Record<string, unknown> | null;
  version: number;
  isCustom: boolean;
  createdAt: string;
}

export interface DecisionTemplate {
  id: string;
  namespace: string;
  name: string;
  description: string;
  category: string;
  version: number;
  isDefault: boolean;
  isCustom: boolean;
  createdAt: string;
}

export interface DecisionContextPickerItem {
  id: string;
  contextId: string;
  meetingId: string;
  title: string;
  templateName: string;
  status: "open" | "deferred" | "logged";
  sourceMeetingTitle: string;
  sourceMeetingDate: string;
  sourceMeetingTags: string[];
}

export interface DecisionLog {
  id: string;
  meetingId: string;
  decisionContextId: string;
  templateId: string;
  templateVersion: number;
  fields: Record<string, string>;
  decisionMethod: {
    type: string;
    details?: string;
  };
  sourceChunkIds: string[];
  loggedAt: string;
  loggedBy: string;
}

export interface DecisionFeedback {
  id: string;
  decisionContextId: string;
  fieldId: string | null;
  draftVersionNumber: number | null;
  fieldVersionId: string | null;
  rating: "approved" | "needs_work" | "rejected";
  source: "user" | "expert_agent" | "peer_user";
  authorId: string;
  comment: string;
  textReference: string | null;
  referenceId: string | null;
  referenceUrl: string | null;
  excludeFromRegeneration: boolean;
  createdAt: string;
}

export interface LLMInteraction {
  id: string;
  decisionContextId: string;
  fieldId: string | null;
  operation: string;
  promptSegments: Array<
    | { type: "system"; content: string }
    | { type: "transcript"; speaker?: string; text: string; tags: string[] }
    | { type: "supplementary"; label?: string; content: string; tags: string[] }
    | {
        type: "template_guidance";
        scope: "template" | "field";
        templateId: string;
        fieldId: string | null;
        label: string;
        content: string;
      }
    | {
        type: "feedback";
        id: string;
        decisionContextId: string;
        fieldId: string | null;
        draftVersionNumber: number | null;
        fieldVersionId: string | null;
        rating: "approved" | "needs_work" | "rejected";
        source: "user" | "expert_agent" | "peer_user";
        authorId: string;
        content: string;
        comment: string;
        textReference: string | null;
        referenceId: string | null;
        referenceUrl: string | null;
        excludeFromRegeneration: boolean;
        createdAt: string;
      }
    | {
        type: "template_fields";
        fields: Array<{
          id: string;
          displayName: string;
          description: string;
          extractionPrompt: string;
        }>;
      }
  >;
  promptText: string;
  responseText: string;
  parsedResult: unknown;
  provider: string;
  model: string;
  latencyMs: number;
  tokenCount: { input: number; output: number } | null;
  createdAt: string;
}

export interface TranscriptChunk {
  id: string;
  meetingId: string;
  rawTranscriptId: string;
  sequenceNumber: number;
  text: string;
  speaker: string | null;
  startTime: string | null;
  endTime: string | null;
  chunkStrategy: string;
  tokenCount: number;
  wordCount: number;
  contexts: string[];
  topics: string[];
  createdAt: string;
}

export interface ReadableTranscriptRow {
  id: string;
  meetingId: string;
  sequenceNumber: number;
  displayText: string;
  chunkIds: string[];
  speaker: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface AssignTranscriptChunksResponse {
  chunks: TranscriptChunk[];
}

export interface SupplementaryContent {
  id: string;
  meetingId: string;
  label: string;
  body: string;
  sourceType: string;
  contexts: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface GlobalContext {
  activeMeetingId?: string;
  activeDecisionId?: string;
  activeDecisionContextId?: string;
  activeField?: string;
  activeMeeting?: Meeting;
  activeDecision?: FlaggedDecision;
  activeDecisionContext?: DecisionContext;
  activeTemplate?: DecisionTemplate;
}

export interface InSessionMeetingsContextSummary {
  currentContext: GlobalContext;
  inSessionMeetings: Meeting[];
}

export interface ApiStatus {
  status: "ok";
  timestamp: string;
  nodeEnv: string;
  databaseConfigured: boolean;
  llm: {
    mode: "mock" | "real";
    provider: string;
    model: string;
  };
}
