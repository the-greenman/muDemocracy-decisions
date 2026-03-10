#!/usr/bin/env node

import { resolve } from 'node:path';
import { runBatchTranscription, runLiveTranscription, runLocalTranscription, runUploadSmoke } from './session.js';
import { startWebServer } from './web-server.js';

interface ParsedArgs {
  command: 'transcribe' | 'transcribe-local' | 'smoke-upload' | 'smoke-stream' | 'live' | 'serve' | null;
  audioFilePath: string | null;
  meetingId: string | null;
  apiUrl?: string;
  language?: string;
  outputPath?: string;
  outputTextPath?: string;
  outputSrtPath?: string;
  chunkMs?: number;
  port?: number;
  host?: string;
  mode: 'upload' | 'stream';
  chunkStrategy: 'fixed' | 'semantic' | 'speaker' | 'streaming';
}

function printUsage(): void {
  console.log('Usage: transcription-service transcribe <audio-file> --meeting-id <uuid> [--api-url <url>] [--language <code>] [--mode upload|stream] [--chunk-strategy fixed|semantic|speaker|streaming]');
  console.log('       transcription-service transcribe-local <audio-file> [--language <code>] [--output <path>] [--output-text <path>] [--output-srt <path>]');
  console.log('       transcription-service smoke-upload <audio-file> [--meeting-id <uuid>] [--api-url <url>] [--language <code>] [--chunk-strategy fixed|semantic|speaker|streaming]');
  console.log('       transcription-service smoke-stream <audio-file> [--meeting-id <uuid>] [--api-url <url>] [--language <code>] [--chunk-strategy fixed|semantic|speaker|streaming]');
  console.log('       transcription-service live --meeting-id <uuid> [--api-url <url>] [--language <code>] [--chunk-ms <milliseconds>]');
  console.log('       transcription-service serve [--api-url <url>] [--host <host>] [--port <port>]');
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, audioFilePath, ...rest] = argv;

  const parsed: ParsedArgs = {
    command:
    command === 'transcribe' || command === 'transcribe-local' || command === 'smoke-upload'
      || command === 'smoke-stream'
      || command === 'live'
      || command === 'serve'
        ? command
        : null,
    audioFilePath: audioFilePath ?? null,
    meetingId: null,
    mode: 'upload',
    chunkStrategy: 'speaker',
  };

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];

    if (token === '--meeting-id' || token === '-m') {
      parsed.meetingId = rest[i + 1] ?? null;
      i += 1;
      continue;
    }

    if (token === '--api-url') {
      const value = rest[i + 1];
      if (value !== undefined) {
        parsed.apiUrl = value;
      }
      i += 1;
      continue;
    }

    if (token === '--language' || token === '-l') {
      const value = rest[i + 1];
      if (value !== undefined) {
        parsed.language = value;
      }
      i += 1;
      continue;
    }

    if (token === '--output' || token === '-o') {
      const value = rest[i + 1];
      if (value !== undefined) {
        parsed.outputPath = value;
      }
      i += 1;
      continue;
    }

    if (token === '--output-text') {
      const value = rest[i + 1];
      if (value !== undefined) {
        parsed.outputTextPath = value;
      }
      i += 1;
      continue;
    }

    if (token === '--output-srt') {
      const value = rest[i + 1];
      if (value !== undefined) {
        parsed.outputSrtPath = value;
      }
      i += 1;
      continue;
    }

    if (token === '--mode') {
      const value = rest[i + 1];
      if (value === 'upload' || value === 'stream') {
        parsed.mode = value;
      }
      i += 1;
      continue;
    }

    if (token === '--chunk-strategy') {
      const value = rest[i + 1];
      if (value === 'fixed' || value === 'semantic' || value === 'speaker' || value === 'streaming') {
        parsed.chunkStrategy = value;
      }
      i += 1;
      continue;
    }

    if (token === '--chunk-ms') {
      const value = Number(rest[i + 1]);
      if (Number.isFinite(value) && value > 0) {
        parsed.chunkMs = value;
      }
      i += 1;
      continue;
    }

    if (token === '--port') {
      const value = Number(rest[i + 1]);
      if (Number.isFinite(value) && value > 0) {
        parsed.port = Math.floor(value);
      }
      i += 1;
      continue;
    }

    if (token === '--host') {
      const value = rest[i + 1];
      if (value !== undefined) {
        parsed.host = value;
      }
      i += 1;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.apiUrl !== undefined) {
    process.env.DECISION_LOGGER_API_URL = parsed.apiUrl;
  }
  if (!parsed.command || !parsed.audioFilePath) {
    if (parsed.command !== 'live' && parsed.command !== 'serve') {
      printUsage();
      process.exit(1);
    }
  }

  if (!parsed.command) {
    printUsage();
    process.exit(1);
  }

  if (parsed.command === 'transcribe-local') {
    if (!parsed.audioFilePath) {
      printUsage();
      process.exit(1);
    }

    await runLocalTranscription({
      audioFilePath: resolve(parsed.audioFilePath),
      ...(parsed.language === undefined ? {} : { language: parsed.language }),
      ...(parsed.outputPath === undefined ? {} : { outputPath: resolve(parsed.outputPath) }),
      ...(parsed.outputTextPath === undefined ? {} : { outputTextPath: resolve(parsed.outputTextPath) }),
      ...(parsed.outputSrtPath === undefined ? {} : { outputSrtPath: resolve(parsed.outputSrtPath) }),
    });
    return;
  }

  if (parsed.command === 'smoke-upload' || parsed.command === 'smoke-stream') {
    if (!parsed.audioFilePath) {
      printUsage();
      process.exit(1);
    }

    await runUploadSmoke({
      audioFilePath: resolve(parsed.audioFilePath),
      chunkStrategy: parsed.chunkStrategy,
      mode: parsed.command === 'smoke-upload' ? 'upload' : 'stream',
      ...(parsed.meetingId === null ? {} : { meetingId: parsed.meetingId }),
      ...(parsed.language === undefined ? {} : { language: parsed.language }),
    });
    return;
  }

  if (parsed.command === 'serve') {
    const server = await startWebServer({
      ...(parsed.port === undefined ? {} : { port: parsed.port }),
      ...(parsed.host === undefined ? {} : { host: parsed.host }),
    });
    console.log(`Transcription web server listening on http://${server.host}:${server.port}`);
    return;
  }

  if (!parsed.meetingId) {
    printUsage();
    process.exit(1);
  }

  if (parsed.command === 'live') {
    await runLiveTranscription({
      meetingId: parsed.meetingId,
      ...(parsed.language === undefined ? {} : { language: parsed.language }),
      ...(parsed.chunkMs === undefined ? {} : { chunkMs: parsed.chunkMs }),
    });
    return;
  }

  if (!parsed.audioFilePath) {
    printUsage();
    process.exit(1);
  }

  await runBatchTranscription({
    audioFilePath: resolve(parsed.audioFilePath),
    meetingId: parsed.meetingId,
    mode: parsed.mode,
    chunkStrategy: parsed.chunkStrategy,
    ...(parsed.language === undefined ? {} : { language: parsed.language }),
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Transcription failed: ${message}`);
  process.exit(1);
});
