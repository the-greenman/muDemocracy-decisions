import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLlmReachability,
  resetLlmReachabilityCache,
} from "../llm-reachability.js";

/**
 * Snapshots the LLM-relevant env vars so we can mutate them freely inside each
 * test and restore afterwards. The repo test setup hardcodes USE_MOCK_LLM=true,
 * which short-circuits the probe; most tests need to clear it first.
 */
const LLM_ENV_KEYS = [
  "NODE_ENV",
  "USE_MOCK_LLM",
  "LLM_PROVIDER",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
] as const;

describe("getLlmReachability", () => {
  let savedEnv: Record<string, string | undefined>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of LLM_ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    resetLlmReachabilityCache();
  });

  afterEach(() => {
    for (const key of LLM_ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllGlobals();
    resetLlmReachabilityCache();
  });

  it("returns reachable=true without probing when USE_MOCK_LLM is set", async () => {
    process.env.USE_MOCK_LLM = "true";
    process.env.LLM_PROVIDER = "ollama";

    const result = await getLlmReachability();

    expect(result).toEqual({ reachable: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("probes GET {baseUrl}/models for ollama and returns reachable + latencyMs + baseUrl", async () => {
    process.env.LLM_PROVIDER = "ollama";
    process.env.LLM_BASE_URL = "http://ollama:11434/v1";
    fetchSpy.mockResolvedValue({ ok: true, status: 200 });

    const result = await getLlmReachability();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://ollama:11434/v1/models",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.reachable).toBe(true);
    expect(result.baseUrl).toBe("http://ollama:11434/v1");
    expect(typeof result.latencyMs).toBe("number");
    expect(result.error).toBeUndefined();
  });

  it("falls back to a sensible default baseUrl when LLM_BASE_URL is unset (ollama)", async () => {
    process.env.LLM_PROVIDER = "ollama";
    fetchSpy.mockResolvedValue({ ok: true, status: 200 });

    const result = await getLlmReachability();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:11434/v1/models",
      expect.anything(),
    );
    expect(result.baseUrl).toBe("http://localhost:11434/v1");
  });

  it("reports reachable=false with HTTP status when the probe returns a non-2xx", async () => {
    process.env.LLM_PROVIDER = "ollama";
    process.env.LLM_BASE_URL = "http://ollama:11434/v1";
    fetchSpy.mockResolvedValue({ ok: false, status: 503 });

    const result = await getLlmReachability();

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("HTTP 503");
    expect(result.baseUrl).toBe("http://ollama:11434/v1");
  });

  it("reports reachable=false when fetch rejects (connection refused, DNS, etc.)", async () => {
    process.env.LLM_PROVIDER = "openai-compatible";
    process.env.LLM_BASE_URL = "http://nonexistent:8080/v1";
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await getLlmReachability();

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
    expect(result.baseUrl).toBe("http://nonexistent:8080/v1");
  });

  it("sends Authorization header for openai-compatible probes when LLM_API_KEY is set", async () => {
    process.env.LLM_PROVIDER = "openai-compatible";
    process.env.LLM_BASE_URL = "http://vllm:8080/v1";
    process.env.LLM_API_KEY = "secret";
    fetchSpy.mockResolvedValue({ ok: true, status: 200 });

    await getLlmReachability();

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://vllm:8080/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
        }),
      }),
    );
  });

  it("returns reachable=true for openai iff OPENAI_API_KEY is set (without network probe)", async () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";

    const result = await getLlmReachability();

    expect(result).toEqual({ reachable: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns reachable=false for openai when OPENAI_API_KEY is missing", async () => {
    process.env.LLM_PROVIDER = "openai";

    const result = await getLlmReachability();

    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/OPENAI_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns reachable=true for anthropic iff ANTHROPIC_API_KEY is set", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";

    const result = await getLlmReachability();

    expect(result).toEqual({ reachable: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns reachable=false for anthropic when ANTHROPIC_API_KEY is missing", async () => {
    process.env.LLM_PROVIDER = "anthropic";

    const result = await getLlmReachability();

    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/ANTHROPIC_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches the result across calls within the TTL window", async () => {
    process.env.LLM_PROVIDER = "ollama";
    process.env.LLM_BASE_URL = "http://ollama:11434/v1";
    fetchSpy.mockResolvedValue({ ok: true, status: 200 });

    const now = 10_000;
    await getLlmReachability(now);
    await getLlmReachability(now + 500);
    await getLlmReachability(now + 9_999);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("invalidates the cache after the TTL elapses", async () => {
    process.env.LLM_PROVIDER = "ollama";
    process.env.LLM_BASE_URL = "http://ollama:11434/v1";
    fetchSpy.mockResolvedValue({ ok: true, status: 200 });

    const now = 10_000;
    await getLlmReachability(now);
    await getLlmReachability(now + 10_001);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("invalidates the cache when the configured provider changes", async () => {
    process.env.LLM_PROVIDER = "ollama";
    process.env.LLM_BASE_URL = "http://ollama:11434/v1";
    fetchSpy.mockResolvedValue({ ok: true, status: 200 });
    await getLlmReachability(10_000);

    // Switch to anthropic; no fetch should happen, and the cached "reachable" for ollama
    // must not leak into the new provider.
    process.env.LLM_PROVIDER = "anthropic";
    const result = await getLlmReachability(10_100);

    expect(result.reachable).toBe(false);
    expect(result.error).toMatch(/ANTHROPIC_API_KEY/);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still just the ollama probe
  });
});
