import { Command } from "commander";
import chalk from "chalk";
import { spawn } from "node:child_process";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { api, requireActiveMeeting } from "../client.js";
import { withSpinner } from "../runtime.js";

export const transcriptCommand = new Command("transcript").description("Transcript management");

interface TranscriptReadingRow {
  id: string;
  displayText: string;
  speaker?: string;
  startTime?: string;
  endTime?: string;
}

interface StreamingStatusResponse {
  status: "active" | "idle";
  eventCount: number;
}

interface TranscriptChunkSummary {
  id: string;
  wordCount?: number;
  createdAt: string;
}

interface TranscriptionServiceHealth {
  reachable: boolean;
  status: "ok" | "unreachable" | "error";
  url: string;
  error?: string;
}

interface TranscriptionServiceStatusResponse {
  status: "ok";
  provider: string;
  sessionCount: number;
  defaults: {
    windowMs: number;
    stepMs: number;
    dedupeHorizonMs: number;
    autoFlushMs: number;
  };
}

function resolveApiUrl(): string {
  return process.env.DECISION_LOGGER_API_URL ?? process.env.API_BASE_URL ?? "http://localhost:3001";
}

function resolveTranscriptionServiceUrl(): string {
  return (
    process.env.TRANSCRIPTION_SERVICE_URL ??
    process.env.TRANSCRIPTION_URL ??
    "http://localhost:8788"
  );
}

function resolveWhisperLocalUrl(): string {
  return process.env.WHISPER_LOCAL_URL ?? "http://localhost:9000";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function formatTranscriptRow(row: TranscriptReadingRow): string {
  const timeRange =
    row.startTime && row.endTime
      ? `${row.startTime} -> ${row.endTime}`
      : (row.startTime ?? row.endTime ?? "n/a");
  const speaker = row.speaker ?? "Unknown";
  return `${chalk.gray(timeRange)} ${chalk.cyan(`[${speaker}]`)} ${row.displayText}`;
}

async function getTranscriptRows(meetingId: string): Promise<TranscriptReadingRow[]> {
  const response = await api.get<{ rows: TranscriptReadingRow[] }>(
    `/api/meetings/${meetingId}/transcript-reading`,
  );
  return response.rows;
}

async function getStreamingStatus(meetingId: string): Promise<StreamingStatusResponse> {
  return api.get<StreamingStatusResponse>(`/api/meetings/${meetingId}/streaming/status`);
}

async function flushTranscriptStream(meetingId: string): Promise<number> {
  const response = await api.post<{ chunks: Array<{ id: string }> }>(
    `/api/meetings/${meetingId}/streaming/flush`,
  );
  return response.chunks.length;
}

async function getTranscriptChunks(meetingId: string): Promise<TranscriptChunkSummary[]> {
  const response = await api.get<{ chunks: TranscriptChunkSummary[] }>(
    `/api/meetings/${meetingId}/chunks`,
  );
  return response.chunks;
}

async function getTranscriptionServiceHealth(): Promise<TranscriptionServiceHealth> {
  const baseUrl = resolveTranscriptionServiceUrl().replace(/\/$/, "");
  const url = `${baseUrl}/health`;

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return {
        reachable: false,
        status: "error",
        url,
        error: `${response.status} ${response.statusText}`.trim(),
      };
    }

    const payload = (await response.json().catch(() => ({}))) as { status?: string };
    return {
      reachable: true,
      status: payload.status === "ok" ? "ok" : "error",
      url,
      ...(payload.status === "ok" ? {} : { error: "Unexpected health response" }),
    };
  } catch (error) {
    return {
      reachable: false,
      status: "unreachable",
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getTranscriptionServiceStatus(): Promise<TranscriptionServiceStatusResponse | null> {
  const baseUrl = resolveTranscriptionServiceUrl().replace(/\/$/, "");
  const url = `${baseUrl}/status`;

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as Partial<TranscriptionServiceStatusResponse>;
    if (
      payload.status !== "ok" ||
      typeof payload.provider !== "string" ||
      typeof payload.sessionCount !== "number" ||
      payload.defaults === undefined
    ) {
      return null;
    }
    return payload as TranscriptionServiceStatusResponse;
  } catch {
    return null;
  }
}

async function getWhisperLocalHealth(): Promise<TranscriptionServiceHealth> {
  const baseUrl = resolveWhisperLocalUrl().replace(/\/$/, "");
  const url = `${baseUrl}/openapi.json`;

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return {
        reachable: false,
        status: "error",
        url,
        error: `${response.status} ${response.statusText}`.trim(),
      };
    }

    return {
      reachable: true,
      status: "ok",
      url,
    };
  } catch (error) {
    return {
      reachable: false,
      status: "unreachable",
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function launchTranscriptionClient(args: string[], apiUrl: string): Promise<void> {
  const child = spawn("pnpm", args, {
    stdio: "inherit",
    env: {
      ...process.env,
      DECISION_LOGGER_API_URL: apiUrl,
      API_BASE_URL: apiUrl,
    },
  });

  let signalForwarded = false;
  const forwardShutdownSignal = (signal: NodeJS.Signals): void => {
    if (signalForwarded) {
      return;
    }
    signalForwarded = true;
    if (!child.killed) {
      child.kill(signal);
    }
  };

  const handleSigint = (): void => {
    forwardShutdownSignal("SIGINT");
  };

  const handleSigterm = (): void => {
    forwardShutdownSignal("SIGTERM");
  };

  process.once("SIGINT", handleSigint);
  process.once("SIGTERM", handleSigterm);

  return new Promise<void>((resolvePromise, rejectPromise) => {
    const cleanupHandlers = (): void => {
      process.off("SIGINT", handleSigint);
      process.off("SIGTERM", handleSigterm);
    };

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      cleanupHandlers();
      if (code === 0) {
        resolvePromise();
        return;
      }

      if (signalForwarded && code === 130) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Transcription client exited with code ${code ?? "unknown"}`));
    });
  });
}

async function watchTranscript(
  meetingId: string,
  intervalMs: number,
  flushBeforeRead: boolean = false,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  const seenRowIds = new Set<string>();

  while (shouldContinue()) {
    if (flushBeforeRead) {
      await flushTranscriptStream(meetingId);
    }
    const rows = await getTranscriptRows(meetingId);
    for (const row of rows) {
      if (seenRowIds.has(row.id)) {
        continue;
      }
      seenRowIds.add(row.id);
      console.log(formatTranscriptRow(row));
    }
    if (!shouldContinue()) {
      break;
    }
    await sleep(intervalMs);
  }
}

async function runTranscriptionWithOptionalWatch(
  meetingId: string,
  apiUrl: string,
  args: string[],
  watch: boolean,
  intervalMs: number,
  flushBeforeRead: boolean,
): Promise<void> {
  if (!watch) {
    await launchTranscriptionClient(args, apiUrl);
    return;
  }

  let keepWatching = true;
  try {
    await Promise.all([
      launchTranscriptionClient(args, apiUrl).finally(() => {
        keepWatching = false;
      }),
      watchTranscript(meetingId, intervalMs, flushBeforeRead, () => keepWatching),
    ]);
  } finally {
    keepWatching = false;
  }
}

function formatRelativeActivity(timestamp: string | undefined): string {
  if (!timestamp) {
    return "n/a";
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return timestamp;
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function buildActivitySparkline(chunks: TranscriptChunkSummary[]): string {
  if (chunks.length === 0) {
    return ".....";
  }

  const bars = "._-~=^#";
  const recent = chunks.slice(-8);
  const maxWords = Math.max(...recent.map((chunk) => chunk.wordCount ?? 0), 1);
  return recent
    .map((chunk) => {
      const value = chunk.wordCount ?? 0;
      const index = Math.min(bars.length - 1, Math.floor((value / maxWords) * (bars.length - 1)));
      return bars[index] ?? bars[0];
    })
    .join("");
}

function printTranscriptionStatus(
  meetingId: string,
  streamStatus: StreamingStatusResponse,
  persistedRows: number,
  chunks: TranscriptChunkSummary[],
  serviceHealth: TranscriptionServiceHealth,
  serviceStatus: TranscriptionServiceStatusResponse | null,
  whisperHealth: TranscriptionServiceHealth,
): void {
  const lastChunk = chunks[chunks.length - 1];
  const lastPersistedAt = lastChunk?.createdAt;
  const lastSentRecent =
    lastPersistedAt !== undefined && Date.now() - Date.parse(lastPersistedAt) < 90_000;
  const activityLabel =
    streamStatus.eventCount > 0 || lastSentRecent ? "sending_to_meeting_context" : "idle";

  console.log(chalk.white(`Meeting:           ${meetingId}`));
  console.log(chalk.white(`API URL:           ${resolveApiUrl()}`));
  console.log(chalk.white(`Transcription URL: ${serviceHealth.url}`));
  console.log(chalk.white(`Service health:    ${serviceHealth.status}`));
  if (serviceHealth.error) {
    console.log(chalk.white(`Service detail:    ${serviceHealth.error}`));
  }
  if (serviceStatus) {
    console.log(
      chalk.white(
        `Provider:          ${serviceStatus.provider} (${serviceStatus.sessionCount} sessions)`,
      ),
    );
    console.log(
      chalk.white(
        `Service defaults:  window=${serviceStatus.defaults.windowMs}ms step=${serviceStatus.defaults.stepMs}ms dedupe=${serviceStatus.defaults.dedupeHorizonMs}ms flush=${serviceStatus.defaults.autoFlushMs}ms`,
      ),
    );
  }
  console.log(chalk.white(`Whisper URL:       ${whisperHealth.url}`));
  console.log(chalk.white(`Whisper health:    ${whisperHealth.status}`));
  if (whisperHealth.error) {
    console.log(chalk.white(`Whisper detail:    ${whisperHealth.error}`));
  }
  console.log(chalk.white(`Activity:          ${activityLabel}`));
  console.log(chalk.white(`Buffer state:      ${streamStatus.status}`));
  console.log(chalk.white(`Buffered events:   ${streamStatus.eventCount}`));
  console.log(chalk.white(`Persisted rows:    ${persistedRows}`));
  console.log(chalk.white(`Persisted chunks:  ${chunks.length}`));
  console.log(chalk.white(`Last persisted:    ${formatRelativeActivity(lastPersistedAt)}`));
  console.log(chalk.white(`Recent activity:   ${buildActivitySparkline(chunks)}`));
  console.log(chalk.white(`FFmpeg binary:     ${process.env.FFMPEG_BIN ?? "ffmpeg"}`));
  console.log(
    chalk.white(`Input format:      ${process.env.TRANSCRIPTION_LIVE_INPUT_FORMAT ?? "pulse"}`),
  );
  console.log(
    chalk.white(`Input device:      ${process.env.TRANSCRIPTION_LIVE_INPUT_DEVICE ?? "default"}`),
  );
  console.log(chalk.white(`Window ms (env):   ${process.env.STREAM_WINDOW_MS ?? "30000"}`));
  console.log(chalk.white(`Step ms (env):     ${process.env.STREAM_STEP_MS ?? "10000"}`));
}

transcriptCommand
  .command("upload")
  .description("Upload a transcript file to a meeting")
  .requiredOption("-f, --file <path>", "Path to transcript file (.txt or .json)")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .option("-s, --strategy <strategy>", "Chunking strategy: fixed|semantic", "fixed")
  .option("--chunk-size <n>", "Chunk size in tokens", "500")
  .option("--overlap <n>", "Chunk overlap in tokens", "50")
  .action(
    async (opts: {
      file: string;
      meetingId?: string;
      strategy: string;
      chunkSize: string;
      overlap: string;
    }) => {
      const meetingId = opts.meetingId ?? (await requireActiveMeeting());
      const filePath = resolve(opts.file);
      const raw = await readFile(filePath, "utf-8");

      let content = raw;
      if (opts.file.endsWith(".json")) {
        const parsed = JSON.parse(raw) as Array<{ speaker?: string; text?: string }>;
        if (Array.isArray(parsed)) {
          content = parsed.map((e) => `[${e.speaker ?? "Unknown"}]: ${e.text ?? ""}`).join("\n");
        }
      }

      const result = await withSpinner("Uploading transcript…", () =>
        api.post<{ transcript: { id: string; format: string }; chunks: unknown[] }>(
          `/api/meetings/${meetingId}/transcripts/upload`,
          {
            content,
            format: opts.file.endsWith(".json") ? "json" : "txt",
            chunkStrategy: opts.strategy,
            chunkSize: parseInt(opts.chunkSize, 10),
            overlap: parseInt(opts.overlap, 10),
          },
        ),
      );

      console.log(chalk.green("✓ Transcript uploaded"));
      console.log(chalk.gray(`Transcript ID: ${result.transcript.id}`));
      console.log(chalk.white(`Chunks created: ${result.chunks.length}`));
      console.log(chalk.white(`Strategy: ${opts.strategy}`));
    },
  );

transcriptCommand
  .command("transcribe-file")
  .description("Transcribe an audio file for a meeting using the external transcription client")
  .argument("<file>", "Path to audio file")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .option("-l, --language <code>", "Language code for transcription")
  .option("--mode <mode>", "Delivery mode: upload|stream", "upload")
  .option(
    "--chunk-strategy <strategy>",
    "Chunk strategy: fixed|semantic|speaker|streaming",
    "speaker",
  )
  .option("-w, --watch", "Watch the transcript as it is generated")
  .option("--flush", "Flush buffered stream events before each transcript watch poll")
  .option("--interval-ms <milliseconds>", "Interval between transcript checks", "2000")
  .action(
    async (
      file: string,
      opts: {
        meetingId?: string;
        language?: string;
        mode: string;
        chunkStrategy: string;
        watch?: boolean;
        flush?: boolean;
        intervalMs?: string;
      },
    ) => {
      const meetingId = opts.meetingId ?? (await requireActiveMeeting());
      const apiUrl = resolveApiUrl();
      const args = [
        "--filter",
        "@repo/transcription",
        "exec",
        "tsx",
        "src/index.ts",
        "transcribe",
        resolve(file),
        "--meeting-id",
        meetingId,
        "--api-url",
        apiUrl,
        "--mode",
        opts.mode,
        "--chunk-strategy",
        opts.chunkStrategy,
      ];

      if (opts.language) {
        args.push("--language", opts.language);
      }

      console.log(chalk.gray(`Starting file transcription for meeting ${meetingId}`));

      const intervalMs = Number.parseInt(opts.intervalMs ?? "2000", 10);
      await runTranscriptionWithOptionalWatch(
        meetingId,
        apiUrl,
        args,
        opts.watch === true,
        Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 2000,
        opts.flush === true,
      );
    },
  );

transcriptCommand
  .command("read")
  .description("Read transcript rows for a meeting")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .action(async (opts: { meetingId?: string }) => {
    const meetingId = opts.meetingId ?? (await requireActiveMeeting());
    const rows = await withSpinner("Loading transcript…", () => getTranscriptRows(meetingId));

    if (rows.length === 0) {
      console.log(chalk.yellow("No transcript rows found"));
      return;
    }

    for (const row of rows) {
      console.log(formatTranscriptRow(row));
    }
  });

transcriptCommand
  .command("status")
  .description("Show transcription stream status and local capture configuration for a meeting")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .action(async (opts: { meetingId?: string }) => {
    const meetingId = opts.meetingId ?? (await requireActiveMeeting());
    const [streamStatus, rows, chunks, serviceHealth, serviceStatus, whisperHealth] = await withSpinner(
      "Loading transcription status…",
      () =>
        Promise.all([
          getStreamingStatus(meetingId),
          getTranscriptRows(meetingId),
          getTranscriptChunks(meetingId),
          getTranscriptionServiceHealth(),
          getTranscriptionServiceStatus(),
          getWhisperLocalHealth(),
        ]),
    );

    printTranscriptionStatus(
      meetingId,
      streamStatus,
      rows.length,
      chunks,
      serviceHealth,
      serviceStatus,
      whisperHealth,
    );
  });

transcriptCommand
  .command("flush")
  .description("Flush buffered transcript stream events into persisted transcript rows")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .action(async (opts: { meetingId?: string }) => {
    const meetingId = opts.meetingId ?? (await requireActiveMeeting());
    const chunkCount = await withSpinner("Flushing transcript stream…", () =>
      flushTranscriptStream(meetingId),
    );
    console.log(chalk.green("✓ Transcript stream flushed"));
    console.log(chalk.white(`Chunks created: ${chunkCount}`));
  });

transcriptCommand
  .command("watch")
  .description("Watch transcript rows arrive in real time for a meeting")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .option("--interval-ms <milliseconds>", "Interval between transcript checks", "2000")
  .option("--flush", "Flush buffered stream events before each read poll")
  .action(async (opts: { meetingId?: string; intervalMs?: string; flush?: boolean }) => {
    const meetingId = opts.meetingId ?? (await requireActiveMeeting());
    const intervalMs = Number.parseInt(opts.intervalMs ?? "2000", 10);

    console.log(chalk.gray(`Watching transcript stream for meeting ${meetingId}`));
    await watchTranscript(
      meetingId,
      Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 2000,
      opts.flush === true,
    );
  });

transcriptCommand
  .command("live")
  .description("Start live transcription for a meeting using the external transcription client")
  .option("-m, --meeting-id <id>", "Meeting ID (defaults to active meeting)")
  .option("-l, --language <code>", "Language code for transcription")
  .option("--window-ms <milliseconds>", "Sliding window duration in milliseconds")
  .option("--step-ms <milliseconds>", "Sliding window step interval in milliseconds")
  .option("--follow", "Watch the transcript as it is generated")
  .option("--interval-ms <milliseconds>", "Interval between transcript checks", "2000")
  .option("--flush", "Flush buffered stream events before each transcript watch poll")
  .action(
    async (opts: {
      meetingId?: string;
      language?: string;
      windowMs?: string;
      stepMs?: string;
      follow?: boolean;
      intervalMs?: string;
      flush?: boolean;
    }) => {
      const meetingId = opts.meetingId ?? (await requireActiveMeeting());
      const apiUrl = resolveApiUrl();
      const args = [
        "--filter",
        "@repo/transcription",
        "exec",
        "tsx",
        "src/index.ts",
        "live",
        "--meeting-id",
        meetingId,
        "--api-url",
        apiUrl,
      ];

      if (opts.language) {
        args.push("--language", opts.language);
      }

      if (opts.windowMs) {
        args.push("--window-ms", opts.windowMs);
      }

      if (opts.stepMs) {
        args.push("--step-ms", opts.stepMs);
      }

      console.log(chalk.gray(`Starting live transcription for meeting ${meetingId}`));

      const intervalMs = Number.parseInt(opts.intervalMs ?? "2000", 10);
      await runTranscriptionWithOptionalWatch(
        meetingId,
        apiUrl,
        args,
        opts.follow === true,
        Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 2000,
        opts.flush === true,
      );
    },
  );
