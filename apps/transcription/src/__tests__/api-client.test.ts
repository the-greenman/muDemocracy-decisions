import { describe, expect, it, vi } from "vitest";
import { DecisionLoggerApiClient } from "../api-client.js";

describe("DecisionLoggerApiClient", () => {
  it("uploads whisper json using the existing transcript upload endpoint", async () => {
    const fetchMockFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          transcript: { id: "transcript-1" },
          chunks: [{ id: "chunk-1" }],
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const fetchMock = fetchMockFn as unknown as typeof fetch;

    const client = new DecisionLoggerApiClient("http://localhost:3000", "api-key", fetchMock);
    const result = await client.uploadWhisperJson("meeting-123", { segments: [] }, "speaker");

    expect(result.transcript.id).toBe("transcript-1");
    expect(fetchMockFn).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMockFn.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:3000/api/meetings/meeting-123/transcripts/upload");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "content-type": "application/json",
      "x-api-key": "api-key",
    });

    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body).toEqual({
      content: JSON.stringify({ segments: [] }),
      format: "json",
      chunkStrategy: "speaker",
    });
  });
});
