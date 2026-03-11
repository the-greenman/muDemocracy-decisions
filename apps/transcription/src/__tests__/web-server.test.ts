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
    const createPayload = (await createResponse.json()) as { sessionId: string };
    expect(createPayload.sessionId).toBeTruthy();

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
    const chunkPayload = (await chunkResponse.json()) as { accepted: boolean; eventCount: number };
    expect(chunkPayload).toEqual({ accepted: true, eventCount: 2 });

    expect(provider.transcribe).toHaveBeenCalledWith(Buffer.from("fake-audio"), {
      filename: "first.webm",
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
    };
    expect(statusPayload.status).toBe("active");
    expect(statusPayload.bufferedEvents).toBe(2);

    const stopResponse = await fetch(`${baseUrl}/sessions/${createPayload.sessionId}/stop`, {
      method: "POST",
    });
    expect(stopResponse.status).toBe(200);
    expect(apiClient.flushStream).toHaveBeenCalledWith("meeting-browser-1");

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
    expect(payload.error).toContain("meetingId");
  });
});
