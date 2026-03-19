// ── API client ────────────────────────────────────────────────────
// Thin fetch wrapper. All API calls go through apiFetch<T>().

export const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

const CONNECTION_ID_KEY = "connectionId";

export function getConnectionId(): string | null {
  return localStorage.getItem(CONNECTION_ID_KEY);
}

function storeConnectionId(id: string): void {
  localStorage.setItem(CONNECTION_ID_KEY, id);
  // Expose for console debugging: window.__decisionLogger.connectionId
  const w = window as unknown as Record<string, unknown>;
  w.__decisionLogger = { ...(w.__decisionLogger as object | undefined), connectionId: id };
}

/**
 * Resolves the connection ID to use for this browser session.
 *
 * Priority:
 * 1. Already stored in localStorage → use it
 * 2. GET /api/connections?limit=1 → use most recent
 * 3. POST /api/connections → create new
 *
 * Subsequent calls return the cached value without API calls.
 */
let _initPromise: Promise<string> | null = null;

export async function initConnection(): Promise<string> {
  const stored = getConnectionId();
  if (stored) {
    storeConnectionId(stored); // ensure window.__decisionLogger is set even for cached IDs
    return stored;
  }

  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // Try to find existing connection
    const listRes = await fetch(`${BASE_URL}/api/connections?limit=1`);
    if (listRes.ok) {
      const { connections } = await listRes.json();
      if (connections && connections.length > 0) {
        storeConnectionId(connections[0].id);
        return connections[0].id as string;
      }
    }

    // Create new connection
    const createRes = await fetch(`${BASE_URL}/api/connections`, { method: "POST" });
    if (!createRes.ok) throw new Error("Failed to create connection");
    const conn = await createRes.json();
    storeConnectionId(conn.id);
    return conn.id as string;
  })().finally(() => {
    _initPromise = null;
  });

  return _initPromise;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const connectionId = getConnectionId();

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(connectionId ? { "X-Connection-ID": connectionId } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message: string =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}

/** Convenience helper for mutations with a JSON body. */
export function jsonBody(data: unknown): RequestInit {
  return {
    body: JSON.stringify(data),
  };
}
