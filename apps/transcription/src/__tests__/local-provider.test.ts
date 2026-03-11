import { describe, expect, it, vi } from "vitest";
import { LocalWhisperProvider } from "../providers/local.js";

describe("LocalWhisperProvider", () => {
  it("maps local whisper segments into transcript events", async () => {
    const fetchMockFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          text: "hello world",
          segments: [
            { id: 10, text: " hello ", start: 0.1, end: 1.4 },
            { id: 11, text: "world", start: 1.4, end: 2.8 },
            { id: 12, text: "   ", start: 2.8, end: 3.1 },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const fetchMock = fetchMockFn as unknown as typeof fetch;

    const provider = new LocalWhisperProvider("http://localhost:9000", fetchMock);

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
    const [url, init] = fetchMockFn.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:9000/asr?output=json");
    expect(init?.method).toBe("POST");

    const body = init?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("audio_file")).toBeTruthy();
  });
});
