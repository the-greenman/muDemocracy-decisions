// ── API client ────────────────────────────────────────────────────
// Thin fetch wrapper. All API calls go through apiFetch<T>().

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

// Get or generate connection ID from localStorage
function getConnectionId(): string {
  const stored = localStorage.getItem("connectionId");
  if (stored) {
    return stored;
  }
  // Generate a new UUID if none exists
  const newId = crypto.randomUUID();
  localStorage.setItem("connectionId", newId);
  return newId;
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

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Connection-ID": getConnectionId(),
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
