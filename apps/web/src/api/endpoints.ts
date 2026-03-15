// ── API endpoint functions ────────────────────────────────────────
// One typed function per API endpoint. Paths verified against
// apps/api/src/routes/*.ts route definitions.

import { apiFetch, jsonBody } from "./client.js";
import type {
  AssignTranscriptChunksResponse,
  InSessionMeetingsContextSummary,
  DecisionContext,
  DecisionField,
  DecisionTemplate,
  ExportTemplate,
  FlaggedDecision,
  FlaggedDecisionListItem,
  DecisionLog,
  DecisionFeedback,
  LLMInteraction,
  Meeting,
  MeetingSummary,
  ApiStatus,
  ReadableTranscriptRow,
  SupplementaryContent,
  TranscriptChunk,
  GlobalContext,
} from "./types.js";

// ── Meetings ──────────────────────────────────────────────────────

export function listMeetings() {
  return apiFetch<{ meetings: Meeting[] }>("/api/meetings");
}

export function getMeeting(id: string) {
  return apiFetch<Meeting>(`/api/meetings/${id}`);
}

export function getApiStatus() {
  return apiFetch<ApiStatus>("/api/status");
}

export function createMeeting(body: { title: string; date: string; participants?: string[] }) {
  return apiFetch<Meeting>("/api/meetings", { method: "POST", ...jsonBody(body) });
}

export function updateMeeting(
  id: string,
  body: {
    title?: string;
    date?: string;
    participants?: string[];
    status?: "proposed" | "in_session" | "ended";
  },
) {
  return apiFetch<Meeting>(`/api/meetings/${id}`, { method: "PATCH", ...jsonBody(body) });
}

export function deleteMeeting(id: string) {
  return apiFetch<void>(`/api/meetings/${id}`, { method: "DELETE" });
}

export function getMeetingSummary(id: string) {
  return apiFetch<MeetingSummary>(`/api/meetings/${id}/summary`);
}

export function listMeetingDecisionContexts(id: string) {
  return apiFetch<{ contexts: DecisionContext[] }>(`/api/meetings/${id}/decision-contexts`);
}

export function getTranscriptReading(meetingId: string) {
  return apiFetch<{ rows: ReadableTranscriptRow[] }>(
    `/api/meetings/${meetingId}/transcript-reading`,
  );
}

export function listMeetingChunks(meetingId: string) {
  return apiFetch<{ chunks: TranscriptChunk[] }>(`/api/meetings/${meetingId}/chunks`);
}

export function uploadTranscript(
  meetingId: string,
  body: {
    content: string;
    format: "json" | "txt" | "vtt" | "srt";
    chunkStrategy: "fixed" | "semantic" | "speaker" | "streaming";
    chunkSize?: number;
    overlap?: number;
    uploadedBy?: string;
  },
) {
  return apiFetch<{ transcript: unknown; chunks: TranscriptChunk[] }>(
    `/api/meetings/${meetingId}/transcripts/upload`,
    { method: "POST", ...jsonBody(body) },
  );
}

// ── Flagged Decisions ─────────────────────────────────────────────

export function listFlaggedDecisions(meetingId: string, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<{ decisions: FlaggedDecisionListItem[] }>(
    `/api/meetings/${meetingId}/flagged-decisions${qs}`,
  );
}

export function createFlaggedDecision(
  meetingId: string,
  body: {
    suggestedTitle: string;
    contextSummary: string;
    confidence: number;
    chunkIds: string[];
    priority: number;
    suggestedTemplateId?: string;
    templateConfidence?: number;
  },
) {
  return apiFetch<FlaggedDecision>(`/api/meetings/${meetingId}/flagged-decisions`, {
    method: "POST",
    ...jsonBody(body),
  });
}

export function updateFlaggedDecision(
  id: string,
  body: {
    suggestedTitle?: string;
    contextSummary?: string;
    status?: "pending" | "accepted" | "rejected" | "dismissed";
    priority?: number;
    chunkIds?: string[];
  },
) {
  return apiFetch<FlaggedDecision>(`/api/flagged-decisions/${id}`, {
    method: "PATCH",
    ...jsonBody(body),
  });
}

export function deleteFlaggedDecision(id: string) {
  return apiFetch<void>(`/api/flagged-decisions/${id}`, { method: "DELETE" });
}

export function getFlaggedDecisionContext(flaggedDecisionId: string) {
  return apiFetch<DecisionContext>(`/api/flagged-decisions/${flaggedDecisionId}/context`);
}

// ── Decision Contexts ─────────────────────────────────────────────

export function createDecisionContext(body: {
  meetingId: string;
  flaggedDecisionId?: string | null;
  title: string;
  templateId: string;
  draftData?: Record<string, string>;
  activeField?: string | null;
}) {
  return apiFetch<DecisionContext>("/api/decision-contexts", {
    method: "POST",
    ...jsonBody(body),
  });
}

export function getDecisionContext(id: string) {
  return apiFetch<DecisionContext>(`/api/decision-contexts/${id}`);
}

export function updateDecisionContext(
  id: string,
  body: { title?: string; activeField?: string; templateId?: string },
) {
  return apiFetch<DecisionContext>(`/api/decision-contexts/${id}`, {
    method: "PATCH",
    ...jsonBody(body),
  });
}

/** POST /api/decision-contexts/:id/template-change */
export function changeDecisionContextTemplate(id: string, templateId: string) {
  return apiFetch<DecisionContext>(`/api/decision-contexts/${id}/template-change`, {
    method: "POST",
    ...jsonBody({ templateId }),
  });
}

export function generateDraft(id: string) {
  return apiFetch<DecisionContext>(`/api/decision-contexts/${id}/generate-draft`, {
    method: "POST",
    ...jsonBody({}),
  });
}

/** POST /api/decision-contexts/:id/regenerate */
export function regenerateDraft(id: string) {
  return apiFetch<DecisionContext>(`/api/decision-contexts/${id}/regenerate`, {
    method: "POST",
    ...jsonBody({}),
  });
}

export function regenerateField(contextId: string, fieldId: string) {
  return apiFetch<{ value: string }>(
    `/api/decision-contexts/${contextId}/fields/${fieldId}/regenerate`,
    { method: "POST", ...jsonBody({}) },
  );
}

export function createDecisionFeedback(
  contextId: string,
  body: {
    fieldId?: string | null;
    draftVersionNumber?: number | null;
    fieldVersionId?: string | null;
    rating: "approved" | "needs_work" | "rejected";
    source: "user" | "expert_agent" | "peer_user";
    authorId: string;
    comment: string;
    textReference?: string | null;
    referenceId?: string | null;
    referenceUrl?: string | null;
    excludeFromRegeneration?: boolean;
  },
) {
  return apiFetch<DecisionFeedback>(`/api/decision-contexts/${contextId}/feedback`, {
    method: "POST",
    ...jsonBody(body),
  });
}

export function listDecisionFeedback(contextId: string) {
  return apiFetch<{ items: DecisionFeedback[] }>(`/api/decision-contexts/${contextId}/feedback`);
}

export function listFieldDecisionFeedback(contextId: string, fieldId: string) {
  return apiFetch<{ items: DecisionFeedback[] }>(
    `/api/decision-contexts/${contextId}/feedback/field/${fieldId}`,
  );
}

export function getFieldTranscriptChunks(contextId: string, fieldId: string) {
  return apiFetch<{ chunks: TranscriptChunk[] }>(
    `/api/decision-contexts/${contextId}/fields/${fieldId}/transcript`,
  );
}

export function assignDecisionTranscriptChunks(contextId: string, chunkIds: string[]) {
  return apiFetch<AssignTranscriptChunksResponse>(
    `/api/decision-contexts/${contextId}/transcript/context`,
    {
      method: "POST",
      ...jsonBody({ chunkIds }),
    },
  );
}

export function assignFieldTranscriptChunks(
  contextId: string,
  fieldId: string,
  chunkIds: string[],
) {
  return apiFetch<AssignTranscriptChunksResponse>(
    `/api/decision-contexts/${contextId}/fields/${fieldId}/transcript/context`,
    {
      method: "POST",
      ...jsonBody({ chunkIds }),
    },
  );
}

/** PATCH /api/decision-contexts/:id/fields/:fieldId */
export function updateFieldValue(contextId: string, fieldId: string, value: string) {
  return apiFetch<DecisionContext>(`/api/decision-contexts/${contextId}/fields/${fieldId}`, {
    method: "PATCH",
    ...jsonBody({ value }),
  });
}

/** PUT /api/decision-contexts/:id/lock-field */
export function lockField(contextId: string, fieldId: string) {
  return apiFetch<DecisionContext>(`/api/decision-contexts/${contextId}/lock-field`, {
    method: "PUT",
    ...jsonBody({ fieldId }),
  });
}

/** DELETE /api/decision-contexts/:id/lock-field */
export function unlockField(contextId: string, fieldId: string) {
  return apiFetch<DecisionContext>(`/api/decision-contexts/${contextId}/lock-field`, {
    method: "DELETE",
    ...jsonBody({ fieldId }),
  });
}

export function listDraftVersions(contextId: string) {
  return apiFetch<{
    versions: Array<{ version: number; fieldCount: number; savedAt: string }>;
  }>(`/api/decision-contexts/${contextId}/versions`);
}

export function rollbackDraft(contextId: string, version: number) {
  return apiFetch<DecisionContext>(`/api/decision-contexts/${contextId}/rollback`, {
    method: "POST",
    ...jsonBody({ version }),
  });
}

export function logDecision(
  contextId: string,
  body: { loggedBy: string; decisionMethod: { type: string; details?: string } },
) {
  return apiFetch<DecisionLog>(`/api/decision-contexts/${contextId}/log`, {
    method: "POST",
    ...jsonBody(body),
  });
}

export function exportMarkdown(
  contextId: string,
  options?: {
    exportTemplateId?: string;
  },
) {
  const params = new URLSearchParams();
  if (options?.exportTemplateId) {
    params.set("exportTemplateId", options.exportTemplateId);
  }
  const query = params.toString();
  return apiFetch<{ markdown: string }>(
    `/api/decision-contexts/${contextId}/export/markdown${query ? `?${query}` : ""}` ,
  );
}

export function listLLMInteractions(contextId: string) {
  return apiFetch<{ interactions: LLMInteraction[] }>(
    `/api/decision-contexts/${contextId}/llm-interactions`,
  );
}

// ── Decision Logs ─────────────────────────────────────────────────

/** GET /api/decisions/:id */
export function getDecisionLog(id: string) {
  return apiFetch<DecisionLog>(`/api/decisions/${id}`);
}

/** GET /api/decisions/:id/export?format=markdown|json */
export function exportDecisionLog(id: string, format: "markdown" | "json") {
  return apiFetch<{ format: string; content: unknown }>(
    `/api/decisions/${id}/export?format=${format}`,
  );
}

// ── Templates ─────────────────────────────────────────────────────

export function listTemplates() {
  return apiFetch<{ templates: DecisionTemplate[] }>("/api/templates");
}

export function getTemplateFields(templateId: string) {
  return apiFetch<{ fields: DecisionField[] }>(`/api/templates/${templateId}/fields`);
}

export function listTemplateExportTemplates(templateId: string) {
  return apiFetch<{ exportTemplates: ExportTemplate[] }>(
    `/api/templates/${templateId}/export-templates`,
  );
}

// ── Supplementary Content ─────────────────────────────────────────

export function createSupplementaryContent(body: {
  meetingId: string;
  body: string;
  label?: string;
  contexts?: string[];
  sourceType?: string;
  createdBy?: string;
}) {
  return apiFetch<SupplementaryContent>("/api/supplementary-content", {
    method: "POST",
    ...jsonBody(body),
  });
}

export function listSupplementaryContent(contextTag: string) {
  return apiFetch<{ items: SupplementaryContent[] }>(
    `/api/supplementary-content?context=${encodeURIComponent(contextTag)}`,
  );
}

export function deleteSupplementaryContent(id: string) {
  return apiFetch<void>(`/api/supplementary-content/${id}`, { method: "DELETE" });
}

// ── Global Context ────────────────────────────────────────────────

export function getGlobalContext() {
  return apiFetch<GlobalContext>("/api/context");
}

export function getInSessionMeetingsContextSummary() {
  return apiFetch<InSessionMeetingsContextSummary>("/api/context/in-session-meetings");
}

export function setActiveMeeting(meetingId: string) {
  return apiFetch<GlobalContext>("/api/context/meeting", {
    method: "POST",
    ...jsonBody({ meetingId }),
  });
}

export function setActiveDecision(
  meetingId: string,
  flaggedDecisionId: string,
  templateId?: string,
) {
  return apiFetch<GlobalContext>(`/api/meetings/${meetingId}/context/decision`, {
    method: "POST",
    ...jsonBody({ flaggedDecisionId, templateId }),
  });
}

export function setActiveField(meetingId: string, fieldId: string) {
  return apiFetch<GlobalContext>(`/api/meetings/${meetingId}/context/field`, {
    method: "POST",
    ...jsonBody({ fieldId }),
  });
}

export function clearActiveField(meetingId: string) {
  return apiFetch<GlobalContext>(`/api/meetings/${meetingId}/context/field`, {
    method: "DELETE",
    ...jsonBody({}),
  });
}

export function clearActiveDecision(meetingId: string) {
  return apiFetch<GlobalContext>(`/api/meetings/${meetingId}/context/decision`, {
    method: "DELETE",
    ...jsonBody({}),
  });
}
