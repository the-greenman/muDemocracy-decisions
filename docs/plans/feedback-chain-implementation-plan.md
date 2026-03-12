# Plan: Feedback Chain System

**Status**: approved — 2026-03-12
**Related docs**: `docs/decision-feedback-architecture.md`, `docs/field-regeneration-strategy.md`, `docs/expert-system-architecture.md`, `docs/mcp-architecture-strategy.md`

## Context

The former `GuidanceSegment[]` mechanism was transient — never persisted, only logged in `llm_interactions.promptSegments`. This made it impossible to build a durable feedback history, see what feedback was previously given, or selectively include/exclude feedback from future regenerations.

This plan replaces `GuidanceSegment[]` entirely with a persistent, structured `decision_feedback` table. Feedback becomes a first-class entity with:
- Categorical rating (`approved | needs_work | rejected`)
- Source attribution (`user | expert_agent | peer_user`)
- Optional verbatim text reference (annotating specific words/lines)
- Per-item exclusion from regeneration context
- Open cross-reference fields (`referenceId`, `referenceUrl`) for future external artefact links

The feedback chain is assembled automatically by `DraftGenerationService` during every regeneration. No ad-hoc guidance in the request body.

Template guidance remains a separate prompt source. It expresses the canonical intent of the active template and each field definition, while feedback provides contextual steering toward that intent for a specific draft or field instance.

**MCP compatibility**: `FeedbackService` is callable from both `apps/api` (REST) and `apps/mcp` (MCP tools), following the Shared Core pattern in `docs/mcp-architecture-strategy.md`.

**No backward compatibility** with `GuidanceSegment[]` — removed entirely from schemas, services, and API.

---

## What Changes

### 1. Removed: GuidanceSegment

- Remove `GuidanceSegmentSchema` and `GuidanceSegment` type from `packages/schema/src/index.ts`
- Remove the ad-hoc `guidance` discriminant from `PromptSegmentSchema`; replace it with a `feedback` variant and a distinct template-guidance prompt representation
- Remove `GuidanceSegment` type and all related exports from `packages/core/src/llm/i-llm-service.ts`
- Remove `addGuidance` method from `packages/core/src/llm/prompt-builder.ts`
- Preserve template and field extraction guidance as canonical prompt inputs sourced from the active template and field library
- Remove `guidance?: GuidanceSegment[]` from `generateDraft`, `regenerateField`, `regenerateDraft` in `DraftGenerationService`
- Remove `guidance` field from `GenerateDraftRequestSchema`, `RegenerateDraftRequestSchema`, `RegenerateFieldRequestSchema` in the API routes

### 2. Added: `decision_feedback` table

New Postgres table with columns:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `decision_context_id` | `uuid` | FK to `decision_contexts.id` |
| `field_id` | `uuid` | nullable — FK to `decision_fields.id`; null = whole-draft feedback |
| `draft_version_number` | `integer` | nullable — links to a specific `draftVersions` snapshot |
| `field_version_id` | `uuid` | nullable — forward-compat, FK added when `field_versions` lands |
| `rating` | enum | `approved \| needs_work \| rejected` |
| `source` | enum | `user \| expert_agent \| peer_user` |
| `author_id` | `text` | user id or agent name |
| `comment` | `text` | free-text assessment |
| `text_reference` | `text` | nullable — verbatim quote from the field value |
| `reference_id` | `text` | nullable — open cross-ref: opaque external artifact ID |
| `reference_url` | `text` | nullable — open cross-ref: URL |
| `exclude_from_regeneration` | `boolean` | default `false` |
| `created_at` | `timestamptz` | default now |

Indexes: `(decision_context_id)`, `(field_id)`, `(decision_context_id, field_id)`.

### 3. Added: `IFeedbackRepository` + `DrizzleFeedbackRepository`

Interface at `packages/core/src/interfaces/i-feedback-repository.ts`:
- `create(data)`, `findByContext(contextId)`, `findByField(contextId, fieldId)`, `update(id, data)`, `delete(id)`

Implementation at `packages/db/src/repositories/feedback-repository.ts` following `DrizzleLLMInteractionRepository` pattern.

### 4. Added: `FeedbackService`

At `packages/core/src/services/feedback-service.ts`. Clean primitive-argument methods suitable for both REST and MCP:
- `addFeedback(data)` — Zod-validated, delegates to repo
- `getFeedbackChain(contextId, fieldId?)` — scoped or full chain
- `toggleExclude(id, exclude)` — delegates to `repo.update`
- `deleteFeedback(id)`

### 5. Changed: `PromptBuilder`

- `addFeedbackChain(items: DecisionFeedback[]): this` — skips excluded items, pushes `feedback` segment objects
- `addTemplateGuidance(...)` (or equivalent) preserves template-level and field-level extraction intent as a distinct prompt layer separate from feedback
- `buildString()` renders feedback after supplementary content, before fields:

```
=== FEEDBACK ON PREVIOUS DRAFT ===
[approved | user | Alice] comment
  > "quoted text" (if textReference)

=== FEEDBACK (applies to: <fieldId>) ===
[needs_work | expert_agent | TechReviewer] comment
```

- `buildDraftPrompt` and `buildFieldRegenerationPrompt`: remove ad-hoc `guidance` param, add `feedbackChain: DecisionFeedback[]`, and include template guidance automatically from the resolved template + field definitions

### 6. Changed: `DraftGenerationService`

- Constructor gains `IFeedbackRepository` as last parameter
- `generateDraft`: auto-fetches `feedbackRepo.findByContext(contextId)` → passes to prompt builder
- `regenerateField`: merges `findByField(contextId, fieldId)` + whole-draft items from `findByContext` (field-specific first, mirrors chunk priority)
- All ad-hoc `guidance` parameters removed
- Template guidance remains wired through resolved template metadata and field definitions for both full-draft generation and field regeneration

### 7. Added: 5 REST API routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET`    | `/api/decision-contexts/:id/feedback`                | All feedback for context |
| `GET`    | `/api/decision-contexts/:id/feedback/field/:fieldId` | Field-scoped feedback |
| `POST`   | `/api/decision-contexts/:id/feedback`                | Add feedback (`decisionContextId` from route param) |
| `PATCH`  | `/api/decision-feedback/:feedbackId/exclude`         | Toggle `excludeFromRegeneration` |
| `DELETE` | `/api/decision-feedback/:feedbackId`                 | Delete feedback item |

### 8. Added: 3 MCP tools

At `apps/mcp/src/tools/feedback-tools.ts`:
- `add_field_feedback` — input: `CreateDecisionFeedback`; output: `DecisionFeedback`
- `get_feedback_chain` — input: `{ decisionContextId, fieldId? }`; output: `{ items: DecisionFeedback[] }`
- `exclude_feedback_item` — input: `{ feedbackId, exclude: boolean }`; output: `DecisionFeedback`

Each tool delegates to `FeedbackService`. Input/output schemas from `@repo/schema`.

### 9. Changed: `FieldZoom` web UI

Replace the guidance textarea with a `FeedbackSection` sub-component:
- Feedback chain items: rating badge (green/amber/red), source, author, timestamp, optional blockquote textReference
- Per-item `excludeFromRegeneration` toggle (muted when excluded)
- "Add feedback" form: rating radio, comment textarea, optional quote textarea

---

## Testing Plan

### Unit tests

**`packages/core/src/__tests__/feedback-service.test.ts`** (new)
- [ ] `addFeedback` creates record via mock repo
- [ ] `addFeedback` rejects invalid rating via Zod
- [ ] `addFeedback` rejects invalid source via Zod
- [ ] `getFeedbackChain(contextId)` calls `findByContext`
- [ ] `getFeedbackChain(contextId, fieldId)` calls `findByField`
- [ ] `toggleExclude(id, true)` calls `repo.update({ excludeFromRegeneration: true })`
- [ ] `deleteFeedback(id)` delegates to `repo.delete`

**`packages/core/src/__tests__/prompt-builder.test.ts`** (update)
- [ ] Remove all existing guidance-related test cases
- [ ] Add test coverage proving template guidance renders separately from feedback
- [ ] `addFeedbackChain([])` produces no feedback section in output
- [ ] `addFeedbackChain` with all items `excludeFromRegeneration=true` produces no section
- [ ] `approved` rating renders green label
- [ ] `needs_work` rating renders amber label
- [ ] `rejected` rating renders red label
- [ ] Whole-draft feedback (fieldId=null) renders in `=== FEEDBACK ON PREVIOUS DRAFT ===`
- [ ] Field-scoped feedback renders in `=== FEEDBACK (applies to: <fieldId>) ===`
- [ ] `textReference` present → renders blockquote

**`packages/core/src/__tests__/draft-generation-service.test.ts`** (update)
- [ ] Remove all guidance-param test cases
- [ ] `generateDraft` calls `feedbackRepo.findByContext` with correct contextId
- [ ] `generateDraft` still includes template guidance from resolved template/field definitions
- [ ] Excluded feedback items absent from `llm_interactions.promptSegments`
- [ ] Non-excluded items present in `llm_interactions.promptSegments`
- [ ] `regenerateField` calls `feedbackRepo.findByField` then `findByContext`
- [ ] Field-scoped feedback appears before whole-draft feedback in assembled chain

### Integration tests

**`packages/db/src/__tests__/feedback-repository.integration.test.ts`** (new)
- [ ] `create` inserts row and returns mapped record
- [ ] `findByContext` returns all items for context, ordered by `createdAt`
- [ ] `findByField` returns only items matching `fieldId`
- [ ] `findByContext` includes null-fieldId items
- [ ] `update` toggles `excludeFromRegeneration` and returns updated record
- [ ] `update` with unknown id returns `null`
- [ ] `delete` removes row, returns `true`
- [ ] `delete` with unknown id returns `false`
- [ ] Cascade delete: deleting parent `decision_context` removes feedback rows

### API E2E tests

**`apps/api/src/__tests__/decision-feedback.e2e.test.ts`** (new)
- [ ] `POST /api/decision-contexts/:id/feedback` with valid body → 201 + created item
- [ ] `POST` with invalid rating → 422
- [ ] `GET /api/decision-contexts/:id/feedback` → 200 + `{ items: [] }` for fresh context
- [ ] `GET /api/decision-contexts/:id/feedback` → returns created items
- [ ] `GET /api/decision-contexts/:id/feedback/field/:fieldId` → returns only field-scoped items
- [ ] `PATCH /api/decision-feedback/:id/exclude` `{ excludeFromRegeneration: true }` → 200
- [ ] `DELETE /api/decision-feedback/:id` → 204
- [ ] `POST .../generate-draft` → inspect `llm_interactions.promptSegments` — contains `feedback` type segment, no `guidance` segment
- [ ] `PATCH .../exclude` then regenerate → excluded item absent from `promptSegments`

### MCP tool tests

**`apps/mcp/src/__tests__/feedback-tools.test.ts`** (new)
- [ ] `add_field_feedback` tool calls `FeedbackService.addFeedback`
- [ ] `get_feedback_chain` tool calls `FeedbackService.getFeedbackChain`
- [ ] `exclude_feedback_item` tool calls `FeedbackService.toggleExclude`

---

## Sequencing

Follow strict layering order (schema → db → core → api → mcp → web):

1. Create docs (this step — done)
2. Update `packages/schema/src/index.ts` (Step 1)
3. Update `packages/db/src/schema.ts` + generate + migrate (Step 2)
4. Create `IFeedbackRepository` interface (Step 3)
5. Create `DrizzleFeedbackRepository` + integration tests (Step 4)
6. Create `FeedbackService` + unit tests (Step 5)
7. Remove `GuidanceSegment` from `i-llm-service.ts` (Step 6)
8. Update `PromptBuilder` + unit tests (Step 7)
9. Update `DraftGenerationService` + unit tests (Step 8)
10. Wire service factory (Step 9)
11. Add REST API routes + E2E tests (Step 10)
12. Create MCP tools + tool tests (Step 11)
13. Update `FieldZoom` web UI (Step 12)
14. Run full validation checkpoint

---

## Validation Checkpoint

```bash
pnpm db:generate    # review 0008_*.sql - should contain new enums and table
pnpm db:migrate
pnpm build
pnpm type-check
pnpm lint:workspace
pnpm --filter @repo/db test
pnpm --filter @repo/core test
pnpm test:e2e
```

Smoke checks:
- `POST /api/decision-contexts/:id/feedback` → item created, returned in response
- `GET /api/decision-contexts/:id/feedback` → `{ items: [...] }`
- `POST .../generate-draft` (no body) → `llm_interactions.promptSegments` has `feedback` type entry, no `guidance` entry
- `PATCH /api/decision-feedback/:id/exclude` `{ excludeFromRegeneration: true }` → confirmed in DB; next regeneration omits item from `promptSegments`
- MCP tool `add_field_feedback` invocation creates a DB record visible via the GET endpoint
