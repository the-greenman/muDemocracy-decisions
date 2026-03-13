import { afterEach, describe, expect, it, vi } from "vitest";
import type { ITranscriptionProvider } from "../providers/interface.js";
import { startWebServer } from "../web-server.js";

const runningServers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  while (runningServers.length > 0) {
    const server = runningServers.pop();
    if (server) {
      await server.close();
    }
  }
});

function pcmToWav(pcmData: Buffer): Buffer {
  const sampleRate = 16_000;
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

describe("web transcription server", () => {
  it("creates a session, accepts chunk uploads, reports status, and flushes on stop", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [
          { text: "hello world", startTimeSeconds: 0.2 },
          { text: "second line", startTimeSeconds: 1.1 },
        ],
        rawResponse: {},
      }),
    };

    const apiClient = {
      postStreamEvent: vi.fn().mockResolvedValue(undefined),
      flushStream: vi.fn().mockResolvedValue(undefined),
    };

    const server = await startWebServer({
      port: 0,
      host: "127.0.0.1",
      provider,
      apiClient,
      autoFlushMs: 1,
      normalizeAudioChunk: async (audio) => audio,
    });
    runningServers.push(server);

    const baseUrl = `http://127.0.0.1:${server.port}`;

    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        meetingId: "meeting-browser-1",
        language: "en",
      }),
    });

    expect(createResponse.status).toBe(201);
    const createPayload = (await createResponse.json()) as {
      sessionId: string;
      windowMs: number;
      stepMs: number;
      dedupeHorizonMs: number;
    };
    expect(createPayload.sessionId).toBeTruthy();
    expect(createPayload.windowMs).toBe(30_000);
    expect(createPayload.stepMs).toBe(10_000);
    expect(createPayload.dedupeHorizonMs).toBe(90_000);

    const chunkResponse = await fetch(
      `${baseUrl}/sessions/${createPayload.sessionId}/chunks?filename=first.webm`,
      {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
        },
        body: Buffer.from("fake-audio"),
      },
    );

    expect(chunkResponse.status).toBe(200);
    const chunkPayload = (await chunkResponse.json()) as {
      accepted: boolean;
      eventCount: number;
      autoFlushed: boolean;
    };
    expect(chunkPayload).toEqual({ accepted: true, eventCount: 2, autoFlushed: true });

    expect(provider.transcribe).toHaveBeenCalledWith(pcmToWav(Buffer.from("fake-audio")), {
      filename: expect.stringMatching(/^window-\d+\.wav$/),
      language: "en",
    });
    expect(apiClient.postStreamEvent).toHaveBeenNthCalledWith(1, "meeting-browser-1", {
      text: "hello world",
      startTimeSeconds: 0.2,
      sequenceNumber: 1,
    });
    expect(apiClient.postStreamEvent).toHaveBeenNthCalledWith(2, "meeting-browser-1", {
      text: "second line",
      startTimeSeconds: 1.1,
      sequenceNumber: 2,
    });

    const statusResponse = await fetch(`${baseUrl}/sessions/${createPayload.sessionId}/status`);
    expect(statusResponse.status).toBe(200);
    const statusPayload = (await statusResponse.json()) as {
      status: string;
      bufferedEvents: number;
      postedEvents: number;
      dedupedEvents: number;
      windowMs: number;
      stepMs: number;
      dedupeHorizonMs: number;
    };
    expect(statusPayload.status).toBe("active");
    expect(statusPayload.bufferedEvents).toBe(2);
    expect(statusPayload.postedEvents).toBe(2);
    expect(statusPayload.dedupedEvents).toBe(0);
    expect(statusPayload.windowMs).toBe(30_000);
    expect(statusPayload.stepMs).toBe(10_000);
    expect(statusPayload.dedupeHorizonMs).toBe(90_000);

    const diagnosticsResponse = await fetch(`${baseUrl}/diagnostics`);
    expect(diagnosticsResponse.status).toBe(200);
    const diagnosticsPayload = (await diagnosticsResponse.json()) as {
      status: string;
      sessions: Array<{
        sessionId: string;
        meetingId: string;
        chunkTrace: Array<{
          filename: string;
          contentType?: string;
          originalByteLength: number;
          normalizedByteLength: number;
          rollingWindowChunkCount: number;
        }>;
        activeWindowChunks: Array<{
          filename: string;
          normalizedByteLength: number;
        }>;
        whisperResponses: Array<{
          filename: string;
          eventCount: number;
          textPreview: string;
          rawResponse: unknown;
        }>;
        deliveredEvents: Array<{
          meetingId: string;
          event: {
            text: string;
            sequenceNumber?: number;
          };
        }>;
      }>;
    };
    expect(diagnosticsPayload.status).toBe("ok");
    const diagnosticsSession = diagnosticsPayload.sessions.find(
      (session) => session.sessionId === createPayload.sessionId,
    );
    expect(diagnosticsSession).toBeTruthy();
    expect(diagnosticsSession?.meetingId).toBe("meeting-browser-1");
    expect(diagnosticsSession?.chunkTrace).toHaveLength(1);
    expect(diagnosticsSession?.chunkTrace[0]).toMatchObject({
      filename: "first.webm",
      contentType: "application/octet-stream",
      originalByteLength: 10,
      normalizedByteLength: 10,
      rollingWindowChunkCount: 1,
    });
    expect(diagnosticsSession?.activeWindowChunks).toEqual([
      expect.objectContaining({ filename: "first.webm", normalizedByteLength: 10 }),
    ]);
    expect(diagnosticsSession?.whisperResponses).toHaveLength(1);
    expect(diagnosticsSession?.whisperResponses[0]).toMatchObject({
      eventCount: 2,
      rawResponse: {},
    });
    expect(diagnosticsSession?.whisperResponses[0]?.textPreview).toContain("hello world");
    expect(diagnosticsSession?.deliveredEvents).toHaveLength(2);
    expect(diagnosticsSession?.deliveredEvents[0]).toMatchObject({
      meetingId: "meeting-browser-1",
      event: { text: "hello world", sequenceNumber: 1 },
    });
    expect(diagnosticsSession?.deliveredEvents[1]).toMatchObject({
      meetingId: "meeting-browser-1",
      event: { text: "second line", sequenceNumber: 2 },
    });

    const stopResponse = await fetch(`${baseUrl}/sessions/${createPayload.sessionId}/stop`, {
      method: "POST",
    });
    expect(stopResponse.status).toBe(200);
    expect(apiClient.flushStream).toHaveBeenNthCalledWith(1, "meeting-browser-1");
    expect(apiClient.flushStream).toHaveBeenNthCalledWith(2, "meeting-browser-1");

    const stoppedStatusResponse = await fetch(
      `${baseUrl}/sessions/${createPayload.sessionId}/status`,
    );
    const stoppedStatusPayload = (await stoppedStatusResponse.json()) as { status: string };
    expect(stoppedStatusPayload.status).toBe("stopped");
  });

  it("returns 400 when meetingId is missing in session create request", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [],
        rawResponse: {},
      }),
    };

    const server = await startWebServer({
      port: 0,
      host: "127.0.0.1",
      provider,
      apiClient: {
        postStreamEvent: vi.fn().mockResolvedValue(undefined),
        flushStream: vi.fn().mockResolvedValue(undefined),
      },
      normalizeAudioChunk: async (audio) => audio,
    });
    runningServers.push(server);

    const baseUrl = `http://127.0.0.1:${server.port}`;

    const response = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error.length).toBeGreaterThan(0);
  });

  it("returns 400 when stepMs exceeds windowMs", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [],
        rawResponse: {},
      }),
    };

    const server = await startWebServer({
      port: 0,
      host: "127.0.0.1",
      provider,
      apiClient: {
        postStreamEvent: vi.fn().mockResolvedValue(undefined),
        flushStream: vi.fn().mockResolvedValue(undefined),
      },
      normalizeAudioChunk: async (audio) => audio,
    });
    runningServers.push(server);

    const baseUrl = `http://127.0.0.1:${server.port}`;

    const response = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        meetingId: "meeting-browser-2",
        windowMs: 10_000,
        stepMs: 20_000,
      }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("stepMs");
  });

  it("dedupes repeated transcript events across chunks within dedupe horizon", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi
        .fn()
        .mockResolvedValueOnce({
          events: [{ text: "same line", startTimeSeconds: 0.2 }],
          rawResponse: {},
        })
        .mockResolvedValueOnce({
          events: [{ text: "same line", startTimeSeconds: 0.3 }],
          rawResponse: {},
        }),
    };

    const apiClient = {
      postStreamEvent: vi.fn().mockResolvedValue(undefined),
      flushStream: vi.fn().mockResolvedValue(undefined),
    };

    const server = await startWebServer({
      port: 0,
      host: "127.0.0.1",
      provider,
      apiClient,
      autoFlushMs: 100_000,
      normalizeAudioChunk: async (audio) => audio,
    });
    runningServers.push(server);

    const baseUrl = `http://127.0.0.1:${server.port}`;
    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meetingId: "meeting-browser-dedupe" }),
    });
    const createPayload = (await createResponse.json()) as { sessionId: string };

    const firstChunkResponse = await fetch(
      `${baseUrl}/sessions/${createPayload.sessionId}/chunks?filename=first.webm`,
      {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: Buffer.from("audio-1"),
      },
    );
    expect(firstChunkResponse.status).toBe(200);
    const firstPayload = (await firstChunkResponse.json()) as { eventCount: number };
    expect(firstPayload.eventCount).toBe(1);

    const secondChunkResponse = await fetch(
      `${baseUrl}/sessions/${createPayload.sessionId}/chunks?filename=second.webm`,
      {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: Buffer.from("audio-2"),
      },
    );
    expect(secondChunkResponse.status).toBe(200);
    const secondPayload = (await secondChunkResponse.json()) as { eventCount: number };
    expect(secondPayload.eventCount).toBe(0);

    const statusResponse = await fetch(`${baseUrl}/sessions/${createPayload.sessionId}/status`);
    const statusPayload = (await statusResponse.json()) as {
      postedEvents: number;
      dedupedEvents: number;
      bufferedEvents: number;
    };
    expect(statusPayload.postedEvents).toBe(1);
    expect(statusPayload.dedupedEvents).toBe(1);
    expect(statusPayload.bufferedEvents).toBe(1);

    expect(apiClient.postStreamEvent).toHaveBeenCalledTimes(1);
  });

  it("transcribes a rolling window using the latest window-sized chunk history", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi
        .fn()
        .mockResolvedValue({ events: [{ text: "line", startTimeSeconds: 0.2 }], rawResponse: {} }),
    };

    const apiClient = {
      postStreamEvent: vi.fn().mockResolvedValue(undefined),
      flushStream: vi.fn().mockResolvedValue(undefined),
    };

    const server = await startWebServer({
      port: 0,
      host: "127.0.0.1",
      provider,
      apiClient,
      autoFlushMs: 100_000,
      normalizeAudioChunk: async (audio) => audio,
    });
    runningServers.push(server);

    const baseUrl = `http://127.0.0.1:${server.port}`;
    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        meetingId: "meeting-browser-window",
        windowMs: 30_000,
        stepMs: 10_000,
      }),
    });
    const createPayload = (await createResponse.json()) as { sessionId: string };

    const chunks = [Buffer.from("a"), Buffer.from("b"), Buffer.from("c"), Buffer.from("d")];
    for (const [index, chunk] of chunks.entries()) {
      const response = await fetch(
        `${baseUrl}/sessions/${createPayload.sessionId}/chunks?filename=chunk-${index + 1}.webm`,
        {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: chunk,
        },
      );
      expect(response.status).toBe(200);
    }

    expect(provider.transcribe).toHaveBeenCalledTimes(4);
    expect(provider.transcribe).toHaveBeenNthCalledWith(
      1,
      pcmToWav(Buffer.concat([Buffer.from("a")])),
      expect.objectContaining({ filename: expect.stringMatching(/^window-\d+\.wav$/) }),
    );
    expect(provider.transcribe).toHaveBeenNthCalledWith(
      2,
      pcmToWav(Buffer.concat([Buffer.from("a"), Buffer.from("b")])),
      expect.objectContaining({ filename: expect.stringMatching(/^window-\d+\.wav$/) }),
    );
    expect(provider.transcribe).toHaveBeenNthCalledWith(
      3,
      pcmToWav(Buffer.concat([Buffer.from("a"), Buffer.from("b"), Buffer.from("c")])),
      expect.objectContaining({ filename: expect.stringMatching(/^window-\d+\.wav$/) }),
    );
    expect(provider.transcribe).toHaveBeenNthCalledWith(
      4,
      pcmToWav(Buffer.concat([Buffer.from("b"), Buffer.from("c"), Buffer.from("d")])),
      expect.objectContaining({ filename: expect.stringMatching(/^window-\d+\.wav$/) }),
    );
  });
});
