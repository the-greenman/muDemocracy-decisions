# Logging and Observability Plan

**Status**: authoritative
**Owns**: runtime logging strategy, correlation model, debug surfaces, redaction rules, observability rollout
**Must sync with**: `packages/schema`, `docs/PLAN.md`, `docs/iterative-implementation-plan.md`, `docs/transcription-service-plan.md`

## Purpose

The system needs first-class observability so live operations can be understood and debugged without attaching a debugger or adding ad hoc `console.log` statements.

This plan defines how to:

- watch live operations as they happen
- trace a single user or system action across layers
- inspect failures after the fact
- debug LLM, transcript, and streaming behavior safely
- avoid leaking sensitive transcript content into logs

## Goals

### Primary Goals

- Make every request and command traceable with a stable correlation ID
- Produce structured logs that can be filtered by operation, meeting, decision, and status
- Support high-signal local debugging during development
- Support production-safe logging with redaction and log-level controls

### Non-Goals

- Full metrics and tracing infrastructure in the first pass
- Vendor lock-in to a specific observability platform
- Logging full raw transcript bodies by default

## Logging Principles

### 1. Structured Logs Only

Logs should be emitted as structured JSON at the core runtime boundaries:

- API request lifecycle
- CLI command execution
- service operations
- repository/database operations
- LLM invocations
- transcript streaming and buffering
- external transcription callbacks

Human-readable pretty printing can be added in development, but the underlying event shape should remain structured.

### 2. Correlation First

Every operation should carry a correlation ID so related events can be grouped.

Recommended keys:

- `correlationId`: top-level operation identifier
- `requestId`: per HTTP request
- `commandId`: per CLI invocation
- `meetingId`
- `decisionContextId`
- `flaggedDecisionId`
- `fieldId`
- `expertId`
- `mcpServer`

### 3. Redaction by Default

Transcript content, prompt bodies, and sensitive config values must not be logged in full by default.

Default policy:

- log metadata, sizes, counts, IDs, durations, and statuses
- log content hashes or short previews only when explicitly enabled in debug mode
- never log API secrets, auth headers, or full provider credentials

### 4. Layered Detail

Different environments need different verbosity:

- `error`: failures only
- `warn`: recoverable problems and retries
- `info`: normal lifecycle events
- `debug`: development diagnostics
- `trace`: highly verbose internals, only for focused troubleshooting

## Core Event Families

### API Events

- request started
- request validated
- service call completed
- request failed
- request completed

Example fields:

```json
{
  "level": "info",
  "event": "api.request.completed",
  "correlationId": "corr_123",
  "requestId": "req_456",
  "method": "POST",
  "path": "/api/meetings",
  "statusCode": 201,
  "durationMs": 34
}
```

### CLI Events

- command started
- command parsed
- command succeeded
- command failed

Example fields:

```json
{
  "level": "info",
  "event": "cli.command.completed",
  "correlationId": "corr_123",
  "commandId": "cmd_456",
  "command": "meeting create",
  "durationMs": 22,
  "exitCode": 0
}
```

### Transcript Pipeline Events

- transcript event received
- stream buffer appended
- stream buffer flushed
- chunk created
- semantic topics extracted
- decision candidates detected

These are critical for debugging live ingest behavior.

### LLM Events

- LLM request queued
- LLM request sent
- LLM response validated
- LLM validation failed
- LLM request retried

Log metadata:

- provider
- model
- operation (`decision-detection`, `draft-generation`, `field-regeneration`, `expert-consultation`)
- token counts if available
- latency
- validation result

Do not log full prompt or response bodies unless an explicit unsafe debug mode is enabled locally.

### Persistence Events

- DB query started/completed
- transaction started/committed/rolled back
- migration started/completed

For normal operation, log query categories and durations, not full SQL text unless trace mode is enabled.

## Runtime Debug Surfaces

### Local Development

The default developer experience should support watching operations live in one terminal.

Recommended behavior:

- API logs to stdout in pretty mode when `NODE_ENV=development`
- CLI errors are user-friendly, with optional `--verbose` to emit structured debug context
- `LOG_LEVEL=debug` enables service and repository detail
- `LOG_LEVEL=trace` enables high-volume internals for focused investigation

### Optional Debug Commands

Add these once the basic logger exists:

- `decision-logger debug tail` - tail recent application events
- `decision-logger debug context` - print active context plus correlation details
- `decision-logger debug replay <correlation-id>` - show related logged events

These are not required for the first logging foundation, but they are the intended UX for live debugging.

## Configuration

Recommended environment variables:

```bash
LOG_LEVEL=info
LOG_FORMAT=json
LOG_PRETTY=false
LOG_INCLUDE_CONTENT_PREVIEW=false
LOG_CONTENT_PREVIEW_CHARS=120
LOG_SQL=false
LOG_LLM_PAYLOADS=false
```

Expected behavior:

- production defaults to structured JSON
- local development may set `LOG_PRETTY=true`
- content and SQL payload logging remain opt-in

## Implementation Shape

### Shared Logger Package Boundary

The logger should live in `packages/core` as shared infrastructure, not duplicated in apps.

Suggested modules:

- `packages/core/src/logging/logger.ts`
- `packages/core/src/logging/context.ts`
- `packages/core/src/logging/redaction.ts`
- `packages/core/src/logging/events.ts`

### Injection Pattern

Services should accept a logger dependency or use a context-aware logger factory so logs keep correlation metadata without manually rebuilding the same object everywhere.

### Interface Adaptation

- `apps/api` attaches request/correlation context at request start
- `apps/cli` creates a command-scoped correlation context
- background or stream processing code creates operation-scoped contexts

## Rollout Plan

### Phase A: Logging Foundation

- Add shared structured logger in `packages/core`
- Add correlation/context helpers
- Add log-level and formatting config
- Add redaction utilities

### Phase B: Core Lifecycle Coverage

- Instrument API request lifecycle
- Instrument CLI command lifecycle
- Instrument core services and repository boundaries

### Phase C: Live Operations Coverage

- Instrument transcript streaming and chunk creation
- Instrument LLM requests, retries, and validation failures
- Instrument expert and MCP operations

### Phase D: Debug UX

- Add `--verbose` and debug-focused CLI surfaces
- Add documented workflows for tracing a correlation ID across events

## Validation Criteria

The logging plan is only complete when all of the following are true:

- A single request or command can be traced with one correlation ID
- Transcript streaming failures can be diagnosed from logs alone
- LLM failures show enough metadata to distinguish timeout, validation, and provider issues
- Logs do not leak full transcript or secret content in default configuration
- Developers can increase verbosity without editing code

## Integration Notes

- This plan complements, but does not replace, decision-history and audit-history features
- Audit records are domain data; logs are operational diagnostics
- The external transcription service should emit compatible correlation IDs when calling the core API
