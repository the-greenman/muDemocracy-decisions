import { logHttpRequest, logHttpResponse } from "./runtime.js";

const BASE_URL =
  process.env.DECISION_LOGGER_API_URL ?? process.env.API_BASE_URL ?? "http://localhost:3001";

const CONNECTION_ID = process.env.DECISION_LOGGER_CONNECTION_ID;
if (!CONNECTION_ID) {
  throw new Error(
    "DECISION_LOGGER_CONNECTION_ID is required. Generate a UUID and add it to your .env file.",
  );
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const init: RequestInit = { method };
  const headers: Record<string, string> = { "X-Connection-ID": CONNECTION_ID as string };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  init.headers = headers;
  logHttpRequest(method, url, body);
  const res = await fetch(url, init);
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    await logHttpResponse(res.status, url, payload);
    throw new Error(payload.error ?? `HTTP ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  const payload = (await res.json()) as T;
  await logHttpResponse(res.status, url, payload);
  return payload;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

export interface GlobalContext {
  activeMeetingId?: string;
  activeDecisionId?: string;
  activeDecisionContextId?: string;
  activeField?: string;
  activeMeeting?: Meeting;
  activeDecision?: FlaggedDecision;
  activeDecisionContext?: DecisionContext;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  status: string;
  createdAt: string;
}

export interface FlaggedDecision {
  id: string;
  meetingId: string;
  suggestedTitle: string;
  contextSummary?: string;
  confidence: number;
  priority: number;
  status: string;
  chunkIds?: string[];
  suggestedTemplateId?: string;
  createdAt: string;
}

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
  flaggedDecisionId: string;
  templateId: string;
  title: string;
  status: string;
  draftData?: Record<string, unknown>;
  lockedFields?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DecisionField {
  id: string;
  name: string;
  fieldType: string;
  description?: string;
  required?: boolean;
  order?: number;
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

export interface DecisionLog {
  id: string;
  meetingId: string;
  decisionContextId: string;
  templateId: string;
  templateVersion: number;
  fields: Record<string, unknown>;
  decisionMethod: { type: string; details?: string };
  loggedBy: string;
  loggedAt: string;
}

export interface DecisionExportResponse {
  format: "json" | "markdown";
  content: DecisionLog | string;
}

export interface ApiStatusResponse {
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

export async function getContext(): Promise<GlobalContext> {
  return api.get<GlobalContext>("/api/context");
}

export async function requireActiveMeeting(): Promise<string> {
  const ctx = await getContext();
  if (!ctx.activeMeetingId) {
    throw new Error("No active meeting. Run: context set-meeting <id>");
  }
  return ctx.activeMeetingId;
}

export async function requireActiveDecisionContext(): Promise<{
  contextId: string;
  meetingId: string;
}> {
  const ctx = await getContext();
  if (!ctx.activeDecisionContextId) {
    throw new Error("No active decision context. Run: context set-decision <flagged-decision-id>");
  }
  if (!ctx.activeMeetingId) {
    throw new Error("No active meeting. Run: context set-meeting <id>");
  }
  return { contextId: ctx.activeDecisionContextId, meetingId: ctx.activeMeetingId };
}
