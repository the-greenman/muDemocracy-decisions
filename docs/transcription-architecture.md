# Transcription Architecture

**Status**: authoritative
**Owns**: transcription provider abstraction, live vs batch flow definitions, Docker local setup, transcription service boundary
**Must sync with**: `docs/plans/transcription-service-plan.md`, `docs/transcript-preprocessing-architecture.md`, `docs/plans/whisper-transcription-implementation-plan.md`, `docs/plans/sliding-window-live-transcription-plan.md`

## Purpose

Define how audio gets converted to text and delivered to the core Decision Logger system, while keeping audio processing, GPU dependencies, and transcription vendor details completely outside the core application.

The core API is transport-agnostic: it accepts text events. The transcription service is a separate process that owns audio capture, speech-to-text, and delivery to those text endpoints.

Use `README.md` for top-level repository orientation and `docs/OVERVIEW.md` for the wider architecture/document map. This document owns only the transcription boundary and transcription-specific flow semantics.

## Decision Summary

1. The transcription service runs as a **separate container** - not embedded in the core API.
2. The core API exposes **text-only endpoints** - it never receives raw audio bytes.
3. The transcription provider is **abstracted behind an interface** - swappable between OpenAI Whisper API and a local Docker-hosted service via a single env var.
4. **Live and batch flows use different core endpoints** - streaming events for live, bulk upload for post-meeting recordings.
5. The transcription service is **context-blind** - it does not own or know about decision IDs, field names, or context tags.
6. **Context tagging is a server-side concern** - the core API auto-injects the active decision/field context into each incoming stream event based on global context state.
7. **Batch uploads are context-free at ingest** - retroactive context tagging happens via chunk relevance scoring after the meeting.

## Non-Goals

- Audio storage or playback in the core system.
- GPU or native binary dependencies in the core API container.
- Real-time partial transcripts pushed to the core API (prefer finalized segments).
- The core API knowing which transcription vendor was used.
- The transcription service knowing about decisions, fields, or context state.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  BATCH FLOW (post-meeting recording)                             │
│                                                                  │
│  .wav/.mp3/.m4a file                                             │
│       ↓                                                          │
│  Transcription Service                                           │
│       → ITranscriptionProvider.transcribe(buffer)               │
│       → POST /api/meetings/:id/transcripts/upload               │
│            (content: Whisper JSON, format: 'json')              │
│       ↓                                                          │
│  Core API                                                        │
│       → WhisperTranscriptPreprocessor                           │
│       → Chunking pipeline                                        │
│       → Decision detection                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LIVE FLOW (during meeting)                                      │
│                                                                  │
│  Microphone / capture layer                                      │
│       ↓  (audio frames)                                          │
│  Transcription Service                                           │
│       → assembles rolling 30s audio window                      │
│       → runs every 10s step (overlap enabled)                   │
│       → transcribes + dedupes overlap repeats                   │
│       → POST /api/meetings/:id/transcripts/stream               │
│            (per finalized segment: text, speaker?, timestamp?)  │
│  [repeat for each step]                                          │
│       ↓  (on meeting end)                                        │
│       → POST /api/meetings/:id/streaming/flush                  │
│       ↓                                                          │
│  Core API                                                        │
│       → StreamingBufferRepository                               │
│       → TranscriptChunks created                                │
│       → Decision detection triggered on flush                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core API Contract

The transcription service calls these endpoints only. See `docs/plans/transcription-service-plan.md` for the authoritative contract.

### Schema-first contract rule

When changing any API request/response shape, define/update Zod schemas in `packages/schema` first, then implement route and handler behavior from those schemas.

### Live delivery

```
POST /api/meetings/:id/transcripts/stream
Content-Type: application/json

{
  "text": "I think we should defer the vendor decision",
  "speaker": "Alice",            // optional
  "timestamp": "00:15:30",      // optional, source-relative
  "sequenceNumber": 42,          // optional
  "contexts": ["decision:xyz"]   // optional override/supplement - see Context Tagging below
}
```

Responses:
```json
{ "buffering": true, "bufferSize": 5, "appliedContexts": ["meeting:abc", "decision:xyz"] }
```
or when a chunk is created:
```json
{ "chunkCreated": true, "chunkId": "uuid", "appliedContexts": ["meeting:abc", "decision:xyz", "decision:xyz:options"] }
```

The `appliedContexts` field shows which context tags were stored on the event, including any auto-injected tags.

### Streaming lifecycle

```
GET  /api/meetings/:id/streaming/status   → { status, eventCount }
POST /api/meetings/:id/streaming/flush    → { chunks: TranscriptChunk[] }
DELETE /api/meetings/:id/streaming/buffer → clears buffer (abandoned sessions)
```

### Transcription session control API (web path)

The facilitator web UI controls recording through the transcription service session API:

```
POST /sessions
GET  /sessions/:id/status
POST /sessions/:id/chunks
POST /sessions/:id/stop
GET  /status
```

`GET /status` should report effective runtime defaults for `windowMs`, `stepMs`, `dedupeHorizonMs`, and `autoFlushMs`.

Session create supports optional sliding-window controls:

```json
{
  "meetingId": "<uuid>",
  "language": "en",
  "windowMs": 30000,
  "stepMs": 10000,
  "dedupeHorizonMs": 90000
}
```

### Batch delivery

```
POST /api/meetings/:id/transcripts/upload
Content-Type: application/json

{
  "content": "<whisper JSON string>",
  "format": "json",
  "chunkStrategy": "speaker"
}
```

---

## Provider Abstraction

The transcription service uses an internal provider interface:

```typescript
interface ITranscriptionProvider {
  transcribe(
    audio: Buffer,
    options: { filename: string; language?: string }
  ): Promise<TranscriptEvent[]>
}
```

`TranscriptEvent` matches the core API streaming body shape (text, speaker, timestamp).

### OpenAI Whisper API (default)

- Calls `POST https://api.openai.com/v1/audio/transcriptions`
- `response_format: 'verbose_json'` → returns segments with start/end timestamps
- Best for: getting started, no infrastructure needed
- Latency: ~2-5s per 30s chunk (suitable for documentation, not stenography)
- Requires: `OPENAI_API_KEY`

### Local Docker (self-hosted)

- Calls `POST http://$WHISPER_LOCAL_URL/asr?output=json`
- Compatible with `onerahmet/openai-whisper-asr-webservice` (same response shape)
- Best for: privacy requirements, offline use, lower per-call cost at volume
- Latency: `base` model ~3s on CPU, `large-v3` ~5s on GPU (faster with `faster_whisper` engine)
- Requires: Docker, `TRANSCRIPTION_PROVIDER=local`

Switch between providers:
```env
TRANSCRIPTION_PROVIDER=openai   # default
TRANSCRIPTION_PROVIDER=local    # use Docker service
```

---

## Docker Setup (Local Whisper)

`docker-compose.whisper.yml` at project root:

```yaml
services:
  whisper:
    image: onerahmet/openai-whisper-asr-webservice:latest
    ports:
      - "9000:9000"
    environment:
      - ASR_MODEL=base              # base | small | medium | large-v3
      - ASR_ENGINE=openai_whisper   # or: faster_whisper (faster on CPU)
    volumes:
      - whisper-models:/root/.cache/whisper
volumes:
  whisper-models:
```

Start: `docker compose -f docker-compose.whisper.yml up -d`

Model tradeoffs:

| Model | Size | CPU speed | Accuracy | Use when |
|-------|------|-----------|----------|----------|
| `base` | 74M | ~3s/30s chunk | good | development, low-resource |
| `small` | 244M | ~6s/30s chunk | better | balanced default |
| `medium` | 769M | ~15s/30s chunk | high | accuracy matters |
| `large-v3` | 1.5G | GPU recommended | best | production with GPU |

For faster CPU performance, set `ASR_ENGINE=faster_whisper`.

---

## Configuration Reference

### Transcription Service

```env
# Provider selection
TRANSCRIPTION_PROVIDER=openai       # 'openai' | 'local'

# OpenAI provider
OPENAI_API_KEY=sk-...

# Local provider
WHISPER_LOCAL_URL=http://localhost:9000

# Core API target
DECISION_LOGGER_API_URL=http://localhost:3000
DECISION_LOGGER_API_KEY=internal-service-token   # if auth is enabled

# Live streaming behavior defaults
STREAM_WINDOW_MS=30000              # rolling transcription window (ms)
STREAM_STEP_MS=10000                # window advance interval (ms)
STREAM_DEDUPE_HORIZON_MS=90000      # duplicate suppression memory horizon (ms)
STREAM_AUTO_FLUSH_MS=10000          # periodic flush cadence while live
STREAM_MAX_RETRY_ATTEMPTS=5
STREAM_RETRY_BASE_MS=250
STREAM_MAX_OUTBOUND_QUEUE=200
```

### Core API (no transcription-specific vars needed)

The core API does not know or care which transcription provider is in use.

---

## Context-Aware Streaming

The transcription service is context-blind - it sends raw text events with no knowledge of decisions or fields. Context tags are applied server-side by the `/stream` endpoint handler.

### How context is auto-injected

When the `/stream` endpoint receives an event, it:
1. Calls `globalContextService.getContext()` to read current state:
   - `activeMeetingId` → always adds `meeting:{id}`
   - `activeDecisionContextId` → adds `decision:{contextId}` if set
   - `activeField` → adds `decision:{contextId}:{fieldName}` if set
2. Merges auto-injected tags with any `contexts` explicitly included in the request body
3. Stores the merged context list on the buffer event

The response includes `appliedContexts` so the caller can see what was actually tagged.

### How the facilitator sets context

The facilitator (via UI or CLI) calls context endpoints as focus shifts during the meeting:

```bash
# "Let's work on the vendor selection decision"
POST /api/meetings/:id/context/decision   { "decisionContextId": "xyz" }
# → subsequent stream events get: ["meeting:abc", "decision:xyz"]

# "Let's look at the options field"
POST /api/meetings/:id/context/field      { "fieldId": "options-field-uuid" }
# → subsequent stream events get: ["meeting:abc", "decision:xyz", "decision:xyz:options"]

# "Ok, moving on from that decision"
DELETE /api/meetings/:id/context/decision
# → subsequent stream events get: ["meeting:abc"]
```

Context changes take effect on the **next** stream event received - already-buffered events are not retroactively re-tagged.

### Batch uploads and context

Batch uploads (post-meeting recordings) are context-free at ingest. The entire file is uploaded as one transcript with no decision context active. Context tagging for batch uploads happens retroactively via **chunk relevance scoring** - the existing `ChunkRelevance` mechanism scores each chunk against each field and applies `decision:{id}:{field}` tags during draft generation.

Do not attempt to set active decision context before a batch upload to "pre-tag" it - the upload preprocessor processes the file as a whole and the active context state at upload time is not applied to individual chunks.

---

## Live Meeting Flow: Step by Step

1. User starts a meeting in Decision Logger. Transcription service starts an audio capture session.
   - In browser mode, the client uploads raw chunks and the transcription service assembles the sliding window server-side.
2. The facilitator begins the meeting. All audio streams with only `meeting:{id}` context.
3. When discussion focuses on a specific decision:
   - Facilitator (or UI) calls `POST /api/meetings/:id/context/decision`.
   - Subsequent stream events are auto-tagged with `decision:{contextId}`.
4. When drilling into a specific field:
   - Facilitator calls `POST /api/meetings/:id/context/field`.
   - Subsequent events get `decision:{contextId}:{fieldName}` added.
5. When topic shifts back to general meeting:
   - Facilitator calls `DELETE /api/meetings/:id/context/decision`.
   - Stream events revert to `meeting:{id}` only.
6. Every 10s, the transcription service builds a rolling 30s window, transcribes it, dedupes overlap repeats, and POSTs segments to `/stream`.
7. On meeting end:
   - Transcription service calls `POST /api/meetings/:id/streaming/flush`.
   - All buffered events become `TranscriptChunk` records with their stored context tags.
   - Decision detection can now run over the full tagged transcript.

Note: The core API does not push events to clients in real time (no WebSocket/SSE in Phase T0). Clients poll `GET /api/meetings/:id/transcript-reading` to see the latest readable transcript.

---

## Failure Handling

- The transcription service retries failed `POST /stream` calls with exponential backoff (up to `MAX_RETRY_ATTEMPTS`).
- If the service crashes mid-meeting, any buffered (not-yet-flushed) content is lost. Restart the service and call `/flush` manually to recover any events the API received before the crash.
- Duplicate sequence numbers on retry are tolerated by the core API (sequence numbers are advisory, not enforced as unique keys).
- The core API rejects empty text. The service should filter out empty segments before submission.

---

## Relationship to Other Docs

| Doc | Relationship |
|-----|-------------|
| `docs/plans/transcription-service-plan.md` | Authoritative API contract. This doc expands on provider details and Docker setup. |
| `docs/transcript-preprocessing-architecture.md` | What happens inside the core API after text events arrive (canonical segment format, preprocessors). |
| `docs/plans/whisper-transcription-implementation-plan.md` | Phased implementation plan for building out this architecture. |
