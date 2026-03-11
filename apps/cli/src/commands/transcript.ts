import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { api, requireActiveMeeting } from '../client.js';
import { withSpinner } from '../runtime.js';

export const transcriptCommand = new Command('transcript')
  .description('Transcript management');

interface TranscriptReadingRow {
  id: string;
  displayText: string;
  speaker?: string;
  startTime?: string;
  endTime?: string;
}

function resolveApiUrl(): string {
  return process.env.DECISION_LOGGER_API_URL ?? process.env.API_BASE_URL ?? 'http://localhost:3001';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function formatTranscriptRow(row: TranscriptReadingRow): string {
  const timeRange = row.startTime && row.endTime
    ? `${row.startTime} -> ${row.endTime}`
    : row.startTime ?? row.endTime ?? 'n/a';
  const speaker = row.speaker ?? 'Unknown';
  return `${chalk.gray(timeRange)} ${chalk.cyan(`[${speaker}]`)} ${row.displayText}`;
}

async function getTranscriptRows(meetingId: string): Promise<TranscriptReadingRow[]> {
  const response = await api.get<{ rows: TranscriptReadingRow[] }>(`/api/meetings/${meetingId}/transcript-reading`);
  return response.rows;
}

function launchTranscriptionClient(args: string[], apiUrl: string): Promise<void> {
  const child = spawn('pnpm', args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      DECISION_LOGGER_API_URL: apiUrl,
      API_BASE_URL: apiUrl,
    },
  });

  return new Promise<void>((resolvePromise, rejectPromise) => {
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Transcription client exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function watchTranscript(
  meetingId: string,
  intervalMs: number,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  const seenRowIds = new Set<string>();

  while (shouldContinue()) {
    const rows = await getTranscriptRows(meetingId);
    for (const row of rows) {
      if (seenRowIds.has(row.id)) {
        continue;
      }
      seenRowIds.add(row.id);
      console.log(formatTranscriptRow(row));
    }
    if (!shouldContinue()) {
      break;
    }
    await sleep(intervalMs);
  }
}

async function runTranscriptionWithOptionalWatch(
  meetingId: string,
  apiUrl: string,
  args: string[],
  watch: boolean,
  intervalMs: number,
): Promise<void> {
  if (!watch) {
    await launchTranscriptionClient(args, apiUrl);
    return;
  }

  let keepWatching = true;
  try {
    await Promise.all([
      launchTranscriptionClient(args, apiUrl).finally(() => {
        keepWatching = false;
      }),
      watchTranscript(meetingId, intervalMs, () => keepWatching),
    ]);
  } finally {
    keepWatching = false;
  }
}

transcriptCommand
  .command('upload')
  .description('Upload a transcript file to a meeting')
  .requiredOption('-f, --file <path>', 'Path to transcript file (.txt or .json)')
  .option('-m, --meeting-id <id>', 'Meeting ID (defaults to active meeting)')
  .option('-s, --strategy <strategy>', 'Chunking strategy: fixed|semantic', 'fixed')
  .option('--chunk-size <n>', 'Chunk size in tokens', '500')
  .option('--overlap <n>', 'Chunk overlap in tokens', '50')
  .action(async (opts: { file: string; meetingId?: string; strategy: string; chunkSize: string; overlap: string }) => {
    const meetingId = opts.meetingId ?? await requireActiveMeeting();
    const filePath = resolve(opts.file);
    const raw = await readFile(filePath, 'utf-8');

    let content = raw;
    if (opts.file.endsWith('.json')) {
      const parsed = JSON.parse(raw) as Array<{ speaker?: string; text?: string }>;
      if (Array.isArray(parsed)) {
        content = parsed.map((e) => `[${e.speaker ?? 'Unknown'}]: ${e.text ?? ''}`).join('\n');
      }
    }

    const result = await withSpinner('Uploading transcript…', () => api.post<{ transcript: { id: string; format: string }; chunks: unknown[] }>(
      `/api/meetings/${meetingId}/transcripts/upload`,
      {
        content,
        format: opts.file.endsWith('.json') ? 'json' : 'txt',
        chunkStrategy: opts.strategy,
        chunkSize: parseInt(opts.chunkSize, 10),
        overlap: parseInt(opts.overlap, 10),
      },
    ));

    console.log(chalk.green('✓ Transcript uploaded'));
    console.log(chalk.gray(`Transcript ID: ${result.transcript.id}`));
    console.log(chalk.white(`Chunks created: ${result.chunks.length}`));
    console.log(chalk.white(`Strategy: ${opts.strategy}`));
  });

transcriptCommand
  .command('transcribe-file')
  .description('Transcribe an audio file for a meeting using the external transcription client')
  .argument('<file>', 'Path to audio file')
  .option('-m, --meeting-id <id>', 'Meeting ID (defaults to active meeting)')
  .option('-l, --language <code>', 'Language code for transcription')
  .option('--mode <mode>', 'Delivery mode: upload|stream', 'upload')
  .option('--chunk-strategy <strategy>', 'Chunk strategy: fixed|semantic|speaker|streaming', 'speaker')
  .option('-w, --watch', 'Watch the transcript as it is generated')
  .option('--interval-ms <milliseconds>', 'Interval between transcript checks', '2000')
  .action(async (
    file: string,
    opts: {
      meetingId?: string;
      language?: string;
      mode: string;
      chunkStrategy: string;
      watch?: boolean;
      intervalMs?: string;
    },
  ) => {
    const meetingId = opts.meetingId ?? await requireActiveMeeting();
    const apiUrl = resolveApiUrl();
    const args = [
      '--filter',
      '@repo/transcription',
      'exec',
      'tsx',
      'src/index.ts',
      'transcribe',
      resolve(file),
      '--meeting-id',
      meetingId,
      '--api-url',
      apiUrl,
      '--mode',
      opts.mode,
      '--chunk-strategy',
      opts.chunkStrategy,
    ];

    if (opts.language) {
      args.push('--language', opts.language);
    }

    console.log(chalk.gray(`Starting file transcription for meeting ${meetingId}`));

    const intervalMs = Number.parseInt(opts.intervalMs ?? '2000', 10);
    await runTranscriptionWithOptionalWatch(
      meetingId,
      apiUrl,
      args,
      opts.watch === true,
      Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 2000,
    );
  });

transcriptCommand
  .command('read')
  .description('Read transcript rows for a meeting')
  .option('-m, --meeting-id <id>', 'Meeting ID (defaults to active meeting)')
  .action(async (opts: { meetingId?: string }) => {
    const meetingId = opts.meetingId ?? await requireActiveMeeting();
    const rows = await withSpinner('Loading transcript…', () => getTranscriptRows(meetingId));

    if (rows.length === 0) {
      console.log(chalk.yellow('No transcript rows found'));
      return;
    }

    for (const row of rows) {
      console.log(formatTranscriptRow(row));
    }
  });

transcriptCommand
  .command('watch')
  .description('Watch transcript rows arrive in real time for a meeting')
  .option('-m, --meeting-id <id>', 'Meeting ID (defaults to active meeting)')
  .option('--interval-ms <milliseconds>', 'Interval between transcript checks', '2000')
  .action(async (opts: { meetingId?: string; intervalMs?: string }) => {
    const meetingId = opts.meetingId ?? await requireActiveMeeting();
    const intervalMs = Number.parseInt(opts.intervalMs ?? '2000', 10);

    console.log(chalk.gray(`Watching transcript stream for meeting ${meetingId}`));
    await watchTranscript(meetingId, Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 2000);
  });

transcriptCommand
  .command('live')
  .description('Start live transcription for a meeting using the external transcription client')
  .option('-m, --meeting-id <id>', 'Meeting ID (defaults to active meeting)')
  .option('-l, --language <code>', 'Language code for transcription')
  .option('--chunk-ms <milliseconds>', 'Chunk duration in milliseconds')
  .option('-w, --watch', 'Watch the transcript as it is generated')
  .option('--interval-ms <milliseconds>', 'Interval between transcript checks', '2000')
  .action(async (opts: { meetingId?: string; language?: string; chunkMs?: string; watch?: boolean; intervalMs?: string }) => {
    const meetingId = opts.meetingId ?? await requireActiveMeeting();
    const apiUrl = resolveApiUrl();
    const args = [
      '--filter',
      '@repo/transcription',
      'exec',
      'tsx',
      'src/index.ts',
      'live',
      '--meeting-id',
      meetingId,
      '--api-url',
      apiUrl,
    ];

    if (opts.language) {
      args.push('--language', opts.language);
    }

    if (opts.chunkMs) {
      args.push('--chunk-ms', opts.chunkMs);
    }

    console.log(chalk.gray(`Starting live transcription for meeting ${meetingId}`));

    const intervalMs = Number.parseInt(opts.intervalMs ?? '2000', 10);
    await runTranscriptionWithOptionalWatch(
      meetingId,
      apiUrl,
      args,
      opts.watch === true,
      Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 2000,
    );
  });
