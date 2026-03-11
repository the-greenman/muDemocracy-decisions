import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
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
  corsOrigin?: string;
}

interface SessionState {
  id: string;
  meetingId: string;
  language?: string;
  status: "active" | "stopping" | "stopped";
  startedAt: string;
  stoppedAt?: string;
  eventsAccepted: number;
  nextSequenceNumber: number;
}

interface RunningWebServer {
  server: Server;
  port: number;
  host: string;
  close: () => Promise<void>;
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

async function parseJsonBody<T>(req: IncomingMessage, maxBytes: number): Promise<T> {
  const body = await collectRequestBody(req, maxBytes);
  if (body.length === 0) {
    throw new Error("Request body is required");
  }
  const decoded = JSON.parse(body.toString("utf8")) as T;
  return decoded;
}

function resolveChunkFilename(req: IncomingMessage, fallback: string): string {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const fromQuery = requestUrl.searchParams.get("filename") ?? undefined;
  const fromHeader = req.headers["x-audio-filename"];
  if (typeof fromHeader === "string" && fromHeader.trim().length > 0) {
    return fromHeader;
  }
  if (fromQuery && fromQuery.trim().length > 0) {
    return fromQuery;
  }
  return fallback;
}

export async function startWebServer(options?: StartWebServerOptions): Promise<RunningWebServer> {
  const apiUrl = resolveDecisionLoggerApiUrl();
  const apiKey = process.env.DECISION_LOGGER_API_KEY;

  const provider = options?.provider ?? createProviderFromEnv();
  const apiClient = options?.apiClient ?? new DecisionLoggerApiClient(apiUrl, apiKey);
  const sleep = options?.sleep ?? wait;
  const deliveryConfig = resolveDeliveryConfig(options?.deliveryConfig);
  const maxChunkBytes =
    options?.maxChunkBytes ??
    parsePositiveInt(process.env.TRANSCRIPTION_MAX_CHUNK_BYTES, 25_000_000);
  const corsOrigin = options?.corsOrigin ?? process.env.TRANSCRIPTION_CORS_ORIGIN ?? "*";

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

      if (method === "POST" && path === "/sessions") {
        type SessionCreateBody = { meetingId?: string; language?: string };
        const body = await parseJsonBody<SessionCreateBody>(req, maxChunkBytes);
        const meetingId = body.meetingId?.trim();
        if (!meetingId) {
          sendJson(req, res, 400, { error: "meetingId is required" }, corsOrigin);
          return;
        }

        const session: SessionState = {
          id: randomUUID(),
          meetingId,
          ...(body.language === undefined ? {} : { language: body.language }),
          status: "active",
          startedAt: new Date().toISOString(),
          eventsAccepted: 0,
          nextSequenceNumber: 1,
        };
        sessions.set(session.id, session);

        sendJson(
          req,
          res,
          201,
          {
            sessionId: session.id,
            meetingId: session.meetingId,
            startedAt: session.startedAt,
          },
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
        const transcription = await provider.transcribe(audio, {
          filename,
          ...(session.language === undefined ? {} : { language: session.language }),
        });

        const normalizedEvents = normalizeSequenceNumbers(
          transcription.events,
          session.nextSequenceNumber,
        );
        await deliverStreamEvents(
          session.meetingId,
          normalizedEvents,
          (meetingId, event) => apiClient.postStreamEvent(meetingId, event),
          sleep,
          deliveryConfig,
        );

        session.nextSequenceNumber += normalizedEvents.length;
        session.eventsAccepted += normalizedEvents.length;

        sendJson(
          req,
          res,
          200,
          {
            accepted: true,
            eventCount: normalizedEvents.length,
          },
          corsOrigin,
        );
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

        sendJson(
          req,
          res,
          200,
          {
            sessionId: session.id,
            meetingId: session.meetingId,
            status: session.status,
            bufferedEvents: session.eventsAccepted,
            startedAt: session.startedAt,
            ...(session.stoppedAt === undefined ? {} : { stoppedAt: session.stoppedAt }),
          },
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
