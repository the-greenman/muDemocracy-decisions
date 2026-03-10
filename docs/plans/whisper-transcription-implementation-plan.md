# Whisper Transcription Implementation Plan

**Status**: active
**Goal**: Build a Whisper-based transcription service that delivers text events to the core Decision Logger API, supporting both batch (post-meeting recordings) and live (during-meeting) flows.

See `docs/transcription-architecture.md` for the full architecture. See `docs/plans/transcription-service-plan.md` for the API contract this plan implements.

---

## Current State

- ✅ Core streaming infrastructure exists: `addTranscriptText()`, `addStreamEvent()`, `flushStream()`, `StreamingBufferRepository`
- ✅ `WhisperTranscriptPreprocessor` handles Whisper JSON in the batch upload path
- ✅ `GlobalContextService` tracks `activeMeetingId`, `activeDecisionContextId`, `activeField`
- ✅ `TranscriptChunk.contexts` stores context tags; `StreamEventData` supports `contexts` field
- ✅ Context endpoints exist: `GET /api/context`, `POST /api/context/meeting`, `DELETE /api/context/meeting`, `POST /api/meetings/:id/context/decision`, `DELETE /api/meetings/:id/context/decision`, `POST /api/meetings/:id/context/field`, `DELETE /api/meetings/:id/context/field`
- ✅ Decision context lookup endpoints exist: `GET /api/meetings/:id/decision-contexts`, `GET /api/flagged-decisions/:id/context`
- ❌ No `/transcripts/stream` endpoint exposed by the API
- ❌ No `/streaming/status`, `/streaming/flush`, `/streaming/buffer` endpoints
- ❌ `/stream` handler does not auto-inject active decision/field context
- ❌ No transcription service (OpenAI Whisper or local)
- ❌ No Docker setup for local Whisper

---

## Phase T0: Core Streaming Endpoints

**Goal**: Expose the streaming buffer as an API surface so the transcription service has somewhere to send text events.

### Tasks

**T0.1 Route definitions** (`apps/api/src/routes/decision-workflow.ts`)
- `POST /api/meetings/:id/transcripts/stream`
  - Request: `{ text: string, speaker?: string, timestamp?: string, sequenceNumber?: number, contexts?: string[] }`
  - Response 201: `{ buffering: boolean, bufferSize: number, chunkId?: string, appliedContexts: string[] }`
  - Response 400: missing text
  - Response 503: no DB
- `GET /api/meetings/:id/streaming/status`
  - Response 200: `{ status: 'active' | 'idle' | 'flushing', eventCount: number }`
- `POST /api/meetings/:id/streaming/flush`
  - Response 200: `{ chunks: TranscriptChunk[] }`
- `DELETE /api/meetings/:id/streaming/buffer`
  - Response 204

**T0.2 Schema additions** (`packages/schema/src/index.ts`)
- `StreamTranscriptEventSchema` - request body for `/stream` (include optional `contexts` array)
- `StreamTranscriptResponseSchema` - include `appliedContexts: string[]`
- `StreamStatusResponseSchema`
- `StreamFlushResponseSchema`

**T0.3 Context-aware stream handler** (`apps/api/src/index.ts`)

This is the critical piece. The `/stream` handler must auto-inject active context:

```typescript
// Pseudocode for /stream handler
const event = await c.req.json()
const globalContext = await globalContextService.getContext()

// Build context tags from active state
const autoContexts: string[] = [`meeting:${meetingId}`]
if (globalContext.activeDecisionContextId) {
  autoContexts.push(`decision:${globalContext.activeDecisionContextId}`)
  if (globalContext.activeField) {
    autoContexts.push(`decision:${globalContext.activeDecisionContextId}:${globalContext.activeField}`)
  }
}

// Merge with any explicitly passed contexts (deduplicate)
const appliedContexts = Array.from(new Set([...autoContexts, ...(event.contexts ?? [])]))

await transcriptService.addStreamEvent(meetingId, {
  type: 'text',
  data: { text: event.text, speaker: event.speaker, startTime: event.timestamp, contexts: appliedContexts }
})
```

- Wire `transcriptService.getStreamStatus()` → `/status` handler
- Wire `transcriptService.flushStream()` → `/flush` handler
- Wire `transcriptService.clearStream()` → `DELETE /buffer` handler

**T0.4 `globalContextService` available in workflow services** (`packages/core/src/service-factory.ts`)

Confirm `globalContextService` is accessible in the same service scope as `transcriptService`. The handler needs both. If currently wired separately, expose via the shared service factory.

### TDD Checkpoints

- Unit: `/stream` handler with active decision context set → verify `decision:{id}` tag in stored event
- Unit: `/stream` handler with active field set → verify `decision:{id}:{field}` tag included
- Unit: `/stream` handler with no active context → verify only `meeting:{id}` applied
- Unit: `/stream` handler with explicit `contexts` in body → verify merged, not replaced
- Integration: POST to `/stream` → verify `StreamingBufferRepository` has event with correct contexts
- Integration: POST `/flush` → verify `TranscriptChunks` have correct context tags in DB
- Simulate end-to-end:
  ```bash
  # Set active decision via flagged decision; server resolves/creates the DecisionContext
  curl -X POST http://localhost:3000/api/meetings/$ID/context/decision \
    -d '{"flaggedDecisionId":"flag-xyz"}'

  # POST a text event - should auto-tag with decision context
  curl -X POST http://localhost:3000/api/meetings/$ID/transcripts/stream \
    -d '{"text":"We decided to defer the vendor selection","speaker":"Alice"}'
  # Response should include applied meeting + resolved decision-context tags, e.g.
  # "appliedContexts": ["meeting:$ID", "decision:<resolved-context-id>"]

  # Flush and verify chunks have correct contexts
  curl -X POST http://localhost:3000/api/meetings/$ID/streaming/flush
  curl http://localhost:3000/api/meetings/$ID/transcript-reading
  ```

---

## Phase T1: Transcription Service (OpenAI Whisper)

**Goal**: A standalone service that accepts audio, transcribes via the OpenAI Whisper API, and supports both local-only verification (no API integration) and core API delivery.

### Location

`apps/transcription/` (new package in monorepo) or a standalone script at `tools/transcription-service/`.

Prefer a minimal standalone service - it has its own Docker image and should not import `@repo/*` packages.

### Structure

```
apps/transcription/
  src/
    index.ts                 # entry point, CLI or HTTP server
    providers/
      interface.ts           # ITranscriptionProvider
      openai.ts              # OpenAIWhisperProvider
      local.ts               # LocalWhisperProvider (Phase T2)
    session.ts               # session lifecycle (start, chunk, end)
    api-client.ts            # sends events to core API
  package.json
  tsconfig.json
```

### ITranscriptionProvider interface

```typescript
interface TranscriptEvent {
  text: string
  speaker?: string
  timestamp?: string  // HH:MM:SS source-relative
  sequenceNumber?: number
}

interface ITranscriptionProvider {
  transcribe(
    audio: Buffer,
    options: { filename: string; language?: string }
  ): Promise<TranscriptEvent[]>
}
```

### OpenAIWhisperProvider

- `POST https://api.openai.com/v1/audio/transcriptions`
- `model: 'whisper-1'`, `response_format: 'verbose_json'`
- Maps Whisper segments → `TranscriptEvent[]` (start time as HH:MM:SS)
- Env: `OPENAI_API_KEY`

### Session Lifecycle

**Local-only verification mode** (`transcription-service transcribe-local <file.wav>`):
1. Load audio file into buffer
2. `provider.transcribe(buffer, { filename })`
3. Print mapped segments and timestamps to stdout
4. Optionally write raw response/events JSON to a file for inspection

**Batch mode (integrated)** (`transcription-service transcribe <file.wav> --meeting-id <id>`):
1. Load audio file into buffer
2. `provider.transcribe(buffer, { filename })`
3. Default while T0 is incomplete: `POST /transcripts/upload` with Whisper JSON (`format: json`)
4. After T0 lands: support segment streaming to `/transcripts/stream` + `/streaming/flush`

**Live mode** (`transcription-service live --meeting-id <id>`):
1. Start capturing audio from mic (via `ffmpeg` or `sox` subprocess)
2. Every `STREAM_CHUNK_MS` (default 30s): read current buffer, transcribe, POST segments
3. On SIGTERM/Ctrl-C: POST final chunk, then POST `/streaming/flush`

### TDD Checkpoints

- Unit: `OpenAIWhisperProvider` with mock `fetch` - verify segments mapped correctly
- Local smoke test: `transcription-service transcribe-local test.wav` prints non-empty segments
- Integration: Send a real `.wav` file (use files from `test-cases/` if audio samples added)
- End-to-end: `transcription-service transcribe test.wav --meeting-id $ID` → verify DB chunks

---

## Phase T2: Docker / Local Whisper

**Goal**: Add a local Whisper option that works offline and doesn't require an OpenAI key.

### Tasks

**T2.1 docker-compose.whisper.yml** (project root)
```yaml
services:
  whisper:
    image: onerahmet/openai-whisper-asr-webservice:latest
    ports:
      - "9000:9000"
    environment:
      - ASR_MODEL=base
      - ASR_ENGINE=openai_whisper
    volumes:
      - whisper-models:/root/.cache/whisper
volumes:
  whisper-models:
```

**T2.2 LocalWhisperProvider** (`apps/transcription/src/providers/local.ts`)
- `POST http://$WHISPER_LOCAL_URL/asr?output=json`
- Same `ITranscriptionProvider` interface as OpenAI provider
- Response shape from `onerahmet/openai-whisper-asr-webservice` matches OpenAI verbose JSON

**T2.3 Provider factory** (`apps/transcription/src/providers/index.ts`)
```typescript
export function createProvider(): ITranscriptionProvider {
  return process.env.TRANSCRIPTION_PROVIDER === 'local'
    ? new LocalWhisperProvider(process.env.WHISPER_LOCAL_URL ?? 'http://localhost:9000')
    : new OpenAIWhisperProvider(process.env.OPENAI_API_KEY!)
}
```

### TDD Checkpoints

- Unit: `LocalWhisperProvider` with mock fetch
- Integration:
  ```bash
  docker compose -f docker-compose.whisper.yml up -d
  TRANSCRIPTION_PROVIDER=local transcription-service transcribe test.wav --meeting-id $ID
  # Verify same chunks as T1 test
  ```

---

## Phase T3: CLI Integration

**Goal**: Add `transcript transcribe` and `transcript live` commands to the existing CLI.

### Tasks

**T3.1** Extend `apps/cli/src/commands/transcript.ts`:
- `transcript transcribe <audio-file>` subcommand
  - Calls transcription service HTTP API (if running) or falls back to calling provider directly
  - Options: `-m, --meeting-id`, `-l, --language`, `-s, --strategy`
- `transcript live` subcommand
  - Requires `ffmpeg` in PATH
  - Starts live mode session, displays running transcript in terminal via polling
  - `Ctrl-C` sends flush and prints summary

**T3.2** Add transcription service URL to CLI config:
- `TRANSCRIPTION_SERVICE_URL` env var
- Falls back to running in-process if not set (useful for batch mode)

### TDD Checkpoints

- Unit: CLI command option parsing
- E2E: `pnpm dev --filter=apps/cli -- transcript transcribe test.wav -m $ID`
- Verify end-to-end: CLI → transcription → core API → chunks → decision detection on flush

---

## Deferred

| Item | Reason |
|------|--------|
| SSE push for real-time segment display | Needs WebSocket/SSE transport layer; polling `/transcript-reading` is sufficient for MVP |
| Redis-backed streaming buffer | In-memory is fine for single-server MVP; noted in `StreamingBufferRepository` |
| Speaker diarization | Whisper does not do diarization; would require separate pyannote.audio step |
| Partial/unstable transcript display | Prefer finalized segments; partials add complexity without decision workflow value |
| GPU Docker image | Add `USE_GPU=true` flag later; CPU is fine for `base`/`small` models |

---

## Validation Checklist

- [ ] T0: POST text events to `/stream` with no active context → chunks tagged `meeting:{id}` only
- [ ] T0: POST text events with active decision → chunks tagged `meeting:{id}` + `decision:{contextId}`
- [ ] T0: POST text events with active decision + field → all three context levels present
- [ ] T0: Explicit `contexts` in body are merged, not replaced, with auto-injected tags
- [ ] T0: POST `/flush` creates TranscriptChunks with correct context tags in DB
- [ ] T0: POST `/flush` creates TranscriptChunks with correct timing (`start_time`/`end_time`)
- [ ] T1: Batch transcription of a `.wav` file produces correct chunks in DB
- [ ] T1: Segments have `start_time`/`end_time` from Whisper output
- [ ] T2: Docker local Whisper produces same output as T1 with same audio
- [ ] T2: `TRANSCRIPTION_PROVIDER=local` switches provider without code change
- [ ] T3: CLI end-to-end (audio file → chunks → decision detection) completes successfully
- [ ] All tests pass: `pnpm test`
