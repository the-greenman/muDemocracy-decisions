# API Contract Remediation Plan

Restore strict schema-first API behavior across `apps/api` by aligning route Zod contracts, handler responses, and e2e expectations. This plan addresses the current contract drift discovered during T0/T1 transcription work.

## Status

- **State**: active
- **Date opened**: March 10, 2026
- **Primary owner**: API layer (`apps/api`) with schema support (`packages/schema`)

## Current Phase

- **Phase**: R3/R4 follow-through
- **Last updated**: March 10, 2026
- **Summary**:
  - R0 transcription regression protections are in place.
  - R1 high-priority error-contract normalization for delete/rollback/regenerate/export is in place.
  - R2 targeted e2e coverage and CLI parity for template discovery/field inspection are in place.
  - R4 progress is in place for context-setting, supplementary-content, template/context-window, and selected workflow read paths.
  - Remaining work is focused on the last workflow-route negative-path coverage gaps and prevention guardrails.

## Cleanup Remediation Notes

### Applied high-value cleanup

- The custom DB migration runner now uses SQL statement splitting that respects quoted strings, comments, and PostgreSQL dollar-quoted blocks such as `DO $$ ... $$;`.
- Root validation scripts now include:
  - `pnpm validate`
  - `pnpm validate:docker`
  - `pnpm validate:stack`

### Medium-value cleanup decisions

- Handwritten `packages/db/src/**/*.d.ts` files should be reduced only after a dedicated follow-up, not during active remediation.
  - Current recommendation: keep them temporarily because they still define the published package surface expected by consumers.
  - Follow-up direction: migrate toward generated declarations from implementation where possible, and remove handwritten declaration shims incrementally package-by-package.

- The API Dockerfile now depends on a specific set of workspace inputs during image build.
  - Builder-stage root inputs:
    - `package.json`
    - `pnpm-lock.yaml`
    - `pnpm-workspace.yaml`
    - `turbo.json`
    - `tsconfig.json`
    - `tsconfig.base.json`
    - `scripts/`
    - `prompts/`
  - Builder-stage package metadata/config inputs:
    - `packages/schema/package.json`
    - `packages/schema/tsconfig.json`
    - `packages/core/package.json`
    - `packages/core/tsconfig.json`
    - `packages/core/tsconfig.declarations.json`
    - `packages/db/package.json`
    - `packages/db/tsconfig.json`
    - `packages/db/tsconfig.declarations.json`
    - `apps/api/package.json`
    - `apps/api/tsconfig.json`
  - Builder-stage source/runtime inputs:
    - `packages/schema/src`
    - `packages/schema/tsup.config.ts`
    - `packages/core/src`
    - `packages/core/tsup.config.ts`
    - `packages/db/src`
    - `packages/db/drizzle`
    - `packages/db/drizzle.config.ts`
    - `packages/db/tsup.config.ts`
    - `apps/api/src`
    - `apps/api/scripts`
    - `apps/api/tsup.config.ts`

  These inputs are required because the API image builds the workspace packages inside Docker rather than copying prebuilt artifacts from the host.

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

### R4. Remaining Route Contract Audit

- Audit the remaining active API routes for undocumented or inconsistent failure responses.
- Prioritize routes that are consumed by the CLI or are part of the decision workflow happy-path.
- Normalize on a documented minimum error shape (`{ error: string }`) and explicit status mappings for:
  - `404` not found
  - `400` request/validation/business-rule failures
  - `409` dependency/conflict failures where applicable
  - `503` unavailable infrastructure-backed paths where intentionally supported

Priority route families for this pass:

1. context-setting routes (done)
2. supplementary-content routes (done)
3. template/context-window routes not already covered by focused tests (done)
4. remaining decision-workflow read/write routes with broad error handling or stale contract entries

Required outcomes:

- Every active route declares the failure responses it can intentionally emit.
- Handler branches align with declared response schemas.
- CLI-visible routes have explicit, stable contract coverage.

### R5. Consumer Alignment and Validation Flow

- Verify CLI assumptions against finalized API contracts for template discovery, field inspection, and decision operations.
- Add/retain validation commands that make contract drift easier to catch locally.
- Ensure OpenAPI/export generation remains compatible with remediated route contracts.

Required outcomes:

- CLI request/response expectations match API contracts.
- Local validation flow for API changes is documented and practical.
- Contract changes are easier to detect before merge.

## Sequencing

1. **R0** first to protect active transcription track.
2. **R1** for endpoint error contract normalization.
3. **R2** to improve test reliability and local debugging.
4. **R3** for ongoing prevention.
5. **R4** for broad route-family audit and remaining contract cleanup.
6. **R5** for consumer alignment and validation flow hardening.

## Validation Checkpoints

- [x] Stream flush no longer fails on missing `rawTranscriptId`.
- [x] Whisper `verbose_json` fixture uploads via `/transcripts/upload` and yields timestamped transcript-reading rows.
- [x] `DELETE /api/meetings/:id` has explicit contract behavior for dependency conflicts.
- [x] `rollback`/`regenerate`/decision export endpoints return statuses matching declared schemas.
- [x] Focused endpoint e2e runs can execute without hidden inter-test ordering dependencies.
- [x] Full `@repo/api` e2e passes with no contract drift failures.
- [ ] Remaining active decision-workflow and context routes have explicit, audited failure contracts.
- [ ] CLI-visible template/context operations are verified against finalized API contracts.
- [ ] Contract drift guardrails are reflected in the normal API validation flow.

## R4 Progress Notes

- Context-setting routes now declare the intentional `400` mismatch failures emitted by the clear-context handlers.
- Supplementary-content routes now have focused negative-path coverage for invalid query input and missing deletes.
- Template/context-window routes now have focused `404` coverage for missing template or decision-context resources.
- Workflow read-path cleanup has removed stale `400` contract noise from `GET /api/flagged-decisions/:id/context` and `GET /api/decisions/:id` and added explicit field-transcript failure contracts.
- Workflow write-path cleanup now includes explicit missing-context handling for draft versions and aligned `400` declarations for field updates.
- CLI-visible contract validation confirmed that the shared CLI client correctly depends on the normalized `{ error: string }` error shape across template, context, and decision workflows.
- CLI validation also found and fixed a real request-shape mismatch: `draft unlock-field` now sends `fieldId` in the DELETE request body to match the API contract.
- Remaining R4 work should focus on routes whose handlers still broadly map thrown errors into `400`/`404` responses without equally precise focused tests.

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
5. Remaining active API route families have been explicitly audited for contract drift, with CLI-facing paths covered.
6. Local validation flow includes practical guardrails for contract and image-build regressions.

## Risks

- Changing status codes may break existing CLI/web assumptions if not coordinated.
- E2E test ordering refactors can hide regressions if setup is oversimplified.
- Mixed in-progress feature branches may reintroduce drift unless PR checklist is enforced.
