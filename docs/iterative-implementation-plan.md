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

## Current State (as of March 3, 2026)

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

---

## Architecture Decisions

### LLM SDK: Vercel AI SDK (provider-agnostic)
Use `ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai`. Existing API keys work unchanged. Provider and model are runtime-configurable via env vars:
- `LLM_PROVIDER=anthropic|openai`
- `LLM_MODEL=claude-opus-4-5|gpt-4o` (etc.)

### CLI Architecture: @repo/core until M5
- M1–M4: CLI imports `@repo/core` services directly (no API server required to use CLI)
- M5: CLI rewrites to pure HTTP API client (`DECISION_LOGGER_API_URL`)
- API is built in parallel throughout M1–M4, ready for M5 web UI

### Observability: Two layers

**Layer 1 — LLM interaction persistence (M1, always on)**:
Every LLM call stores its structured prompt segments, serialized prompt text, raw response, model, provider, latency, and token counts in a `llm_interactions` table. No opt-in flag needed. Surfaced via `draft debug` CLI and `GET /api/decision-contexts/:id/llm-interactions`.

**Layer 2 — Runtime structured logging (M2, phased rollout)**:
Per `docs/logging-observability-plan.md`, all service boundaries emit structured JSON with correlation IDs. Rollout: M2 adds the shared logger + correlation helpers (Phase A/B of the observability plan). M4 instruments LLM requests and streaming (Phase C). Full debug UX (`--verbose`, `debug tail`) completes in M5 alongside the full API layer (Phase D). This does not block any LLM or domain milestone — logging is additive infrastructure.

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

---

## Principles (unchanged from original plan)

- **TDD at every step**: tests before code, always
- **Zod as SSOT**: never write manual types
- **Strict layering**: apps → core → db → schema
- **Commit validated chunks**: each commit passes its checkpoint
- **Checkpoint before continuing**: do not proceed if validation fails
- **Prompt versioning**: track prompt changes, measure quality
- **Modular-by-seams**: add stable interfaces now; defer hard module boundaries until justified

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
  // 2. Fetch template fields (default template if none set)
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
pnpm db:push

# 2. Unit tests pass
pnpm test --filter=@repo/core  # includes new draft-generation tests

# 3. Full workflow via CLI
pnpm cli meeting create "Q1 Planning" --participants "Alice,Bob"
pnpm cli transcript upload ./examples/sample-transcript.txt --meeting-id <id>
pnpm cli decisions flag <meeting-id> --title "Approve cloud migration"
pnpm cli decision context create --meeting-id <id> --flagged-decision-id <flag-id> --title "Cloud Migration"
pnpm cli draft generate --guidance "Focus on cost and timeline"
pnpm cli draft show
pnpm cli draft lock-field decision_statement
pnpm cli draft generate   # decision_statement unchanged
pnpm cli draft export --output cloud-migration-decision.md
cat cloud-migration-decision.md  # Valid markdown, all fields populated

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
- ⏳ Real LLM generates populated draft from sample transcript - pending M1.7 implementation
- ✅ Locked fields unchanged after regeneration (verified in tests)
- ✅ LLM interaction stored with prompt segments (implemented in draft service)
- ✅ Markdown export renders all fields in template order (implemented in M1.9 and verified via API export endpoint)
- ✅ `draft debug` shows exact prompt sent to LLM (implemented in M1.8)
- ✅ API endpoint returns same result as CLI path (implemented and covered with real-DB API tests)

---

## Milestone 2: Versions + Ongoing Transcripts

**Deliverable**: Add transcript content incrementally to a meeting. View draft history. Roll back to a prior draft version. Global context management for active meeting/decision/field state.

---

### M2.1 — Global Context Management

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

---

### M2.2 — Auto-Tagging Transcript Chunks

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

---

### M2.3 — Draft Versioning Schema

**Update**: `packages/schema/src/index.ts` — add `draftVersions` to `DecisionContextSchema`

**Update**: `packages/db/src/schema.ts`
```sql
draft_versions JSONB NOT NULL DEFAULT '[]'
-- Array of { version: number, draftData: Record<string,string>, savedAt: string }
```

Drizzle migration required.

---

### M2.4 — Version Service Methods

**Update**: `packages/core/src/services/decision-context-service.ts`
- `saveSnapshot(id)` — pushes current `draft_data` + timestamp into `draft_versions` before overwriting
- `rollback(id, version)` — restores `draft_data` from `draft_versions[version]`
- `listVersions(id)` — returns `Array<{version, savedAt, fieldCount}>`

`DraftGenerationService.generateDraft()` calls `saveSnapshot()` automatically before each generation.

---

### M2.5 — Ongoing Transcript

- `transcript upload` allows re-uploading to an existing meeting (appends chunks, does not replace)
- `transcript add --text "..."` correctly uses active meeting context + auto-tagging
- CLI command `transcript add --field <name> --text "..."` tags chunk at field level

---

### M2.6 — CLI + API for Versions

**Add to `draft` commands**:
```
draft versions             — list snapshots with timestamps and field counts
draft rollback <version>   — restore draft to version N
```

**New API endpoints**:
- `GET /api/decision-contexts/:id/versions` — list versions
- `POST /api/decision-contexts/:id/rollback` — body: `{ version: number }`

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

### M2 Validation

```bash
pnpm cli decisions flag <meeting-id> --title "Decision A" --segments 12-18,22
pnpm cli decisions flag <meeting-id> --title "Decision B" --segments 16-20
pnpm cli decisions update <flagged-id> --segments all

pnpm cli draft generate                # version 1
pnpm cli draft versions                # shows v1
pnpm cli transcript add --text "Additional context about costs..."
pnpm cli draft generate                # version 2 (v1 snapshot saved)
pnpm cli draft versions                # shows v1, v2
pnpm cli draft rollback 1              # restore v1
pnpm cli draft show                    # shows v1 content
pnpm cli draft debug                   # shows both LLM interactions

# Modular foundation parity checks
pnpm --filter=@repo/core type-check
pnpm test --filter=@repo/core
# Existing transcript/draft/context tests pass unchanged against adapter wiring
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

**Deliverable**: Regenerate a specific field with field-level guidance. Manually edit a field value directly. Full decision logging (immutable record).

---

### M4.1 — Field-Specific Regeneration

**Update**: `packages/core/src/services/draft-generation-service.ts`
- `regenerateField(decisionContextId, fieldId, guidance?: GuidanceSegment[]): Promise<string>`
- Chunk weighting: field-tagged (`decision:<id>:<field>`) > decision-tagged (`decision:<id>`) > meeting-tagged (`meeting:<id>`)
- Calls `llm.regenerateField()` with weighted, filtered chunk set
- Stores separate `LLMInteraction` record with `fieldId` populated

**Validation**:
```typescript
const value = await draftService.regenerateField(contextId, 'options');
expect(typeof value).toBe('string');
const interactions = await llmInteractionRepo.findByField(contextId, 'options');
expect(interactions[0].fieldId).toBe('options');
```

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

**CLI command**:
```
draft edit-field <field-name>    — opens $EDITOR or prompts interactively for value
```

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

---

### M4.5 — Decision Logging (Finalization)

Fix existing TODOs in `DecisionLogService` (currently hardcodes `templateVersion: 1` and `sourceChunkIds: []`).

**Update**: `packages/core/src/services/decision-log-service.ts`
- `logDecision(contextId, options)` — fetch actual template version from `DecisionTemplate`; fetch source chunk IDs from `ChunkRelevance` records
- Creates immutable `DecisionLog` from `DecisionContext.draftData`
- Updates `DecisionContext.status` to `'logged'`
- Validation: cannot log if required fields are empty (check against template `required` flag)

**CLI command**:
```
decision log --type <consensus|vote|authority|defer|reject|manual|ai_assisted> \
             --details "text" --actors "Alice,Bob" --logged-by "Alice"
```

**Update**: `draft export` command — also works for logged decisions (renders `DecisionLog.fields`)

---

### M4.6 — Logging API Endpoints

- `POST /api/decision-contexts/:id/log` — finalize; body: `{ decisionMethod, actors, loggedBy }`
- `GET /api/decisions/:id` — show decision log
- `GET /api/decisions/:id/export?format=markdown|json` — export

---

### M4.7 — Field/Template Identity Hardening

Move identity-hardening work forward so decision logging and M5 field/template APIs run on stable contracts.

**DB schema updates**:
- `decision_fields.namespace` (default `core`)
- Uniqueness constraint: `(namespace, name, version)`

**Definition model updates**:
- Field identity is stable via UUID at definition time (seed-time for canonical/core registry).
- `name` is the stable programmatic key within a `namespace` (not the user-facing label).
- Templates reuse fields by `fieldId` (UUID) and customize presentation via `template_field_assignments.customLabel` / `customDescription`.

**Seed/registry updates**:
- Canonical fields/templates stored in a registry (constants) with pre-assigned UUIDs.
- Seeding is idempotent by `id`, with fallback lookup by `(namespace, name, version)`.

**Why here**:
- M4.5 decision logging needs reliable template identity for accurate `templateVersion` attribution.
- M5.1 field/template CRUD should launch after identity constraints are in place to avoid migration churn.

---

### M4.8 — Modular Foundation B (Content + Coaching Seams)

Add pluggable draft-content and coaching seams while keeping the current draft path as the active implementation.

**Add**:
- `IContentCreator` contract and `AIContentCreator` adapter around current LLM draft generation path.
- `FieldValue` provenance metadata shape (`source`, optional `provenance`, optional `confidence`) stored in a backward-compatible way.
- `ICoachObserverHook` interface with default no-op implementation wired in service factory.

**Constraints**:
- Existing `draft generate`/`draft regenerate-field` behavior remains unchanged.
- Coaching remains opt-in; no synchronous advice generation required before M6.

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
pnpm db:push
pnpm db:seed
pnpm cli field list
pnpm cli template list --fields

# Modular foundation seam checks
pnpm --filter=@repo/core type-check
pnpm test --filter=@repo/core
# Verify no-op coach hook does not change draft generation outputs
```

### M4 Exit Criteria
- ✅ Single field regeneration stores separate `LLMInteraction` with `fieldId`
- ✅ Field-tagged transcript clearly separated from transcript in prompt (verifiable via `draft debug`)
- ✅ Manual field edits persist and are marked as manually edited
- ✅ Decision logging creates immutable record with real template version + source chunk IDs
- ✅ Cannot log decision with required fields empty
- ✅ Export works for both draft and logged decisions
- ✅ Field/template identity hardened (namespace + uniqueness + stable seed UUIDs)
- ✅ `IContentCreator` seam exists with AI adapter bound to current implementation
- ✅ Field provenance metadata supported without breaking existing draft_data consumers
- ✅ No-op coaching hook wired and verified non-disruptive

---

## Milestone 5: Web Interface

**Deliverable**: Browser-based UI for the full multi-decision workflow. Users manually flag multiple decisions from a meeting and jump between them, working on each independently. Requires completing the full API layer and migrating the CLI to API client mode. Expert and MCP endpoints exist as stubs only — full expert implementation is in M6.

**Note on auto-detection**: LLM-based auto-detection of implicit decisions is a post-M5 enhancement. M5 (like M1–M4) uses manual decision flagging. The web UI supports flagging multiple decisions and switching between them.

---

### M5.0 — Multi-Decision Workflow Foundation

Before the web UI, the API and CLI must support working on multiple decisions simultaneously within a single meeting — flagging several, then jumping between them to work on each independently.

**Already supported in services**: `FlaggedDecisionService` (list, prioritize), `DecisionContextService` (multiple contexts per meeting), `GlobalContextService` (set-active-decision). The gap is smooth CLI/API ergonomics for switching.

**Ensure the following work correctly**:
- Flag multiple decisions in one meeting: `decisions flag <meeting-id> --title "..."` (repeat for each)
- List all flagged decisions: `decisions list --meeting-id <id>` (shows status, draft state)
- Switch active decision: `context set-decision <flagged-id>` (loads existing `DecisionContext` if one exists)
- Each decision has its own isolated draft state, version history, and LLM interactions
- `draft show` always refers to the currently active decision context

**API endpoints** (confirm exist):
- `GET /api/meetings/:id/flagged-decisions` — list all flagged decisions for a meeting
- `GET /api/meetings/:id/decision-contexts` — list all draft contexts with status
- `GET /api/meetings/:id/summary` — aggregate stats (decision count, draft count, logged count)
- `GET /api/flagged-decisions/:id/context` — get the `DecisionContext` for a flagged decision (enables web UI "resume" flow)

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
- `POST /api/fields`, `PATCH /api/fields/:id`, `DELETE /api/fields/:id`
- `POST /api/templates`, `PATCH /api/templates/:id`, `DELETE /api/templates/:id`
- `POST /api/templates/:id/set-default`

**Validation**:
```bash
pnpm test:e2e   # Full API test suite passes
curl http://localhost:3000/docs  # OpenAPI spec UI renders all endpoints
curl http://localhost:3000/api/context  # Returns global context state
curl http://localhost:3000/api/meetings/<id>/summary  # Returns stats
```

---

### M5.2 — Modular Activation Gate (v1-safe)

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

---

### M5.5 — Web Frontend

**New**: `apps/web/` in monorepo (React + Vite, or Hono + htmx for minimal JS)

Key screens:
1. **Meeting list** — create/open meetings
2. **Transcript view** — upload, stream, view chunks with context tags
3. **Decision detection** — review auto-detected decisions, accept/dismiss/flag
4. **Draft editor** — field-by-field view with lock toggles, regenerate buttons, manual edit
5. **Expert consultation** — request advice from experts, view suggestions
6. **Decision log** — view finalized decisions, export markdown/JSON

Real-time: SSE or WebSocket for streaming LLM draft generation (show progress per field as it generates).

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
- ✅ Multiple decisions flagged and worked on independently within one meeting
- ✅ Switching between active decisions preserves independent draft state
- ✅ All API endpoints implemented (expert/MCP as stubs), tested, and in OpenAPI spec
- ✅ Modular activation gate passed (seams present; advanced v2 features still optional)
- ✅ `apps/cli` has zero `@repo/core` or `@repo/db` imports
- ✅ CLI works against local and remote API URLs
- ✅ Web UI: flag → draft → multi-decision switch → export full workflow
- ✅ Real-time draft generation streaming in web UI
- ✅ E2E test suite passes

---

## Milestone 6: Expert System + Decision Detection

**Deliverable**: Domain expert consultation (technical, legal, stakeholder) and LLM-assisted decision detection — both implemented within the same expert framework. The Decision Detector is the first expert, returning structured output. Other experts return rich free-text advice. No MCP required in this milestone.

**Why experts first, then detection**: The expert system provides the infrastructure (prompt personas, structured output, LLM interaction logging) that the Decision Detector reuses. Building experts first means detection gets a mature, tested foundation.

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
- Returns structured JSON: `Array<{ title, description, type, confidence, implicitType?, suggestedTemplate }>`
- Confidence threshold: >= 0.5 to include

**Seed**: Decision Detector expert inserted into `experts` table (name: `'decision-detector'`, domain: `'detection'`)

---

### M6.4 — Decision Detection Service

**New**: `packages/core/src/services/decision-detection-service.ts`

> **Note**: This is a **thin orchestration wrapper** — it contains no LLM calls of its own. All LLM inference goes through `ExpertService.consultStructured()`, which uses the Decision Detector expert persona. This is the expert-persona approach: the class exists purely to fetch transcript, build context, delegate to the expert, and persist `FlaggedDecision` records.

```typescript
export class DecisionDetectionService {
  constructor(
    private expertService: ExpertService,
    private transcriptService: TranscriptService,
    private flaggedDecisionService: FlaggedDecisionService,
  ) {}

  async detect(meetingId: string): Promise<FlaggedDecision[]>
  // 1. Fetch all transcript chunks for meeting
  // 2. Build context via PromptBuilder
  // 3. Call expertService.consultStructured('decision-detector', context, DetectionResultSchema)
  // 4. Filter to confidence >= 0.5
  // 5. Create FlaggedDecision records for each detected decision
  // 6. Return created FlaggedDecision[]
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
Result displays as a numbered list with confidence scores and suggested templates. User promotes specific ones: `decisions flag --from-detection <index>`.

**New API endpoint**:
- `POST /api/meetings/:id/detect-decisions` — runs detection, returns `FlaggedDecision[]`

**Web UI update**: "Detect Decisions" button on transcript view. Results shown with confidence scores; user selects which to promote.

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
# Expected: flags "I want alignment" as defer (confidence >= 0.5)

pnpm cli transcript upload test-cases/discussion-not-decision.json --meeting-id <id>
pnpm cli decisions detect --meeting-id <id>
# Expected: no decisions flagged

# Quality check
pnpm test:llm -- --grep="decision detection"
# Target: Precision > 0.80, Recall > 0.75, F1 > 0.77

# Observability: detection prompt visible
pnpm cli draft debug   # shows detection expert interaction in llm_interactions
```

### M6 Exit Criteria
- ✅ Expert consultation (technical, legal, stakeholder) returns domain-specific advice
- ✅ Decision Detector expert persona seeded and promptable
- ✅ Structured output: `detectDecisions()` returns typed `FlaggedDecision[]`
- ✅ Implicit decision patterns detected (defer, reject, redirect)
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
  — Invoke Decision Detector expert and return flagged decisions for review
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
pnpm db:push
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

## Deployment Considerations (unchanged)

Compatible with **Cloudflare Workers + Hyperdrive + managed Postgres** (Neon/Supabase) without schema changes. Not compatible with Cloudflare D1 (SQLite) due to `TEXT[]`, `JSONB`, and GIN indexes throughout the schema. pgvector available on Neon/Supabase when needed post-MVP.
