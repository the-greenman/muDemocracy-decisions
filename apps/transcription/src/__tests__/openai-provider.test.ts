import { describe, expect, it, vi } from "vitest";
import { OpenAIWhisperProvider } from "../providers/openai.js";

describe("OpenAIWhisperProvider", () => {
  it("maps verbose_json segments into transcript events", async () => {
    const fetchMockFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          text: "hello world",
          segments: [
            { id: 1, text: " hello ", start: 0.1, end: 1.4 },
            { id: 2, text: "world", start: 1.4, end: 2.8 },
            { id: 3, text: "   ", start: 2.8, end: 3.1 },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const fetchMock = fetchMockFn as unknown as typeof fetch;

    const provider = new OpenAIWhisperProvider("test-key", fetchMock);

    const result = await provider.transcribe(Buffer.from("abc"), { filename: "sample.wav" });

    expect(result.events).toEqual([
      {
        text: "hello",
        sequenceNumber: 1,
        startTimeSeconds: 0.1,
        endTimeSeconds: 1.4,
      },
      {
        text: "world",
        sequenceNumber: 2,
        startTimeSeconds: 1.4,
        endTimeSeconds: 2.8,
      },
    ]);

    expect(fetchMockFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchMockFn.mock.calls[0] ?? [];
    expect(init?.headers).toEqual({ Authorization: "Bearer test-key" });

    const body = init?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("model")).toBe("whisper-1");
    expect((body as FormData).get("response_format")).toBe("verbose_json");
  });
});
