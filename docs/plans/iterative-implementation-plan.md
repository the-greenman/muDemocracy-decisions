# Iterative Implementation Plan

**Document Role**: This document defines delivery milestones focused on working software. It supersedes the phase-based plan from Feb 2026. All tasks from the original Phases 3–8 are incorporated here. `packages/schema` remains the single source of truth.

The original phase-based plan (Phases 0–8) is preserved at `docs/archive/iterative-implementation-plan-phases-0-8.md`.

---

## Context

Phases 0–2 are complete: Zod schemas, full service layer, Drizzle repositories, CLI scaffolding (with stubs), and API skeleton (3 meeting endpoints). No LLM integration exists. The old phase plan deferred the API to Phase 6 and made the CLI a full API client only in Phase 7. This rework prioritises:

1. Working deliverables at each milestone
2. LLM integration from Milestone 1 onwards
3. API built alongside each milestone (not deferred)
4. Observability into LLM prompt construction from day one

---

## Current State (as of March 8, 2026)

- ✅ Phase 0: Vertical slice
- ✅ Phase 1: Schema foundation (all Zod schemas)
- ✅ Phase 2: Core services + repositories + CLI scaffolding
- ✅ M1.1: Fixed all CLI layering violations (no direct @repo/db imports)
- ✅ M1.2: Vercel AI SDK installed and configured
- ✅ M1.3: LLM abstraction layer implemented (interface, mock service, Vercel AI service)
- ✅ M1.4: Prompt builder implemented with observability support
- ✅ M1.5: LLM interaction storage schema and repository implemented
- ✅ M1.6: Draft generation service implemented with full test coverage
- ✅ M1.7: Transcript upload and processing commands implemented
- ✅ M1.8: Draft CLI commands implemented (generate, show, export, debug, lock/unlock)
- ✅ M1.9: Markdown export service implemented with full formatting options
- ✅ M1.10: Draft generation prompt template implemented with runtime injection
- ✅ M1.11: API endpoints implemented with OpenAPI/Swagger docs, real-DB e2e coverage, and compose-based API/db startup workflow
- ✅ M5-CLI: CLI rewritten as pure HTTP API client (tsx boot blocker resolved by eliminating all @repo/* imports)

---

## Triage: M5 Blockers vs Post-M5 Backlog

**Date**: March 10, 2026. Goal: ship a working web UI (M5) without completing non-essential architecture work first.

### Must complete before M5

| Sub-item | Status |
|---|---|
| M4.1–M4.6: Field regen, manual edit, decision logging | ✅ Done |
| M4.7a: Field/template identity hardening | ✅ Done (parity tests remain) |
| M4.12: `outstanding_issues` field | ⏳ Small — do in M4 pass |
| M5-CLI: HTTP client CLI | ✅ Done |
| M5.0: Multi-decision workflow foundation | ⏳ |
| M5.1: Core API endpoints (meeting, context, flagged-decisions, draft, log, export) | ⏳ |
| M5.4: Interactive CLI UX (Clack) | ✅ Done (implemented without Clack) |
| M5.5 Phases 0–2: Web scaffolding + shared display + facilitator view (core workflow) | ⏳ |

### Deferred to post-M5 backlog

| Sub-item | Reason for deferral |
|---|---|
| M4.7b: Definition immutability + context pinning | Major undertaking; 7 named code incompatibilities; no user-visible impact before M5 |
| M4.8: Modular Foundation B | Infrastructure seams only; no user value before M5 |
| M4.9: Cross-meeting decision context | Schema migration + API changes; G6/G11 defer until post-M5 |
| M4.10: Decision tagging + cross-references | Non-core; web Phase 5 depends on it but Phase 5 is post-M5 |
| M4.11: Supplementary content store | Useful but not blocking the core workflow |
| Versioning Architecture Phases A–E | Snapshot model is sufficient for M5; full field-version model is post-M5 |
| M5.1a: Transcript reading mode | Enhancement; raw chunk list works for M5 core workflow |
| M5.1a.1: Transcript preprocessing seam | Infrastructure; defer |
| M5.1b: AI-assisted segment suggestions | Manual flagging is sufficient for M5 |
| M5.2: Modular activation gate | Infrastructure check; defer |
| M5.5 Phases 3–5: SSE streaming, tags, relations | Non-core for a working web UI |

**Effect on M5 exit criteria**: items that depend solely on deferred work have been removed from the M5 exit criteria list. They are tracked in the Post-M5 Backlog section at the end of this document.

---

## Architecture Decisions

### LLM SDK: Vercel AI SDK (provider-agnostic)
Use `ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai`. Existing API keys work unchanged. Provider and model are runtime-configurable via env vars:
- `LLM_PROVIDER=anthropic|openai`
- `LLM_MODEL=claude-opus-4-5|gpt-4o` (etc.)

### CLI Architecture: HTTP client (M5 CLI pivot executed early)

The original plan called for CLI to import `@repo/core` directly through M1–M4, then rewrite to HTTP in M5. A tsx/ESM runtime boot blocker in the M1–M4 CLI made it unusable, and with the API fully validated (43/43 E2E tests), the M5 pivot was executed at M4/M5 boundary.

- M1–M4 CLI: direct `@repo/core` service imports — **replaced, do not restore**
- M5 CLI (current): pure HTTP API client, `API_BASE_URL` env var (default `http://localhost:3000`), no `@repo/*` imports
- Commands: `meeting`, `transcript`, `decisions`, `context`, `draft`
- API is built in parallel throughout M1–M4, ready for M5 web UI

### CLI/API Sync Contract (all milestones)

CLI and API must remain behaviorally aligned while implementation wiring differs.

- Every new CLI workflow must have a matching API contract entry in the same milestone, or an explicit `CLI-only until M5` note.
- Every new API workflow must have a matching CLI command mapping, or an explicit `API-only (web/UI support)` note.
- Milestone validation must include at least one parity check where the same operation is executed through CLI and API and produces equivalent state/result.
- Any intentional mismatch must be documented inline with reason, owner, and planned convergence milestone.
- The iterative plan is the source-of-truth matrix for command/endpoint parity; keep CLI/API entries adjacent in each milestone section.

### Observability: Two layers

**Layer 1 — LLM interaction persistence (M1, always on)**:
Every LLM call stores its structured prompt segments, serialized prompt text, raw response, model, provider, latency, and token counts in a `llm_interactions` table. No opt-in flag needed. Surfaced via `draft debug` CLI and `GET /api/decision-contexts/:id/llm-interactions`.

**Layer 2 — Runtime structured logging (M2, phased rollout)**:
Per `docs/plans/logging-observability-plan.md`, all service boundaries emit structured JSON with correlation IDs. Rollout: M2 adds the shared logger + correlation helpers (Phase A/B of the observability plan). M4 instruments LLM requests and streaming (Phase C). Full debug UX (`--verbose`, `debug tail`) completes in M5 alongside the full API layer (Phase D). This does not block any LLM or domain milestone — logging is additive infrastructure.

### Prompt Construction: Structured Segments
A `PromptBuilder` class assembles prompts as a typed segment list before serializing to string. Guidance text is visually and semantically distinct from transcript content via explicit section delimiters. The segment tree is stored per-interaction for full auditability.

### Auto-Detection: Deferred to M6
M1–M5 use manual decision flagging (user specifies the decision). Auto-detection via LLM (implicit decisions, confidence scoring) is introduced in M6 as the first expert persona (the Decision Detector), after the expert system infrastructure exists.

### Modular Foundations (v2-aligned, v1-non-blocking)
The v2 modular architecture is a direction, not a fixed contract at this stage. During M1–M5, we should add seam-level foundations that keep v1 shipping velocity high while making future extraction easier.

Scope for v1:
- Introduce interface/barrel boundaries where natural (`transcript`, `draft/log`, `detection`, `expert`, `events`) without forcing a full rewrite.
- Keep internal implementations swappable (chunking, tagging, context-windowing) behind service interfaces.
- Prefer additive refactors with parity tests over behavioral rewrites.
- Avoid introducing mandatory runtime coupling between subsystems before v1 stabilization.

Out of scope for v1:
- No requirement to finalize the exact subsystem/module shape.
- No requirement to move to separate packages/processes.
- No requirement to fully implement advanced transcript structures (graphs, multi-pipeline chunking) before core workflow is stable.
- Definition-package distribution, public template exchange, upstream sync, and diff re-import are v2 scope rather than part of this iterative delivery plan.

---

## Principles (unchanged from original plan)

- **TDD at every step**: tests before code, always
- **Zod as SSOT**: never write manual types
- **Strict layering**: apps → core → db → schema
- **Commit validated chunks**: each commit passes its checkpoint
- **Checkpoint before continuing**: do not proceed if validation fails
- **Prompt versioning**: track prompt changes, measure quality
- **Modular-by-seams**: add stable interfaces now; defer hard module boundaries until justified
- **CLI/API parity**: no undocumented drift between command workflows and API contracts

---

## Milestone 1: LLM Draft from Transcript (MVP)

**Deliverable**: CLI tool that takes a transcript, lets the user manually identify a decision, generates a draft using the default template and optional guidance text, and exports to markdown. Uses a real LLM backend. Field locking ships with this milestone (already implemented in services).

**What "manually specified" means**: The user tells the system what the decision is — no LLM auto-detection. This creates a `FlaggedDecision` directly.

**What "guidance" means**: Free-text context the user provides to steer the LLM (e.g. "focus on cost implications"). Guidance is typed as `GuidanceSegment[]` — distinct from transcript in both the type system and the prompt.

---

### M1.1 — Fix Layering Violation ✅ COMPLETE

**Files**: `apps/cli/src/commands/meeting.ts`, `apps/cli/src/commands/decisions.ts`, `apps/cli/src/commands/template.ts`, `apps/cli/src/commands/field.ts`

Replaced direct `Drizzle*Repository` imports with service factory methods from `@repo/core`:
- `meeting.ts` - Already using `createMeetingService()`
- `decisions.ts` - Updated to use `createFlaggedDecisionService()`
- `template.ts` - Updated to use `createDecisionTemplateService()`
- `field.ts` - Updated to use `createDecisionFieldService()`

Also added missing service methods:
- `getDecisionById()`, `updateDecision()`, `updateDecisionPriority()` to `FlaggedDecisionService`
- Removed `@repo/db` dependency from `apps/cli/package.json`

**Validation**: ✅ CLI builds and runs without @repo/db imports
```bash
pnpm --filter=apps/cli build  # Builds successfully
pnpm --filter=apps/cli type-check  # No TypeScript errors
```

---

### M1.2 — Install Vercel AI SDK ✅ COMPLETE

Vercel AI SDK packages already installed in `packages/core/package.json`:
- `ai`: ^6.0.105
- `@ai-sdk/anthropic`: ^3.0.50
- `@ai-sdk/openai`: ^3.0.37

`.env.example` already includes LLM configuration:
```
LLM_PROVIDER=anthropic
LLM_MODEL=claude-opus-4-5
```

---

### M1.3 — LLM Abstraction Layer ✅ COMPLETE

**Interface**: `packages/core/src/llm/i-llm-service.ts` - Already implemented
```typescript
export interface ILLMService {
  generateDraft(params: GenerateDraftParams): Promise<DraftResult>;
  regenerateField(params: RegenerateFieldParams): Promise<string>;
}

export type GuidanceSegment = {
  fieldId?: string;           // undefined = applies to whole draft
  content: string;
  source: 'user_text' | 'tagged_transcript';
};
```

**Mock Service**: `packages/core/src/llm/mock-llm-service.ts` - Already implemented
- Deterministic canned responses for unit tests
- Parameterised to return different results per field
- Methods to override responses for test setup

**Vercel AI Service**: `packages/core/src/llm/vercel-ai-llm-service.ts` - Already implemented
- Uses `generateObject()` with Zod output schema for structured extraction
- Selects provider/model from env vars (LLM_PROVIDER, LLM_MODEL)
- Calls `PromptBuilder` to construct prompt

**Validation**: ✅ All tests pass
```typescript
const mock = new MockLLMService();
const result = await mock.generateDraft({ transcriptChunks: [], templateFields: [], guidance: [] });
expect(result).toBeDefined();
expect(typeof Object.values(result)[0]).toBe('string');
```

---

### M1.4 — Prompt Builder (Observability Foundation) ✅ COMPLETE

**Implementation**: `packages/core/src/llm/prompt-builder.ts` - Already implemented

Constructs prompts as a typed segment list, then serializes. The segment list is stored in `llm_interactions` for full auditability.

```typescript
export type PromptSegment =
  | { type: 'system'; content: string }
  | { type: 'transcript'; speaker?: string; text: string; tags: string[] }
  | { type: 'guidance'; fieldId?: string; content: string; source: 'user_text' | 'tagged_transcript' }
  | { type: 'template_fields'; fields: Array<{ id: string; displayName: string; description: string }> };

export class PromptBuilder {
  addSystem(content: string): this;
  addTranscriptChunk(chunk: TranscriptChunk): this;
  addGuidance(segment: GuidanceSegment): this;
  addTemplateFields(fields: DecisionField[]): this;
  buildSegments(): PromptSegment[];
  buildString(): string;
}
```

Guidance segments are rendered with explicit visual delimiters so the LLM cannot confuse guidance with factual transcript:
```
=== TRANSCRIPT ===
[Alice]: We need to decide on the cloud provider...

=== GUIDANCE (applies to: options field) ===
Focus on cost implications and vendor lock-in risks.

=== FIELDS TO EXTRACT ===
1. decision_statement: A clear statement of what was decided...
```

---

### M1.5 — LLM Interaction Storage Schema ✅ COMPLETE

All LLM communications are persisted — no opt-in required.

**Schema**: `packages/schema/src/index.ts` - Already implemented
```typescript
export const PromptSegmentSchema = z.discriminatedUnion('type', [...]);

export const LLMInteractionSchema = z.object({
  id: z.string().uuid(),
  decisionContextId: z.string().uuid(),
  fieldId: z.string().nullable(),
  operation: z.enum(['generate_draft', 'regenerate_field']),
  promptSegments: z.array(PromptSegmentSchema),
  promptText: z.string(),
  responseText: z.string(),
  parsedResult: z.record(z.string(), z.any()).nullable(),
  provider: z.string(),
  model: z.string(),
  latencyMs: z.number(),
  tokenCount: z.object({ input: z.number(), output: z.number() }).nullable(),
  createdAt: z.string(),
});
```

**Database**: `packages/db/src/schema.ts` - Already implemented
- `llm_interactions` table with proper indexes on decisionContextId and fieldId

**Repository**: `packages/db/src/repositories/llm-interaction-repository.ts` - Already implemented
- `create(data)` - Creates new LLM interaction record
- `findByDecisionContext(id)` - Returns all interactions for a decision context
- `findByField(contextId, fieldId)` - Returns interactions for a specific field

---

### M1.6 — Draft Generation Service ✅ COMPLETE

**Implementation**: `packages/core/src/services/draft-generation-service.ts` - Already implemented

```typescript
export class DraftGenerationService {
  constructor(
    private llm: ILLMService,
    private transcriptRepo: ITranscriptChunkRepository,
    private templateRepo: IDecisionTemplateRepository,
    private contextRepo: IDecisionContextRepository,
    private llmInteractionRepo: ILLMInteractionRepository,
  ) {}

  async generateDraft(decisionContextId: string, guidance?: GuidanceSegment[]): Promise<DecisionContext>;
  // 1. Fetch transcript chunks for meeting (weighted: field-tagged > decision-tagged > meeting-tagged)
  // 2. Resolve the context's pinned template definition version and field-definition set
  // 3. Build prompt via PromptBuilder
  // 4. Skip locked fields (pass to LLM only unlocked fields)
  // 5. Call llm.generateDraft()
  // 6. Persist LLMInteraction record
  // 7. Merge LLM result with existing locked field values
  // 8. Save to decision_contexts.draft_data
  // 9. Return updated context
}
```

**Tests**: `packages/core/src/__tests__/draft-generation-service.test.ts` - All 10 tests pass
- Unit tests with `MockLLMService`
- Verifies: locked fields not sent to LLM, interaction stored, guidance segments passed correctly

**Validation**: ✅ All tests pass
```typescript
const draft = await draftService.generateDraft(contextId);
DraftSchema.parse(draft.draftData);
const interactions = await llmInteractionRepo.findByDecisionContext(contextId);
expect(interactions).toHaveLength(1);
expect(interactions[0].promptSegments).toBeDefined();
```

---

### M1.7 — Transcript Upload (Fix Stubs) ✅ COMPLETE

**File**: `apps/cli/src/commands/transcript.ts` - Already implemented

Implemented the previously stubbed commands:
- `transcript upload <file>` — reads file (JSON array of `{speaker, text}` or plain text), calls `transcriptService.uploadTranscript()`, then auto-processes into chunks
- `transcript process <id>` — re-chunks a raw transcript with configurable strategy and chunk size
- `transcript list --chunks` — shows chunks for a meeting instead of raw transcripts

**Chunking strategies (2 supported):**
- `fixed` — **default** word/token-count based chunking using `maxTokens` and `overlap`.
- `semantic` — optional/experimental sentence-boundary aware chunking (tries to keep sentences intact, still bounded by `maxTokens`).

**Selecting a strategy:**
- Upload-time chunking:
  - `transcript upload ... --chunk-strategy fixed|semantic --chunk-size 500 --overlap 50`
- Re-processing an existing raw transcript:
  - `transcript process --transcript-id <id> --strategy fixed|semantic --chunk-size 500 --overlap 50`

**Filtering chunks when listing:**
- `transcript list --meeting-id <id> --chunks --strategy fixed`
- `transcript list --meeting-id <id> --chunks --strategy semantic`

**Added**: `processTranscript()` public method to `TranscriptService` to expose chunking functionality

**Validation**: ✅ Commands work as expected
```bash
pnpm cli transcript upload ./examples/sample.txt --meeting-id <id>  # Uploads and auto-chunks
pnpm cli transcript list --meeting-id <id> --chunks  # Shows chunks
pnpm cli transcript process <transcript-id> --strategy fixed --chunk-size 500  # Re-chunks
```

---

### M1.8 — Draft CLI Commands ✅ COMPLETE

**File**: `apps/cli/src/commands/draft.ts` - Already implemented

Implemented all draft subcommands:
- `draft generate [--guidance "text"]` — generate/regenerate full draft (respects locks)
- `draft show` — display current draft_data with lock status
- `draft export [--output path.md]` — render to markdown (stdout or file)
- `draft debug [--context-id <id>]` — print last LLM interaction (prompt + response)
- `draft lock-field <field-name>` — lock a field
- `draft unlock-field <field-name>` — unlock a field

**Added**: `LLMInteractionService` and `createLLMInteractionService()` factory

`draft show` renders locked fields with `[LOCKED]` prefix:
```
[LOCKED] decision_statement: Approve roof repair budget
         options: (awaiting generation)
```

---

### M1.9 — Markdown Export Service ✅ COMPLETE

**File**: `packages/core/src/services/markdown-export-service.ts` - Already implemented

Implemented full markdown export service with features:
- Export decision drafts to structured markdown format
- Configurable metadata (timestamps, participants, etc.)
- Field ordering options (template order or alphabetical)
- Locked field indicators (prefix, suffix, or none)
- Support for multiple field types (markdown, list, etc.)
- Export multiple decisions to single file

**Format**: `# Decision: {title}\n\n## {fieldDisplayName}\n{fieldValue}\n\n...`
- Includes metadata footer: date, participants, logged-by, decision method

**CLI Integration**: Enhanced `draft export` command with new options:
- `--no-metadata` - Exclude metadata
- `--field-order <template|alphabetical>` - Field ordering
- `--lock-indicator <prefix|suffix|none>` - Lock indicator style

---

### M1.10 — Draft Generation Prompt ✅ COMPLETE

**File**: `prompts/draft-generation.md` - Already implemented

Created comprehensive prompt template for LLM-based draft generation:
- System prompt instructing LLM to extract structured field values from transcript
- Guidance injection section clearly marked: `{GUIDANCE_SECTION}`
- Field list injected at runtime with display names and extraction descriptions
- v1 — version tracked in filename/header
- Includes detailed instructions, output format, and examples

**Implementation**: 
- Added `buildDraftPromptFromTemplate()` function to prompt-builder
- Integrated into DraftGenerationService with `USE_TEMPLATE_PROMPT=true` flag
- Fetches additional context (meeting ID, decision title, summary) for template
- Maintains backward compatibility with existing prompt system

---

### M1.11 — API Endpoints (parallel build)

**Status**: ✅ COMPLETE

**New route files** in `apps/api/src/routes/`:
- `POST /api/meetings/:id/transcripts/upload` — upload + chunk transcript
- `POST /api/meetings/:id/flagged-decisions` — manually create flagged decision
- `POST /api/decision-contexts` — create context from flagged decision
- `POST /api/decision-contexts/:id/generate-draft` — body: `{ guidance?: GuidanceSegment[] }`
- `GET /api/decision-contexts/:id/export/markdown` — returns markdown string
- `PUT /api/decision-contexts/:id/lock-field` — lock field
- `DELETE /api/decision-contexts/:id/lock-field` — unlock field
- `GET /api/decision-contexts/:id/llm-interactions` — debug/observability

All routes use Zod schemas + `@hono/zod-openapi` (auto-generates OpenAPI spec).

**Delivered**:
- Route definitions and handlers added in `apps/api/src/routes/decision-workflow.ts` and `apps/api/src/index.ts`
- Runtime OpenAPI served from `GET /openapi.json`
- Swagger UI served from `GET /docs`
- Real-database API e2e coverage added for the M1.11 workflow endpoints
- Compose/Docker workflow fixed so the API and database can be brought up reliably for iterative testing (`pnpm up:stack`)

---

### M1 Validation (End-to-End)

```bash
# 1. Infrastructure
docker-compose up -d postgres
pnpm db:migrate
 
# 2. Unit tests pass
pnpm test --filter=@repo/core  # includes new draft-generation tests

# 3. Full workflow via CLI
pnpm cli meeting create "Q1 Planning" --participants "Alice,Bob"
pnpm cli transcript upload ./examples/sample-transcript.txt --meeting-id <id>
pnpm cli decisions flag <meeting-id> --title "Approve cloud migration"
pnpm cli decisions flag <meeting-id> --title "Escalate risk controls"
pnpm cli decisions update <flagged-id> --segments all

pnpm cli draft generate                # version 1
pnpm cli draft versions                # shows v1
pnpm cli transcript add --text "Additional context about costs..."
pnpm cli draft generate                # version 2 (v1 snapshot saved)
pnpm cli draft versions                # shows v1, v2
pnpm cli draft rollback 1              # restore v1
pnpm cli draft show                    # shows v1 content
pnpm cli draft debug                   # shows both LLM interactions

# 4. Debug observability
pnpm cli draft debug    # prints prompt segments + response for last generation

# 5. API endpoint test
curl -X POST http://localhost:3001/api/decision-contexts/<id>/generate-draft \
  -H "Content-Type: application/json" \
  -d '{"guidance": [{"content": "Focus on cost", "source": "user_text"}]}'
# Returns updated DecisionContext with populated draft_data

curl http://localhost:3001/api/decision-contexts/<id>/llm-interactions
# Returns stored prompt + response for inspection

# 6. Compose-based API startup
pnpm up:stack
curl http://localhost:3001/health
curl http://localhost:3001/openapi.json
curl http://localhost:3001/docs
```

### M1 Exit Criteria
- ✅ M1.1: CLI layering violations fixed (no direct @repo/db imports)
- ✅ M1.2: Vercel AI SDK installed and configured
- ✅ M1.3: LLM abstraction layer implemented (interface, mock, Vercel AI service)
- ✅ M1.4: Prompt builder implemented with typed segments and delimiters
- ✅ M1.5: LLM interaction storage implemented (schema, table, repository)
- ✅ M1.6: Draft generation service implemented with full test coverage
- ⏳ Optional live-provider validation: real LLM generates populated draft from sample transcript when provider credentials are configured
- ✅ Locked fields unchanged after regeneration (verified in tests)
- ✅ LLM interaction stored with prompt segments (implemented in draft service)
- ✅ Markdown export renders all fields in template order (implemented in M1.9 and verified via API export endpoint)
- ✅ `draft debug` shows exact prompt sent to LLM (implemented in M1.8)
- ✅ API endpoint returns same result as CLI path (implemented and covered with real-DB API tests)

---

## Milestone 2: Versions + Ongoing Transcripts

**Deliverable**: Add transcript content incrementally to a meeting. View draft history. Roll back to a prior draft version. Global context management for active meeting/decision/field state.

**Status**: ✅ Substantially complete. Core context management, auto-tagging, snapshot versioning, rollback flows, and API/CLI surfaces are implemented. Remaining work in this milestone is primarily documentation refresh and any parity polish not yet covered by focused tests.

---

### M2.1 — Global Context Management ✅ COMPLETE

Implements persistent session state for the CLI (active meeting, decision, field).

**New**: `packages/core/src/services/global-context-service.ts`
- `setActiveMeeting(meetingId)` / `clearMeeting()`
- `setActiveDecision(flaggedDecisionId, templateId?)` — creates or retrieves `DecisionContext`
- `setActiveField(fieldId)` / `clearField()`
- `getContext(): Promise<GlobalContext>` — returns full active state with nested objects

State persisted in a lightweight local file (`~/.decision-logger/context.json`) for CLI, or in-memory for API.

**New tests**: unit tests for all state transitions and persistence.

**Validation**:
```typescript
await globalContext.setActiveMeeting('mtg_123');
await globalContext.setActiveDecision('flag_1');
await globalContext.setActiveField('options');
const ctx = await globalContext.getContext();
expect(ctx.activeMeetingId).toBe('mtg_123');
expect(ctx.activeField).toBe('options');
```

**CLI commands**:
```
context show
context set-meeting <id>
context set-decision <flagged-id> [--template <id>]
context set-field <field-name>
context clear-field
context clear-decision
context clear-meeting
```

**Delivered**:
- Global context service and factory wiring implemented
- CLI context commands implemented against the HTTP API client
- API coverage exists for active meeting / decision / field context workflows

---

### M2.2 — Auto-Tagging Transcript Chunks ✅ COMPLETE

When a transcript chunk is added, it is automatically tagged based on the active context.

**Update**: `packages/core/src/services/transcript-service.ts`
- `addChunk()` accepts active context (from `GlobalContextService`) and applies tags:
  - Always: `meeting:<id>`
  - If decision active: `decision:<contextId>`
  - If field active: `decision:<contextId>:<fieldId>`

**Validation**:
```typescript
await globalContext.setActiveMeeting('mtg_1');
await globalContext.setActiveDecision('flag_1');
await globalContext.setActiveField('options');

const chunk = await transcriptService.addChunk({ text: 'Three options were discussed...' });
expect(chunk.contexts).toContain('meeting:mtg_1');
expect(chunk.contexts).toContain('decision:ctx_1');
expect(chunk.contexts).toContain('decision:ctx_1:options');
```

**Delivered**:
- Transcript chunk creation and streaming flows apply meeting / decision / field context tags
- API e2e coverage verifies context-aware transcript and streaming behavior

---

### M2.2a — Segment Range Selection for Manual Decision Flagging

Improve manual context selection so users can tag chunk ranges without listing every chunk ID.

**Update**: `apps/cli/src/commands/decisions.ts`, `packages/core/src/services/flagged-decision-service.ts`
- Extend `decisions flag` and `decisions update` to accept sequence-based ranges:
  - `--segments 12-18,22,25-27`
  - `--segments all` (or `--all`) to include all chunks in the active/target meeting
- Resolve ranges by `TranscriptChunk.sequenceNumber` to concrete chunk IDs before persistence.
- Persist normalized `segmentIds` only (no schema change required).
- Validate ranges with clear errors:
  - invalid format (`12-`, `a-b`)
  - descending range (`18-12`)
  - out-of-bounds sequence numbers
  - missing meeting context when `--all` is used

**Behavior note**:
- A single chunk can be linked to multiple flagged decisions. This is expected and supported by context tagging (`contexts` is an array).

**Validation**:
```bash
pnpm cli transcript list --meeting-id <id> --chunks
pnpm cli decisions flag <meeting-id> --title "Approve vendor" --segments 12-18,22
pnpm cli decisions flag <meeting-id> --title "Escalate risk controls" --segments 16-20
# chunk 16-18 may belong to both decisions
pnpm cli decisions update <flagged-id> --segments all
```

**Status**: ⏳ Not yet confirmed complete in this plan. Keep as the next M2 follow-up if range-based selection is still desired beyond the current chunk-ID workflow.

---

### M2.3 — Draft Versioning Schema ✅ COMPLETE

**Update**: `packages/schema/src/index.ts` — add `draftVersions` to `DecisionContextSchema`

**Update**: `packages/db/src/schema.ts`
```sql
draft_versions JSONB NOT NULL DEFAULT '[]'
-- Array of { version: number, draftData: Record<string,string>, savedAt: string }
```

Drizzle migration required.

> **Long-term direction**: `draft_versions` is a transitional snapshot model. The target architecture is field-centric versioning per `docs/versioning-architecture.md`.

**Delivered**:
- Snapshot-based draft version persistence is implemented and exercised through API e2e coverage
- The snapshot model remains the active M5-compatible versioning approach

---

### M2.4 — Version Service Methods ✅ COMPLETE

**Update**: `packages/core/src/services/decision-context-service.ts`
- `saveSnapshot(id)` — pushes current `draft_data` + timestamp into `draft_versions` before overwriting
- `rollback(id, version)` — restores `draft_data` from `draft_versions[version]`
- `listVersions(id)` — returns `Array<{version, savedAt, fieldCount}>`

`DraftGenerationService.generateDraft()` calls `saveSnapshot()` automatically before each generation.

> **Implementation note**: decision-level snapshot rollback may remain temporarily while field-based restore is completed, but the target behavior is field-based orchestration.

**Delivered**:
- Version list and rollback service behavior implemented
- Workflow routes and API handlers shipped for listing versions and restoring snapshots
- API e2e tests cover successful version listing, successful rollback, and missing-context failure cases

---

### Versioning Architecture Implementation (Dedicated Plan Section)

> **Triage: DEFERRED — post-M5 backlog.** The snapshot model (M2.3/M2.4) is sufficient for M5. Phases A–E below are the correct long-term direction but do not need to ship before the web UI. Move to post-M5 backlog.

**Architecture source-of-truth**: `docs/versioning-architecture.md`

**Supporting references**:
- `docs/field-template-versioning-explainer.md`
- `docs/plans/field-versioning-schema-proposal.md`
- `docs/plans/field-versioning-api-proposal.md`

This section defines implementation sequencing for the long-term field-based versioning model.

**Scope clarification**:
- `DecisionContext` is long-running decision preparation state and may span multiple meetings plus off-meeting work.
- Meetings manage ordered agendas by selecting from open decision contexts.
- Automatically detected decision candidates remain candidates until explicitly promoted into decision contexts.
- One decision context may accumulate transcript evidence from many meetings.
- `DecisionLog` is the immutable record of the actual decision moment.
- Finalization must capture the meeting/event context and authority participant snapshot relevant at that specific moment.

**Phase A — Schema introduction**
- Add field-version and field-visibility persistence model.
- Add `field_versions` table with append-only per-field history, active-version semantics, and provenance columns.
- Add `field_visibility_state` table for current template-driven visibility without deleting field content.
- Add DB constraints/indexes for:
  - unique `(decision_context_id, field_id, version)`
  - exactly one active field version per `(decision_context_id, field_id)`
  - efficient active-field and history reads by context/field.
- Add explicit context/meeting linkage planning so agendas and transcript relations do not hard-code single-meeting ownership.

**Phase B — Field-Specific Writes**
- Route manual edit/regenerate/full regenerate through the field-version path.
- Keep provisional snapshot updates only where unfinished code still depends on them.
- Add tests ensuring active values resolve from the field-version path correctly.
- Field-specific write entry points:
  - `DecisionContextService.setFieldValue()`
  - single-field regenerate flow
  - full draft generate/regenerate flow for unlocked visible fields
- Persist field-version provenance where available:
  - `source`
  - `sourceInteractionId`
  - `createdBy`
  - optional `notes`
- Keep `lockedFields` as the current lock-state source for now; enforce lock policy in service logic rather than introducing lock-history persistence in Phase A/B.

**Phase C — Field-Centric Reads**
- Switch UI/API/CLI field reads to field-version active values.
- Add field-centric read services that return active visible field state from `field_versions` + `field_visibility_state`.
- Migrate `draft show`, field-specific API responses, export preparation, and finalization reads onto active field versions.
- Remove provisional read paths as soon as the field-version surfaces cover the required behavior.

**Phase D — Rollback conversion**
- Convert rollback UX/API semantics to field-based restore operations.
- Retain decision-level rollback command temporarily if needed.
- Add field-history list/show/restore capabilities as first-class API/CLI workflows.
- Implement restore as append-only creation of a new active field version with `source='rollback'`.
- Convert decision-level rollback into orchestration that restores the affected fields rather than reactivating snapshot state in place.

**Phase E — Template transform and context/meeting alignment**
- Treat template change alone as a visibility/state change, not a field-value version event.
- Only create `template_transform` field versions for values that are actually regenerated or transformed.
- Add API/CLI affordances for template change modes, e.g. visibility-only vs transform-unlocked-visible-fields.
- Add meeting-agenda selection semantics for open contexts.
- Add transcript-to-context linkage semantics for evidence from many meetings.
- Keep decision candidates separate from decision contexts until promotion.

**Acceptance checkpoints**
- Field edit/regenerate always creates append-only field versions.
- Hidden fields remain recoverable and excluded from export.
- Completion persists notes text + timestamp with active field versions.
- API/CLI parity holds for field-version list/show/restore flows.
- Locked fields reject automated writes from regenerate/template-transform flows.
- Decision-level rollback behaves as a compatibility wrapper over field restore semantics.

**Validation questions**:
- Can one context be resumed in a later meeting without cloning field history? ✓ (join table)
- Can off-meeting edits occur without fabricating meeting ownership? ✓ (context has no required `meetingId` for edits)
- Can finalization explicitly identify the meeting/event and participant set? ✓ (via `decision_context_meetings.meetingId` + meeting participants)

---

### M2.5 — Ongoing Transcript ✅ COMPLETE

- `transcript upload` allows re-uploading to an existing meeting (appends chunks, does not replace)
- `transcript add --text "..."` correctly uses active meeting context + auto-tagging
- CLI command `transcript add --field <name> --text "..."` tags chunk at field level

**Delivered**:
- Incremental transcript upload and streaming flows are implemented
- Context-aware transcript additions are covered through API e2e workflows

---

### M2.6 — CLI + API for Versions ✅ COMPLETE

**Add to `draft` commands**:
```
draft versions             — list snapshots with timestamps and field counts
draft rollback <version>   — restore draft to version N
```

**New API endpoints**:
- `GET /api/decision-contexts/:id/versions` — list versions
- `POST /api/decision-contexts/:id/rollback` — body: `{ version: number }`

**Migration note**:
- These snapshot-oriented commands/endpoints may remain temporarily while the field-version workflow is completed.
- Long-term field-centric additions should be introduced alongside them:
  - `draft field-history <field-ref>`
  - `draft show-field-version <field-ref> --version <n>`
  - `draft restore-field <field-ref> --version <n>`
  - `GET /api/decision-contexts/:id/fields/:fieldRef/versions`
  - `GET /api/decision-contexts/:id/fields/:fieldRef/versions/:version`
  - `POST /api/decision-contexts/:id/fields/:fieldRef/restore`

**Delivered**:
- Snapshot version list and rollback flows are available via API
- API e2e coverage exists for `GET /api/decision-contexts/:id/versions` and `POST /api/decision-contexts/:id/rollback`
- Field-level history/restore remains part of the deferred long-term field-version architecture

---

### M2.7 — Modular Foundation A (Interfaces + Adapters)

Lay non-breaking seams that allow subsystem extraction later without changing user-visible behavior now.

**Add**:
- `packages/core/src/transcript-manager/i-transcript-manager.ts` and `index.ts` barrel (interface only).
- `packages/core/src/decision-log-generator/i-decision-log-generator.ts` and `i-content-creator.ts` (interface only).
- `packages/core/src/events/decision-events.ts`, `i-event-bus.ts`, `in-process-event-bus.ts` (minimal in-memory implementation).

**Wire (no behavior changes)**:
- Service factory creates adapter-backed implementations that delegate to existing services (`TranscriptService`, `DraftGenerationService`, `DecisionContextService`).
- Event bus defaults to in-process and no-op unless subscribers are explicitly registered.

**Constraints**:
- No endpoint/CLI contract changes in this step.
- No mandatory runtime dependency on detector/expert subscribers.

---

### M2.8 — Decision Tagging and Cross-References (Foundation)

> **Triage: DEFERRED — post-M5 backlog.** Valuable feature, but the core workflow (flag → generate → log → export) does not require tags or relations. Web Phase 5 consumes these APIs; Phase 5 is post-M5. Implement after the core web UI ships.

**Goal**: Give decisions and decision contexts lightweight metadata — tags for topics, teams, committees, and projects — and allow them to reference each other. The initial design must be simple enough to ship now but structured so it can evolve toward a full graph model without a breaking migration.

#### Guiding principle

Avoid a generic graph from the start. A tag table + a typed relation table is sufficient for M4. The schema choices below are designed so that a future graph layer can be placed on top without discarding the existing rows.

---

#### Tagging model

Tags are named, categorised labels that can be attached to both `DecisionContext` and `DecisionLog` records.

**Tag categories (initial)**:
- `topic` — subject matter (e.g., "infrastructure", "hiring", "security")
- `team` — team or committee owning or affected by the decision
- `project` — associated project or initiative

A tag is a first-class entity so it can be renamed, merged, and eventually queried across decisions. Free-text string arrays on the decision rows are explicitly rejected because they cannot be renamed, merged, or traversed efficiently.

**DB schema additions** (`packages/db/src/schema.ts`):

```sql
-- Canonical tag definitions
tags (
  id          uuid PK,
  namespace   text NOT NULL DEFAULT 'core',
  name        text NOT NULL,
  category    tag_category_enum NOT NULL,  -- topic | team | project
  createdAt   timestamptz
)
UNIQUE (namespace, name)

-- Many-to-many: tags on decision contexts (drafts in progress)
decision_context_tags (
  contextId   uuid FK → decision_contexts.id,
  tagId       uuid FK → tags.id,
  PRIMARY KEY (contextId, tagId)
)

-- Many-to-many: tags on decision logs (immutable finalized records)
decision_log_tags (
  logId       uuid FK → decision_logs.id,
  tagId       uuid FK → tags.id,
  PRIMARY KEY (logId, tagId)
)
```

Tags on a `DecisionLog` are a snapshot taken at finalization from the context's tag set. They do not update after logging.

**Services**:
- `TagService` in `packages/core/src/services/tag-service.ts`
  - `createTag(name, category)` — idempotent by `(namespace, name)`
  - `addTagToContext(contextId, tagId)`
  - `removeTagFromContext(contextId, tagId)`
  - `getTagsForContext(contextId)`
  - `getTagsForLog(logId)`
  - `listTags(filter?: { category })` — for autocomplete

Tags are snapshotted onto `DecisionLog` automatically during `DecisionLogService.logDecision`.

**API route file**: `apps/api/src/routes/tags.ts` (new file, registered in `apps/api/src/index.ts`)

**API endpoints**:
- `GET /api/tags` — list all tags, filterable by `?category=team|topic|project`
- `POST /api/tags` — body: `{ name, category }` — idempotent create by `(namespace, name)`
- `GET /api/decision-contexts/:id/tags` — list tags on context
- `POST /api/decision-contexts/:id/tags` — body: `{ name, category? }` — resolve-or-create tag by name and associate; `category` required only when creating a new tag
- `DELETE /api/decision-contexts/:id/tags/:tagId` — remove tag from context
- `GET /api/decisions/:id/tags` — list tags on a logged decision (read-only after finalization)

**CLI commands**:

Top-level `tag` command group (`apps/cli/src/commands/tag.ts`, registered in entry point) for managing the tag library:
```
tag list [--category topic|team|project]          — list all tags
tag create <name> --category <category>           — create a tag
```

`context tag` nested sub-group on the existing `contextCommand` (operates on the **active** context from `GlobalContextService`, no ID arg required — consistent with `context set-field`):
```
context tag add <name> [--category topic|team|project]   — resolve-or-create tag by name and attach to active context
context tag remove <name>                                 — detach tag from active context by name
context tag list                                          — list tags on active context
```

---

#### Cross-reference model

Decisions and contexts sometimes depend on, supersede, or block each other. A typed relation table captures this without requiring a full graph library.

**Initial relation types**:
- `supersedes` — this decision replaces a prior one
- `depends_on` — this decision requires another to be logged first
- `related_to` — informational link, no ordering implied
- `blocks` — this context must be resolved before another can proceed

**DB schema additions**:

```sql
-- Typed edges between decisions/contexts
decision_relations (
  id            uuid PK,
  fromType      relation_node_type_enum NOT NULL,  -- decision_context | decision_log
  fromId        uuid NOT NULL,
  relationType  decision_relation_type_enum NOT NULL,
  toType        relation_node_type_enum NOT NULL,
  toId          uuid NOT NULL,
  createdAt     timestamptz,
  createdBy     text
)
INDEX on (fromType, fromId)
INDEX on (toType, toId)
```

`fromType`/`toType` allow edges between any combination of contexts and logs. This is intentionally the same shape as a generic property graph edge table — a future graph layer can read these rows directly.

**Services**:
- `DecisionRelationService` in `packages/core/src/services/decision-relation-service.ts`
  - `addRelation(from, relationType, to, createdBy)` — rejects self-links and duplicate directed edges
  - `removeRelation(id)`
  - `getRelationsFrom(nodeType, nodeId)` — outgoing edges
  - `getRelationsTo(nodeType, nodeId)` — incoming edges

**API route file**: `apps/api/src/routes/decision-relations.ts` (new file, registered in `apps/api/src/index.ts`)

**API endpoints**:
- `POST /api/decision-relations` — body: `{ fromType, fromId, relationType, toType, toId, createdBy? }`
- `DELETE /api/decision-relations/:id`
- `GET /api/decision-contexts/:id/relations` — both outgoing and incoming edges for this context
- `GET /api/decisions/:id/relations` — both outgoing and incoming edges for this logged decision

**CLI commands**:

`context relation` nested sub-group on the existing `contextCommand` (operates on the **active** context, consistent with other `context` sub-commands):
```
context relation add <relationType> <toId> [--to-type context|decision] [--by <user>]
                                                  — add a relation from active context to another node
context relation remove <relationId>              — remove a relation by ID
context relation list                             — list all relations on active context
```

`decision relation` nested sub-group on the existing `decisionCommand` (mirrors the existing `decision context` nested group pattern, operates by explicit ID):
```
decision relation add <fromId> <relationType> <toId> [--from-type context|decision] [--to-type context|decision] [--by <user>]
decision relation remove <relationId>
decision relation list <id> [--node-type context|decision]
```

The `--to-type` / `--from-type` flags default to `decision` (a logged decision) when omitted, since the most common use case is linking two finalized decisions.

---

#### Graph evolution path

The initial schema is graph-compatible by design:
- `tags` → future: tag hierarchy (`parentId`), tag merges, upstream-tracked tag packages
- `decision_relations` → future: weighted edges, traversal queries, cycle detection, visualisation
- No graph library or query language is required now; standard SQL is sufficient for M4 filtering and display
- When a graph query layer is added (e.g., Apache AGE, or an application-layer BFS), it can consume the existing `decision_relations` rows directly

**Do not** add graph traversal, cycle detection, or weighted edges in M4. Add those only when a concrete feature requires them.

---

### M2.9 — Supplementary Content Store

> **Triage: DEFERRED — post-M5 backlog.** Useful enrichment but not part of the core workflow. LLM draft generation works without it. The web prototype validated the interaction model; implement after the core web UI ships.

**Goal**: Allow facilitators to attach non-transcript text evidence — meeting background, comparison tables, prior documents — to a meeting, decision context, or specific field. This material participates in LLM context retrieval alongside transcript chunks using the same `{scope}:{id}[:{field}]` tagging hierarchy.

**Why here**: The context builder must query both sources from the beginning. Deferring schema creation to M5.1 would require retrofitting retrieval logic that was shipped against transcript-only assumptions. G4 in `docs/ux-workflow-examples.md` identified this as a parallel store, not a secondary feature.

---

#### Schema

**New table** (`packages/db/src/schema.ts`):

```sql
supplementary_content (
  id           uuid PRIMARY KEY,
  meeting_id   uuid NOT NULL REFERENCES meetings(id),
  label        text,
  body         text NOT NULL,
  source_type  text NOT NULL DEFAULT 'manual',
  contexts     text[] NOT NULL DEFAULT '{}',   -- e.g. ['decision:abc', 'decision:abc:options']
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT NOW()
)
CREATE INDEX idx_supcontent_contexts ON supplementary_content USING GIN(contexts);
```

The `contexts` array holds the same `{scope}:{id}[:{field}]` tags used by transcript chunks. Three tagging levels match the three points of entry:

| Entry point | Tag applied |
|---|---|
| Meeting-level background | `meeting:{meetingId}` |
| Decision workspace | `decision:{contextId}` |
| Field zoom | `decision:{contextId}:{fieldId}` |

---

#### Service

**New**: `packages/core/src/services/supplementary-content-service.ts`

- `add(meetingId, body, options?: { label?, contexts?, createdBy? }): Promise<SupplementaryContent>`
- `listByContext(contextTag: string): Promise<SupplementaryContent[]>` — filters by `contexts @> ARRAY[contextTag]` (GIN index query)
- `remove(id): Promise<void>`

**Context builder extension** (`packages/core/src/services/context-builder.ts` or equivalent):

The prompt builder currently fetches transcript chunks by context tag. It must be extended to also fetch `supplementary_content` rows matching the same tags and include them as a distinct section in the prompt:

```
=== SUPPLEMENTARY EVIDENCE (options field) ===
[Options comparison table — added 14:32]
Option 1: full cloud-native stack (£45k). Option 2: patch existing service (£8k)...
```

This section is rendered after transcript evidence for the same scope, before any inline guidance.

---

#### API endpoints

**New route file**: `apps/api/src/routes/supplementary-content.ts`

- `POST /api/supplementary-content` — body: `{ meetingId, body, label?, contexts?, createdBy? }`
- `GET /api/supplementary-content?context={tag}` — list items matching context tag
- `DELETE /api/supplementary-content/:id`

---

#### CLI commands

```
supplementary add --meeting-id <id> --body "text" [--label "label"] [--context "decision:abc:options"]
supplementary list --context "decision:abc"
supplementary remove <id>
```

---

#### Web prototype reference

The prototype in `apps/web/` already implements this flow: `FieldZoom.tsx` shows a "Supplementary evidence" section with add/remove controls. `FacilitatorMeetingPage.tsx` holds supplementary state at page level and passes it down. `FacilitatorFieldCard.tsx` shows a count badge via the `supplementaryCount` prop. This prototype was built to validate G4 and serves as the accepted interaction model.

---

#### Validation

```bash
# Add supplementary evidence at field scope
curl -X POST http://localhost:3000/api/supplementary-content \
  -d '{"meetingId":"<id>","body":"Option 1: cloud-native...","label":"Comparison table","contexts":["decision:<ctx-id>:options"]}'

# Retrieve by context tag
curl "http://localhost:3000/api/supplementary-content?context=decision:<ctx-id>:options"

# Verify it appears in draft generation prompt
pnpm cli draft debug   # supplementary section visible alongside transcript sections

# Regeneration with supplementary evidence active
pnpm cli draft regenerate-field options
# Expected: options field now incorporates the comparison table text
```

---

### M2.10 — Open Questions Field (Template Library Addition)

**Goal**: Add an `outstanding_issues` field to templates used for decisions that may be deferred mid-meeting. Without a structured place to record the open questions that caused a deferral, that information is lost to the system — it exists only in meeting notes or memory. When the context is resumed in a future meeting, the working group has no structured record of what was unresolved.

**Identified in**: Flow 2, G12 (`docs/ux-workflow-examples.md`).

**Scope**: This is a field library addition, not a schema change. The field is added to the canonical field definitions and assigned to relevant templates. No new table or migration is required beyond the normal seed update.

---

#### New field definition

```
name:        outstanding_issues
label:       Outstanding issues / open questions
description: Unresolved questions, dependencies, or concerns that prevented this decision from being finalised. Used when a decision is deferred — records why and what must be answered before it can proceed.
type:        text (long-form, markdown)
required:    false
prompt:      Summarise any open questions, unresolved dependencies, or concerns raised during discussion that the group could not answer in this session.
```

#### Templates to receive this field

| Template | Rationale |
|---|---|
| Proposal Acceptance | Most commonly deferred; replaces the adjacent but semantically different `stakeholder_concerns` for recording blocking questions |
| Strategy Decision | Strategic direction frequently deferred pending information |
| Standard Decision | General-purpose fallback; deferral is common |

Technology Selection, Budget Approval, and Policy Change templates do not receive this field by default — deferral is less common and existing concern/risk fields partially cover the need.

#### Interaction model

The `outstanding_issues` field is shown in field zoom like any other field. During a deferral flow, the facilitator zooms into it and records the open questions before deferring the context. When the context is resumed in a future meeting, this field is immediately visible as a locked or editable starting point for the new session.

The field is not auto-populated by LLM generation — it captures what the group explicitly identified as unresolved. It may be pre-populated by guidance if the facilitator asks for a summary of open points, but is not part of the standard draft generation pass.

---

### M2 Validation

```bash
# Per-field workflow
pnpm cli context set-field options
pnpm cli transcript add --text "Option 1: full replacement for £45k. Option 2: patch for £8k."
pnpm cli draft regenerate-field options
pnpm cli draft regenerate-field options --guidance "Focus on long-term maintenance cost"
pnpm cli draft debug  # shows field-tagged chunks in guidance section, separate from transcript
pnpm cli draft edit-field consequences_positive  # manual edit
pnpm cli draft show  # [MANUALLY EDITED] consequences_positive

# Finalization
pnpm cli decision log --type consensus --details "5 for, 2 against" \
     --actors "Alice,Bob,Carol" --logged-by "Alice"
pnpm cli draft export --output final-decision.md
cat final-decision.md  # Complete markdown with all fields

# API test
curl http://localhost:3000/api/decisions/<id>/export?format=markdown

# Field/template identity checks
pnpm db:migrate
pnpm db:seed
pnpm cli field list
pnpm cli template list --fields

# Modular foundation seam checks
pnpm --filter=@repo/core type-check
pnpm test --filter=@repo/core
# Verify no-op coach hook does not change draft generation outputs
```

### M2 Exit Criteria
- ✅ Draft versions stored after each generation
- ✅ Rollback restores exact prior draft
- ✅ New transcript chunks tagged with active context automatically
- ✅ Field-tagged chunks used preferentially in next generation
- ✅ `transcript add` works incrementally with existing meetings
- ✅ Context commands (set-meeting, set-decision, set-field) work end-to-end
- ✅ Manual decision flagging accepts sequence ranges and `all` segment selection
- ✅ Overlapping segments can be linked to multiple flagged decisions
- ✅ Interface/barrel seams for transcript/log/events exist and compile
- ✅ Adapter wiring preserves existing behavior (no API/CLI regressions)
- ✅ In-process event bus is optional and non-blocking (no required subscribers)

---

## Milestone 3: Field Locking (ships with M1, promoted here for visibility)

**Status**: `DecisionContextService.lockField()` and `unlockField()` already implemented. `DraftGenerationService` (from M1) already skips locked fields. The CLI commands also ship in M1 (`draft lock-field`, `draft unlock-field`, `draft show` with `[LOCKED]` markers).

This milestone is **complete when M1 is delivered**. No additional implementation required beyond what M1 specifies.

### M3 Validation
```bash
pnpm cli draft lock-field decision_statement
pnpm cli draft generate                # decision_statement unchanged
pnpm cli draft show                    # [LOCKED] decision_statement: "..."
pnpm cli draft unlock-field decision_statement
pnpm cli draft generate                # decision_statement now regenerated
```

---

## Milestone 4: Per-Field Updates + Manual Edit
### M4.1 — Field-Specific Regeneration

**Update**: `packages/core/src/services/draft-generation-service.ts`
- `regenerateField(decisionContextId, fieldId, guidance?: GuidanceSegment[]): Promise<string>`
- Chunk weighting: field-tagged (`decision:<id>:<field>`) > decision-tagged (`decision:<id>`) > meeting-tagged (`meeting:<id>`)
- Calls `llm.regenerateField()` with weighted, filtered chunk set
- Stores separate `LLMInteraction` record with `fieldId` populated
- Rejects persistence failures after regeneration instead of silently returning generated content
- Validates that the requested field belongs to the active template before regeneration proceeds

**Validation**:
```typescript
const value = await draftService.regenerateField(contextId, 'options');
expect(typeof value).toBe('string');
const interactions = await llmInteractionRepo.findByField(contextId, 'options');
expect(interactions[0].fieldId).toBe('options');
```
**Completed**:
- Added test coverage for weighting order so field-tagged chunks outrank decision-tagged chunks, which outrank meeting-tagged chunks
- Added a regression test ensuring failed draft persistence after LLM completion throws an error

---

### M4.2 — Field-Level Guidance as Tagged Transcript

Guidance arrives via two paths, both resolved to `GuidanceSegment[]`:

1. **Tagged transcript chunks**: `transcript add --field options --text "..."` stores a chunk tagged `decision:<id>:options`. During field regeneration, these are fetched and wrapped as `GuidanceSegment{ source: 'tagged_transcript', fieldId: 'options' }`.

2. **Inline guidance**: `draft regenerate-field options --guidance "text"` wraps the text as `GuidanceSegment{ source: 'user_text', fieldId: 'options' }`.

`PromptBuilder` renders both with distinct section headers:
```
=== GUIDANCE (options field - from tagged transcript) ===
[Alice]: Option 1: full replacement for £45k. Option 2: patch and monitor...

=== GUIDANCE (options field - additional context) ===
Focus on the cost difference between the two approaches.
```

This distinction is preserved in `llm_interactions.promptSegments` for full auditability.

---

### M4.3 — Manual Field Edit

**Update**: `packages/core/src/services/decision-context-service.ts`
- `setFieldValue(id, fieldId, value): Promise<DecisionContext>`
- Updates `draft_data[fieldId]` directly
- Does NOT lock the field automatically (user can still regenerate)
- Marks field in metadata as `{ manuallyEdited: true }` within `draft_data` or a separate `fieldMeta` JSONB column
- Validates that `fieldId` is assigned to the context template before writing into `draft_data`

**CLI command**:
```
draft edit-field <field-name>    — opens $EDITOR or prompts interactively for value
```
**Completed**:
- `draft show` now renders a clear `[MANUALLY EDITED]` indicator based on persisted field metadata

---

### M4.4 — Per-Field CLI and API Commands

**Add to `draft` commands**:
```
draft regenerate-field <field-name> [--guidance "text"]  — regenerate single field
draft edit-field <field-name>                            — manual edit
```

**New API endpoints**:
- `POST /api/decision-contexts/:id/fields/:fieldId/regenerate` — body: `{ guidance?: GuidanceSegment[] }`
- `PATCH /api/decision-contexts/:id/fields/:fieldId` — body: `{ value: string }`
- `GET /api/decision-contexts/:id/fields/:fieldId/transcript` — field-tagged chunks for this field
**Contract hardening**:
- Align CLI, API, and docs on field identity semantics: either accept stable field keys end-to-end or document UUID-only routes explicitly
- If API remains UUID-based, add server-side resolution helpers for user-facing flows that reference field names such as `options`
- `PATCH /api/decision-contexts/:id/fields/:fieldId` must reject fields not assigned to the active template

**Completed**:
- Server-side validation now rejects `PATCH /api/decision-contexts/:id/fields/:fieldId` requests for fields not assigned to the active template
- CLI continues to resolve field names to assigned field IDs before calling field-specific services
- Field-specific API routes now accept either an assigned field UUID or a stable field name and resolve that reference server-side before update/regenerate/transcript operations

---

### M4.5 — Decision Logging (Finalization)

**Update**: `packages/core/src/services/decision-log-service.ts`
- `logDecision(contextId, options)` — fetch actual template version from `DecisionTemplate`; fetch source chunk IDs from `ChunkRelevance` records
- Creates immutable `DecisionLog` from `DecisionContext.draftData`
- Updates `DecisionContext.status` to `'logged'`
- Validation: cannot log if required fields are empty (check against template `required` flag)
- Treat `DecisionContext` as the preparation workspace, which may contain work accumulated across multiple meetings or outside meeting time.
- Treat `DecisionLog` as the point-in-time finalized record for the actual decision event.
- Extend finalization planning so the log captures:
  - the meeting/event identity in which the decision was actually taken
  - the participant snapshot relevant at that moment
  - the finalization timestamp, which may differ from earlier preparation timestamps

**Completed**:
- `DecisionLogService` now reads real template version from the template repository
- Required fields are validated against template field assignments before finalization
- Source chunk IDs are collected from `ChunkRelevanceRepository` and stored on the immutable decision log
- Successful finalization updates the `DecisionContext` status to `logged`
- Core service tests were updated to cover constructor wiring, required-field validation, source chunk collection, and logged status transition
- Required-field validation coverage includes whitespace-only strings and empty arrays

**CLI command**:
```
decision log --type <consensus|vote|authority|defer|reject|manual|ai_assisted> \
             --details "text" --actors "Alice,Bob" --logged-by "Alice"
```

**Update**: `draft export` command — also works for logged decisions (renders `DecisionLog.fields`)

---

### M4.6 — Logging API Endpoints

**Status**: COMPLETE

- `POST /api/decision-contexts/:id/log` — finalize; body: `{ decisionMethod, actors, loggedBy }`
- `GET /api/decisions/:id` — show decision log
- `GET /api/decisions/:id/export?format=markdown|json` — export

**Completed**:
- Added API handlers for decision finalization, decision-log retrieval, and export
- Added CLI `decision log` support using the correct `decisionMethod` object shape
- Added API e2e coverage for finalize, show, and export flows against the real test database
- Validated `api` and `cli` type-checks after wiring the new decision logging surfaces
- Logged decision markdown export now reuses shared export formatting so draft and logged exports do not drift
- Added API coverage for invalid field/template associations on field update routes

---

### M4.7a — Field/Template Definition Identity Hardening

**DB schema updates**:
- `decision_fields.namespace` (default `core`)
- Uniqueness constraint: `(namespace, name, version)`
- `decision_templates.namespace` (default `core`)
- Uniqueness constraint: `(namespace, name, version)`

**Definition model updates**:
- Field identity is stable via UUID at definition time (seed-time for canonical/core registry).
- Template identity is stable via UUID at definition time (seed-time for canonical/core registry).
- `name` is the stable programmatic key within a `namespace` (not the user-facing label).
- Fields remain the primary semantic definition units.
- Templates reuse fields by `fieldId` (UUID) and act as versioned compositions over field definitions.
- Templates should not override field-definition meaning, prompt semantics, or validation behavior.
- Remove `templateFieldAssignments.customLabel` and `customDescription` entirely. If different wording is required, define a different field definition.

**Seed/registry updates**:
- Canonical fields/templates stored in a registry (constants) with pre-assigned UUIDs.
- Seeding is idempotent by `id`, with fallback lookup by `(namespace, name, version)` for both fields and templates.

**Why here**:
- M4.5 decision logging needs reliable template identity for accurate `templateVersion` attribution.
- M5.1 field/template CRUD should launch after identity constraints are in place to avoid migration churn.

**Current progress**:
- DB support is already present for `decision_fields.namespace`
- DB uniqueness is already present on `(namespace, name, version)`
- DB seed flow already supports idempotent seeding by `id` with fallback lookup by `(namespace, name, version)`
- Core and DB now expose authoritative field/template identity lookup by stable attributes
- Field-specific CLI/API callers now use shared identity-aware resolution rather than ad hoc name scans
- Field-specific API routes now accept stable field references while continuing to validate active-template assignment
- Template namespace hardening is now implemented across schema, repositories, seeds, and API/CLI-facing fixtures.
- Template identity lookup now supports stable identity attributes (`namespace`, `name`, `version`) alongside UUID-based reads.
- `templateFieldAssignments.customLabel` / `customDescription` have been removed so template assignments only express composition metadata.
- Remaining follow-up: add explicit parity tests that exercise both UUID and stable-identity resolution paths for templates/fields.

**Impact of versioning review**:
- This recent field work remains valid and should be treated as foundational contract hardening for the long-term field-version model
- Current `draft_data` / `draft_versions` field reads and writes remain compatibility behavior during migration, not the final persistence architecture
- Template transform behavior is still snapshot-shaped and must later align with field visibility semantics from `docs/versioning-architecture.md`

**Concrete tasks for M4.7a**:
- Done: add `namespace` and `(namespace, name, version)` uniqueness to `decision_templates`.
- Done: extend template repository and identity lookup helpers to resolve templates by stable identity attributes as well as UUID.
- Done: remove `templateFieldAssignments.customLabel` and `customDescription` from schema, services, repositories, seeds, and tests.
- Done: update canonical template registry data so template assignments only express composition metadata.
- Remaining: add parity tests for field/template identity lookup using UUID and stable identity attributes.

---

### M4.7b — Definition Immutability And Context Pinning

> **Triage: DEFERRED — post-M5 backlog.** Lists 7 named code incompatibilities with no single clear endpoint. Critical long-term work, but does not block the web UI. Tackle after M5 ships.

**Goal**:
- Make field-definition and template-definition versions immutable.
- Replace in-place semantic/composition mutation with version creation.
- Make `DecisionContext` creation pin a template definition version and resolved field-definition set.

**Concrete tasks for M4.7b**:
- Add schema/types for:
  - `FieldVersion`
  - `FieldVisibilityState`
  - field-version source enums and inferred types
- Add lineage/versioning support for definition entities so new field/template versions can be created without mutating prior definition rows in place.
- Add context configuration support for:
  - pinned template definition version on `DecisionContext`
  - resolved field-definition versions used by that context
- Add DB migrations, repositories, and core service interfaces for:
  - create next field-definition version instead of mutating an existing field row
  - create next template-definition version instead of mutating an existing template row
  - create next field version
  - read active field version
  - list field history
  - restore field version
  - recompute field visibility for template changes
- Add explicit migration support for:
  - moving an open context to a newer version of the same template definition
  - recomputing the resolved field-definition set during template migration
- Add focused tests for:
  - append-only restore behavior
  - one-active-version invariant
  - hidden-field preservation across template changes
  - locked-field rejection for automated writes
  - context creation binding exact template and field-definition versions
  - explicit version-to-version template migration without synthetic unchanged field writes
  - agenda selection of open contexts without transferring ownership to meetings
  - transcript linkage from many meetings into one decision context
- Add planning/design follow-up for cross-meeting context scope:
  - decide whether `decision_contexts.meetingId` becomes origin-meeting metadata
  - evaluate a `decision_context_meetings` join table for multi-meeting preparation
  - define how finalization stores meeting/event identity and authority participant snapshot on `DecisionLog`

**Code incompatibilities introduced by field/template distribution proposal** (`docs/plans/field-and-template-definition-distribution-proposal.md`):

The following existing code conflicts with or is incomplete relative to the new planning model. None have a defined update task yet. These must be resolved before or alongside the concrete next tasks above.

1. **`templateFieldAssignments.customLabel` / `customDescription` — forbidden semantic override**
   - Location: `packages/db/src/schema.ts` (`templateFieldAssignments` table), `packages/schema/src/index.ts`, `packages/core/src/services/decision-template-service.ts`, and 8 other files that read or write these columns
   - Conflict: the proposal prohibits templates from overriding field semantic description. These columns are per-template label and description overrides, which violates that rule.
   - Resolution required: remove `customLabel` and `customDescription` from `templateFieldAssignments`. If a different label or description is needed, a distinct field definition must be created. A DB migration and cleanup of all service/repo/test callsites is needed.

2. **`DecisionFieldService.updateField` mutates the field row in place — no version lineage**
   - Location: `packages/core/src/services/decision-field-service.ts:52–66`
   - Conflict: the proposal requires that a materially changed field definition creates a new version row (incrementing `version`), not an in-place update. In-place mutation silently changes the meaning of any open `DecisionContext` that references the old definition and makes prior states unrecoverable.
   - Resolution required: replace `updateField` with a `createNextFieldVersion` operation that inserts a new row under the same `(namespace, name)` with `version + 1`. The old row must remain immutable. Any open context that pinned the prior version must not be silently rebased.

3. **`DecisionTemplateService.updateTemplate` — no version bump on composition change**
   - Location: `packages/core/src/services/decision-template-service.ts:86–127`
   - Conflict: the proposal requires a new template-definition version whenever the included field set, field order, requiredness, or referenced field-definition versions change. The current implementation deletes and recreates field assignments in place without incrementing `decisionTemplates.version`, so open contexts silently see a changed composition.
   - Resolution required: composition-changing updates must produce a new `decisionTemplates` row (new UUID, incremented version). The old row must remain immutable so pinned contexts are stable.

4. **`templateFieldAssignments.fieldId` references field identity without pinning a specific field-definition version**
   - Location: `packages/db/src/schema.ts:202` (FK to `decisionFields.id`)
   - Conflict: the proposal requires template versions to reference exact field-definition versions. Currently `fieldId` points to a `decisionFields` row, but there is no structural lineage linking rows that are different versions of the same conceptual field. A template cannot express "uses field X at version 2" without a `fieldLineageId` or equivalent stable cross-version identifier.
   - Resolution required: introduce a stable lineage identity for field definitions (e.g., a `lineageId` UUID shared across all version rows of the same conceptual field, or a `(namespace, name)` composite reference on the assignment). `templateFieldAssignments` should store the resolved field-definition version ID (pointing to the specific row), not a floating reference that silently tracks the latest version.

5. **`decisionTemplates` has no `namespace` column**
   - Location: `packages/db/src/schema.ts:179–193`
   - Conflict: the proposal treats both fields and templates as distributable units with namespace-scoped identity. Fields already have `namespace` with a `(namespace, name, version)` uniqueness constraint, but templates have no equivalent. Templates cannot participate in import/export or identity-aware lookup without this.
   - Resolution required: add `namespace text NOT NULL DEFAULT 'core'` to `decisionTemplates` and a `(namespace, name, version)` uniqueness constraint, mirroring the field schema. Update `DecisionTemplateIdentityLookup`, the template repository, and seeding logic accordingly.

6. **`decisionLogs` records `templateVersion` but not resolved field-definition versions**
   - Location: `packages/db/src/schema.ts:276` (`templateVersion integer`)
   - Conflict: the proposal requires that a `DecisionLog` captures the exact resolved field-definition versions active at finalization, not just the template version. Without this, the log cannot be reproduced or audited against the field extraction prompts and validation rules that were in effect.
   - Resolution required: add a `resolvedFieldVersions jsonb` column to `decisionLogs` that stores a map of `fieldId → fieldVersion` (or the resolved field-definition row IDs) at the moment of logging. Update `DecisionLogService.logDecision` to populate this from the context's pinned field-definition set.

7. **`decisionContexts` stores `templateId` but does not pin a template version or resolved field-definition set**
   - Location: `packages/db/src/schema.ts:250` (`templateId uuid`)
   - Conflict: the proposal requires context creation to bind to one specific template-definition version and its resolved set of field-definition versions. Currently only `templateId` is stored — a live FK to the mutable template row — so any in-place template mutation (issue 3) silently changes the context's composition.
   - Status: partially acknowledged in the "Current progress" note above, but no schema, migration, or service task is defined.
   - Resolution required: add `pinnedTemplateVersion integer` and `resolvedFieldVersions jsonb` to `decisionContexts`. Populate both at context creation from the template row at that moment. `resolvedFieldVersions` should map each assigned field's `(namespace, name)` to its version so the context remains reproducible even after the template or field rows are superseded.

---

### M4.8 — Modular Foundation B (Content + Coaching Seams)

> **Triage: DEFERRED — post-M5 backlog.** Infrastructure seams with no user-visible output. Does not block M5.

Add pluggable draft-content and coaching seams while keeping the current draft path as the active implementation.

**Add**:
- `IContentCreator` contract and `AIContentCreator` adapter around current LLM draft generation path.
- `FieldValue` provenance metadata shape (`source`, optional `provenance`, optional `confidence`) stored in a backward-compatible way.
- `ICoachObserverHook` interface with default no-op implementation wired in service factory.

**Constraints**:
- Existing `draft generate`/`draft regenerate-field` behavior remains unchanged.
- Coaching remains opt-in; no synchronous advice generation required before M6.

---

### M4.9 — Cross-Meeting Decision Context Planning

> **Triage: DEFERRED — post-M5 backlog.** Requires a new join table migration, changes to multiple API routes, and G6/G11 UI flows. This is M6-level scope. `DecisionContext.meetingId` remains the sole meeting association for M5.

Add the architectural seam for decisions that are prepared over time, not only inside one meeting.

**Goal**:
- A `DecisionContext` may remain active across:
  - multiple meetings
  - asynchronous preparation work
  - off-meeting drafting/review
- A `DecisionLog` remains tied to one concrete decision moment.

**Plan**:
- Reclassify `DecisionContext.meetingId` as compatibility/origin-meeting metadata unless/until the model is expanded.
- Design explicit linkage between one decision context and multiple meetings/events.
- Keep transcript evidence, guidance, and field history attachable to the same long-running context.
- Ensure finalization records:
  - the meeting/event where the decision was actually made
  - the participant snapshot at finalization time
  - the active visible field state at that moment

**Chosen implementation**: `decision_context_meetings` join table. A broader decision-work-item abstraction above `DecisionContext` is not required for v1.

**Schema addition** (`packages/db/src/schema.ts`):

```sql
decision_context_meetings (
  id          uuid PRIMARY KEY,
  contextId   uuid NOT NULL REFERENCES decision_contexts(id),
  meetingId   uuid NOT NULL REFERENCES meetings(id),
  status      text NOT NULL DEFAULT 'active',  -- 'active' | 'deferred' | 'completed'
  addedAt     timestamptz NOT NULL DEFAULT NOW(),
  addedBy     text,
  UNIQUE (contextId, meetingId)
)
INDEX on (meetingId, status)
INDEX on (contextId)
```

`status` values:
- `active` — context is on this meeting's current decision agenda
- `deferred` — context was removed from this meeting's agenda without being logged; it remains open and can be added to a future meeting's agenda via the normal G6 flow
- `completed` — context was logged (decision made) during this meeting

`DecisionContext.meetingId` is retained as origin-meeting metadata for compatibility but is no longer the sole meeting association.

**Deferred contexts** (G11 from `docs/ux-workflow-examples.md` Flow 2):
- Deferral sets the `status` to `'deferred'` on the meeting-context association for the current meeting.
- The context itself remains `status: 'open'` — it is not closed or deleted.
- No future meeting ID is assigned at deferral time. The facilitator of a future meeting uses the G6 flow (add existing context to agenda) to resume it.
- The deferred context is browsable from the meeting list or a dedicated "open decisions" view.

**Cross-meeting context loading** (G6 from `docs/ux-workflow-examples.md` Flow 2):
- Any open `DecisionContext` (status `'open'`, not yet logged) can be added to a new meeting's agenda.
- Sub-committee contexts prepared outside a meeting follow the same path.
- Adding a context to a meeting creates a new `decision_context_meetings` row with `status: 'active'`.
- The context is not cloned; field history, versions, transcript tags, and supplementary content are all preserved.

**New API endpoints**:
- `GET /api/decision-contexts?status=open` — list all open contexts across meetings (for the "add to agenda" picker)
- `POST /api/meetings/:id/decision-contexts/:contextId/activate` — add an existing open context to this meeting's agenda (creates `decision_context_meetings` row, `status: 'active'`)
- `POST /api/meetings/:id/decision-contexts/:contextId/defer` — mark context as deferred on this meeting's agenda (`status: 'deferred'`); context remains open

**`GET /api/meetings/:id/decision-contexts`** must be updated to read from `decision_context_meetings` rather than filtering `decision_contexts.meetingId`.

**Finalization** continues to identify the specific meeting where the decision was made via the `decision_context_meetings` record with `status: 'completed'`. The `DecisionLog` already captures `actors` and timestamp.

**Recommendation**:
- Do not block field-version work on this.
- Preserve `DecisionContext.meetingId` for compatibility.
- The join table is additive — existing single-meeting contexts get a synthetic `decision_context_meetings` row on migration.

**Validation questions**:
- Can one context be resumed in a later meeting without cloning field history? ✓ (join table)
- Can off-meeting edits occur without fabricating meeting ownership? ✓ (context has no required `meetingId` for edits)
- Can finalization explicitly identify the meeting/event and participant set? ✓ (via `decision_context_meetings.meetingId` + meeting participants)

---

### M4.10 — Decision Tagging and Cross-References (Foundation)

> **Triage: DEFERRED — post-M5 backlog.** Valuable feature, but the core workflow (flag → generate → log → export) does not require tags or relations. Web Phase 5 consumes these APIs; Phase 5 is post-M5. Implement after the core web UI ships.

**Goal**: Give decisions and decision contexts lightweight metadata — tags for topics, teams, committees, and projects — and allow them to reference each other. The initial design must be simple enough to ship now but structured so it can evolve toward a full graph model without a breaking migration.

#### Guiding principle

Avoid a generic graph from the start. A tag table + a typed relation table is sufficient for M4. The schema choices below are designed so that a future graph layer can be placed on top without discarding the existing rows.

---

#### Tagging model

Tags are named, categorised labels that can be attached to both `DecisionContext` and `DecisionLog` records.

**Tag categories (initial)**:
- `topic` — subject matter (e.g., "infrastructure", "hiring", "security")
- `team` — team or committee owning or affected by the decision
- `project` — associated project or initiative

A tag is a first-class entity so it can be renamed, merged, and eventually queried across decisions. Free-text string arrays on the decision rows are explicitly rejected because they cannot be renamed, merged, or traversed efficiently.

**DB schema additions** (`packages/db/src/schema.ts`):

```sql
-- Canonical tag definitions
tags (
  id          uuid PK,
  namespace   text NOT NULL DEFAULT 'core',
  name        text NOT NULL,
  category    tag_category_enum NOT NULL,  -- topic | team | project
  createdAt   timestamptz
)
UNIQUE (namespace, name)

-- Many-to-many: tags on decision contexts (drafts in progress)
decision_context_tags (
  contextId   uuid FK → decision_contexts.id,
  tagId       uuid FK → tags.id,
  PRIMARY KEY (contextId, tagId)
)

-- Many-to-many: tags on decision logs (immutable finalized records)
decision_log_tags (
  logId       uuid FK → decision_logs.id,
  tagId       uuid FK → tags.id,
  PRIMARY KEY (logId, tagId)
)
```

Tags on a `DecisionLog` are a snapshot taken at finalization from the context's tag set. They do not update after logging.

**Services**:
- `TagService` in `packages/core/src/services/tag-service.ts`
  - `createTag(name, category)` — idempotent by `(namespace, name)`
  - `addTagToContext(contextId, tagId)`
  - `removeTagFromContext(contextId, tagId)`
  - `getTagsForContext(contextId)`
  - `getTagsForLog(logId)`
  - `listTags(filter?: { category })` — for autocomplete

Tags are snapshotted onto `DecisionLog` automatically during `DecisionLogService.logDecision`.

**API route file**: `apps/api/src/routes/tags.ts` (new file, registered in `apps/api/src/index.ts`)

**API endpoints**:
- `GET /api/tags` — list all tags, filterable by `?category=team|topic|project`
- `POST /api/tags` — body: `{ name, category }` — idempotent create by `(namespace, name)`
- `GET /api/decision-contexts/:id/tags` — list tags on context
- `POST /api/decision-contexts/:id/tags` — body: `{ name, category? }` — resolve-or-create tag by name and associate; `category` required only when creating a new tag
- `DELETE /api/decision-contexts/:id/tags/:tagId` — remove tag from context
- `GET /api/decisions/:id/tags` — list tags on a logged decision (read-only after finalization)

**CLI commands**:

Top-level `tag` command group (`apps/cli/src/commands/tag.ts`, registered in entry point) for managing the tag library:
```
tag list [--category topic|team|project]          — list all tags
tag create <name> --category <category>           — create a tag
```

`context tag` nested sub-group on the existing `contextCommand` (operates on the **active** context from `GlobalContextService`, no ID arg required — consistent with `context set-field`):
```
context tag add <name> [--category topic|team|project]   — resolve-or-create tag by name and attach to active context
context tag remove <name>                                 — detach tag from active context by name
context tag list                                          — list tags on active context
```

---

#### Cross-reference model

Decisions and contexts sometimes depend on, supersede, or block each other. A typed relation table captures this without requiring a full graph library.

**Initial relation types**:
- `supersedes` — this decision replaces a prior one
- `depends_on` — this decision requires another to be logged first
- `related_to` — informational link, no ordering implied
- `blocks` — this context must be resolved before another can proceed

**DB schema additions**:

```sql
-- Typed edges between decisions/contexts
decision_relations (
  id            uuid PK,
  fromType      relation_node_type_enum NOT NULL,  -- decision_context | decision_log
  fromId        uuid NOT NULL,
  relationType  decision_relation_type_enum NOT NULL,
  toType        relation_node_type_enum NOT NULL,
  toId          uuid NOT NULL,
  createdAt     timestamptz,
  createdBy     text
)
INDEX on (fromType, fromId)
INDEX on (toType, toId)
```

`fromType`/`toType` allow edges between any combination of contexts and logs. This is intentionally the same shape as a generic property graph edge table — a future graph layer can read these rows directly.

**Services**:
- `DecisionRelationService` in `packages/core/src/services/decision-relation-service.ts`
  - `addRelation(from, relationType, to, createdBy)` — rejects self-links and duplicate directed edges
  - `removeRelation(id)`
  - `getRelationsFrom(nodeType, nodeId)` — outgoing edges
  - `getRelationsTo(nodeType, nodeId)` — incoming edges

**API route file**: `apps/api/src/routes/decision-relations.ts` (new file, registered in `apps/api/src/index.ts`)

**API endpoints**:
- `POST /api/decision-relations` — body: `{ fromType, fromId, relationType, toType, toId, createdBy? }`
- `DELETE /api/decision-relations/:id`
- `GET /api/decision-contexts/:id/relations` — both outgoing and incoming edges for this context
- `GET /api/decisions/:id/relations` — both outgoing and incoming edges for this logged decision

**CLI commands**:

`context relation` nested sub-group on the existing `contextCommand` (operates on the **active** context, consistent with other `context` sub-commands):
```
context relation add <relationType> <toId> [--to-type context|decision] [--by <user>]
                                                  — add a relation from active context to another node
context relation remove <relationId>              — remove a relation by ID
context relation list                             — list all relations on active context
```

`decision relation` nested sub-group on the existing `decisionCommand` (mirrors the existing `decision context` nested group pattern, operates by explicit ID):
```
decision relation add <fromId> <relationType> <toId> [--from-type context|decision] [--to-type context|decision] [--by <user>]
decision relation remove <relationId>
decision relation list <id> [--node-type context|decision]
```

The `--to-type` / `--from-type` flags default to `decision` (a logged decision) when omitted, since the most common use case is linking two finalized decisions.

---

#### Graph evolution path

The initial schema is graph-compatible by design:
- `tags` → future: tag hierarchy (`parentId`), tag merges, upstream-tracked tag packages
- `decision_relations` → future: weighted edges, traversal queries, cycle detection, visualisation
- No graph library or query language is required now; standard SQL is sufficient for M4 filtering and display
- When a graph query layer is added (e.g., Apache AGE, or an application-layer BFS), it can consume the existing `decision_relations` rows directly

**Do not** add graph traversal, cycle detection, or weighted edges in M4. Add those only when a concrete feature requires them.

---

### M4.11 — Supplementary Content Store

> **Triage: DEFERRED — post-M5 backlog.** Useful enrichment but not part of the core workflow. LLM draft generation works without it. The web prototype validated the interaction model; implement after the core web UI ships.

**Goal**: Allow facilitators to attach non-transcript text evidence — meeting background, comparison tables, prior documents — to a meeting, decision context, or specific field. This material participates in LLM context retrieval alongside transcript chunks using the same `{scope}:{id}[:{field}]` tagging hierarchy.

**Why here**: The context builder must query both sources from the beginning. Deferring schema creation to M5.1 would require retrofitting retrieval logic that was shipped against transcript-only assumptions. G4 in `docs/ux-workflow-examples.md` identified this as a parallel store, not a secondary feature.

---

#### Schema

**New table** (`packages/db/src/schema.ts`):

```sql
supplementary_content (
  id           uuid PRIMARY KEY,
  meeting_id   uuid NOT NULL REFERENCES meetings(id),
  label        text,
  body         text NOT NULL,
  source_type  text NOT NULL DEFAULT 'manual',
  contexts     text[] NOT NULL DEFAULT '{}',   -- e.g. ['decision:abc', 'decision:abc:options']
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT NOW()
)
CREATE INDEX idx_supcontent_contexts ON supplementary_content USING GIN(contexts);
```

The `contexts` array holds the same `{scope}:{id}[:{field}]` tags used by transcript chunks. Three tagging levels match the three points of entry:

| Entry point | Tag applied |
|---|---|
| Meeting-level background | `meeting:{meetingId}` |
| Decision workspace | `decision:{contextId}` |
| Field zoom | `decision:{contextId}:{fieldId}` |

---

#### Service

**New**: `packages/core/src/services/supplementary-content-service.ts`

- `add(meetingId, body, options?: { label?, contexts?, createdBy? }): Promise<SupplementaryContent>`
- `listByContext(contextTag: string): Promise<SupplementaryContent[]>` — filters by `contexts @> ARRAY[contextTag]` (GIN index query)
- `remove(id): Promise<void>`

**Context builder extension** (`packages/core/src/services/context-builder.ts` or equivalent):

The prompt builder currently fetches transcript chunks by context tag. It must be extended to also fetch `supplementary_content` rows matching the same tags and include them as a distinct section in the prompt:

```
=== SUPPLEMENTARY EVIDENCE (options field) ===
[Options comparison table — added 14:32]
Option 1: full cloud-native stack (£45k). Option 2: patch existing service (£8k)...
```

This section is rendered after transcript evidence for the same scope, before any inline guidance.

---

#### API endpoints

**New route file**: `apps/api/src/routes/supplementary-content.ts`

- `POST /api/supplementary-content` — body: `{ meetingId, body, label?, contexts?, createdBy? }`
- `GET /api/supplementary-content?context={tag}` — list items matching context tag
- `DELETE /api/supplementary-content/:id`

---

#### CLI commands

```
supplementary add --meeting-id <id> --body "text" [--label "label"] [--context "decision:abc:options"]
supplementary list --context "decision:abc"
supplementary remove <id>
```

---

#### Web prototype reference

The prototype in `apps/web/` already implements this flow: `FieldZoom.tsx` shows a "Supplementary evidence" section with add/remove controls. `FacilitatorMeetingPage.tsx` holds supplementary state at page level and passes it down. `FacilitatorFieldCard.tsx` shows a count badge via the `supplementaryCount` prop. This prototype was built to validate G4 and serves as the accepted interaction model.

---

#### Validation

```bash
# Add supplementary evidence at field scope
curl -X POST http://localhost:3000/api/supplementary-content \
  -d '{"meetingId":"<id>","body":"Option 1: cloud-native...","label":"Comparison table","contexts":["decision:<ctx-id>:options"]}'

# Retrieve by context tag
curl "http://localhost:3000/api/supplementary-content?context=decision:<ctx-id>:options"

# Verify it appears in draft generation prompt
pnpm cli draft debug   # supplementary section visible alongside transcript sections

# Regeneration with supplementary evidence active
pnpm cli draft regenerate-field options
# Expected: options field now incorporates the comparison table text
```

---

### M4.12 — Open Questions Field (Template Library Addition)

**Goal**: Add an `outstanding_issues` field to templates used for decisions that may be deferred mid-meeting. Without a structured place to record the open questions that caused a deferral, that information is lost to the system — it exists only in meeting notes or memory. When the context is resumed in a future meeting, the working group has no structured record of what was unresolved.

**Identified in**: Flow 2, G12 (`docs/ux-workflow-examples.md`).

**Scope**: This is a field library addition, not a schema change. The field is added to the canonical field definitions and assigned to relevant templates. No new table or migration is required beyond the normal seed update.

---

#### New field definition

```
name:        outstanding_issues
label:       Outstanding issues / open questions
description: Unresolved questions, dependencies, or concerns that prevented this decision from being finalised. Used when a decision is deferred — records why and what must be answered before it can proceed.
type:        text (long-form, markdown)
required:    false
prompt:      Summarise any open questions, unresolved dependencies, or concerns raised during discussion that the group could not answer in this session.
```

#### Templates to receive this field

| Template | Rationale |
|---|---|
| Proposal Acceptance | Most commonly deferred; replaces the adjacent but semantically different `stakeholder_concerns` for recording blocking questions |
| Strategy Decision | Strategic direction frequently deferred pending information |
| Standard Decision | General-purpose fallback; deferral is common |

Technology Selection, Budget Approval, and Policy Change templates do not receive this field by default — deferral is less common and existing concern/risk fields partially cover the need.

#### Interaction model

The `outstanding_issues` field is shown in field zoom like any other field. During a deferral flow, the facilitator zooms into it and records the open questions before deferring the context. When the context is resumed in a future meeting, this field is immediately visible as a locked or editable starting point for the new session.

The field is not auto-populated by LLM generation — it captures what the group explicitly identified as unresolved. It may be pre-populated by guidance if the facilitator asks for a summary of open points, but is not part of the standard draft generation pass.

---

### M4 Validation

```bash
# Per-field workflow
pnpm cli context set-field options
pnpm cli transcript add --text "Option 1: full replacement for £45k. Option 2: patch for £8k."
pnpm cli draft regenerate-field options
pnpm cli draft regenerate-field options --guidance "Focus on long-term maintenance cost"
pnpm cli draft debug  # shows field-tagged chunks in guidance section, separate from transcript
pnpm cli draft edit-field consequences_positive  # manual edit
pnpm cli draft show  # [MANUALLY EDITED] consequences_positive

# Finalization
pnpm cli decision log --type consensus --details "5 for, 2 against" \
     --actors "Alice,Bob,Carol" --logged-by "Alice"
pnpm cli draft export --output final-decision.md
cat final-decision.md  # Complete markdown with all fields

# API test
curl http://localhost:3000/api/decisions/<id>/export?format=markdown

# Field/template identity checks
pnpm db:migrate
pnpm db:seed
pnpm cli field list
pnpm cli template list --fields

# Modular foundation seam checks
pnpm --filter=@repo/core type-check
pnpm test --filter=@repo/core
# Verify no-op coach hook does not change draft generation outputs
```

### M4 Exit Criteria

> Items from M4.7b, M4.8, M4.9, M4.10, and M4.11 are deferred (post-M5). Only the criteria below gate M5 entry.

- Single field regeneration stores separate `LLMInteraction` with `fieldId`
- Field-tagged transcript clearly separated from transcript in prompt (verifiable via `draft debug`)
- Manual field edits persist, are marked as manually edited, and are surfaced in CLI/API reads
- Decision logging creates immutable record with real template version + source chunk IDs
- Cannot log decision with required fields empty
- Export works for both draft and logged decisions
- Logged export reuses shared formatting rules or equivalent centralized rendering to avoid drift from draft export
- Field/template identity hardened (namespace + uniqueness + stable seed UUIDs)
- Field-level API/CLI contracts are aligned on identifier semantics and reject fields not assigned to the active template
- `outstanding_issues` field seeded and assigned to Proposal Acceptance, Strategy Decision, and Standard Decision templates

---

## Milestone 5: Web Interface

**Deliverable**: Browser-based UI for the full multi-decision workflow. Users manually flag multiple decisions from a meeting and jump between them, working on each independently. Requires completing the full API layer and migrating the CLI to API client mode. Expert and MCP endpoints exist as stubs only — full expert implementation is in M6.

**Note on auto-detection**: LLM-based auto-detection of implicit decisions is a post-M5 enhancement. M5 (like M1–M4) uses manual decision flagging. The web UI supports flagging multiple decisions and switching between them.

---

### M5-CLI — Minimal HTTP Client CLI (complete)

The old `apps/cli` direct-service-import CLI was replaced with a minimal HTTP client CLI. Covers the core E2E workflow with no `@repo/*` dependencies.

**Commands shipped:**
- `meeting create/list/show`
- `transcript upload`
- `decisions flag/list/update`
- `context show/set-meeting/clear-meeting/set-decision/clear-decision/set-field/clear-field`
- `draft generate/show/lock-field/unlock-field/log`

**Configuration:** `API_BASE_URL` env var, defaults to `http://localhost:3000`.

**E2E validation path:**
```bash
pnpm cli meeting create "Q1 Planning" -p "Alice,Bob"
pnpm cli context set-meeting <id>
pnpm cli transcript upload -f ./transcript.txt
pnpm cli decisions flag -t "Approve cloud migration"
pnpm cli decisions list
pnpm cli context set-decision <flagged-id>
pnpm cli draft generate
pnpm cli draft show
pnpm cli draft lock-field -f <field-id>
pnpm cli draft log --type consensus --by Alice
```

---

### M5.0 — Multi-Decision Workflow Foundation

Before the web UI, the API and CLI must support working on multiple decisions simultaneously within a single meeting — flagging several, then jumping between them to work on each independently.

**Already supported in services**: `FlaggedDecisionService` (list, prioritize), `DecisionContextService` (multiple contexts per meeting), `GlobalContextService` (set-active-decision). The gap is smooth CLI/API ergonomics for switching.

**Ensure the following work correctly**:
- Flag multiple decisions in one meeting: `decisions flag <meeting-id> --title "..."` (repeat for each)
- List all flagged decisions: `decisions list --meeting-id <id>` (shows status, draft state)
- Switch active decision: `context set-decision <flagged-id>` (loads existing `DecisionContext` if one exists)
- Activating an agenda item may create a `DecisionContext` with the current default template when no template has been explicitly confirmed yet
- Template assignment remains changeable after context creation; changing templates must not require recreating the flagged decision or losing agenda position
- Each decision has its own isolated draft state, version history, and LLM interactions
- `draft show` always refers to the currently active decision context
- Candidate queue distinguishes `suggested` from `agenda` items
- Agenda ordering is explicit/user-controlled; new suggestions are inserted by user choice, not auto-appended to agenda end
- Meeting participant list can be updated during meeting lifecycle (join/leave reflected in updates)

**Follow-on planning beyond one meeting**:
- A decision should also be able to continue beyond the originating meeting without losing the same `DecisionContext`.
- Meeting-specific workflows remain important for evidence capture and finalization, but should not be the sole lifecycle boundary for the decision draft.

**Naming reference — two distinct entities, two milestones**:

`FlaggedDecision` (M1–M5, implemented) — a manually created decision item. Status: `pending | accepted | rejected | dismissed`. Routes: `/api/meetings/:id/flagged-decisions`, `/api/flagged-decisions/:id`. In M5, this is the only candidate type. The facilitator view's `Suggested` tab shows `status: pending` records; the `Agenda` tab shows `status: accepted` records.

`DecisionCandidate` (M6, not yet implemented) — an AI-detected decision candidate produced by the Decision Detector expert. Routes: `/api/meetings/:id/decision-candidates` (introduced in M6.6). When a `DecisionCandidate` is promoted by the facilitator, it creates a `FlaggedDecision`. After M6 ships, the facilitator queue merges both sources: AI candidates in `Suggested`, promoted `FlaggedDecision` records in `Agenda`.

Do not use `decision-candidates` routes in M5. All candidate queue API work in M5 is against `flagged-decisions`.

**API endpoints** (confirm exist):
- `GET /api/meetings/:id/flagged-decisions` — list all flagged decisions for a meeting; `?status=pending` for Suggested tab, `?status=accepted` for Agenda tab
- `GET /api/meetings/:id/decision-contexts` — list all draft contexts with status
- `GET /api/flagged-decisions/:id/context` — get the `DecisionContext` for a flagged decision (enables web UI "resume" flow)
- `PATCH /api/meetings/:id` — update meeting metadata/participants during session
- `PATCH /api/flagged-decisions/:id` — update title/summary/priority/status; use `{ status: 'accepted', priority: n }` to promote to Agenda and set position
- `GET /api/templates/:id/fields` — list the ordered field definitions assigned to a template so clients can drive client-side field reassignment during template changes
- `POST /api/decision-contexts/:id/template-change` — change the active template for an existing decision context; initial M5 behavior preserves draft data and leaves reassignment decisions to the client

**Future API planning for cross-meeting work**:
- `GET /api/decision-contexts/:id` should remain the canonical way to resume one long-running decision context.
- Add related-meeting/event views later rather than forcing all context navigation through a single meeting.

**Validation**:
```bash
# Multiple decisions in one meeting
pnpm cli decisions flag <mtg-id> --title "Approve roof repair"
pnpm cli decisions flag <mtg-id> --title "Update parking policy"
pnpm cli decisions list --meeting-id <mtg-id>   # shows both

# Jump between decisions
pnpm cli context set-decision <flag-1-id>
pnpm cli draft generate
pnpm cli context set-decision <flag-2-id>
pnpm cli draft generate --guidance "Focus on tenant impact"
# Each decision has its own independent draft
```

---

### M5.1 — Full API Layer

Complete all remaining API endpoints. All use Zod + `@hono/zod-openapi`.

**Meeting endpoints** (mostly done — add missing):
- `PATCH /api/meetings/:id` — update title/date/participants/status
- `DELETE /api/meetings/:id`
- `GET /api/meetings/:id/summary` — stats (segment count, decision count, etc.)

**Transcript endpoints**:
- `POST /api/meetings/:id/transcripts/stream` — buffered streaming event
- `GET /api/meetings/:id/streaming/status`
- `POST /api/meetings/:id/streaming/flush`
- `DELETE /api/meetings/:id/streaming/buffer`
- `GET /api/meetings/:id/transcripts/raw`
- `GET /api/meetings/:id/chunks` — with context/time/strategy filters
- `GET /api/meetings/:id/transcript-reading` — non-overlap reading projection for human review/segment selection
- `POST /api/chunks/search`

**Context/state endpoints**:
- `GET /api/context` — global context state (critical for web UI state visibility)
- `POST /api/context/meeting`, `DELETE /api/context/meeting`
- `POST /api/meetings/:id/context/decision`, `POST /api/meetings/:id/context/field`
- `DELETE /api/meetings/:id/context/field`, `DELETE /api/meetings/:id/context/decision`
- `GET /api/meetings/:id/decision-contexts` — list drafts (web UI drafts list)
- `GET /api/flagged-decisions/:id/context` — resume work (web UI resume)

**Decision workflow endpoints**:
- `GET /api/meetings/:id/flagged-decisions` — list all flagged decisions (manual only; auto-detection added in M6)
- `PATCH /api/flagged-decisions/:id`, `PATCH /api/flagged-decisions/:id/priority`
- `DELETE /api/flagged-decisions/:id`
- `GET /api/decision-contexts/:id/context-window`, `POST /api/decision-contexts/:id/context-window`, `GET /api/decision-contexts/:id/context-window/preview`
- `POST /api/decision-contexts/:id/regenerate` — full regeneration respecting locks
- `POST /api/decision-contexts/:id/generate-draft` (already in M1)

**Expert/MCP endpoints** (stubs only in M5 — full implementation in M6/M7):
- `GET /api/experts` — list registered experts (returns seeded experts from M6 when available)
- `GET /api/mcp/servers` — list registered MCP servers

**Field/Template endpoints** (add to existing, after M4.7 identity hardening):
- `GET /api/templates/:id/fields` — ordered template field definitions for client-side reassignment and template-change UX
- `POST /api/fields`, `PATCH /api/fields/:id`, `DELETE /api/fields/:id`
- `POST /api/templates`, `PATCH /api/templates/:id`, `DELETE /api/templates/:id`
- `POST /api/templates/:id/set-default`

These endpoints cover local definition management for v1/v1.5 workflows.

Public definition-package distribution, upstream update flows, and diff re-import remain out of scope for this iterative plan and belong to v2.

**Versioning-first additions before broader CRUD expansion**:
- `GET /api/decision-contexts/:id/fields` — active field state backed by active field versions
- `GET /api/decision-contexts/:id/fields/:fieldRef/versions`
- `GET /api/decision-contexts/:id/fields/:fieldRef/versions/:version`
- `POST /api/decision-contexts/:id/fields/:fieldRef/restore`
- `POST /api/decision-contexts/:id/template-change` with explicit transform mode semantics; M5 first ships a minimal preserve-draft-data version, then later adds transform/visibility modes

**Preserved future-facing API notes**:
- Expert and MCP surfaces are expected to include CRUD-style expert management plus MCP server inspection/registration flows, but exact contracts remain subordinate to the M6/M7 milestone implementation.
- Field/template management is expected to expose list/get/update/default-selection flows; exact route contracts should be finalized through `packages/schema` and milestone-specific API work rather than a static overview doc.
- Decision-context creation should bind a specific template definition version and resolved field-definition set rather than allowing template-definition editing inside the context.
- Migration to a newer version of the same template definition should use the same explicit transform semantics as template-to-template migration, not an implicit in-place rebind.
- Iterative-plan scope stops at local definition management and runtime context migration; public/community definition-package management is deferred to v2.
- Export should preserve a simple single-log export flow first, with richer export-option surfaces and batch export treated as later contract expansion.

**Validation**:
```bash
pnpm test:e2e   # Full API test suite passes
curl http://localhost:3000/docs  # OpenAPI spec UI renders all endpoints
curl http://localhost:3000/api/context  # Returns global context state
curl http://localhost:3000/api/meetings/<id>/summary  # Returns stats
```

---

### M5.1a — Transcript Reading Mode (UI-Critical)

> **Triage: DEFERRED — post-M5 backlog.** The reading-mode projection improves UX for segment selection but is not required for the core workflow (flag → generate → log → export). Segment selection via raw chunk list is sufficient for M5. Implement before web Phase 3 (segment selection screen).

For human segment selection, overlapped chunk text is hard to read. Add a dedicated reading projection that is non-overlapping and sequence-ordered.

**Architecture reference**: `docs/transcript-reading-and-segment-selection-architecture.md`

**Goal**:
- Keep overlap-based chunking for LLM quality.
- Provide a separate **reading mode** for humans (CLI + API + web UI) that avoids duplicate overlap text.

**Behavior**:
- Reading mode returns a de-overlapped display stream (stable order by sequence/time).
- User selection in reading mode maps back to underlying chunk IDs internally.
- Overlap metadata is optional and compact (e.g., icon/count), hidden by default in reading view.
- Reading rows are append-only for ongoing transcript ingestion; existing rows are not renumbered when new transcript content is added.
- Confirmed selections persist both selected reading-row IDs and final ordered, deduplicated chunk IDs.

**Preserved transcript-selection contract notes**:
- Confirmed selection persistence may need to retain meeting reference, selection reference type/id, reading-row IDs, chunk IDs, selection source, and explicit user-confirmation state.
- Reading projection rows may need stable row identity, ordered sequence position, optional speaker/timing metadata, source chunk references, and overlap metadata.
- Candidate queue / agenda states remain important planning concepts for meeting workflow ordering even if final schema names change during implementation.

**CLI/API parity**:
- CLI: `transcript list --reading --meeting-id <id> [--from <seq>] [--to <seq>] [--query <text>] [--page <n>] [--page-size <n>]`
- API: `GET /api/meetings/:id/transcript-reading?from=<seq>&to=<seq>&q=<text>&page=<n>&pageSize=<n>`
- Any temporary asymmetry must be documented per the CLI/API sync contract.

**Validation**:
```bash
# API reading projection
curl "http://localhost:3000/api/meetings/<id>/transcript-reading?from=120&to=180"

# CLI# Reading mode parity
pnpm cli transcript list --reading --meeting-id <id>
curl "http://localhost:3000/api/meetings/<id>/transcript-reading"

# Verify no duplicate overlap text in reading mode

# Verify same row selection resolves to same chunk IDs across CLI/API
```

---

### M5.1a.1 — Transcript Preprocessing Seam (Whisper-Canonical)

> **Triage: DEFERRED — post-M5 backlog.** Infrastructure concern. Plain-text upload works today. Implement when a second transcript source (e.g. Whisper JSON) is actively needed.

Introduce a lightweight preprocessing layer to normalize transcript input into one canonical segment shape before chunking and reading projection.

**Architecture reference**: `docs/transcript-preprocessing-architecture.md`

**Goal**:
- Keep Whisper-style segments as the canonical internal format.
- Support non-Whisper text input through pluggable normalization processors.
- Improve reading-mode usability without creating source-specific importer pipelines.

**Implementation tasks**:
- Add `TranscriptPreprocessor` interface and registry in transcript ingest path.
- Implement default Whisper pass-through preprocessor.
- Implement plain-text normalization fallback preprocessor for pasted/uploaded text.
- Ensure preprocessing runs before chunking and reading projection derivation.
- Preserve raw transcript input and preprocessing metadata for auditability.
- Emit preprocessing observability (processor ID, counts, warnings, duration).

**Contract rules**:
- Canonical segment output remains source-agnostic (`sequenceNumber`, `text`, optional `speaker`/timing/metadata).
- Missing speaker metadata remains valid; presentation fallback is `Speaker unknown`.
- Preprocessing must be deterministic for equivalent input.

**CLI/API parity notes**:
- No new source-specific endpoint families.
- Existing transcript ingest commands/routes continue to accept raw transcript input.
- Reading/chunk endpoints expose normalized content regardless of source.

**Validation**:
```bash
# Upload/paste plain text transcript and verify normalization
pnpm cli transcript upload <file-or-payload>

# Verify deterministic sequence ordering and readable row sizing
pnpm cli transcript list --reading --meeting-id <id>
curl "http://localhost:3000/api/meetings/<id>/transcript-reading"

# Verify preprocessing metadata/logging captured
pnpm cli draft debug
```

---

### M5.1b — AI-Assisted Segment Suggestions (Review First)

> **Triage: DEFERRED — post-M5 backlog.** Manual segment selection is sufficient for M5. AI-assisted suggestions are an enhancement layered on top of M5.1a. Implement after reading mode and the segment selection screen (web Phase 3).

Manual decision creation should support title/summary-driven AI suggestions for relevant transcript evidence.

**Behavior**:
- User provides decision title + summary.
- System proposes matching transcript segments for review.
- Suggestions are pre-selected in selection UI, but user must confirm/edit before persistence.
- Persist only user-confirmed selection.
- Suggestions return reading-row spans plus mapped chunk IDs; single-row suggestions are represented as one-row spans.
- This workflow assists explicit user-driven decision creation and does not create candidate records automatically.

**Preserved suggestion contract notes**:
- Suggestion requests may later support optional sequence bounds, query filtering, result limits, and confidence thresholds.
- Suggestion responses may need to preserve suggested reading-row spans, source chunk references, confidence, and inclusion reason.
- CLI and API parity remains required even if one surface temporarily ships ahead of the other.

**CLI/API parity**:
- CLI: `decisions suggest-segments --meeting-id <id> --title <text> --summary <text> [--from <seq>] [--to <seq>] [--limit <n>]`
- API: `POST /api/meetings/:id/segment-suggestions`
- Response includes sequence, mapped chunk IDs, confidence, and reason.

**Validation**:
```bash
# API suggestions
curl -X POST http://localhost:3000/api/meetings/<id>/segment-suggestions \
  -H "Content-Type: application/json" \
  -d '{"title":"Choose secure storage backend","summary":"Select primary storage path and defer access method details","limit":20}'

# CLI suggestions
pnpm cli decisions suggest-segments --meeting-id <id> \
  --title "Choose secure storage backend" \
  --summary "Select primary storage path and defer access method details" \
  --limit 20

# Parity check: same meeting/title/summary returns equivalent ranked suggestions

# Confirm only reviewed/accepted selections are persisted
```

**Boundary note**:
- `segment-suggestions` is selection assistance for one explicit decision workflow item.
- Meeting-wide candidate discovery, candidate persistence, revisit linking, and promotion remain part of M6 decision detection.

---

### M5.2 — Modular Activation Gate (v1-safe)

> **Triage: DEFERRED — post-M5 backlog.** A useful checkpoint but not a user-deliverable. Run after M5 ships as a health check before starting M6.

Before broad web/API adoption, verify that modular seams are usable without forcing activation of unfinished v2 behaviors.

**Checks**:
- Public API contracts do not expose provisional internal module types.
- Transcript context-windowing remains strategy-extensible (`strategy` values can grow without schema rewrites).
- Feature-flag or adapter-switch path exists for future activation (e.g. legacy service path vs subsystem facade path).
- v2 transcript evolution remains optional in v1 (`multi-pipeline chunking`, `graph views`, advanced tagging can be added later).

**Validation**:
```bash
pnpm test:e2e
pnpm --filter=@repo/core test
curl http://localhost:3000/docs   # OpenAPI remains stable while internals are swappable
```

---

### M5.3 — CLI Migration to API Client

The CLI becomes a pure HTTP API consumer (`@repo/core` and `@repo/db` imports removed from `apps/cli`).

**New**: `apps/cli/src/api-client.ts` — thin fetch wrapper
- Uses `DECISION_LOGGER_API_URL` env var (default: `http://localhost:3000`)
- Global `--api-url <url>` flag to override at runtime
- User-friendly error messages for 4xx/5xx and connection failures

**Rewrite all command files** in `apps/cli/src/commands/` to use `api-client.ts` instead of service imports.

**Validation**:
```bash
# Zero @repo/core or @repo/db imports in apps/cli
grep -r "from '@repo/core'" apps/cli/src  # returns nothing
grep -r "from '@repo/db'" apps/cli/src    # returns nothing

# Works against local API
DECISION_LOGGER_API_URL=http://localhost:3000 pnpm cli meeting list

# Works against remote
DECISION_LOGGER_API_URL=https://my-deployed-api.example.com pnpm cli meeting list

# Offline: clear error message
pnpm cli meeting list  # "Cannot connect to API at http://localhost:3000"
```

---

### M5.4 — Interactive CLI UX (Clack)

- Clack prompts for missing required arguments (e.g. `meeting create` without `--participants`)
- Spinners during LLM operations ("Generating draft...")
- Colored output: locked fields in green, unlocked in yellow
- Confirmation prompts for destructive actions (delete, rollback)
- `--verbose` flag: prints raw HTTP request/response for debugging

**Status**: ✅ Complete (implemented with existing commander-based runtime helpers; no Clack adoption needed for M5).

**Delivered so far**:
- Global `--verbose` flag wired into the CLI runtime
- Raw HTTP request/response tracing added to the shared API client for debugging
- Spinner support added for draft generation
- Confirmation prompt groundwork added for decision logging flows
- Spinner coverage expanded to high-latency CLI actions such as meeting creation, transcript upload, decision flagging, template changes, field lock/unlock, and decision logging
- Confirmation prompts added for destructive context-clearing flows and decision logging, with `--yes` bypass for non-interactive runs
- Interactive prompting for missing high-friction command inputs added using the current runtime helpers (for example missing participants, decision titles, and decision log metadata)
- Real one-shot CLI usage validated via the local `dlogger` wrapper without introducing a separate prompt framework

**Notes**:
- The current commander + runtime-helper approach satisfies the M5 UX bar with lower migration risk, so Clack adoption is deferred unless future web/CLI requirements justify it.
- Future UX polish can still add more command-specific affordances, but M5.4 itself is complete.

---

### M5.5 — Web Frontend

**Full reference**: `docs/web-ui-plan.md` — authoritative design spec with user stories, route architecture, API dependency map, and phased build order. The summary below is an index.

**Technology**: React + Vite + TypeScript, Tailwind CSS, React Router v6 — `apps/web/` package (`@repo/web`)

**UX reference**: `docs/ui-ux-overview.md` — page goals, shared-display vs facilitator-mode rules, maintenance guidelines

#### Mode split: separate routes

Shared display and facilitator controls are separate routes (not a toggle). Primary target is a dual-screen setup: group watches `/meetings/:id` on the room projector; facilitator controls `/meetings/:id/facilitator` on their laptop.

Simplicity invariants enforced by structure:
- Shared display components have zero mutation event handlers
- No UUIDs in the shared display DOM
- Facilitator-only components in `src/components/facilitator/` (import boundary)
- Tags and status use colours/icons on shared screen — no raw enum strings

#### Route inventory

| Route | Audience | Screen |
|---|---|---|
| `/` | Facilitator | Meeting list — create/open |
| `/meetings/:id` | **Projected to group** | Shared display — agenda + active workspace (read-only) |
| `/meetings/:id/facilitator` | Facilitator device | Full controls — candidates, generate, lock, edit, finalise |
| `/meetings/:id/facilitator/transcript` | Facilitator | Segment selection in reading mode |
| `/decisions/:id` | Both | Logged decision — projectable, read-only, export |

#### Screen summary

**Shared meeting display** (`/meetings/:id`): agenda always visible; active decision fields in large high-contrast text; locked fields with muted background (no `[LOCKED]` label); tags as coloured pills; per-field spinner during generation; zero action buttons. Polls or subscribes SSE to reflect facilitator actions within a few seconds.

**Facilitator view** (`/meetings/:id/facilitator`): candidate queue (`Suggested` / `Agenda` tabs), candidate promotion with template picker, per-field lock/unlock/regenerate/zoom/guidance, LLM log panel, field version history, finalise flow. All controls visible; the group never sees this route.

Additional Screen 3 stories from gap analysis (`docs/ux-workflow-examples.md`):
- **G1** (Flow 1): As a facilitator, I can upload a transcript file (plain text, no attribution required) to the active meeting and trigger decision detection.
- **G2** (Flow 1): As a facilitator, I can create a new decision context directly by entering a title, summary, and choosing a template — without requiring a prior detected candidate.
- **G2.1** (Flow 1 extension): As a facilitator, I can edit an active context title/summary in place as understanding evolves, without recreating the context.
- **G5 (UI-only, Flow 1)**: The **Regenerate all** action exposes an optional "Focus for this pass" text input, sent as `additionalContext`. Ephemeral — not saved after the pass. No new API needed.
- **G6** (Flow 2): As a facilitator, I can add an existing open decision context (from a prior meeting or sub-committee) to the current meeting's agenda — without cloning it — so its full field history and transcript evidence are immediately available. (Requires M4.9 `decision_context_meetings` join table.)
- **G6.1** (Flow 2 extension): As a facilitator, I can find related meetings by date, title, and tag when attaching cross-meeting context.
- **G6.2** (Flow 2 extension): As a facilitator, I can use autocomplete plus a calendar popup to pick related meetings quickly during agenda/context attachment.
- **G8** (Flow 2): As a facilitator, I can start a live transcript stream for the current meeting, see its status (active / paused / stopped) and row count, and stop it when the meeting ends. (Requires `POST /api/meetings/:id/transcripts/stream` and `GET /api/meetings/:id/streaming/status`.)
- **G9** (Flow 2): As a facilitator, I can see how many new transcript rows have arrived since the last regeneration pass, so I can judge whether regenerating again will produce materially different output. (Lightweight indicator adjacent to the Regenerate action; no new API — row count derivable from existing transcript state.)
- **G10** (Flow 2): As a facilitator, I can quickly flag a future decision (title only, no template required) from within the active deliberation, adding it to the candidate queue without switching away from the current context. Distinct from G2, which requires full context creation.
- **G11** (Flow 2): As a facilitator, I can defer an open decision context — removing it from today's agenda while preserving all content — so it can be resumed in a future meeting via the G6 flow. No future meeting ID is assigned at deferral time. (Requires `POST /api/meetings/:id/decision-contexts/:contextId/defer`, M4.9.)

**Segment selection** (`/meetings/:id/facilitator/transcript`): reading-mode projection (no overlap text), text search + range filter, drag-to-select rows, AI suggestion pre-selection (mandatory human review before confirm), confirms persist reading-row IDs + chunk IDs.

Additional Screen 4 story added from Flow 1 gap analysis:
- **G3**: As a facilitator, I can jump directly to a specific sequence number in the transcript to orient quickly in a long session. (A row-jump control in the toolbar: enter a sequence number and scroll to that row with a brief visual highlight. Qualitatively different from range-narrowing — one-step navigation without filtering out the surrounding rows.)

**Logged decision** (`/decisions/:id`): complete field rendering, decision method and actors, tags, related decisions, export buttons.

#### API gaps to fill before each phase

Rows marked **[DEFERRED]** depend on post-M5 sub-items and do not block web Phases 0–2.

| Endpoint | Blocks | Milestone |
|---|---|---|
| `GET /api/meetings/:id/decision-contexts` | Shared display agenda | M5.1 |
| `GET /api/decision-contexts/:id` | Shared display workspace | M5.1 |
| `GET /api/meetings/:id/summary` | Meeting header stats | M5.1 |
| `GET /api/meetings/:id/flagged-decisions` | Facilitator candidate queue | M5.1 |
| `PATCH /api/meetings/:id` | Participant updates | M5.1 |
| `PATCH /api/decision-contexts/:id` | Edit active context title/summary (G2.1) | M5.1 |
| `POST /api/decision-contexts/:id/regenerate` | Full regen (all unlocked) | M5.1 |
| `GET /api/meetings/:id/transcript-reading` | Segment selection | **[DEFERRED]** M5.1a |
| `POST /api/meetings/:id/segment-suggestions` | AI segment assist | **[DEFERRED]** M5.1b |
| Tag + relation endpoints | Tag pills, related decisions | **[DEFERRED]** M4.10 |
| `POST /api/supplementary-content` | Field-zoom evidence add | **[DEFERRED]** M4.11 |
| `GET /api/supplementary-content?context={tag}` | Context builder retrieval | **[DEFERRED]** M4.11 |
| `DELETE /api/supplementary-content/:id` | Remove supplementary item | **[DEFERRED]** M4.11 |
| `GET /api/decision-contexts?status=open` | Add-to-agenda picker (G6) | **[DEFERRED]** M4.9 |
| `POST /api/meetings/:id/decision-contexts/:contextId/activate` | Add existing context to meeting agenda (G6) | **[DEFERRED]** M4.9 |
| `POST /api/meetings/:id/decision-contexts/:contextId/defer` | Defer context from meeting agenda (G11) | **[DEFERRED]** M4.9 |
| `GET /api/meetings?query=<text>&dateFrom=<iso>&dateTo=<iso>&tag=<name>` | Related-meeting autocomplete/filter picker (G6 extension) | **[DEFERRED]** post-M5 |
| `GET /api/meetings/calendar?month=<YYYY-MM>` | Related-meeting calendar popup (G6 extension) | **[DEFERRED]** post-M5 |
| `POST /api/meetings/:id/transcripts/stream` | Start live transcript stream (G8) | **[DEFERRED]** post-M5 |
| `GET /api/meetings/:id/streaming/status` | Live stream status indicator (G8) | **[DEFERRED]** post-M5 |

Implementation note (March 9, 2026): the related-meeting search/calendar endpoints and `PATCH /api/decision-contexts/:id` are required by the facilitator UI workflow but are not yet present in `apps/api/src/routes/*`.

#### Phased build order

- **Phase 0** — App scaffolding: `apps/web/` package, Vite + React + Tailwind, typed API client, router
- **Phase 1** — Shared display: meeting list, shared meeting view, logged decision view. Fill M5.1 list/get gaps first.
- **Phase 2** — Facilitator view: candidate queue, promote, generate, lock, edit, finalise. Fill M5.1 write gaps first.
- **Phase 3** — Segment selection: reading mode, drag-select, AI suggestions, confirm. Fill M5.1a/b first.
- **Phase 4** — Streaming: SSE per-field progress on shared + facilitator views
- **Phase 5** — Tags and relations: inline management and display (after M4.10 API ready)

#### Behavioral requirements (preserved)

- Candidate promotion requires template selection before initial draft generation; detector-suggested template may be preselected
- Segment selection persists reading-row IDs together with resolved chunk IDs for auditability
- Manual and AI-assisted selections both require explicit user confirmation before persistence
- Related-meeting picker in facilitator workflow supports date/title/tag autocomplete and calendar-based selection
- Field zoom supports edit, regenerate, and field-version navigation
- Field content preserved when switching templates; non-template fields hidden (not deleted), excluded from export
- Completion captures decision method, actors, logged-by, and timestamp; incomplete decisions remain resumable
- Real-time draft generation via SSE (show per-field progress, not raw token stream)

**Preserved export planning notes**:
- Export targets may grow beyond markdown/json to include HTML, PDF, CSV, DOCX, and plain text
- Batch export and format-specific rendering options remain future concerns until canonical API/schema support exists
- Export rendering must reflect finalized decision-log authority participants, not broader contributor history

---

### M5 Validation (End-to-End)

```bash
# Full multi-decision workflow smoke test (manual, no shortcuts)
pnpm dev --filter=apps/api &

pnpm cli meeting create "Release Readiness Review" --participants "Alice,Bob,Carol"
pnpm cli context set-meeting <id>
pnpm cli transcript upload examples/final-smoke-test.txt

# Flag two decisions manually
pnpm cli decisions flag <mtg-id> --title "Approve cloud migration"
pnpm cli decisions flag <mtg-id> --title "Defer hiring decision"

# Work on first decision
pnpm cli context set-decision <flag-1-id>
pnpm cli draft generate
pnpm cli draft lock-field decision_statement

# Switch to second decision
pnpm cli context set-decision <flag-2-id>
pnpm cli draft generate --guidance "Focus on budget constraints"

# Return to first
pnpm cli context set-decision <flag-1-id>
pnpm cli draft show   # preserves state from earlier session

# Log first decision
pnpm cli decision log --type consensus --details "Approved in review" \
     --actors "Alice,Bob,Carol" --logged-by "Alice"
pnpm cli decision export <log-id> --format markdown

# API state visibility (used by web UI)
curl http://localhost:3000/api/meetings/<id>/summary
curl http://localhost:3000/api/meetings/<id>/decision-contexts
curl http://localhost:3000/api/flagged-decisions/<flag-id>/context

# Web UI
open http://localhost:5173  # Decision draft editor, multi-decision switcher
```

### M5 Exit Criteria

> Criteria removed from this list because they depend on deferred items (M4.9, M4.10, M4.11, M5.1a, M5.1b, M5.2) are tracked in the Post-M5 Backlog section.

**Core workflow (gates M5 done):**
- ✅ Multiple decisions flagged and worked on independently within one meeting
- ✅ Switching between active decisions preserves independent draft state
- ✅ Core API endpoints implemented (expert/MCP as stubs), tested, and in OpenAPI spec — covers meeting, transcript, flagged-decisions, decision-contexts, draft, log, export
- ✅ Candidate queue supports `suggested` vs `agenda` states with explicit agenda ordering controls
- ✅ Template selected before initial draft generation in candidate promotion flow
- ✅ New transcript in decision/field context is recency-weighted for manual regeneration
- ✅ Decision completion persists free-text agreement notes and timestamp; incomplete decisions can be resumed
- ✅ `apps/cli` has zero `@repo/core` or `@repo/db` imports
- ✅ CLI works against local and remote API URLs

**Web UI (gates M5 done):**
- ✅ Web UI: flag → draft → multi-decision switch → export — full workflow works end-to-end in browser
- ✅ UI/UX behavior for each shipped screen documented and maintained in `docs/ui-ux-overview.md`
- ✅ Shared-display experience remains uncluttered; facilitator-only controls are separated or explicitly gated
- ✅ Transcript upload available in facilitator view (G1)
- ✅ Direct decision context creation available in facilitator view without prior candidate (G2)
- ✅ Active context title/summary editable in place (G2.1)
- ✅ Regenerate dialog exposes optional "Focus for this pass" input (G5)
- ✅ `outstanding_issues` field visible and editable in field zoom for relevant templates (G12, M4.12)
- ✅ E2E test suite passes

**Post-M5 (tracked in backlog, do not gate M5):**
- Transcript reading mode (G3, M5.1a)
- AI-assisted segment suggestions (M5.1b)
- Supplementary content in facilitator view (G4, M4.11)
- Add existing context to agenda picker (G6, M4.9)
- Live transcript streaming (G8, M5.1)
- Regeneration recency signal (G9)
- Context deferral from agenda (G11, M4.9)
- Field-level version navigation in field zoom
- Real-time SSE draft generation streaming
- Tags and relations (M4.10)
- Modular activation gate (M5.2)

---

## Milestone 6: Expert System + Decision Detection

**Deliverable**: Domain expert consultation (technical, legal, stakeholder) and LLM-assisted decision detection — both implemented within the same expert framework. The Decision Detector is the first expert, returning structured output. Other experts return rich free-text advice. No MCP required in this milestone.

**Why experts first, then detection**: The expert system provides the infrastructure (prompt personas, structured output, LLM interaction logging) that the Decision Detector reuses. Building experts first means detection gets a mature, tested foundation.

**Implementation reference**: `docs/decision-detection-implementation-reference.md` defines the candidate persistence model, two-pass segment strategy, and review/promotion lifecycle for this milestone.

**Boundary with M5 transcript selection**:
- M5 transcript reading and `segment-suggestions` support explicit user-driven decision creation and reviewed evidence selection.
- M6 decision detection supports meeting-wide candidate discovery, candidate persistence, revisit linking, and candidate promotion/dismissal.
- Shared expert infrastructure is expected; shared lifecycle ownership is not.

---

### M6.1 — Expert Service (replaces stub)

**New/Update**: `packages/core/src/services/expert-service.ts` (replaces `expert-advice-service.ts` mock stub)
- `consult(expertId, decisionContextId): Promise<ExpertAdvice>` — free-text advice with suggestions, concerns, and questions
- `consultStructured<T>(expertId, context, outputSchema: ZodSchema<T>): Promise<T>` — structured output for typed results (used by Decision Detector)
- Persists advice in `expert_advice` table; stores `LLMInteraction` per call
- Uses `PromptBuilder` for prompt construction (expert system prompt + decision context)
- Stores `parsedResult` JSONB in `expert_advice` for structured results

**Seed experts** (in `pnpm db:seed`):
- `prompts/experts/technical.md` — technical architecture expert
- `prompts/experts/legal.md` — legal and compliance expert
- `prompts/experts/stakeholder.md` — stakeholder impact expert

**Validation**:
```typescript
const advice = await expertService.consult('technical', decisionContext);
expect(advice.suggestions).toBeDefined();
expect(advice.concerns).toBeDefined();
```

**CLI commands**:
```
draft expert-advice <expert-type> [--focus "area"]
expert list
expert create <name> --prompt-file <file>
```

**API endpoints** (full implementation, replacing stubs from M5):
- `GET/POST /api/experts`, `GET/PATCH/DELETE /api/experts/:id`
- `POST /api/decision-contexts/:id/experts/:name/consult`

**Preserved expert contract notes**:
- Custom experts may eventually carry MCP access configuration, allowed-tool/resource constraints, and optional structured output schemas.
- MCP server registry records may eventually expose server type, connection configuration, capabilities, and activation state.
- These structures should be treated as planning-level contract direction until they exist canonically in `packages/schema`.

**Preserved expert persistence notes**:
- Planning currently expects persistence for expert templates, MCP server registry records, and expert advice history.
- Expert template records may include stable identity, prompt template text, expert type (`core` vs `custom`), activation state, and MCP access configuration.
- MCP access configuration may include allowed server list plus optional tool/resource restrictions.
- Expert advice history may need to retain the decision-context reference, expert reference, request/response payloads, and any MCP tools used for auditability.

**Preserved expert API notes**:
- Full expert CRUD plus expert test/consultation flows are valid planned surfaces.
- The eventual surface may distinguish between normal consultation and test-only prompt execution.
- These routes remain planning-owned until the implemented API and canonical schemas exist.

---

### M6.2 — Structured Output for Expert Service

Detection requires structured output (not free-text). The `consultStructured()` method (introduced in M6.1) enables this. The same pattern extends to any future structured expert responses.

**Update**: `packages/db/src/schema.ts` — add `parsed_result JSONB` column to `expert_advice` table

This is the same structured output pattern used in `DraftGenerationService`. `PromptBuilder` used for construction; `LLMInteraction` stored for observability.

---

### M6.3 — Decision Detector Expert Persona

The Decision Detector is an expert stored in the experts table. It uses `consultStructured()` with a `FlaggedDecisionDetectionSchema` Zod type.

**New**: `prompts/experts/decision-detector.md` — v1 system prompt
- Identifies explicit decisions: voted on, approved, agreed to, decided to
- Identifies implicit decisions:
  - "I want alignment" → `status: defer`
  - "I don't like these options" → `status: reject`
  - "Let's focus on X instead" → decision to redirect/deprioritize
  - Consensus by silence → implicit approval
- Returns structured JSON for candidate creation:
  - `title`, `contextSummary`, `confidence`, `suggestedTemplateId`
  - `startSequenceNumber`, `endSequenceNumber`
  - `evidenceSegmentIds`
- Confidence threshold is configurable per run; default include threshold: `>= 0.5`
- Persisted candidate metadata includes lifecycle timestamps and queue status (`suggested` by default before agenda ordering/promotion)

**Preserved detection contract notes**:
- Candidate records may need to retain meeting reference, source (`ai` or `manual`), lifecycle status, contiguous primary span, evidence segment IDs, and non-contiguous revisit segment IDs.
- Detector structured output may remain smaller than final persisted candidate shape; revisit links can be appended by orchestration after initial inference.
- Detection CLI/API parity remains a planning requirement even if milestone sequencing temporarily staggers delivery.

**Seed**: Decision Detector expert inserted into `experts` table (name: `'decision-detector'`, domain: `'detection'`)

---

### M6.4 — Decision Detection Service

**New**: `packages/core/src/services/decision-detection-service.ts`

> **Note**: This is a **thin orchestration wrapper** — it contains no LLM calls of its own. All LLM inference goes through `ExpertService.consultStructured()`, which uses the Decision Detector expert persona. This class fetches transcript chunks, runs two-pass candidate detection, and persists candidate records for human review/promotion.

```typescript
export class DecisionDetectionService {
  constructor(
    private expertService: ExpertService,
    private transcriptService: TranscriptService,
    private flaggedDecisionService: FlaggedDecisionService,
  ) {}

  async detect(meetingId: string, options?: { confidenceThreshold?: number }): Promise<DecisionCandidate[]>
  // 1. Fetch all transcript chunks for meeting
  // 2. Pass 1: call expertService.consultStructured('decision-detector', context, DetectionResultSchema)
  //    to produce contiguous candidates (span + evidence)
  // 3. Filter by confidenceThreshold (default 0.5)
  // 4. Pass 2: link non-contiguous revisit segments per candidate
  // 5. Persist candidate records (source='ai', status='pending_candidate')
  // 6. Return candidate list for review
}
```

**New test**: `packages/core/src/__tests__/decision-detection-service.test.ts`
- Unit test with `MockLLMService` (canned detection responses)
- Integration test with real LLM (marked slow, requires API key)

---

### M6.5 — Test Corpus

**New**: `test-cases/` directory with representative transcripts:
- `explicit-decisions.json` — clear voted/approved decisions
- `implicit-defer.json` — "I want alignment", "let's wait on this"
- `implicit-reject.json` — "I don't like these options", "this won't work"
- `implicit-redirect.json` — "let's focus on X instead"
- `discussion-not-decision.json` — discussion that reaches no conclusion (negative cases)

**Quality targets**: Precision > 0.80, Recall > 0.75, F1 > 0.77 (run via `pnpm test:llm`)

---

### M6.6 — Detection CLI and API

**New CLI command**:
```
decisions detect [--meeting-id <id>]    — run detection on current meeting's transcript
```
Result displays a candidate list with confidence, contiguous span, and evidence/revisit segments.

**Candidate lifecycle commands**:
```
decisions candidates [--meeting-id <id>]                     — list pending/manual/ai candidates
decisions candidates update <candidate-id> [--title ...]     — refine title/summary/segments
decisions candidates dismiss <candidate-id>                  — mark candidate dismissed
decisions candidates promote <candidate-id>                  — promote candidate to flagged decision/context
```

**New API endpoint**:
- `POST /api/meetings/:id/detect-decisions` — runs detection, persists and returns `DecisionCandidate[]`
- `GET /api/meetings/:id/decision-candidates` — list candidates
- `PATCH /api/decision-candidates/:id` — refine candidate
- `POST /api/decision-candidates/:id/promote` — promote candidate
- `DELETE /api/decision-candidates/:id` — dismiss candidate

**Web UI update**: "Detect Decisions" button on transcript view. Results appear as saved candidates; user reviews/refines/promotes.

---

### M6 Validation

```bash
# Expert consultation (free-text)
pnpm cli draft expert-advice technical
pnpm cli draft expert-advice legal
# Advice is domain-specific and useful

# Decision detection (structured)
pnpm cli transcript upload test-cases/implicit-defer.json --meeting-id <id>
pnpm cli decisions detect --meeting-id <id>
# Expected: creates pending AI candidate "defer pending alignment" (confidence >= 0.5)

pnpm cli decisions candidates --meeting-id <id>
pnpm cli decisions candidates promote <candidate-id>
# Expected: promoted candidate now available in normal decision workflow

pnpm cli transcript upload test-cases/discussion-not-decision.json --meeting-id <id>
pnpm cli decisions detect --meeting-id <id>
# Expected: no new candidates above threshold

# Quality check
pnpm test:llm -- --grep="decision detection"
# Target: Precision > 0.80, Recall > 0.75, F1 > 0.77

# Observability: detection prompt visible
pnpm cli draft debug   # shows detection expert interaction in llm_interactions
```

### M6 Exit Criteria
- ✅ Expert consultation (technical, legal, stakeholder) returns domain-specific advice
- ✅ Decision Detector expert persona seeded and promptable
- ✅ Structured output returns typed candidates with span + evidence segments
- ✅ Implicit decision patterns detected (defer, reject, redirect)
- ✅ Two-pass detection implemented (contiguous pass + revisit linking pass)
- ✅ Above-threshold detections persisted as `pending_candidate` records by default
- ✅ Manual and AI-origin candidates coexist in one candidate lifecycle
- ✅ Candidate review/refine/dismiss/promote flow works end-to-end
- ✅ Overlapping segments can be linked to multiple candidates
- ✅ Negative cases do not generate false positives
- ✅ Quality: Precision > 0.80, Recall > 0.75, F1 > 0.77
- ✅ LLM interaction stored per detection call (full prompt segments + response)
- ✅ Expert and detection CLI commands working end-to-end

---

## Milestone 7: Decision Logger as MCP Server

**Deliverable**: The Decision Logger exposes its own MCP interface, making all core functionality accessible to any MCP-compatible client — including Claude Code, expert personas, and external agents. This is the foundational layer that M8's expert tool integration builds on.

**Why this comes before external MCP tools**: Before experts can use MCP tools, we should ensure the Decision Logger IS a first-class MCP server. This allows experts (implemented in M6) to query and update decision logger state via MCP — a self-referential, elegant design. It also enables Claude Code (or any MCP client) to manage the decision logger without the CLI.

---

### M7.1 — MCP Server Protocol Layer

Implement the Model Context Protocol server in `apps/api/` (or a standalone `apps/mcp/` package).

**New**: `apps/api/src/mcp/decision-logger-mcp-server.ts`
- Implements MCP server protocol (stdio or HTTP/SSE transport)
- Registers tools, resources, and prompts per the MCP spec
- Uses existing `packages/core` services under the hood (no new business logic)

**Transport**: stdio (primary, compatible with Claude Code and standard MCP clients) + HTTP/SSE (for web-accessible deployments)

---

### M7.2 — MCP Tools (Write Operations)

All key decision logger write operations exposed as MCP tools:

```
create_meeting(title, participants, date?)
upload_transcript(meeting_id, text, speaker?)
add_transcript_chunk(meeting_id, text, speaker?, field?)
flag_decision(meeting_id, title, description?)
create_decision_context(flagged_decision_id, title, template_id?)
generate_draft(decision_context_id, guidance?)
regenerate_field(decision_context_id, field_id, guidance?)
set_field_value(decision_context_id, field_id, value)
lock_field(decision_context_id, field_id)
unlock_field(decision_context_id, field_id)
log_decision(decision_context_id, method, actors, logged_by)
rollback_draft(decision_context_id, version)
```

Each tool accepts structured JSON input validated against Zod schemas. Returns structured JSON output.

**Preserved MCP planning notes**:
- MCP resource and tool discovery endpoints/resources are part of the expected future surface area.
- Exact MCP request/response structures should remain planning-owned until the MCP server implementation and canonical schemas are in place.

**Preserved MCP registry notes**:
- MCP server registry design may include server identity, server type, connection configuration, declared capabilities, and lifecycle status.
- Tool discovery and resource discovery should remain first-class registry concerns even if the final transport/API shape changes during implementation.

---

### M7.3 — MCP Resources (Read Operations)

Read-only resources accessible to MCP clients:

```
resource: meetings                      — list all meetings
resource: meeting/{id}                  — meeting details + stats
resource: meeting/{id}/transcript       — all transcript chunks
resource: meeting/{id}/decisions        — flagged decisions list
resource: decision_context/{id}         — current draft state
resource: decision_context/{id}/draft   — draft fields with lock status
resource: decision_context/{id}/history — version history
resource: decision_context/{id}/llm_interactions — prompt/response log
resource: decision_log/{id}             — finalized decision record
resource: templates                     — available decision templates
resource: fields                        — field library
```

---

### M7.4 — MCP Prompts

Pre-defined MCP prompts that package common workflows for LLM clients:

```
prompt: document_decision(meeting_id, decision_title)
  — Full workflow: flag → create context → generate draft → review → log

prompt: review_draft(decision_context_id)
  — Returns current draft with guidance on what still needs attention

prompt: detect_decisions(meeting_id)
  — Invoke Decision Detector expert and return decision candidates for review
```

---

### M7.5 — Registration and Configuration

**Update**: `packages/db/src/seed.ts`
- Register the Decision Logger itself as an MCP server in `mcp_servers` table:
  - `name: 'decision-logger'`
  - `type: 'stdio'`
  - `connectionConfig: { command: 'pnpm', args: ['mcp'] }` (or HTTP URL)

**New CLI command**:
```
pnpm mcp    — starts the Decision Logger MCP server (stdio mode)
```

**New script** in `apps/api/package.json`:
```json
"mcp": "tsx src/mcp/server.ts"
```

**Claude Code integration**: Users can add Decision Logger to their `claude_desktop_config.json` or `.mcp.json`:
```json
{
  "mcpServers": {
    "decision-logger": {
      "command": "pnpm",
      "args": ["--filter=apps/api", "mcp"],
      "cwd": "/path/to/windsurf-project"
    }
  }
}
```

---

### M7.6 — Expert Access via Decision Logger MCP

With the Decision Logger as an MCP server, experts in M6 can now use Decision Logger tools. When an expert is consulted, the Decision Logger MCP tools are available in the expert's tool context:

- The Decision Detector expert can call `resource: meeting/{id}/transcript` to pull the transcript instead of having it injected into the prompt — enabling larger transcript handling
- Domain experts can call `resource: decision_context/{id}/draft` to see the current draft state, then suggest targeted improvements
- This pattern emerges naturally without any special-casing: experts with `decision-logger` in their allowed servers get the full Decision Logger MCP interface

---

### M7 Validation

```bash
# Start MCP server in stdio mode
pnpm --filter=apps/api mcp &

# Test via MCP client (e.g., Claude Code or mcp-cli)
# List available tools
# Create a meeting via MCP
# Upload transcript via MCP
# Flag decision, generate draft, export — full workflow via MCP

# Confirm Decision Logger MCP is accessible to experts
pnpm cli draft expert-advice technical
# Expert should have access to decision_context resource to query current state

# Claude Code integration test
# Add to .mcp.json and verify Decision Logger tools appear in Claude Code
```

### M7 Exit Criteria
- ✅ MCP server starts in stdio mode and registers all tools/resources/prompts
- ✅ Full decision workflow executable via MCP tools alone (no CLI required)
- ✅ MCP resources return current system state accurately
- ✅ Decision Detector and domain experts have Decision Logger MCP tools in their context
- ✅ Claude Code integration: Decision Logger tools appear and work in Claude Code session
- ✅ HTTP/SSE transport works for web-accessible deployments

---

## Milestone 8: External MCP Tool Integration for Experts

**Deliverable**: General MCP protocol support for experts consuming external MCP tools. Experts can invoke tools from any registered MCP server. The Decision Detector may optionally use external MCP tools if this improves quality without becoming brittle.

**Context**: `MCPServer`, `MCPServerService`, `ExpertMCPRepository` already exist in the schema and service layer. The gap is wiring the MCP client into the LLM inference loop.

---

### M8.1 — MCP Client Protocol Layer

**New**: `packages/core/src/mcp/mcp-client.ts`
- Connects to an external MCP server (HTTP or stdio transport)
- `listTools() → MCPTool[]`
- `listResources() → MCPResource[]`
- `callTool(name, args) → ToolResult`
- `ping() → boolean`

**New**: `packages/core/src/mcp/mcp-tool-registry.ts`
- Maps expert ID → allowed MCP server names (from `expert_mcp_assignments` table)
- Enforces access restrictions: expert X can only use servers Y and Z
- Validates tool invocations against allowed list before calling

Note: The Decision Logger MCP server (M7) is itself registerable here, allowing experts to have Decision Logger tools in their context automatically.

---

### M8.2 — Tool-Using Expert Inference

**Update**: `packages/core/src/llm/vercel-ai-llm-service.ts`
- `generateWithTools(params)` — uses Vercel AI SDK `generateText()` with `tools` parameter
- Tools fetched from MCP registry per expert, converted to Vercel AI SDK format
- LLM calls tools in a loop (agentic, with max iteration limit)
- All tool calls and responses logged in `LLMInteraction.promptSegments` (new `tool_call` segment type)

**Update**: `packages/core/src/services/expert-service.ts`
- If expert has MCP servers assigned: use `generateWithTools()` instead of `generateObject()`
- If no MCP servers: continue using non-tool path (no regression)

---

### M8.3 — Decision Detector via MCP (Optional Promotion)

Evaluate whether MCP tools (including the Decision Logger's own MCP server) improve the Decision Detector. Candidate tools:
- `search_transcript(query)` — keyword/semantic search within transcript (via Decision Logger MCP)
- `get_surrounding_context(chunkId, windowSize)` — fetch chunks before/after a given chunk
- `classify_segment(text)` — fast classification (explicit vs implicit vs non-decision)

**Promotion criterion**: F1 with MCP >= F1 without MCP + 0.03, and non-failure rate >= 95%. Otherwise keep the non-MCP version from M6.

---

### M8.4 — External MCP Lifecycle Management

**Full API endpoints** (stubs in M5, now fully implemented):
- `GET/POST /api/mcp/servers`, `GET/PATCH/DELETE /api/mcp/servers/:name`
- `GET /api/mcp/servers/:name/health` — actual ping to external server
- `GET /api/mcp/servers/:name/tools` — live discovery from external server
- `GET /api/mcp/servers/:name/resources` — live discovery from external server

**CLI commands**:
```
mcp list
mcp register <name> --type <type> --config <file>
mcp health
mcp tools <server-name>
```

---

### M8 Validation

```bash
pnpm cli mcp health       # all registered servers respond
pnpm cli mcp tools <server-name>   # lists available tools

# Expert with external MCP tools
pnpm cli draft expert-advice technical  # if technical expert has external servers assigned
pnpm cli draft debug   # shows tool_call segments in prompt segments

# Decision Detector evaluation
pnpm test:llm -- --grep="decision detection mcp"
# Compare F1 with/without MCP; promote if criteria met
```

### M8 Exit Criteria
- ✅ MCP client connects to external servers (HTTP or stdio)
- ✅ Expert tool access restricted to allowed servers per expert
- ✅ Tool invocations logged in `LLMInteraction.promptSegments`
- ✅ Non-MCP experts continue working unchanged (no regression)
- ✅ Decision Detector evaluated: promoted or kept as non-MCP based on F1 + reliability
- ✅ MCP health check and tool discovery working via CLI and API

---

### M9.1 — Field/Template Export/Import Packages (Future)

**Status note**: Field/template identity hardening (namespace, uniqueness, stable UUID seeds) is now tracked in M4.7 so core workflow and APIs rely on stable contracts before M5.

**Goal**: Make field/template definitions portable across environments via package export/import.

**Export/import**:
- Support exporting a “template package” containing:
  - Field definitions (UUID + namespace + name + version + prompts)
  - Template definitions (UUID + version)
  - Template-field assignments (including custom labels)
- Import should upsert by UUID, enabling template migration and shared field libraries.

**Validation**:
```bash
pnpm db:migrate
pnpm db:seed
pnpm cli field list
pnpm cli template list --fields
```

---

## Critical File Index

| File | Milestone | Action |
|------|-----------|--------|
| `apps/cli/src/commands/meeting.ts` | M1 | Fix @repo/db layering violation |
| `apps/cli/src/commands/transcript.ts` | M1 | Implement upload + process stubs |
| `apps/cli/src/commands/draft.ts` | M1 | New: generate, show, export, debug, lock |
| `apps/cli/src/commands/context.ts` | M2 | New: set-meeting, set-decision, set-field |
| `apps/cli/src/api-client.ts` | M5 | New: HTTP client wrapper |
| `packages/core/src/llm/i-llm-service.ts` | M1 | New: interface + GuidanceSegment |
| `packages/core/src/llm/prompt-builder.ts` | M1 | New: structured segment builder |
| `packages/core/src/llm/vercel-ai-llm-service.ts` | M1 | New: Vercel AI SDK impl |
| `packages/core/src/llm/mock-llm-service.ts` | M1 | New: test mock |
| `packages/core/src/services/draft-generation-service.ts` | M1 | New |
| `packages/core/src/services/markdown-export-service.ts` | M1 | New |
| `packages/core/src/services/global-context-service.ts` | M2 | New |
| `packages/core/src/services/decision-detection-service.ts` | M6 | New (via expert system) |
| `packages/core/src/services/decision-log-service.ts` | M4 | Fix TODO stubs |
| `packages/core/src/services/decision-context-service.ts` | M2+M4 | Add snapshot/rollback/setFieldValue |
| `packages/core/src/services/transcript-service.ts` | M2 | Add auto-tagging |
| `packages/schema/src/index.ts` | M1+M2+M4 | Add LLMInteractionSchema, draftVersions, field/template identity constraints |
| `packages/db/src/schema.ts` | M1+M2+M4 | Add llm_interactions, draft_versions, field/template identity constraints |
| `packages/db/src/repositories/llm-interaction-repository.ts` | M1 | New |
| `apps/api/src/routes/transcripts.ts` | M1 | New |
| `apps/api/src/routes/decision-contexts.ts` | M1 | New |
| `apps/api/src/routes/decisions.ts` | M4 | New |
| `apps/api/src/routes/*.ts` | M5 | Complete remaining endpoints |
| `prompts/draft-generation.md` | M1 | New: v1 prompt |
| `prompts/experts/decision-detector.md` | M6 | New: detection persona prompt |
| `prompts/experts/technical.md` | M5 | New: technical expert persona |
| `prompts/experts/legal.md` | M5 | New: legal expert persona |
| `prompts/experts/stakeholder.md` | M5 | New: stakeholder expert persona |
| `test-cases/*.json` | M6 | New: detection test corpus |
| `apps/api/src/mcp/decision-logger-mcp-server.ts` | M7 | New: Decision Logger MCP server |
| `packages/core/src/mcp/mcp-client.ts` | M8 | New: external MCP client |
| `packages/core/src/mcp/mcp-tool-registry.ts` | M8 | New: tool access control |
| `packages/core/package.json` | M1 | Add ai, @ai-sdk/anthropic, @ai-sdk/openai |
| `.env.example` | M1 | Add LLM_PROVIDER, LLM_MODEL |

---

## Post-M5 Backlog

Items triaged out of M4 and M5 to unblock the working web UI. Tackle in order after M5 ships.

### Priority 1 — Web UI completeness (needed for full facilitator workflow)

**M5.1a — Transcript reading mode**
De-overlapped display stream for segment selection. Blocks web Phase 3 (segment selection screen). Implement before adding AI-assisted selection.

**M5.1b — AI-assisted segment suggestions**
Depends on M5.1a reading mode. Implement after Phase 3 segment selection works manually.

**M4.11 — Supplementary content store**
New `supplementary_content` table + service + API endpoints + context builder integration. Blocks facilitator field-zoom evidence panel (G4).

**M4.9 — Cross-meeting decision context**
`decision_context_meetings` join table, `activate`/`defer` endpoints, `GET /api/decision-contexts?status=open` picker. Blocks G6 (add existing context to agenda) and G11 (defer from agenda).

**M5.5 Phase 3 — Segment selection screen** (depends on M5.1a)
Reading mode, drag-to-select, AI suggestions, confirmation persistence.

**M5.5 Phase 4 — SSE streaming**
Per-field progress events in shared display and facilitator view. Real-time draft generation.

### Priority 2 — Correctness and auditability

**M4.7b — Definition immutability + context pinning**
Replace in-place field/template mutation with version creation. Pin template+field versions on `DecisionContext`. Resolve the 7 named code incompatibilities in sequence.
Order: incompatibilities 5 → 4 → 3 → 2 → 7 → 6 → 1 (schema → lineage → services → logs).

**Versioning Architecture Phases A–E** (depends on M4.7b)
Full field-version append-only model. Phase A (schema) → B (writes) → C (reads) → D (rollback) → E (template transform + cross-meeting alignment).

### Priority 3 — Enrichment features

**M4.10 — Decision tagging + cross-references**
Tag library, `decision_context_tags`, `decision_log_tags`, `decision_relations`. Blocks web Phase 5.

**M5.5 Phase 5 — Tags and relations UI** (depends on M4.10)
Tag pills, related decisions panel, tag management in facilitator view.

**M4.8 — Modular Foundation B**
`IContentCreator` seam, field provenance metadata, no-op coaching hook.

**M5.2 — Modular activation gate**
Health check verifying v2 seams are non-disruptive before M6 starts.

**M5.1a.1 — Transcript preprocessing seam**
Whisper-canonical normalization layer. Implement when a second transcript source is actively needed.

---

## Deployment Considerations (unchanged)

Compatible with **Cloudflare Workers + Hyperdrive + managed Postgres** (Neon/Supabase) without schema changes. Not compatible with Cloudflare D1 (SQLite) due to `TEXT[]`, `JSONB`, and GIN indexes throughout the schema. pgvector available on Neon/Supabase when needed post-MVP.
