# API Contract Remediation Plan

Restore strict schema-first API behavior across `apps/api` by aligning route Zod contracts, handler responses, and e2e expectations. This plan addresses the current contract drift discovered during T0/T1 transcription work.

## Status

- **State**: active
- **Date opened**: March 10, 2026
- **Primary owner**: API layer (`apps/api`) with schema support (`packages/schema`)

## Problem Summary

We currently define contracts with Zod/OpenAPI, but runtime behavior and test expectations have drifted in several endpoints.

Observed during validation:

- Streaming flush previously failed with `500` due invalid `rawTranscriptId` (empty UUID) in stream buffer flush path.
- Meeting delete cleanup can return `400` with dependent records, but contract/usage expectations are not explicit.
- Some decision workflow endpoints return statuses/messages that do not match e2e expectations (`rollback`, `regenerate`, decision export chain).
- API tests still rely on stateful sequencing, which makes targeted endpoint validation hard.

## Goals

1. Enforce contract-first endpoint behavior (status codes + response shapes) for all active API routes.
2. Make error semantics explicit and stable for dependency/validation failures.
3. Ensure each endpoint can be validated independently with focused e2e tests.
4. Keep transcription T0/T1 validation green while broader API remediation proceeds.

## Non-Goals

- Redesigning domain behavior for decisions/templates.
- Rewriting the entire e2e suite in one pass.
- Introducing new transport patterns (SSE/WebSocket) in this remediation.

## Scope

### In Scope

- `apps/api/src/routes/*.ts` route response definitions
- `apps/api/src/index.ts` handler status/error behavior
- `packages/schema/src/index.ts` request/response schemas used by API
- `apps/api/src/__tests__/api.e2e.test.ts` contract assertions and test isolation improvements

### Out of Scope

- UI/client changes
- Core business logic redesign unless required for API contract correctness

## Workstreams

### R0. Stabilize Known Production-Facing Bugs (Immediate)

- Keep the streaming flush UUID fix active and covered by DB test.
- Add API-level regression assertion for `/streaming/flush` path.
- Ensure T0 streaming endpoints pass contract expectations in full-suite runs.

Deliverables:

- `packages/db` regression test for missing `rawTranscriptId` (done)
- API e2e checks proving `/stream` + `/status` + `/flush` + `/buffer` behavior

### R1. Define Explicit Error Contracts

For each endpoint with drift, define explicit response schemas for expected failures and map handlers accordingly.

Priority endpoints:

1. `DELETE /api/meetings/:id`
2. `POST /api/decision-contexts/:id/rollback`
3. `POST /api/decision-contexts/:id/fields/:fieldId/regenerate`
4. `GET /api/decisions/:id` and export endpoints

Required outcomes:

- Dependency conflict uses `409` (or chosen single status) consistently.
- Validation/business rule failures use one documented status path.
- Error body shape is consistent (`{ error: string }` minimum).

### R2. Align E2E Tests to Contract, Not Incidental State

- Split high-value endpoint checks into focused setup blocks where practical.
- Ensure targeted `-t` runs do not fail due unrelated missing shared state.
- Add fixture-backed transcription upload test coverage (Whisper verbose JSON) (done).

Required outcomes:

- Endpoint tests assert only declared contract behavior.
- Targeted runs can validate single endpoint families without cascading setup failures.

### R3. Contract Drift Guardrails

- Add a lightweight review checklist for API PRs:
  - route schema changed?
  - handler status changed?
  - e2e error path covered?
- Keep OpenAPI generation in CI validation path.

## Sequencing

1. **R0** first to protect active transcription track.
2. **R1** for endpoint error contract normalization.
3. **R2** to improve test reliability and local debugging.
4. **R3** for ongoing prevention.

## Validation Checkpoints

- [x] Stream flush no longer fails on missing `rawTranscriptId`.
- [x] Whisper `verbose_json` fixture uploads via `/transcripts/upload` and yields timestamped transcript-reading rows.
- [x] `DELETE /api/meetings/:id` has explicit contract behavior for dependency conflicts.
- [x] `rollback`/`regenerate`/decision export endpoints return statuses matching declared schemas.
- [x] Focused endpoint e2e runs can execute without hidden inter-test ordering dependencies.
- [x] Full `@repo/api` e2e passes with no contract drift failures.

## Working Validation Sequence

```bash
# Build schema artifacts used by API type-check paths
pnpm --filter @repo/schema build

# Fast DB-level regression guard for streaming flush
pnpm --filter @repo/db exec vitest run src/__tests__/streaming-buffer-repository.test.ts

# Targeted API contract checks (adjust -t terms as specific fixes land)
pnpm --filter @repo/api exec vitest run --config vitest.e2e.config.ts src/__tests__/api.e2e.test.ts -t "Whisper verbose_json fixture"
pnpm --filter @repo/api test:e2e -- -t "streaming"

# Full API e2e pass gate
pnpm --filter @repo/api test:e2e
```

## Exit Criteria

This remediation is complete when:

1. Endpoint response codes and payload shapes match route Zod contracts across success and expected failure paths.
2. Current failing API e2e assertions are either fixed by implementation or updated to match finalized contract decisions.
3. Full API e2e suite passes consistently in CI/local runs.
4. Transcription T0/T1 paths remain green after contract cleanup.

## Risks

- Changing status codes may break existing CLI/web assumptions if not coordinated.
- E2E test ordering refactors can hide regressions if setup is oversimplified.
- Mixed in-progress feature branches may reintroduce drift unless PR checklist is enforced.
