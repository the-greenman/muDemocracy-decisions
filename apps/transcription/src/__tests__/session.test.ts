import { describe, expect, it, vi } from "vitest";
import { runBatchTranscription, runLiveTranscription } from "../session.js";
import type { ITranscriptionProvider } from "../providers/interface.js";

describe("runBatchTranscription", () => {
  it("uses upload mode to send raw whisper json once", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [{ text: "hello", sequenceNumber: 1 }],
        rawResponse: { segments: [{ id: 1, text: "hello" }] },
      }),
    };

    const apiClient = {
      uploadWhisperJson: vi.fn().mockResolvedValue({
        transcript: { id: "raw-1" },
        chunks: [{ id: "chunk-1" }],
      }),
      postStreamEvent: vi.fn(),
      flushStream: vi.fn(),
    };

    const readAudioFile = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runBatchTranscription(
      {
        audioFilePath: "/tmp/example.wav",
        meetingId: "meeting-1",
        mode: "upload",
        chunkStrategy: "speaker",
      },
      {
        provider,
        apiClient,
        readAudioFile,
      },
    );

    expect(readAudioFile).toHaveBeenCalledWith("/tmp/example.wav");
    expect(provider.transcribe).toHaveBeenCalledTimes(1);
    expect(apiClient.uploadWhisperJson).toHaveBeenCalledWith(
      "meeting-1",
      { segments: [{ id: 1, text: "hello" }] },
      "speaker",
    );
    expect(apiClient.postStreamEvent).not.toHaveBeenCalled();
    expect(apiClient.flushStream).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("uses stream mode to send each event then flush", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [
          { text: "first", sequenceNumber: 1 },
          { text: "second", sequenceNumber: 2 },
        ],
        rawResponse: { ignored: true },
      }),
    };

    const apiClient = {
      uploadWhisperJson: vi.fn(),
      postStreamEvent: vi.fn().mockResolvedValue(undefined),
      flushStream: vi.fn().mockResolvedValue(undefined),
    };

    const readAudioFile = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runBatchTranscription(
      {
        audioFilePath: "/tmp/example.wav",
        meetingId: "meeting-2",
        mode: "stream",
        chunkStrategy: "speaker",
      },
      {
        provider,
        apiClient,
        readAudioFile,
      },
    );

    expect(apiClient.uploadWhisperJson).not.toHaveBeenCalled();
    expect(apiClient.postStreamEvent).toHaveBeenCalledTimes(2);
    expect(apiClient.postStreamEvent).toHaveBeenNthCalledWith(1, "meeting-2", {
      text: "first",
      sequenceNumber: 1,
    });
    expect(apiClient.postStreamEvent).toHaveBeenNthCalledWith(2, "meeting-2", {
      text: "second",
      sequenceNumber: 2,
    });
    expect(apiClient.flushStream).toHaveBeenCalledWith("meeting-2");

    logSpy.mockRestore();
  });

  it("retries stream event delivery with exponential backoff", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [{ text: "retry-me", sequenceNumber: 1 }],
        rawResponse: {},
      }),
    };

    const apiClient = {
      uploadWhisperJson: vi.fn(),
      postStreamEvent: vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary failure 1"))
        .mockRejectedValueOnce(new Error("temporary failure 2"))
        .mockResolvedValueOnce(undefined),
      flushStream: vi.fn().mockResolvedValue(undefined),
    };

    const sleep = vi.fn().mockResolvedValue(undefined);
    const readAudioFile = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runBatchTranscription(
      {
        audioFilePath: "/tmp/example.wav",
        meetingId: "meeting-retry",
        mode: "stream",
        chunkStrategy: "speaker",
      },
      {
        provider,
        apiClient,
        readAudioFile,
        sleep,
        deliveryConfig: {
          maxAttempts: 3,
          baseBackoffMs: 10,
          maxQueueSize: 10,
        },
      },
    );

    expect(apiClient.postStreamEvent).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
    expect(apiClient.flushStream).toHaveBeenCalledWith("meeting-retry");
    logSpy.mockRestore();
  });

  it("drains events in bounded queue batches", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [
          { text: "one", sequenceNumber: 1 },
          { text: "two", sequenceNumber: 2 },
        ],
        rawResponse: {},
      }),
    };

    const apiClient = {
      uploadWhisperJson: vi.fn(),
      postStreamEvent: vi.fn().mockResolvedValue(undefined),
      flushStream: vi.fn().mockResolvedValue(undefined),
    };

    const readAudioFile = vi.fn().mockResolvedValue(Buffer.from("audio"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runBatchTranscription(
      {
        audioFilePath: "/tmp/example.wav",
        meetingId: "meeting-overflow",
        mode: "stream",
        chunkStrategy: "speaker",
      },
      {
        provider,
        apiClient,
        readAudioFile,
        deliveryConfig: {
          maxAttempts: 2,
          baseBackoffMs: 10,
          maxQueueSize: 1,
        },
      },
    );

    expect(apiClient.postStreamEvent).toHaveBeenCalledTimes(2);
    expect(apiClient.flushStream).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });
});

describe("runLiveTranscription", () => {
  it("transcribes chunk source events, streams them, and flushes once", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi
        .fn()
        .mockResolvedValueOnce({
          events: [{ text: "first", sequenceNumber: 1, startTimeSeconds: 0.2 }],
          rawResponse: {},
        })
        .mockResolvedValueOnce({
          events: [{ text: "second", sequenceNumber: 2, startTimeSeconds: 0.4 }],
          rawResponse: {},
        }),
    };

    const apiClient = {
      postStreamEvent: vi.fn().mockResolvedValue(undefined),
      flushStream: vi.fn().mockResolvedValue(undefined),
    };

    async function* chunks() {
      yield { filename: "chunk-000001.wav", audio: Buffer.from("a") };
      yield { filename: "chunk-000002.wav", audio: Buffer.from("b") };
    }

    const stop = vi.fn().mockResolvedValue(undefined);
    const registerSignalHandlers = vi.fn().mockImplementation(() => () => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runLiveTranscription(
      {
        meetingId: "meeting-live-1",
        chunkMs: 1000,
      },
      {
        provider,
        apiClient,
        createChunkSource: vi.fn().mockResolvedValue({
          chunks: chunks(),
          stop,
        }),
        registerSignalHandlers,
      },
    );

    expect(provider.transcribe).toHaveBeenCalledTimes(2);
    expect(apiClient.postStreamEvent).toHaveBeenCalledTimes(2);
    expect(apiClient.postStreamEvent).toHaveBeenNthCalledWith(1, "meeting-live-1", {
      text: "first",
      sequenceNumber: 1,
      startTimeSeconds: 0.2,
    });
    expect(apiClient.postStreamEvent).toHaveBeenNthCalledWith(2, "meeting-live-1", {
      text: "second",
      sequenceNumber: 2,
      startTimeSeconds: 1.4,
    });
    expect(apiClient.flushStream).toHaveBeenCalledTimes(1);
    expect(apiClient.flushStream).toHaveBeenCalledWith("meeting-live-1");
    expect(stop).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });

  it("handles shutdown callback and does not flush twice", async () => {
    const provider: ITranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({
        events: [{ text: "first", sequenceNumber: 1, startTimeSeconds: 0.1 }],
        rawResponse: {},
      }),
    };

    const apiClient = {
      postStreamEvent: vi.fn().mockResolvedValue(undefined),
      flushStream: vi.fn().mockResolvedValue(undefined),
    };

    const deferredChunks: Array<{ filename: string; audio: Buffer }> = [
      { filename: "chunk-1.wav", audio: Buffer.from("a") },
    ];
    async function* chunks() {
      for (const chunk of deferredChunks) {
        yield chunk;
      }
    }

    const stop = vi.fn().mockResolvedValue(undefined);
    let shutdownHandler: (() => Promise<void>) | undefined;
    const registerSignalHandlers = vi.fn().mockImplementation((handler: () => Promise<void>) => {
      shutdownHandler = handler;
      return () => undefined;
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runLiveTranscription(
      {
        meetingId: "meeting-live-2",
        chunkMs: 1000,
      },
      {
        provider,
        apiClient,
        createChunkSource: vi.fn().mockResolvedValue({
          chunks: chunks(),
          stop,
        }),
        registerSignalHandlers,
      },
    );

    await shutdownHandler?.();

    expect(apiClient.flushStream).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });
});
