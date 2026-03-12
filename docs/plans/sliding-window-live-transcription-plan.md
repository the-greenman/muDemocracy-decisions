# Sliding-Window Live Transcription Plan

**Status**: active  
**Goal**: Standardize live transcription on a 30s sliding window with 10s step and server-side dedupe for higher accuracy across web and CLI flows.

---

## Current State and Gap

- Live transcription is functional in web and CLI paths.
- Browser streaming currently sends discrete chunks; overlap semantics are not yet canonicalized in docs/contracts.
- Default behavior is described inconsistently across docs (fixed chunk wording remains in multiple places).
- Session API docs do not yet define sliding-window controls and dedupe observability fields.

Gap to close:
- Make the sliding-window default explicit and authoritative.
- Define schema-first API contract additions for session controls/status.
- Align implementation docs, architecture docs, and operational defaults.

### Progress

- [x] SW1 contract milestone: schema-first session create/status/status-default contracts added and wired in transcription service.
- [x] SW2 rolling-window + dedupe runtime implementation.
  - [x] SW2a: server-side dedupe and horizon-based suppression implemented with TDD coverage.
  - [x] SW2b: rolling 30s/10s window audio assembly implementation.
  - [x] SW2c: ffmpeg-backed normalization/concat path for browser chunk windows.
- [ ] SW3 web/CLI alignment to rolling-window defaults.
- [ ] SW4 observability completion and final validation checkpoint.

---

## Zod-First Contract Changes

Contract work starts in `packages/schema/src/index.ts` before route/handler changes.

1. Add/extend transcription-session schemas:
   - Session create request:
     - `meetingId` (required)
     - `language` (optional)
     - `windowMs` (optional, default 30000)
     - `stepMs` (optional, default 10000)
     - `dedupeHorizonMs` (optional, default 90000)
   - Session status response:
     - `status`, `bufferedEvents`
     - effective `windowMs`, `stepMs`, `dedupeHorizonMs`
     - dedupe counters (`postedEvents`, `dedupedEvents`)
   - Service status response:
     - effective runtime defaults (`windowMs`, `stepMs`, `dedupeHorizonMs`, `autoFlushMs`)

2. API surface to document and implement from schemas:
   - `POST /sessions` optional controls: `windowMs`, `stepMs`, `dedupeHorizonMs`
   - `GET /sessions/:id/status` returns effective window/dedupe metadata
   - `GET /status` returns effective runtime defaults

Assumption: no backward compatibility is required for old fixed-window-only config semantics.

---

## Implementation Phases

### Phase SW1: API/Schema
- Introduce session control/status schemas in `packages/schema`.
- Wire transcription service endpoints to validate/serialize with schema-derived types.
- Reject invalid window/step combinations via schema constraints.

### Phase SW2: Transcription Service
- Introduce rolling audio window processing:
  - default `windowMs=30000`
  - default `stepMs=10000`
- Add server-side dedupe before `/api/meetings/:id/transcripts/stream` posting.
- Add ffmpeg-backed normalization/assembly for browser chunk inputs so sliding windows are reliable.
- Keep stop/flush semantics unchanged (`/streaming/flush` on stop).

### Phase SW3: Web and CLI Alignment
- Web facilitator path:
  - keep browser chunk uploads; rely on server-side sliding window assembly and dedupe.
  - expose effective window/step/dedupe in system status UI.
- CLI live path:
  - align defaults to 30s window / 10s step behavior.
  - remove fixed-window-only assumptions in docs/help where superseded.

### Phase SW4: Observability
- Add per-session counters and effective settings to status endpoints/logs.
- Ensure runtime status clearly indicates active defaults and provider mode.

---

## Test and Validation Checklist

- Schema validation:
  - valid/invalid `windowMs`, `stepMs`, `dedupeHorizonMs` cases
  - response payload validation for session/service status
- Service behavior:
  - rolling-window processing runs every step with correct window span
  - dedupe suppresses overlap duplicates
  - decode/assembly failures are handled without terminating active sessions
- End-to-end:
  - web live stream produces stable transcript flow with reduced duplicate rows
  - CLI live stream follows same default window/step behavior
- Documentation consistency:
  - `docs/transcription-architecture.md`
  - `docs/plans/whisper-transcription-implementation-plan.md`
  - `docs/OVERVIEW.md`
  - this plan

---

## TDD Test Plan (Required)

Use strict Red → Green → Refactor cycles. No implementation step should begin without a failing test.

### 1) Schema-first contract tests

**Red**
- Add failing tests for new/updated schemas in `packages/schema`:
  - session create accepts defaults and optional overrides
  - rejects invalid windows/steps (`<=0`, non-integer, `stepMs > windowMs`)
  - status payload requires effective window/dedupe fields

**Green**
- Implement schema changes until tests pass.

**Refactor**
- Consolidate shared numeric constraints/helper schema fragments.

### 2) Transcription service unit tests

**Red**
- Add failing unit tests in `apps/transcription` for:
  - rolling-window scheduler triggers every 10s with 30s span
  - dedupe suppresses repeated overlap segments
  - dedupe horizon expiry allows later repeated content
  - ffmpeg normalize/concat failure is surfaced but does not terminate session

**Green**
- Implement rolling window + dedupe + error handling.

**Refactor**
- Extract dedupe/fingerprint logic into isolated utility with direct unit coverage.

### 3) Session API integration tests

**Red**
- Add failing integration tests for:
  - `POST /sessions` returns effective defaults when omitted
  - `POST /sessions` applies explicit overrides
  - `GET /sessions/:id/status` exposes window/step/horizon and posted/deduped counters
  - `GET /status` exposes effective runtime defaults

**Green**
- Implement endpoint wiring from schema-derived types.

**Refactor**
- Centralize session config resolution path used by both create and status endpoints.

### 4) End-to-end behavior tests (service + delivery)

**Red**
- Add failing flow tests:
  - overlapping windows produce no duplicate delivered transcript events
  - stop path still flushes once and closes cleanly
  - live throughput remains stable under continuous chunk uploads

**Green**
- Implement missing behavior until event counts and payloads match assertions.

**Refactor**
- Remove duplicated fixture setup between web-session and CLI-live tests.

### 5) Web/CLI contract alignment tests

**Red**
- Add failing tests for:
  - web status UI mapping includes effective sliding-window settings
  - CLI live defaults align to 30s/10s model
  - legacy fixed-window-only assumptions are absent from CLI option/help tests

**Green**
- Update clients/help text/status rendering.

**Refactor**
- Keep one shared source for default window/step constants where practical.

---

## Rollout and Done Criteria

Rollout:
1. Merge schema and status contract updates.
2. Enable sliding-window defaults in transcription service.
3. Update web/CLI defaults and docs.
4. Run full validation pass across web + transcription + CLI smoke flows.

Done when:
- Default live mode is documented and implemented as 30s/10s sliding with server dedupe.
- Session/service status endpoints expose effective settings and dedupe counters.
- No evergreen docs describe fixed non-overlapping chunks as the default live behavior.
- Schema-first rule is explicit in plan docs before API route behavior details.
