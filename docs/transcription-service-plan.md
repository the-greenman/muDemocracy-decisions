# External Transcription Service Plan

This document defines a separate, containerized transcription service that runs outside the core Decision Logger system.

Its purpose is to convert live or recorded audio into transcript text events and deliver them to the core transcript ingestion API. It informs the API boundary, but it is not part of the core application runtime.

## Purpose

The transcription service exists to:

- Accept audio from an external source or upstream capture pipeline
- Perform speech-to-text outside the core application
- Emit transcript text events into the Decision Logger transcript endpoints
- Remain replaceable without changing the core decision workflow

This service may use local GPU-accelerated transcription, a remote transcription provider, or a hybrid model. The Decision Logger core should not depend on any specific transcription engine.

## Scope Boundary

### In Scope

- Running as a separate container
- Receiving audio streams or audio files from an upstream producer
- Converting audio into transcript text events
- Sending transcript events to the core API
- Managing buffering, retries, and basic delivery guarantees

### Out of Scope

- Decision detection
- Decision draft generation
- Decision context management
- Field tagging beyond what is implied by the core API response
- Persisting authoritative meeting records

## Deployment Model

The transcription service runs as an independent container alongside the core system.

```text
audio source / capture layer
        |
        v
external transcription container
        |
        v
Decision Logger API
```

### Why Separate

- Keeps audio and GPU dependencies out of the core app container
- Allows independent scaling and deployment
- Supports multiple transcription backends without changing business logic
- Makes the core API transport-agnostic

## Architectural Principle

The transcription service is an upstream producer of text events.

The Decision Logger core remains the system of record for:

- raw transcript ingestion
- transcript chunking
- buffering state
- context tagging
- decision detection
- decision workflow

The transcription service should not own chunk IDs, decision IDs, or context state. It only sends transcript content plus optional metadata.

## Core Integration Contract

The transcription service should target the existing transcript ingestion API. It should not require new “audio” endpoints in the core system.

### Primary Endpoint

`POST /api/meetings/{id}/transcripts/stream`

Body:

```json
{
  "text": "I think we should approve the roof repair",
  "speaker": "Alice",
  "timestamp": "00:15:30",
  "sequenceNumber": 93
}
```

Notes:

- `text` is required
- `speaker` is optional metadata only
- `timestamp` is optional and may be source-relative
- `sequenceNumber` is optional; the core may assign ordering if needed

Expected responses:

```json
{ "buffering": true, "bufferSize": 5 }
```

or

```json
{
  "chunkCreated": true,
  "chunkId": "uuid",
  "potentialDecision": {
    "id": "uuid",
    "suggestedTitle": "Approve roof repair budget"
  }
}
```

### Supporting Endpoints

The service may use these operational endpoints:

- `GET /api/meetings/{id}/streaming/status`
- `POST /api/meetings/{id}/streaming/flush`
- `DELETE /api/meetings/{id}/streaming/buffer`

Typical uses:

- poll buffer state during long-running sessions
- flush final buffered transcript when the meeting ends
- clear the buffer if the session is abandoned or reset

### Bulk / Catch-Up Modes

For non-live scenarios, the service may also use:

- `POST /api/meetings/{id}/transcripts/upload`
- `POST /api/meetings/{id}/transcripts/add`

Recommended usage:

- use `/transcripts/stream` for live or near-live delivery
- use `/transcripts/upload` for finished transcript files
- use `/transcripts/add` for manual or low-volume immediate text submission

## Data Ownership

### Owned by Transcription Service

- audio session lifecycle
- transcription engine configuration
- transient audio buffers
- partial transcript assembly before submission
- retry queues for outbound API delivery

### Owned by Decision Logger Core

- raw transcript records
- transcript chunks
- context tags
- streaming buffer state inside the domain model
- flagged decisions
- decision contexts and logs

## Transcript Event Model

The transcription service should emit small, ordered transcript events and let the core system decide how to buffer and chunk them.

Recommended event shape:

```typescript
interface TranscriptEvent {
  meetingId: string;
  text: string;
  speaker?: string;
  timestamp?: string;
  sequenceNumber?: number;
  metadata?: {
    source?: 'local-asr' | 'remote-asr' | 'hybrid';
    confidence?: number;
    isPartial?: boolean;
  };
}
```

Notes:

- `speaker` is optional and not required for first release
- `confidence` is advisory only and should not block ingestion
- partial transcripts should be handled carefully; by default, prefer final text segments over unstable partials

## Streaming Behavior

### Recommended Delivery Pattern

1. Receive audio frames from upstream capture
2. Produce short transcript text events
3. Send events to `/transcripts/stream`
4. Let the core API buffer and create transcript chunks
5. Flush when the meeting ends

This keeps chunking logic centralized in the core system and avoids duplicate chunking rules.

### Partial vs Final Transcripts

Preferred initial behavior:

- send only finalized transcript text to the core API
- avoid sending unstable partial text unless the UX specifically requires it

If partials are later needed, they should be modeled as an enhancement to the upstream service contract, not as a change to the core decision workflow.

## Failure Handling

The transcription service must be resilient, but the core system remains authoritative.

### Expected Failure Modes

- temporary API unavailability
- duplicate submissions after retry
- out-of-order transcript events
- delayed flush at meeting end
- missing speaker metadata

### Required Behaviors

- retry failed submissions with backoff
- keep a bounded outbound queue
- tolerate missing speaker labels
- log delivery failures with meeting/session correlation
- support manual flush on shutdown

### Idempotency Guidance

For the first implementation, idempotency can be handled operationally with stable `sequenceNumber` values where available.

If stronger guarantees are needed later, add an explicit upstream event ID and deduplication strategy.

## Security and Runtime

The service should authenticate to the core API using a service credential or internal network trust boundary.

Operational expectations:

- run on the same private network as the core API where possible
- do not expose raw transcription internals to end users
- keep GPU/runtime dependencies isolated to this container

## Configuration

Example environment:

```bash
DECISION_LOGGER_API_URL=http://api:3000
DECISION_LOGGER_API_KEY=internal-service-token
TRANSCRIPTION_BACKEND=local
TRANSCRIPTION_MODEL=whisper-large-v3
USE_GPU=true
STREAM_BATCH_MS=2000
MAX_RETRY_ATTEMPTS=5
```

Notes:

- `TRANSCRIPTION_BACKEND` may be `local`, `remote`, or `hybrid`
- these settings belong to the transcription container, not the core app

## Internal Service API (Optional)

This service may expose its own internal control API, but that is separate from the Decision Logger public API.

Possible internal endpoints:

- `POST /sessions`
- `POST /sessions/:id/audio`
- `POST /sessions/:id/finalize`
- `GET /sessions/:id/status`

These are implementation details for the transcription container and should not be required by the core system.

## Validation Checklist

- [ ] The service can stream transcript text into `POST /api/meetings/{id}/transcripts/stream`
- [ ] The core API can buffer and create chunks without knowing anything about raw audio
- [ ] Missing `speaker` metadata does not block ingestion
- [ ] Meeting-end flush correctly drains buffered content
- [ ] The transcription backend can be swapped without API changes
- [ ] The service can run in its own container with isolated dependencies

## Impact on Core API Design

This plan reinforces the following core API decisions:

- The core system needs text-based transcript endpoints, not audio endpoints
- `speaker` must remain optional metadata
- buffered streaming endpoints are the right integration surface for live transcription
- chunk creation should stay inside the core domain
- the core API should not assume a specific transcription provider

## Recommended Next Step

Keep this service as a separate implementation track.

When the core API is implemented, validate the transcription boundary by building a minimal simulator first:

1. read lines from a file
2. POST them to `/api/meetings/{id}/transcripts/stream`
3. verify chunk creation and flush behavior

That will prove the API contract before adding real audio and GPU-specific dependencies.
