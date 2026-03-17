import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
const baseUrl =
  process.env.DECISION_LOGGER_API_URL ?? process.env.API_BASE_URL ?? "http://localhost:3001";
const connId = process.env.DECISION_LOGGER_CONNECTION_ID ?? "";
const connHeader = { "X-Connection-ID": connId };
const jsonConnHeader = { "Content-Type": "application/json", "X-Connection-ID": connId };

describe("CLI client request shapes", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    stderrWriteSpy.mockClear();
  });

  it("api.delete sends a JSON body when provided", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const { api } = await import("../client.js");
    await api.delete("/api/decision-contexts/ctx/lock-field", { fieldId: "field-1" });

    expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/api/decision-contexts/ctx/lock-field`, {
      method: "DELETE",
      headers: jsonConnHeader,
      body: JSON.stringify({ fieldId: "field-1" }),
    });
  });

  it("meeting create posts title, normalized participants, and date when participants are provided explicitly", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "meeting-1",
        title: "Q1 Planning",
        date: "2026-03-10T00:00:00Z",
        participants: ["Alice", "Bob"],
        status: "active",
        createdAt: "now",
      }),
    });

    const { meetingCommand } = await import("../commands/meeting.js");
    await meetingCommand.parseAsync(
      [
        "node",
        "meeting",
        "create",
        "Q1 Planning",
        "--participants",
        "Alice, Bob",
        "--date",
        "2026-03-10",
      ],
      { from: "node" },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${baseUrl}/api/meetings`, {
      method: "POST",
      headers: jsonConnHeader,
      body: JSON.stringify({
        title: "Q1 Planning",
        date: "2026-03-10T00:00:00Z",
        participants: ["Alice", "Bob"],
      }),
    });
  });

  it("api throws the server error string for non-ok responses", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: "Invalid request data" }),
    });

    const { api } = await import("../client.js");

    await expect(api.post("/api/test", {})).rejects.toThrow("Invalid request data");
  });

  it("api emits verbose HTTP logs when verbose mode is enabled", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const { api } = await import("../client.js");
    const { setCliVerbose } = await import("../runtime.js");

    setCliVerbose(true);
    await api.get("/api/context");
    setCliVerbose(false);

    expect(stderrWriteSpy).toHaveBeenCalled();
  });
});

describe("CLI command request shapes", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    spawnMock.mockReset();
    stderrWriteSpy.mockClear();
  });

  it("draft unlock-field sends fieldId in the DELETE body", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: "meeting-1", activeDecisionContextId: "ctx-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "ctx-1", lockedFields: [] }),
      });

    const { draftCommand } = await import("../commands/draft.js");
    await draftCommand.parseAsync(["node", "draft", "unlock-field", "--field-id", "field-1"], {
      from: "node",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${baseUrl}/api/context`, {
      method: "GET",
      headers: connHeader,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/api/decision-contexts/ctx-1/lock-field`,
      {
        method: "DELETE",
        headers: jsonConnHeader,
        body: JSON.stringify({ fieldId: "field-1" }),
      },
    );
  });

  it("draft lock-field sends fieldId in the PUT body", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: "meeting-1", activeDecisionContextId: "ctx-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "ctx-1", lockedFields: ["field-1"] }),
      });

    const { draftCommand } = await import("../commands/draft.js");
    await draftCommand.parseAsync(["node", "draft", "lock-field", "--field-id", "field-1"], {
      from: "node",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/api/decision-contexts/ctx-1/lock-field`,
      {
        method: "PUT",
        headers: jsonConnHeader,
        body: JSON.stringify({ fieldId: "field-1" }),
      },
    );
  });

  it("context set-decision posts the flaggedDecisionId and optional templateId", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: "meeting-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          activeMeetingId: "meeting-1",
          activeDecisionId: "decision-1",
          activeDecisionContextId: "ctx-1",
        }),
      });

    const { contextCommand } = await import("../commands/context.js");
    await contextCommand.parseAsync(
      ["node", "context", "set-decision", "decision-1", "--template-id", "template-1"],
      { from: "node" },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${baseUrl}/api/context`, {
      method: "GET",
      headers: connHeader,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/api/meetings/meeting-1/context/decision`,
      {
        method: "POST",
        headers: jsonConnHeader,
        body: JSON.stringify({ flaggedDecisionId: "decision-1", templateId: "template-1" }),
      },
    );
  });

  it("context clear-meeting deletes the active meeting context when confirmed with --yes", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        activeMeetingId: undefined,
        activeDecisionId: undefined,
        activeDecisionContextId: undefined,
      }),
    });

    const { contextCommand } = await import("../commands/context.js");
    await contextCommand.parseAsync(["node", "context", "clear-meeting", "--yes"], {
      from: "node",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${baseUrl}/api/context/meeting`, {
      method: "DELETE",
      headers: connHeader,
    });
  });

  it("context clear-decision deletes the active decision context when confirmed with --yes", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: "meeting-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          activeMeetingId: "meeting-1",
          activeDecisionId: undefined,
          activeDecisionContextId: undefined,
        }),
      });

    const { contextCommand } = await import("../commands/context.js");
    await contextCommand.parseAsync(["node", "context", "clear-decision", "--yes"], {
      from: "node",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/api/meetings/meeting-1/context/decision`,
      { method: "DELETE", headers: connHeader },
    );
  });

  it("context clear-field deletes the active field focus when confirmed with --yes", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: "meeting-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: "meeting-1", activeField: undefined }),
      });

    const { contextCommand } = await import("../commands/context.js");
    await contextCommand.parseAsync(["node", "context", "clear-field", "--yes"], { from: "node" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/api/meetings/meeting-1/context/field`,
      { method: "DELETE", headers: connHeader },
    );
  });

  it("decisions list honors an explicit meeting-id option without fetching active context", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ decisions: [] }),
    });

    const { decisionsCommand } = await import("../commands/decisions.js");
    await decisionsCommand.parseAsync(["node", "decisions", "list", "--meeting-id", "meeting-1"], {
      from: "node",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/api/meetings/meeting-1/flagged-decisions`,
      { method: "GET", headers: connHeader },
    );
  });

  it("decisions flag honors an explicit meeting-id option without fetching active context", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "decision-1",
        meetingId: "meeting-1",
        suggestedTitle: "Approve migration",
        confidence: 1,
        priority: 0,
        status: "pending",
        createdAt: "now",
      }),
    });

    const { decisionsCommand } = await import("../commands/decisions.js");
    await decisionsCommand.parseAsync(
      ["node", "decisions", "flag", "--meeting-id", "meeting-1", "--title", "Approve migration"],
      { from: "node" },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/api/meetings/meeting-1/flagged-decisions`,
      {
        method: "POST",
        headers: jsonConnHeader,
        body: JSON.stringify({
          suggestedTitle: "Approve migration",
          contextSummary: "",
          confidence: 1,
          priority: 0,
          chunkIds: [],
        }),
      },
    );
  });

  it("draft log posts the decision method payload", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ activeMeetingId: "meeting-1", activeDecisionContextId: "ctx-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "log-1",
          decisionMethod: { type: "manual" },
          loggedBy: "Tester",
          loggedAt: "now",
        }),
      });

    const { draftCommand } = await import("../commands/draft.js");
    await draftCommand.parseAsync(
      [
        "node",
        "draft",
        "log",
        "--type",
        "manual",
        "--by",
        "Tester",
        "--details",
        "Confirmed in review",
        "--yes",
      ],
      { from: "node" },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(2, `${baseUrl}/api/decision-contexts/ctx-1/log`, {
      method: "POST",
      headers: jsonConnHeader,
      body: JSON.stringify({
        loggedBy: "Tester",
        decisionMethod: { type: "manual", details: "Confirmed in review" },
      }),
    });
  });

  it("draft export requests markdown export for a logged decision", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ format: "markdown", content: "# Decision:\n\nExample export" }),
    });

    const { draftCommand } = await import("../commands/draft.js");
    await draftCommand.parseAsync(["node", "draft", "export", "log-1"], { from: "node" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/api/decisions/log-1/export?format=markdown`,
      { method: "GET", headers: connHeader },
    );
  });

  it("draft export requests json export when explicitly selected", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ format: "json", content: { id: "log-1" } }),
    });

    const { draftCommand } = await import("../commands/draft.js");
    await draftCommand.parseAsync(["node", "draft", "export", "log-1", "--format", "json"], {
      from: "node",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/api/decisions/log-1/export?format=json`,
      { method: "GET", headers: connHeader },
    );
  });

  it("status command requests API status", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        timestamp: "2026-03-10T23:31:00Z",
        nodeEnv: "development",
        databaseConfigured: true,
        llm: {
          mode: "real",
          provider: "anthropic",
          model: "claude-opus-4-5",
        },
      }),
    });

    const { statusCommand } = await import("../commands/status.js");
    await statusCommand.parseAsync(["node", "status"], { from: "node" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${baseUrl}/api/status`, {
      method: "GET",
      headers: connHeader,
    });

    consoleLogSpy.mockRestore();
  });

  it("transcript read requests transcript rows for the provided meeting", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        rows: [
          {
            id: "row-1",
            displayText: "Decision discussed",
            speaker: "Alice",
            startTime: "00:00:01",
            endTime: "00:00:03",
          },
        ],
      }),
    });

    const { transcriptCommand } = await import("../commands/transcript.js");
    await transcriptCommand.parseAsync(
      ["node", "transcript", "read", "--meeting-id", "meeting-1"],
      { from: "node" },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/api/meetings/meeting-1/transcript-reading`,
      { method: "GET", headers: connHeader },
    );

    consoleLogSpy.mockRestore();
  });

  it("transcript status requests stream status and transcript rows", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "active", eventCount: 5 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ rows: [{ id: "row-1", displayText: "Stored text" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          chunks: [{ id: "chunk-1", wordCount: 4, createdAt: "2026-03-11T13:17:37.564Z" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ok",
          provider: "openai",
          sessionCount: 1,
          defaults: {
            windowMs: 30000,
            stepMs: 10000,
            dedupeHorizonMs: 90000,
            autoFlushMs: 10000,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      });

    const { transcriptCommand } = await import("../commands/transcript.js");
    await transcriptCommand.parseAsync(
      ["node", "transcript", "status", "--meeting-id", "meeting-1"],
      { from: "node" },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/api/meetings/meeting-1/streaming/status`,
      { method: "GET", headers: connHeader },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/api/meetings/meeting-1/transcript-reading`,
      { method: "GET", headers: connHeader },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${baseUrl}/api/meetings/meeting-1/chunks`, {
      method: "GET",
      headers: connHeader,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "http://localhost:8788/health", { method: "GET" });
    expect(fetchMock).toHaveBeenNthCalledWith(5, "http://localhost:8788/status", {
      method: "GET",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(6, "http://localhost:9000/openapi.json", {
      method: "GET",
    });

    consoleLogSpy.mockRestore();
  });

  it("transcript flush requests stream flush for the provided meeting", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ chunks: [{ id: "chunk-1" }, { id: "chunk-2" }] }),
    });

    const { transcriptCommand } = await import("../commands/transcript.js");
    await transcriptCommand.parseAsync(
      ["node", "transcript", "flush", "--meeting-id", "meeting-1"],
      { from: "node" },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/api/meetings/meeting-1/streaming/flush`,
      { method: "POST", headers: connHeader },
    );

    consoleLogSpy.mockRestore();
  });

  it("transcript transcribe-file launches the external transcription client", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    spawnMock.mockReturnValue({
      on: (event: string, handler: (code?: number) => void) => {
        if (event === "exit") {
          setTimeout(() => handler(0), 0);
        }
      },
    });

    const { transcriptCommand } = await import("../commands/transcript.js");
    await transcriptCommand.parseAsync(
      [
        "node",
        "transcript",
        "transcribe-file",
        "audio.wav",
        "--meeting-id",
        "meeting-1",
        "--mode",
        "stream",
        "--chunk-strategy",
        "speaker",
        "--language",
        "en",
      ],
      { from: "node" },
    );

    expect(spawnMock).toHaveBeenCalledWith(
      "pnpm",
      [
        "--filter",
        "@repo/transcription",
        "exec",
        "tsx",
        "src/index.ts",
        "transcribe",
        expect.stringMatching(/audio\.wav$/),
        "--meeting-id",
        "meeting-1",
        "--api-url",
        baseUrl,
        "--mode",
        "stream",
        "--chunk-strategy",
        "speaker",
        "--language",
        "en",
      ],
      {
        stdio: "inherit",
        env: expect.objectContaining({
          DECISION_LOGGER_API_URL: baseUrl,
          API_BASE_URL: baseUrl,
        }),
      },
    );

    consoleLogSpy.mockRestore();
  });

  it("transcript live --follow --flush launches transcription and flushes before polling transcript rows", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    spawnMock.mockReturnValue({
      on: (event: string, handler: (code?: number) => void) => {
        if (event === "exit") {
          setTimeout(() => handler(0), 0);
        }
      },
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ chunks: [] }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        rows: [
          {
            id: "row-1",
            displayText: "Streaming transcript row",
            speaker: "Bob",
            startTime: "00:00:05",
            endTime: "00:00:06",
          },
        ],
      }),
    });

    const { transcriptCommand } = await import("../commands/transcript.js");
    await transcriptCommand.parseAsync(
      [
        "node",
        "transcript",
        "live",
        "--meeting-id",
        "meeting-1",
        "--follow",
        "--flush",
        "--interval-ms",
        "1",
      ],
      { from: "node" },
    );

    expect(spawnMock).toHaveBeenCalledWith(
      "pnpm",
      [
        "--filter",
        "@repo/transcription",
        "exec",
        "tsx",
        "src/index.ts",
        "live",
        "--meeting-id",
        "meeting-1",
        "--api-url",
        baseUrl,
      ],
      {
        stdio: "inherit",
        env: expect.objectContaining({
          DECISION_LOGGER_API_URL: baseUrl,
          API_BASE_URL: baseUrl,
        }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/api/meetings/meeting-1/streaming/flush`,
      { method: "POST", headers: connHeader },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/api/meetings/meeting-1/transcript-reading`,
      { method: "GET", headers: connHeader },
    );

    consoleLogSpy.mockRestore();
  });

  it("transcript live forwards --window-ms and --step-ms to transcription client", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    spawnMock.mockReturnValue({
      on: (event: string, handler: (code?: number) => void) => {
        if (event === "exit") {
          setTimeout(() => handler(0), 0);
        }
      },
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ chunks: [] }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ rows: [] }),
    });

    const { transcriptCommand } = await import("../commands/transcript.js");
    await transcriptCommand.parseAsync(
      [
        "node",
        "transcript",
        "live",
        "--meeting-id",
        "meeting-1",
        "--follow",
        "--flush",
        "--interval-ms",
        "1",
        "--window-ms",
        "30000",
        "--step-ms",
        "10000",
      ],
      { from: "node" },
    );

    expect(spawnMock).toHaveBeenCalledWith(
      "pnpm",
      [
        "--filter",
        "@repo/transcription",
        "exec",
        "tsx",
        "src/index.ts",
        "live",
        "--meeting-id",
        "meeting-1",
        "--api-url",
        baseUrl,
        "--window-ms",
        "30000",
        "--step-ms",
        "10000",
      ],
      {
        stdio: "inherit",
        env: expect.objectContaining({
          DECISION_LOGGER_API_URL: baseUrl,
          API_BASE_URL: baseUrl,
        }),
      },
    );

    consoleLogSpy.mockRestore();
  });
});
