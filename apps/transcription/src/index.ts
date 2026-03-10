#!/usr/bin/env node

import { resolve } from 'node:path';
import { runBatchTranscription, runLocalTranscription } from './session.js';

interface ParsedArgs {
  command: 'transcribe' | 'transcribe-local' | null;
  audioFilePath: string | null;
  meetingId: string | null;
  language?: string;
  outputPath?: string;
  outputTextPath?: string;
  outputSrtPath?: string;
  mode: 'upload' | 'stream';
  chunkStrategy: 'fixed' | 'semantic' | 'speaker' | 'streaming';
}

function printUsage(): void {
  console.log('Usage: transcription-service transcribe <audio-file> --meeting-id <uuid> [--language <code>] [--mode upload|stream] [--chunk-strategy fixed|semantic|speaker|streaming]');
  console.log('       transcription-service transcribe-local <audio-file> [--language <code>] [--output <path>] [--output-text <path>] [--output-srt <path>]');
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, audioFilePath, ...rest] = argv;

  const parsed: ParsedArgs = {
    command:
      command === 'transcribe' || command === 'transcribe-local'
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
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.command || !parsed.audioFilePath) {
    printUsage();
    process.exit(1);
  }

  if (parsed.command === 'transcribe-local') {
    await runLocalTranscription({
      audioFilePath: resolve(parsed.audioFilePath),
      ...(parsed.language === undefined ? {} : { language: parsed.language }),
      ...(parsed.outputPath === undefined ? {} : { outputPath: resolve(parsed.outputPath) }),
      ...(parsed.outputTextPath === undefined ? {} : { outputTextPath: resolve(parsed.outputTextPath) }),
      ...(parsed.outputSrtPath === undefined ? {} : { outputSrtPath: resolve(parsed.outputSrtPath) }),
    });
    return;
  }

  if (!parsed.meetingId) {
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
