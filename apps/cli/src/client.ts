import { logHttpRequest, logHttpResponse } from "./runtime.js";

const BASE_URL =
  process.env.DECISION_LOGGER_API_URL ?? process.env.API_BASE_URL ?? "http://localhost:3001";

/**
 * Resolve the connection ID to use for this CLI session.
 *
 * Priority:
 * 1. DECISION_LOGGER_CONNECTION_ID env var
 * 2. GET /api/connections?limit=1 → most recent connection
 * 3. POST /api/connections → create new
 */
async function resolveConnectionId(): Promise<string> {
  if (process.env.DECISION_LOGGER_CONNECTION_ID) {
    return process.env.DECISION_LOGGER_CONNECTION_ID;
  }

  // Bootstrap without X-Connection-ID header (these endpoints don't require it)
  const listRes = await fetch(`${BASE_URL}/api/connections?limit=1`);
  if (listRes.ok) {
    const data = (await listRes.json()) as { connections: Array<{ id: string }> };
    if (data.connections.length > 0 && data.connections[0]) return data.connections[0].id;
  }

  const createRes = await fetch(`${BASE_URL}/api/connections`, { method: "POST" });
  if (!createRes.ok) throw new Error("Failed to create connection");
  const conn = (await createRes.json()) as { id: string };
  return conn.id;
}

// Initialised synchronously from env var; bootstrapped lazily on first request if absent
let _connectionId: string | null = process.env.DECISION_LOGGER_CONNECTION_ID ?? null;

async function getConnectionId(): Promise<string> {
  if (!_connectionId) _connectionId = await resolveConnectionId();
  return _connectionId;
}

/** Returns the connection ID once it has been resolved (safe to call after any api.* call). */
export function resolvedConnectionId(): string | null {
  return _connectionId;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const init: RequestInit = { method };
  // Use sync value when available to avoid microtask delay on already-cached ID
  const connectionId = _connectionId ?? (await getConnectionId());
  const headers: Record<string, string> = { "X-Connection-ID": connectionId };
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
