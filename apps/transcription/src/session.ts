import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readdir, readFile as readFileFromDisk, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DecisionLoggerApiClient } from './api-client.js';
import { formatEventPreviewLine, formatEventsAsSrt, formatEventsAsText } from './output-format.js';
import { createProviderFromEnv } from './providers/index.js';
import type { ITranscriptionProvider, TranscriptEvent } from './providers/interface.js';
import {
  deliverStreamEvents,
  normalizeSequenceNumbers,
  type StreamDeliveryConfig,
} from './stream-delivery.js';

export interface BatchTranscriptionOptions {
  audioFilePath: string;
  meetingId: string;
  language?: string;
  mode: 'upload' | 'stream';
  chunkStrategy: 'fixed' | 'semantic' | 'speaker' | 'streaming';
}

interface BatchTranscriptionDependencies {
  provider: ITranscriptionProvider;
  apiClient: {
    uploadWhisperJson: (
      meetingId: string,
      rawResponse: unknown,
      chunkStrategy: 'fixed' | 'semantic' | 'speaker' | 'streaming',
    ) => Promise<{ transcript: { id: string }; chunks: Array<{ id: string }> }>;
    postStreamEvent: (meetingId: string, event: TranscriptEvent) => Promise<void>;
    flushStream: (meetingId: string) => Promise<void>;
  };
  readAudioFile: (path: string) => Promise<Buffer>;
  sleep: (ms: number) => Promise<void>;
  deliveryConfig: StreamDeliveryConfig;
}

export interface LiveTranscriptionOptions {
  meetingId: string;
  language?: string;
  chunkMs?: number;
}

interface LiveAudioChunk {
  filename: string;
  audio: Buffer;
}

type CleanupFn = () => Promise<void> | void;

interface LiveChunkSource {
  chunks: AsyncGenerator<LiveAudioChunk>;
  stop: CleanupFn;
}

interface LiveTranscriptionDependencies {
  provider: ITranscriptionProvider;
  apiClient: {
    postStreamEvent: (meetingId: string, event: TranscriptEvent) => Promise<void>;
    flushStream: (meetingId: string) => Promise<void>;
  };
  createChunkSource: (chunkMs: number) => Promise<LiveChunkSource>;
  registerSignalHandlers: (onShutdown: CleanupFn) => CleanupFn;
  sleep: (ms: number) => Promise<void>;
  deliveryConfig: StreamDeliveryConfig;
}

export interface LocalTranscriptionOptions {
  audioFilePath: string;
  language?: string;
  outputPath?: string;
  outputTextPath?: string;
  outputSrtPath?: string;
}

export interface UploadSmokeOptions {
  audioFilePath: string;
  meetingId?: string;
  language?: string;
  chunkStrategy: 'fixed' | 'semantic' | 'speaker' | 'streaming';
  mode: 'upload' | 'stream';
}

function buildBatchDependencies(deps?: Partial<BatchTranscriptionDependencies>): BatchTranscriptionDependencies {
  const apiUrl = process.env.DECISION_LOGGER_API_URL ?? 'http://localhost:3001';
  const apiKey = process.env.DECISION_LOGGER_API_KEY;
  return {
    provider: deps?.provider ?? createProviderFromEnv(),
    apiClient: deps?.apiClient ?? new DecisionLoggerApiClient(apiUrl, apiKey),
    readAudioFile: deps?.readAudioFile ?? readFile,
    sleep: deps?.sleep ?? wait,
    deliveryConfig: resolveDeliveryConfig(deps?.deliveryConfig),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createDefaultLiveDependencies(
  deps?: Partial<LiveTranscriptionDependencies>,
): LiveTranscriptionDependencies {
  const apiUrl = process.env.DECISION_LOGGER_API_URL ?? 'http://localhost:3001';
  const apiKey = process.env.DECISION_LOGGER_API_KEY;
  const defaultRegisterSignalHandlers = (onShutdown: CleanupFn): CleanupFn => {
    let shutdownPromise: Promise<void> | null = null;
    const handler = () => {
      if (shutdownPromise === null) {
        shutdownPromise = Promise.resolve(onShutdown()).catch(() => undefined);
      }
    };
    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);

    return () => {
      process.off('SIGINT', handler);
      process.off('SIGTERM', handler);
    };
  };

  return {
    provider: deps?.provider ?? createProviderFromEnv(),
    apiClient: deps?.apiClient ?? new DecisionLoggerApiClient(apiUrl, apiKey),
    createChunkSource: deps?.createChunkSource ?? createFfmpegChunkSource,
    registerSignalHandlers: deps?.registerSignalHandlers ?? defaultRegisterSignalHandlers,
    sleep: deps?.sleep ?? wait,
    deliveryConfig: resolveDeliveryConfig(deps?.deliveryConfig),
  };
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

function resolveDeliveryConfig(
  override?: Partial<StreamDeliveryConfig>,
): StreamDeliveryConfig {
  return {
    maxAttempts: override?.maxAttempts
      ?? parsePositiveInt(process.env.STREAM_MAX_RETRY_ATTEMPTS, 5),
    baseBackoffMs: override?.baseBackoffMs
      ?? parsePositiveInt(process.env.STREAM_RETRY_BASE_MS, 250),
    maxQueueSize: override?.maxQueueSize
      ?? parsePositiveInt(process.env.STREAM_MAX_OUTBOUND_QUEUE, 200),
  };
}


async function createFfmpegChunkSource(chunkMs: number): Promise<LiveChunkSource> {
  const chunkSeconds = Math.max(1, Math.round(chunkMs / 1000));
  const inputFormat = process.env.TRANSCRIPTION_LIVE_INPUT_FORMAT ?? 'pulse';
  const inputDevice = process.env.TRANSCRIPTION_LIVE_INPUT_DEVICE ?? 'default';
  const ffmpegBin = process.env.FFMPEG_BIN ?? 'ffmpeg';
  const captureDirectory = await mkdtemp(join(tmpdir(), 'decision-logger-live-'));
  const segmentPattern = join(captureDirectory, 'chunk-%06d.wav');

  const child = spawn(
    ffmpegBin,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      inputFormat,
      '-i',
      inputDevice,
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      'segment',
      '-segment_time',
      String(chunkSeconds),
      '-reset_timestamps',
      '1',
      segmentPattern,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let stopped = false;
  let childExited = false;
  const processed = new Set<string>();
  let childError = '';

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    childError += chunk;
  });
  child.on('exit', () => {
    childExited = true;
  });

  const chunks = (async function* generator(): AsyncGenerator<LiveAudioChunk> {
    while (!stopped) {
      if (childExited) {
        break;
      }

      const files = (await readdir(captureDirectory))
        .filter((file) => file.endsWith('.wav'))
        .sort();

      for (const file of files) {
        if (processed.has(file)) {
          continue;
        }

        // Skip the newest segment while ffmpeg is still writing it.
        if (!childExited && file === files[files.length - 1]) {
          continue;
        }

        const fullPath = join(captureDirectory, file);
        const audio = await readFileFromDisk(fullPath);
        processed.add(file);
        yield { filename: file, audio };
      }

      await wait(250);
    }

    // Drain remaining chunks on shutdown.
    const files = (await readdir(captureDirectory))
      .filter((file) => file.endsWith('.wav'))
      .sort();
    for (const file of files) {
      if (processed.has(file)) {
        continue;
      }
      const fullPath = join(captureDirectory, file);
      const audio = await readFileFromDisk(fullPath);
      processed.add(file);
      yield { filename: file, audio };
    }
  })();

  const stop = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    stopped = true;
    if (!child.killed) {
      child.kill('SIGTERM');
    }
    await waitForProcessExit(child);
    await rm(captureDirectory, { recursive: true, force: true });
    if (child.exitCode !== null && child.exitCode !== 0 && childError.trim().length > 0) {
      throw new Error(`ffmpeg exited with code ${child.exitCode}: ${childError.trim()}`);
    }
  };

  return { chunks, stop };
}

function waitForProcessExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once('exit', () => resolve());
  });
}

function offsetEvents(events: TranscriptEvent[], offsetSeconds: number): TranscriptEvent[] {
  return events.map((event) => ({
    ...event,
    ...(event.startTimeSeconds === undefined
      ? {}
      : { startTimeSeconds: event.startTimeSeconds + offsetSeconds }),
    ...(event.endTimeSeconds === undefined
      ? {}
      : { endTimeSeconds: event.endTimeSeconds + offsetSeconds }),
  }));
}

export async function runLiveTranscription(
  options: LiveTranscriptionOptions,
  deps?: Partial<LiveTranscriptionDependencies>,
): Promise<void> {
  const { provider, apiClient, createChunkSource, registerSignalHandlers, sleep, deliveryConfig } =
    createDefaultLiveDependencies(deps);
  const chunkMs = options.chunkMs ?? Number(process.env.STREAM_CHUNK_MS ?? '30000');
  const chunkSource = await createChunkSource(chunkMs);
  let stopRequested = false;
  let flushCompleted = false;
  let chunkCount = 0;
  let sentEvents = 0;
  let nextSequenceNumber = 1;

  const flushAndStop = async (): Promise<void> => {
    if (flushCompleted) {
      return;
    }
    flushCompleted = true;
    stopRequested = true;
    await chunkSource.stop();
    await apiClient.flushStream(options.meetingId);
    console.log('Live transcription stream flushed.');
  };

  const unregisterSignals = registerSignalHandlers(flushAndStop);

  try {
    for await (const chunk of chunkSource.chunks) {
      if (stopRequested) {
        break;
      }

      const transcribeOptions: { filename: string; language?: string } = {
        filename: chunk.filename,
      };
      if (options.language !== undefined) {
        transcribeOptions.language = options.language;
      }

      const transcription = await provider.transcribe(chunk.audio, transcribeOptions);
      const timeAdjusted = offsetEvents(transcription.events, (chunkMs / 1000) * chunkCount);
      const adjusted = normalizeSequenceNumbers(timeAdjusted, nextSequenceNumber);
      await deliverStreamEvents(
        options.meetingId,
        adjusted,
        (meetingId, event) => apiClient.postStreamEvent(meetingId, event),
        sleep,
        deliveryConfig,
      );
      chunkCount += 1;
      sentEvents += adjusted.length;
      nextSequenceNumber += adjusted.length;
      console.log(`Live chunk ${chunkCount}: sent ${adjusted.length} events.`);
    }
  } finally {
    unregisterSignals();
    if (!flushCompleted) {
      await flushAndStop();
    }
    console.log(`Live transcription completed: ${chunkCount} chunks, ${sentEvents} events.`);
  }
}

export async function runBatchTranscription(
  options: BatchTranscriptionOptions,
  deps?: Partial<BatchTranscriptionDependencies>,
): Promise<void> {
  const { provider, apiClient, readAudioFile, sleep, deliveryConfig } = buildBatchDependencies(deps);
  const audioBuffer = await readAudioFile(options.audioFilePath);
  const transcribeOptions: { filename: string; language?: string } = {
    filename: basename(options.audioFilePath),
  };
  if (options.language !== undefined) {
    transcribeOptions.language = options.language;
  }

  const transcription = await provider.transcribe(audioBuffer, transcribeOptions);

  if (options.mode === 'upload') {
    const result = await apiClient.uploadWhisperJson(
      options.meetingId,
      transcription.rawResponse,
      options.chunkStrategy,
    );
    console.log(`Uploaded transcript ${result.transcript.id}; created ${result.chunks.length} chunks.`);
    return;
  }

  await deliverStreamEvents(
    options.meetingId,
    transcription.events,
    (meetingId, event) => apiClient.postStreamEvent(meetingId, event),
    sleep,
    deliveryConfig,
  );

  await apiClient.flushStream(options.meetingId);
  console.log(`Streamed ${transcription.events.length} transcript events and flushed stream.`);
}

export async function runLocalTranscription(options: LocalTranscriptionOptions): Promise<void> {
  const provider = createProviderFromEnv();
  const audioBuffer = await readFile(options.audioFilePath);

  const transcribeOptions: { filename: string; language?: string } = {
    filename: basename(options.audioFilePath),
  };
  if (options.language !== undefined) {
    transcribeOptions.language = options.language;
  }

  const transcription = await provider.transcribe(audioBuffer, transcribeOptions);
  const preview = transcription.events.slice(0, 10);

  console.log(`Transcription complete. Segments: ${transcription.events.length}`);
  for (const [index, event] of preview.entries()) {
    console.log(formatEventPreviewLine(index + 1, event));
  }

  if (transcription.events.length > preview.length) {
    console.log(`... ${transcription.events.length - preview.length} additional segments omitted`);
  }

  if (options.outputPath !== undefined) {
    await writeFile(options.outputPath, JSON.stringify(transcription, null, 2), 'utf8');
    console.log(`Saved raw transcription output to ${options.outputPath}`);
  }

  if (options.outputTextPath !== undefined) {
    await writeFile(options.outputTextPath, formatEventsAsText(transcription.events), 'utf8');
    console.log(`Saved plain text transcript to ${options.outputTextPath}`);
  }

  if (options.outputSrtPath !== undefined) {
    await writeFile(options.outputSrtPath, formatEventsAsSrt(transcription.events), 'utf8');
    console.log(`Saved SRT transcript to ${options.outputSrtPath}`);
  }
}

export async function runUploadSmoke(options: UploadSmokeOptions): Promise<void> {
  const apiUrl = process.env.DECISION_LOGGER_API_URL ?? 'http://localhost:3001';
  const apiKey = process.env.DECISION_LOGGER_API_KEY;
  const apiClient = new DecisionLoggerApiClient(apiUrl, apiKey);

  let meetingId = options.meetingId;
  if (!meetingId) {
    const createdMeeting = await apiClient.createMeeting({
      title: `Transcription Smoke ${new Date().toISOString()}`,
      date: new Date().toISOString(),
      participants: ['transcription-service'],
    });
    meetingId = createdMeeting.id;
    console.log(`Created smoke meeting: ${meetingId}`);
  }

  await runBatchTranscription({
    audioFilePath: options.audioFilePath,
    meetingId,
    mode: options.mode,
    chunkStrategy: options.chunkStrategy,
    ...(options.language === undefined ? {} : { language: options.language }),
  }, {
    apiClient,
  });

  const reading = await apiClient.getTranscriptReading(meetingId);
  console.log(`Smoke verification rows (${options.mode}): ${reading.rows.length}`);
  const [first] = reading.rows;
  if (first) {
    console.log(`First row: ${first.startTime ?? 'n/a'} -> ${first.endTime ?? 'n/a'} | ${first.displayText}`);
  }
}
