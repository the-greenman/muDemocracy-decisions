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
  const res = await fetch(url, init);
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
    };
    const { error } = payload;
    const message =
      error == null
        ? `HTTP ${res.status} ${res.statusText}`
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
