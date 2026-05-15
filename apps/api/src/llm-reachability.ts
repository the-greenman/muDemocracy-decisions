/**
 * Determines whether the configured LLM summariser is usable right now.
 *
 * Strategy:
 *   - Local/openai-compatible providers (ollama, openai-compatible): HTTP GET
 *     `${baseUrl}/models` with a short timeout. These endpoints are cheap,
 *     unauthenticated, and expose the same models the summariser will call.
 *   - Hosted providers (openai, anthropic): treat as reachable iff the
 *     corresponding API key env is set. We deliberately skip a network probe
 *     to avoid surprise usage costs and rate-limit noise.
 *   - Mock mode: always reachable.
 *
 * Results are cached in-memory for `CACHE_TTL_MS` so that frequent polling
 * of `/api/status` (e.g. from the web status bar) does not hammer providers.
 */

export type LlmReachability = {
  reachable: boolean;
  latencyMs?: number;
  error?: string;
  baseUrl?: string;
};

type LlmEnv = {
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  anthropicKey?: string;
  openaiKey?: string;
  mockMode: boolean;
};

const CACHE_TTL_MS = 10_000;
const PROBE_TIMEOUT_MS = 2_000;

type CacheEntry = { key: string; at: number; value: LlmReachability };
let cached: CacheEntry | undefined;

function defaultBaseUrlFor(provider: string): string {
  return provider === "ollama" ? "http://localhost:11434/v1" : "http://localhost:8080/v1";
}

function readLlmEnv(): LlmEnv {
  const provider = process.env["LLM_PROVIDER"] ?? "anthropic";
  const mockMode =
    process.env["NODE_ENV"] === "test" || process.env["USE_MOCK_LLM"] === "true";
  const isLocal = provider === "ollama" || provider === "openai-compatible";
  const baseUrl = isLocal
    ? process.env["LLM_BASE_URL"] ?? defaultBaseUrlFor(provider)
    : undefined;
  const apiKey = process.env["LLM_API_KEY"];
  const anthropicKey = process.env["ANTHROPIC_API_KEY"];
  const openaiKey = process.env["OPENAI_API_KEY"];
  return {
    provider,
    mockMode,
    ...(baseUrl !== undefined && { baseUrl }),
    ...(apiKey !== undefined && { apiKey }),
    ...(anthropicKey !== undefined && { anthropicKey }),
    ...(openaiKey !== undefined && { openaiKey }),
  };
}

function cacheKey(env: LlmEnv): string {
  return [
    env.mockMode ? "mock" : "real",
    env.provider,
    env.baseUrl ?? "-",
    env.anthropicKey ? "a1" : "a0",
    env.openaiKey ? "o1" : "o0",
  ].join("|");
}

async function probeHttp(
  baseUrl: string,
  signal: AbortSignal,
  apiKey?: string,
): Promise<LlmReachability> {
  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  const start = Date.now();
  const headers: HeadersInit = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  try {
    const response = await fetch(url, { method: "GET", signal, headers });
    const latencyMs = Date.now() - start;
    if (!response.ok) {
      return {
        reachable: false,
        latencyMs,
        baseUrl,
        error: `HTTP ${response.status} from ${url}`,
      };
    }
    return { reachable: true, latencyMs, baseUrl };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      reachable: false,
      latencyMs,
      baseUrl,
      error: isTimeout ? `Timed out after ${PROBE_TIMEOUT_MS}ms probing ${url}` : message,
    };
  }
}

async function computeReachability(env: LlmEnv): Promise<LlmReachability> {
  if (env.mockMode) {
    return { reachable: true };
  }

  if (env.provider === "ollama" || env.provider === "openai-compatible") {
    const baseUrl = env.baseUrl ?? defaultBaseUrlFor(env.provider);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      return await probeHttp(baseUrl, controller.signal, env.apiKey);
    } finally {
      clearTimeout(timer);
    }
  }

  if (env.provider === "openai") {
    return env.openaiKey
      ? { reachable: true }
      : { reachable: false, error: "OPENAI_API_KEY is not set" };
  }

  // Default: anthropic (current default when LLM_PROVIDER is unset).
  return env.anthropicKey
    ? { reachable: true }
    : { reachable: false, error: "ANTHROPIC_API_KEY is not set" };
}

/**
 * Returns the reachability of the currently-configured LLM summariser,
 * using a short in-memory cache so callers can poll cheaply.
 */
export async function getLlmReachability(now: number = Date.now()): Promise<LlmReachability> {
  const env = readLlmEnv();
  const key = cacheKey(env);
  if (cached && cached.key === key && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await computeReachability(env);
  cached = { key, at: now, value };
  return value;
}

/** Reset the in-memory cache. Intended for tests. */
export function resetLlmReachabilityCache(): void {
  cached = undefined;
}
