# Transcription Service

Standalone Whisper transcription client for Decision Logger.

## What This Supports

- Local verification: `transcribe-local`
- Batch upload to API: `transcribe --mode upload`
- Batch streaming to API: `transcribe --mode stream`
- Integrated smoke checks: `smoke-upload`, `smoke-stream`
- Live microphone streaming: `live`
- Browser-controlled recording sessions: `serve` + `/sessions` HTTP API

## Prerequisites

- Node + pnpm
- Running Decision Logger API
- `OPENAI_API_KEY` in environment (for OpenAI provider)
- `ffmpeg` installed (required for `live`)

## Install and Build

```bash
pnpm install
pnpm --filter @repo/transcription build
```

## Required Environment

Set these before running commands:

```bash
export OPENAI_API_KEY=...
export DECISION_LOGGER_API_URL=http://localhost:3001
# optional
export DECISION_LOGGER_API_KEY=...
```

## Browser Streaming Setup (Web Path)

Run the transcription service as an HTTP server:

```bash
pnpm --filter @repo/transcription exec tsx src/index.ts serve \
  --api-url http://localhost:3001 \
  --host 0.0.0.0 \
  --port 8788
```

### Session API

- `POST /sessions` body `{ "meetingId": "<uuid>", "language": "en" }`
- `POST /sessions/:sessionId/chunks` raw audio blob body (`audio/webm` or `application/octet-stream`)
- `GET /sessions/:sessionId/status`
- `POST /sessions/:sessionId/stop` (flushes stream to core API)

### Browser example (MediaRecorder)

```ts
const createRes = await fetch('http://localhost:8788/sessions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ meetingId, language: 'en' }),
});
const { sessionId } = await createRes.json();

const media = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(media, { mimeType: 'audio/webm' });

recorder.ondataavailable = async (event) => {
  if (event.data.size === 0) return;
  await fetch(`http://localhost:8788/sessions/${sessionId}/chunks?filename=chunk.webm`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: await event.data.arrayBuffer(),
  });
};

recorder.start(10000); // 10s chunks
// stop path:
// recorder.stop();
// await fetch(`http://localhost:8788/sessions/${sessionId}/stop`, { method: 'POST' });
```

### Browser mode environment (optional)

```bash
export TRANSCRIPTION_PORT=8788
export TRANSCRIPTION_CORS_ORIGIN=http://localhost:5173
export TRANSCRIPTION_MAX_CHUNK_BYTES=25000000
export STREAM_MAX_RETRY_ATTEMPTS=5
export STREAM_RETRY_BASE_MS=250
export STREAM_MAX_OUTBOUND_QUEUE=200
```

## Audio Stream Setup (Live)

The `live` command captures audio with `ffmpeg`, splits it into chunks, transcribes each chunk, then posts transcript events to:

- `POST /api/meetings/:id/transcripts/stream`
- `POST /api/meetings/:id/streaming/flush` on shutdown

### 1. Configure capture input

Defaults are Linux PulseAudio/PipeWire:

```bash
export TRANSCRIPTION_LIVE_INPUT_FORMAT=pulse
export TRANSCRIPTION_LIVE_INPUT_DEVICE=default
```

Override if needed:

```bash
export FFMPEG_BIN=ffmpeg
export TRANSCRIPTION_LIVE_INPUT_FORMAT=alsa
export TRANSCRIPTION_LIVE_INPUT_DEVICE=hw:0,0
```

### 2. Configure chunking and delivery (optional)

```bash
export STREAM_CHUNK_MS=30000
export STREAM_MAX_RETRY_ATTEMPTS=5
export STREAM_RETRY_BASE_MS=250
export STREAM_MAX_OUTBOUND_QUEUE=200
```

### 3. Start live streaming

You need a valid meeting ID first.

```bash
pnpm --filter @repo/transcription exec tsx src/index.ts live \
  --meeting-id <meeting-uuid> \
  --api-url http://localhost:3001 \
  --chunk-ms 30000
```

Stop with `Ctrl-C`. The service will flush the stream before exit.

## Batch/Smoke Commands

```bash
# local-only transcription preview
pnpm --filter @repo/transcription exec tsx src/index.ts transcribe-local \
  /abs/path/audio.m4a --output ./transcription.json --output-text ./transcript.txt

# upload mode smoke
pnpm --filter @repo/transcription exec tsx src/index.ts smoke-upload \
  /abs/path/audio.m4a --api-url http://localhost:3001 --chunk-strategy speaker

# stream mode smoke
pnpm --filter @repo/transcription exec tsx src/index.ts smoke-stream \
  /abs/path/audio.m4a --api-url http://localhost:3001 --chunk-strategy speaker
```

## Troubleshooting

- `404 /api/meetings`: wrong API base URL; confirm `DECISION_LOGGER_API_URL`/`--api-url`.
- `OPENAI_API_KEY is required`: key is not loaded in current shell.
- No audio captured in live mode: check `ffmpeg` input format/device values.
- Stream delivery failures: increase retry settings or verify API health.
