import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  TranscriptionDiagnosticsResponseSchema,
  TranscriptionServiceStatusSchema,
  TranscriptionSessionCreateRequestSchema,
  TranscriptionSessionCreateResponseSchema,
  TranscriptionSessionStatusResponseSchema,
} from "../../../packages/schema/src/index.js";
import { DecisionLoggerApiClient } from "./api-client.js";
import { resolveDecisionLoggerApiUrl } from "./config.js";
import { createProviderFromEnv } from "./providers/index.js";
import type { ITranscriptionProvider, TranscriptEvent } from "./providers/interface.js";
import {
  deliverStreamEvents,
  normalizeSequenceNumbers,
  type StreamDeliveryConfig,
} from "./stream-delivery.js";

export interface StartWebServerOptions {
  port?: number;
  host?: string;
  provider?: ITranscriptionProvider;
  apiClient?: {
    postStreamEvent: (meetingId: string, event: TranscriptEvent) => Promise<void>;
    flushStream: (meetingId: string) => Promise<void>;
  };
  maxChunkBytes?: number;
  sleep?: (ms: number) => Promise<void>;
  deliveryConfig?: {
    maxAttempts: number;
    baseBackoffMs: number;
    maxQueueSize: number;
  };
  autoFlushMs?: number;
  windowMs?: number;
  stepMs?: number;
  dedupeHorizonMs?: number;
  normalizeAudioChunk?: (audio: Buffer, filename: string) => Promise<Buffer>;
  corsOrigin?: string;
}

const DIAGNOSTIC_HISTORY_LIMIT = 50;

interface SessionChunkHistoryItem {
  audio: Buffer;
  filename: string;
  receivedAtMs: number;
}

interface SessionChunkDiagnostic {
  receivedAt: string;
  filename: string;
  contentType?: string;
  originalByteLength: number;
  normalizedByteLength: number;
  rollingWindowChunkCount: number;
  rollingWindowAudioBytes: number;
}

interface SessionWhisperDiagnostic {
  createdAt: string;
  filename: string;
  eventCount: number;
  textPreview: string;
  rawResponse: unknown;
  error?: string;
}

interface SessionDeliveredEventDiagnostic {
  createdAt: string;
  meetingId: string;
  event: TranscriptEvent;
}

interface SessionState {
  id: string;
  meetingId: string;
  streamSource: string;
  streamEpochMs: number;
  language?: string;
  status: "active" | "stopping" | "stopped";
  startedAt: string;
  stoppedAt?: string;
  eventsAccepted: number;
  postedEvents: number;
  dedupedEvents: number;
  nextSequenceNumber: number;
  lastFlushedAtMs: number;
  windowMs: number;
  stepMs: number;
  dedupeHorizonMs: number;
  dedupeSeenAtMs: Map<string, number>;
  chunkHistory: SessionChunkHistoryItem[];
  chunkTrace: SessionChunkDiagnostic[];
  whisperResponses: SessionWhisperDiagnostic[];
  deliveredEvents: SessionDeliveredEventDiagnostic[];
  lastChunkReceivedAt?: string;
  lastTranscriptionAt?: string;
  lastProviderEventCount?: number;
  lastProviderTextPreview?: string;
  lastProviderError?: string;
}

interface RunningWebServer {
  server: Server;
  port: number;
  host: string;
  close: () => Promise<void>;
}

async function probeUrlOk(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok
      ? { ok: true }
      : { ok: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function resolveDeliveryConfig(override?: Partial<StreamDeliveryConfig>): StreamDeliveryConfig {
  return {
    maxAttempts:
      override?.maxAttempts ?? parsePositiveInt(process.env.STREAM_MAX_RETRY_ATTEMPTS, 5),
    baseBackoffMs:
      override?.baseBackoffMs ?? parsePositiveInt(process.env.STREAM_RETRY_BASE_MS, 250),
    maxQueueSize:
      override?.maxQueueSize ?? parsePositiveInt(process.env.STREAM_MAX_OUTBOUND_QUEUE, 200),
  };
}

function setCorsHeaders(res: ServerResponse, origin: string): void {
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,x-audio-filename");
}

function sendJson(
  req: IncomingMessage,
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
  corsOrigin: string,
): void {
  setCorsHeaders(res, corsOrigin);
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

function collectRequestBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error(`Request body exceeds limit (${maxBytes} bytes)`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (error) => {
      reject(error);
    });
  });
}

async function parseJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const body = await collectRequestBody(req, maxBytes);
  if (body.length === 0) {
    throw new Error("Request body is required");
  }
  const decoded = JSON.parse(body.toString("utf8")) as unknown;
  return decoded;
}

function resolveChunkFilename(req: IncomingMessage, fallback: string): string {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const fromQuery = requestUrl.searchParams.get("filename") ?? undefined;
  const fromHeader = req.headers["x-audio-filename"];
  const candidate =
    typeof fromHeader === "string" && fromHeader.trim().length > 0
      ? fromHeader
      : fromQuery && fromQuery.trim().length > 0
        ? fromQuery
        : fallback;

  const supported = ["flac", "m4a", "mp3", "mp4", "mpeg", "mpga", "oga", "ogg", "wav", "webm"];
  const ext = candidate.split(".").pop()?.toLowerCase() ?? "";
  if (supported.includes(ext)) {
    return candidate;
  }

  const contentType = (req.headers["content-type"] ?? "").toLowerCase();
  if (contentType.includes("ogg") || contentType.includes("oga")) {
    return `${candidate}.ogg`;
  }
  if (contentType.includes("mp4") || contentType.includes("m4a")) {
    return `${candidate}.m4a`;
  }
  if (
    contentType.includes("mp3") ||
    contentType.includes("mpeg") ||
    contentType.includes("mpga")
  ) {
    return `${candidate}.mp3`;
  }
  if (contentType.includes("wav")) {
    return `${candidate}.wav`;
  }
  if (contentType.includes("flac")) {
    return `${candidate}.flac`;
  }

  return `${candidate}.webm`;
}

function normalizeEventText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildEventFingerprint(event: TranscriptEvent): string {
  const speaker = (event.speaker ?? "").trim().toLowerCase();
  const text = normalizeEventText(event.text);
  return `${speaker}|${text}`;
}

function purgeDedupeHistory(
  seenAtMs: Map<string, number>,
  nowMs: number,
  horizonMs: number,
): void {
  const cutoff = nowMs - horizonMs;
  for (const [key, seenAt] of seenAtMs.entries()) {
    if (seenAt < cutoff) {
      seenAtMs.delete(key);
    }
  }
}

function pushDiagnosticEntry<T>(items: T[], entry: T): void {
  items.push(entry);
  if (items.length > DIAGNOSTIC_HISTORY_LIMIT) {
    items.splice(0, items.length - DIAGNOSTIC_HISTORY_LIMIT);
  }
}

function pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

async function normalizeAudioChunkWithFfmpeg(audio: Buffer): Promise<Buffer> {
  const ffmpegBin = process.env.FFMPEG_BIN ?? "ffmpeg";
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    "pipe:0",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "s16le",
    "pipe:1",
  ];

  const child = spawn(ffmpegBin, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

  return await new Promise<Buffer>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        const message = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(new Error(message.length > 0 ? message : `ffmpeg exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(stdoutChunks));
    });
    child.stdin.end(audio);
  });
}

export async function startWebServer(options?: StartWebServerOptions): Promise<RunningWebServer> {
  const apiUrl = resolveDecisionLoggerApiUrl();
  const apiKey = process.env.DECISION_LOGGER_API_KEY;
  const connectionId = process.env.DECISION_LOGGER_CONNECTION_ID;

  const provider = options?.provider ?? createProviderFromEnv();
  const apiClient = options?.apiClient ?? new DecisionLoggerApiClient(apiUrl, apiKey, fetch, connectionId);
  const sleep = options?.sleep ?? wait;
  const deliveryConfig = resolveDeliveryConfig(options?.deliveryConfig);
  const maxChunkBytes =
    options?.maxChunkBytes ??
    parsePositiveInt(process.env.TRANSCRIPTION_MAX_CHUNK_BYTES, 25_000_000);
  const corsOrigin = options?.corsOrigin ?? process.env.TRANSCRIPTION_CORS_ORIGIN ?? "*";
  const autoFlushMs =
    options?.autoFlushMs ?? parsePositiveInt(process.env.STREAM_AUTO_FLUSH_MS, 10_000);
  const defaultWindowMs =
    options?.windowMs ?? parsePositiveInt(process.env.STREAM_WINDOW_MS, 30_000);
  const defaultStepMs = options?.stepMs ?? parsePositiveInt(process.env.STREAM_STEP_MS, 10_000);
  const defaultDedupeHorizonMs =
    options?.dedupeHorizonMs ??
    parsePositiveInt(process.env.STREAM_DEDUPE_HORIZON_MS, 90_000);
  const normalizeAudioChunk = options?.normalizeAudioChunk ?? normalizeAudioChunkWithFfmpeg;

  const sessions = new Map<string, SessionState>();

  const server = createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const path = requestUrl.pathname;

    if (method === "OPTIONS") {
      setCorsHeaders(res, corsOrigin);
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (method === "GET" && path === "/health") {
        sendJson(req, res, 200, { status: "ok" }, corsOrigin);
        return;
      }

      if (method === "GET" && path === "/status") {
        const provider = process.env.TRANSCRIPTION_PROVIDER ?? "openai";
        const apiProbe = await probeUrlOk(`${apiUrl.replace(/\/$/, "")}/health`);
        const whisperUrl = process.env.WHISPER_LOCAL_URL ?? "http://whisper:9000";
        const whisperProbe =
          provider === "local"
            ? await probeUrlOk(`${whisperUrl.replace(/\/$/, "")}/`)
            : null;

        const payload = TranscriptionServiceStatusSchema.parse({
          status: "ok",
          provider,
          api: {
            url: apiUrl,
            ...apiProbe,
          },
          whisper:
            whisperProbe === null
              ? { enabled: false }
              : {
                  enabled: true,
                  url: whisperUrl,
                  ...whisperProbe,
                },
          sessionCount: sessions.size,
          defaults: {
            windowMs: defaultWindowMs,
            stepMs: defaultStepMs,
            dedupeHorizonMs: defaultDedupeHorizonMs,
            autoFlushMs,
          },
        });

        sendJson(
          req,
          res,
          200,
          payload,
          corsOrigin,
        );
        return;
      }

      if (method === "POST" && path === "/sessions") {
        const body = await parseJsonBody(req, maxChunkBytes);
        const parsed = TranscriptionSessionCreateRequestSchema.safeParse({
          windowMs: defaultWindowMs,
          stepMs: defaultStepMs,
          dedupeHorizonMs: defaultDedupeHorizonMs,
          ...(typeof body === "object" && body !== null
            ? (body as Record<string, unknown>)
            : {}),
        });
        if (!parsed.success) {
          sendJson(
            req,
            res,
            400,
            { error: parsed.error.issues[0]?.message ?? "Invalid request" },
            corsOrigin,
          );
          return;
        }
        const meetingId = parsed.data.meetingId.trim();
        const streamEpochMs = Date.now();

        const session: SessionState = {
          id: randomUUID(),
          meetingId,
          streamSource: parsed.data.streamSource,
          streamEpochMs,
          ...(parsed.data.language === undefined ? {} : { language: parsed.data.language }),
          status: "active",
          startedAt: new Date().toISOString(),
          eventsAccepted: 0,
          postedEvents: 0,
          dedupedEvents: 0,
          nextSequenceNumber: 1,
          lastFlushedAtMs: streamEpochMs,
          windowMs: parsed.data.windowMs,
          stepMs: parsed.data.stepMs,
          dedupeHorizonMs: parsed.data.dedupeHorizonMs,
          dedupeSeenAtMs: new Map<string, number>(),
          chunkHistory: [],
          chunkTrace: [],
          whisperResponses: [],
          deliveredEvents: [],
          lastProviderEventCount: 0,
        };
        sessions.set(session.id, session);

        const payload = TranscriptionSessionCreateResponseSchema.parse({
          sessionId: session.id,
          meetingId: session.meetingId,
          streamSource: session.streamSource,
          streamEpochMs: session.streamEpochMs,
          startedAt: session.startedAt,
          windowMs: session.windowMs,
          stepMs: session.stepMs,
          dedupeHorizonMs: session.dedupeHorizonMs,
        });

        sendJson(
          req,
          res,
          201,
          payload,
          corsOrigin,
        );
        return;
      }

      const chunkMatch = path.match(/^\/sessions\/([^/]+)\/chunks$/);
      if (method === "POST" && chunkMatch) {
        const sessionId = chunkMatch[1];
        if (sessionId === undefined) {
          sendJson(req, res, 404, { error: "Session not found" }, corsOrigin);
          return;
        }
        const session = sessions.get(sessionId);
        if (!session) {
          sendJson(req, res, 404, { error: "Session not found" }, corsOrigin);
          return;
        }
        if (session.status !== "active") {
          sendJson(req, res, 409, { error: `Session is ${session.status}` }, corsOrigin);
          return;
        }

        const audio = await collectRequestBody(req, maxChunkBytes);
        if (audio.length === 0) {
          sendJson(req, res, 400, { error: "Audio chunk body is required" }, corsOrigin);
          return;
        }

        const fallback = `chunk-${Date.now()}.webm`;
        const filename = resolveChunkFilename(req, fallback);
        const nowMs = Date.now();
        const contentType =
          typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : undefined;
        const windowChunkCount = Math.max(1, Math.ceil(session.windowMs / session.stepMs));
        let normalizedChunk: Buffer;
        try {
          normalizedChunk = await normalizeAudioChunk(audio, filename);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to normalize audio chunk: ${message}`);
        }

        session.chunkHistory.push({ audio: normalizedChunk, filename, receivedAtMs: nowMs });
        session.lastChunkReceivedAt = new Date(nowMs).toISOString();
        if (session.chunkHistory.length > windowChunkCount) {
          session.chunkHistory.splice(0, session.chunkHistory.length - windowChunkCount);
        }
        const rollingWindowAudioBytes = session.chunkHistory.reduce((total, chunk) => total + chunk.audio.length, 0);
        pushDiagnosticEntry(session.chunkTrace, {
          receivedAt: session.lastChunkReceivedAt,
          filename,
          ...(contentType === undefined ? {} : { contentType }),
          originalByteLength: audio.length,
          normalizedByteLength: normalizedChunk.length,
          rollingWindowChunkCount: session.chunkHistory.length,
          rollingWindowAudioBytes,
        });

        const windowPcm = Buffer.concat(session.chunkHistory.map((chunk) => chunk.audio));
        const windowAudio = pcmToWav(windowPcm, 16_000, 1, 16);
        const transcriptionFilename = `window-${nowMs}.wav`;
        let transcription;
        try {
          transcription = await provider.transcribe(windowAudio, {
            filename: transcriptionFilename,
            ...(session.language === undefined ? {} : { language: session.language }),
          });
        } catch (error) {
          session.lastProviderError = error instanceof Error ? error.message : String(error);
          session.lastTranscriptionAt = new Date().toISOString();
          pushDiagnosticEntry(session.whisperResponses, {
            createdAt: session.lastTranscriptionAt,
            filename: transcriptionFilename,
            eventCount: 0,
            textPreview: "",
            rawResponse: null,
            error: session.lastProviderError,
          });
          throw error;
        }
        session.lastTranscriptionAt = new Date().toISOString();
        delete session.lastProviderError;
        session.lastProviderEventCount = transcription.events.length;
        session.lastProviderTextPreview = transcription.events.map((event) => event.text.trim()).filter((text) => text.length > 0).join(" ").slice(0, 280);
        pushDiagnosticEntry(session.whisperResponses, {
          createdAt: session.lastTranscriptionAt,
          filename: transcriptionFilename,
          eventCount: transcription.events.length,
          textPreview: session.lastProviderTextPreview,
          rawResponse: transcription.rawResponse,
        });

        purgeDedupeHistory(session.dedupeSeenAtMs, nowMs, session.dedupeHorizonMs);
        const dedupedEvents = transcription.events.filter((event) => {
          const fingerprint = buildEventFingerprint(event);
          if (fingerprint.length === 1) {
            return true;
          }
          if (session.dedupeSeenAtMs.has(fingerprint)) {
            session.dedupedEvents += 1;
            return false;
          }
          session.dedupeSeenAtMs.set(fingerprint, nowMs);
          return true;
        });

        const normalizedEvents = normalizeSequenceNumbers(dedupedEvents, session.nextSequenceNumber).map(
          (event): TranscriptEvent => ({
            ...event,
            contentType: event.contentType ?? "speech",
            streamSource: session.streamSource,
            ...(event.startTimeSeconds !== undefined
              ? { startTimeMs: Math.round(event.startTimeSeconds * 1000) }
              : {}),
            ...(event.endTimeSeconds !== undefined
              ? { endTimeMs: Math.round(event.endTimeSeconds * 1000) }
              : {}),
          }),
        );
        normalizedEvents.forEach((event) => {
          pushDiagnosticEntry(session.deliveredEvents, {
            createdAt: new Date().toISOString(),
            meetingId: session.meetingId,
            event,
          });
        });
        await deliverStreamEvents(
          session.meetingId,
          normalizedEvents,
          (meetingId, event) => apiClient.postStreamEvent(meetingId, event),
          sleep,
          deliveryConfig,
        );

        session.nextSequenceNumber += normalizedEvents.length;
        session.eventsAccepted += normalizedEvents.length;
        session.postedEvents += normalizedEvents.length;

        let autoFlushed = false;
        if (nowMs - session.lastFlushedAtMs >= autoFlushMs) {
          await apiClient.flushStream(session.meetingId);
          session.lastFlushedAtMs = nowMs;
          autoFlushed = true;
        }

        sendJson(
          req,
          res,
          200,
          {
            accepted: true,
            eventCount: normalizedEvents.length,
            autoFlushed,
          },
          corsOrigin,
        );
        return;
      }

      if (method === "GET" && path === "/diagnostics") {
        const payload = TranscriptionDiagnosticsResponseSchema.parse({
          status: "ok",
          sessions: Array.from(sessions.values()).map((session) => ({
            sessionId: session.id,
            meetingId: session.meetingId,
            status: session.status,
            startedAt: session.startedAt,
            ...(session.stoppedAt === undefined ? {} : { stoppedAt: session.stoppedAt }),
            windowMs: session.windowMs,
            stepMs: session.stepMs,
            dedupeHorizonMs: session.dedupeHorizonMs,
            bufferedEvents: session.eventsAccepted,
            postedEvents: session.postedEvents,
            dedupedEvents: session.dedupedEvents,
            ...(session.lastChunkReceivedAt === undefined
              ? {}
              : { lastChunkReceivedAt: session.lastChunkReceivedAt }),
            ...(session.lastTranscriptionAt === undefined
              ? {}
              : { lastTranscriptionAt: session.lastTranscriptionAt }),
            ...(session.lastProviderEventCount === undefined
              ? {}
              : { lastProviderEventCount: session.lastProviderEventCount }),
            ...(session.lastProviderTextPreview === undefined
              ? {}
              : { lastProviderTextPreview: session.lastProviderTextPreview }),
            ...(session.lastProviderError === undefined
              ? {}
              : { lastProviderError: session.lastProviderError }),
            activeWindowChunks: session.chunkHistory.map((chunk) => ({
              receivedAt: new Date(chunk.receivedAtMs).toISOString(),
              filename: chunk.filename,
              normalizedByteLength: chunk.audio.length,
            })),
            chunkTrace: session.chunkTrace,
            whisperResponses: session.whisperResponses,
            deliveredEvents: session.deliveredEvents,
          })),
        });

        sendJson(req, res, 200, payload, corsOrigin);
        return;
      }

      const stopMatch = path.match(/^\/sessions\/([^/]+)\/stop$/);
      if (method === "POST" && stopMatch) {
        const sessionId = stopMatch[1];
        if (sessionId === undefined) {
          sendJson(req, res, 404, { error: "Session not found" }, corsOrigin);
          return;
        }
        const session = sessions.get(sessionId);
        if (!session) {
          sendJson(req, res, 404, { error: "Session not found" }, corsOrigin);
          return;
        }

        if (session.status === "stopped") {
          sendJson(
            req,
            res,
            200,
            {
              flushed: true,
              status: session.status,
              acceptedEvents: session.eventsAccepted,
            },
            corsOrigin,
          );
          return;
        }

        session.status = "stopping";
        await apiClient.flushStream(session.meetingId);
        session.lastFlushedAtMs = Date.now();
        session.status = "stopped";
        session.stoppedAt = new Date().toISOString();

        sendJson(
          req,
          res,
          200,
          {
            flushed: true,
            status: session.status,
            acceptedEvents: session.eventsAccepted,
            stoppedAt: session.stoppedAt,
          },
          corsOrigin,
        );
        return;
      }

      const statusMatch = path.match(/^\/sessions\/([^/]+)\/status$/);
      if (method === "GET" && statusMatch) {
        const sessionId = statusMatch[1];
        if (sessionId === undefined) {
          sendJson(req, res, 404, { error: "Session not found" }, corsOrigin);
          return;
        }
        const session = sessions.get(sessionId);
        if (!session) {
          sendJson(req, res, 404, { error: "Session not found" }, corsOrigin);
          return;
        }

        const payload = TranscriptionSessionStatusResponseSchema.parse({
          status: session.status,
          bufferedEvents: session.eventsAccepted,
          postedEvents: session.postedEvents,
          dedupedEvents: session.dedupedEvents,
          windowMs: session.windowMs,
          stepMs: session.stepMs,
          dedupeHorizonMs: session.dedupeHorizonMs,
          ...(session.lastChunkReceivedAt === undefined
            ? {}
            : { lastChunkReceivedAt: session.lastChunkReceivedAt }),
          ...(session.lastTranscriptionAt === undefined
            ? {}
            : { lastTranscriptionAt: session.lastTranscriptionAt }),
          ...(session.lastProviderEventCount === undefined
            ? {}
            : { lastProviderEventCount: session.lastProviderEventCount }),
          ...(session.lastProviderTextPreview === undefined
            ? {}
            : { lastProviderTextPreview: session.lastProviderTextPreview }),
          ...(session.lastProviderError === undefined
            ? {}
            : { lastProviderError: session.lastProviderError }),
        });

        sendJson(
          req,
          res,
          200,
          payload,
          corsOrigin,
        );
        return;
      }

      sendJson(req, res, 404, { error: "Not found" }, corsOrigin);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.includes("exceeds limit") ? 413 : 500;
      sendJson(req, res, statusCode, { error: message }, corsOrigin);
    }
  });

  const host = options?.host ?? "0.0.0.0";
  const requestedPort = options?.port ?? parsePositiveInt(process.env.TRANSCRIPTION_PORT, 8788);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve listening address for transcription web server");
  }

  return {
    server,
    port: address.port,
    host,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
