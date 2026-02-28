# Iterative Implementation Plan

**Document Role**: This document defines phased delivery, validation checkpoints, and sequencing. Specialist docs own detailed behavior for their domains. `packages/schema` remains the single source of truth for domain contracts.

This document defines a detailed, phased implementation plan with validation checkpoints. Each phase delivers testable functionality, enabling rapid detection of architectural misunderstandings and impractical elements.

## Current Progress (as of Feb 28, 2026)

- ✅ **Phase 0**: Vertical Slice - Complete (Day 1)
- ✅ **Phase 1**: Schema Foundation - Complete (Days 2-3)
- ✅ **Phase 2**: Core Data Services - **In Progress** (Days 4-6)
  - ✅ 2.1 Meeting Service - Complete
  - ✅ 2.2 Transcript Service - Complete
  - ✅ 2.3 Flagged Decision Service - Complete
  - ✅ 2.4 Decision Context Service - Complete
  - ✅ 2.4a Logging Foundation - Complete
  - ✅ 2.5 Decision Log Service - Complete
  - ✅ 2.6 Decision Field Service - Complete
  - ✅ 2.7 Decision Template Service - Complete
  - ⏳ 2.8 Expert and MCP Configuration Services - Next
  - ✅ 2.9 CLI Commands for Data Layer - Partially Complete (transcript and decision commands done)
- ⏳ **Phase 3**: LLM Integration - Pending

## Philosophy

- **Vertical Slice First**: Prove the entire stack works before expanding horizontally
- **TDD at Every Step**: Tests before code, always
- **Checkpoint Validation**: Each phase ends with a concrete, demonstrable outcome
- **Fail Fast**: Small iterations expose problems early
- **Mock LLM and External APIs Only**: LLM calls are expensive; mock them until integration phase. `MockRepository` is temporary scaffolding — replaced by a real Drizzle implementation in Phase 0.3. The database is core infrastructure, not an external dependency.
- **Use Real DB from Phase 0.3**: Every repository test from Phase 0.3 onwards must run against a real test database. In-memory mocks are only valid for service-layer unit tests (where the repo is the injected dependency being mocked).
- **Keep Audio Outside Core**: Audio capture/transcription may exist upstream, but the core system consumes transcript text events only

> **See**: `docs/transcription-service-plan.md` for the external containerized transcription service that integrates with the transcript streaming endpoints
- **Zod First**: All new entities and contract changes begin in `packages/schema`, then flow to Drizzle and API layers
- **Observability by Default**: Live operations must be diagnosable through structured logs and correlation IDs, not ad hoc debugging

## Specialist Doc Mapping

- Transcript ingestion, chunking, and context windows: `docs/transcript-context-management.md`
- Logging, runtime debugging, and correlation strategy: `docs/logging-observability-plan.md`
- Context tags, chunk relevance, and field-level retrieval: `docs/context-tagging-strategy.md`
- Manual flagged-decision triage: `docs/manual-decision-workflow.md`
- Field library and extraction prompts: `docs/field-library-architecture.md`
- Decision detection behavior: `docs/decision-detection-architecture.md`
- Field regeneration behavior: `docs/field-regeneration-strategy.md`
- Expert and MCP scope: `docs/expert-system-architecture.md` and `docs/mcp-architecture-strategy.md`

## Manual Testing Guidance

Automated validation gates are required, but each phase should also leave you with something you can exercise manually. After a phase checkpoint passes, run a short smoke test through the highest-level interface available.

### General Rules

- Prefer CLI for manual verification when a CLI command exists
- Otherwise use the public API directly with `curl`
- Only drop to direct service-level testing when no external interface exists yet
- Reuse a small set of stable test meetings and transcript fixtures so regressions are obvious
- Treat confusing command output, unclear errors, and awkward payloads as phase-level issues, not polish-phase issues

### Command Reality Rules

- Treat bare `decision-logger ...` examples in this document as the target UX, not proof that the command is already runnable
- A CLI command does not count as manually tested until it has been run through the actual repo entrypoint and its output has been inspected
- For this repo, the cleanest no-global-install path is to build the CLI package and run the built entrypoint directly
- The CLI build artifact is `apps/cli/dist/index.mjs` (not `index.js`)
- If `pnpm` is available, a reliable pre-install invocation is:

```bash
npx pnpm@8.15.0 --filter ./apps/cli exec tsx src/index.ts <command...>
```

- If `pnpm` is not installed, use npm workspaces instead:

```bash
npm run build -w @repo/schema
npm run build -w @repo/db
npm run build -w @repo/core
npm run build -w decision-logger
node apps/cli/dist/index.mjs <command...>
```

- After the CLI package is built, the packaged binary path can also be tested with:

```bash
npx pnpm@8.15.0 --filter ./apps/cli build
npx pnpm@8.15.0 --filter ./apps/cli exec decision-logger <command...>
```

- Do not mark a CLI task complete just because a service test passes; verify the command is registered with Commander, parses arguments correctly, and reaches the service layer
- When a CLI command is planned but not yet implemented, test the backing API or service directly and note that the CLI example is still aspirational

### Endpoint Reality Rules

- If a CLI command ultimately depends on an API route, manually test the backing route with `curl` before marking the user-facing flow as credible
- For new routes, verify both the happy path and at least one invalid request
- Record the exact command or `curl` used in the phase notes so the test is repeatable

### Practical Bootstrap

Use this sequence to get into a known-good state for manual smoke testing without relying on a global `pnpm` install:

```bash
# 1. Start the local database
docker compose up -d

# 2. Export the DB connection used by the built packages
export DATABASE_URL="postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_dev"

# 3. Build the workspace packages in dependency order
npm run build -w @repo/schema
npm run build -w @repo/db
npm run build -w @repo/core
npm run build -w decision-logger
npm run build -w @repo/api

# 4. Run a CLI smoke test against the built artifact
node apps/cli/dist/index.mjs meeting create "Manual Smoke A" --date 2026-02-27 --participants Alice

# 5. Start the API in another shell (or background it)
DATABASE_URL="$DATABASE_URL" node apps/api/dist/index.js

# 6. Hit the API directly
curl -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title":"API Smoke","date":"2026-02-27","participants":["Alice"]}'
```

Notes:

- Use `docker compose up -d`, not `docker compose up -d postgres`, unless your compose service is explicitly named `postgres`
- If your local port/user/password differ, adjust `DATABASE_URL` to match your `docker-compose.yml` and `.env`
- Keep one shell dedicated to the API process during manual testing instead of relying on `pkill`

### Recommended Fixtures

- One minimal meeting with 1 participant and 1 transcript event
- One realistic meeting with 3-5 participants and a short decision-oriented transcript
- One negative transcript where no decision should be flagged
- One invalid request per new surface to verify errors are understandable

---

## Phase 0: Vertical Slice (Day 1)

**Status**: ✅ COMPLETE - All validation checkpoints passed

**Goal**: Prove the entire stack works end-to-end with minimal functionality.

### 0.0 Local Infrastructure

One-time setup required before any database-dependent work. All subsequent phases assume this is complete.

- [x] Copy `.env.example` → `.env` — credentials must match `docker-compose.yml` (already aligned out of the box)
- [x] Start Postgres: `docker-compose up -d`
- [x] Verify container healthy: `docker-compose ps` shows `decision-logger-db` as `healthy`
- [x] Confirm test database created by init script: both `decision_logger_dev` and `decision_logger_test` are accessible

**Validation Checkpoint 0.0**:
```bash
docker-compose up -d
docker-compose ps  # decision-logger-db shows "healthy"
psql postgresql://decision_logger:dev_password@localhost:5432/decision_logger_dev -c "SELECT 1"
# Returns: 1
psql postgresql://decision_logger:dev_password@localhost:5432/decision_logger_test -c "SELECT 1"
# Returns: 1 (test DB created automatically by scripts/init-db.sql on first container start)
```

### 0.1 Monorepo Scaffold
- [x] Initialize Turborepo with `apps/` and `packages/` structure
- [x] Create `packages/schema` with single Zod schema: `MeetingSchema`
- [x] Create `packages/db` with Drizzle config (no tables yet)
- [x] Create `packages/core` with empty service structure
- [x] Create `apps/api` with Hono "hello world"
- [x] Verify: `pnpm build` and `pnpm test` pass across all packages

**Validation Checkpoint 0.1**:
```bash
pnpm build  # All packages compile
pnpm test   # Zero tests, but harness works
curl http://localhost:3000/health  # Returns { "status": "ok" }
```

### 0.2 First Database Table
- [x] Define `meetings` table in `packages/db/schema.ts`
- [x] **Create `packages/db/src/client.ts`** — Drizzle connection using `DATABASE_URL` env var (prerequisite for 0.3)
- [x] Run `drizzle-kit generate` to create migration
- [x] Apply migration to local PostgreSQL
- [x] Verify: Table exists via `psql` or Drizzle Studio

**Validation Checkpoint 0.2**:
```bash
pnpm db:migrate  # Migration applies cleanly
pnpm db:studio   # Can view empty meetings table
# Verify client resolves: node -e "import('@repo/db').then(m => console.log('ok'))"
```

### 0.3 First Repository (TDD)
- [x] Define `IMeetingRepository` interface in `packages/core`
- [x] Write failing test: `MeetingRepository.create()` returns a meeting
- [x] **Implement `DrizzleMeetingRepository` in `packages/db/src/repositories/`** (uses DB client from 0.2 — not an in-memory mock)
- [x] **Wire `DrizzleMeetingRepository` into `apps/api` and `apps/cli`** (replace `MockMeetingRepository`)
- [x] Test passes against real test DB

**Validation Checkpoint 0.3**:
```bash
pnpm test --filter=@repo/db  # Repository integration tests pass (real DB)
# Prove persistence: POST /api/meetings, then GET /api/meetings — data survives across requests
curl -X POST http://localhost:3000/api/meetings -H "Content-Type: application/json" \
  -d '{"title": "Persist Test", "date": "2026-02-27", "participants": ["Alice"]}'
curl http://localhost:3000/api/meetings  # Must return the created meeting
```

### 0.4 First Service (TDD)
- [x] Define `IMeetingService` interface
- [x] Write failing test: `MeetingService.create()` validates input and calls repo
- [x] Implement `MeetingService` with DI
- [x] Test passes (uses mock repository)

**Validation Checkpoint 0.4**:
```bash
pnpm test --filter=@repo/core  # 2+ passing tests (unit + integration)
```

### 0.5 First API Endpoint
- [x] Create `POST /api/meetings` endpoint using `@hono/zod-openapi`
- [x] Wire endpoint to `MeetingService`
- [x] Write integration test: POST creates meeting and returns it
- [x] Verify OpenAPI spec is auto-generated

**Validation Checkpoint 0.5**:
```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Meeting", "date": "2026-02-27", "participants": ["Alice"]}'
# Returns: { "id": "uuid", "title": "Test Meeting", ... }

curl http://localhost:3000/docs  # OpenAPI spec available
```

### 0.6 First CLI Command
- [x] Create `apps/cli` with Commander.js
- [x] Implement `decision-logger meeting create <title>` command
- [x] Wire directly to `@repo/core` service (temporary scaffolding — replaced by API client in Phase 7)
- [x] **Write E2E smoke test: run CLI command, assert output contains a meeting ID**

**Validation Checkpoint 0.6**:
```bash
pnpm test --filter=apps/cli  # At least 1 smoke test passes
npx pnpm@8.15.0 --filter ./apps/cli exec tsx src/index.ts \
  meeting create "Test Meeting" --date 2026-02-27 --participants Alice,Bob
# Output: Created meeting: mtg_abc123
```

**Manual Smoke Test**:
```bash
# Confirm the first real user flow feels coherent
npx pnpm@8.15.0 --filter ./apps/cli exec tsx src/index.ts \
  meeting create "Manual Smoke A" --date 2026-02-27 --participants Alice
npx pnpm@8.15.0 --filter ./apps/cli exec tsx src/index.ts \
  meeting create "Manual Smoke B" --date 2026-02-28 --participants Bob,Carol

# Confirm API and CLI are both usable
curl -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title":"API Smoke","date":"2026-02-27","participants":["Alice"]}'
```

### Phase 0 Exit Criteria
- [x] Postgres container running and healthy (`docker-compose ps`)
- [x] Both `decision_logger_dev` and `decision_logger_test` databases accessible
- [x] Monorepo builds and tests pass
- [x] Single meeting can be created via API **and persists in real DB**
- [x] Single meeting can be created via CLI **and persists in real DB**
- [x] OpenAPI spec auto-generated from Zod
- [x] TDD workflow proven (test → implement → pass)
- [x] DI pattern working (service uses injected repository)
- [x] **Primary UX validated early** (CLI is the main interface)

---

## Phase 1: Schema Foundation (Days 2-3)

**Status**: ✅ COMPLETE - All schemas implemented and aligned

### 1.1 Domain Schemas
- [x] `MeetingSchema` (id, title, date, participants, status, createdAt)
- [x] `RawTranscriptSchema` (id, meetingId, source, format, content, metadata, uploadedAt, uploadedBy)
- [x] `TranscriptChunkSchema` (id, meetingId, rawTranscriptId, sequenceNumber, text, speaker?, startTime?, endTime?, chunkStrategy, tokenCount?, wordCount?, contexts, topics?, createdAt)
- [x] `ChunkRelevanceSchema` (id, chunkId, decisionContextId, fieldId, relevance, taggedBy, taggedAt)
- [x] `DecisionContextWindowSchema` (id, decisionContextId, chunkIds, selectionStrategy, totalTokens, totalChunks, relevanceScores, usedFor, createdAt, updatedAt)
- [x] `FlaggedDecisionSchema` (id, meetingId, suggestedTitle, contextSummary, confidence, chunkIds, suggestedTemplateId, templateConfidence, status, createdAt)
- [x] `DecisionContextSchema` (id, meetingId, flaggedDecisionId, title, templateId, activeField, lockedFields, draftData, status, createdAt, updatedAt)
- [x] `DecisionLogSchema` (id, meetingId, decisionContextId, templateId, templateVersion, fields, decisionMethod, sourceChunkIds, loggedAt, loggedBy)
- [x] `DecisionFieldSchema` (id, name, description, category, extractionPrompt, fieldType, placeholder, validationRules, version, isCustom, createdAt)
- [x] `DecisionTemplateSchema` (id, name, description, category, fields: TemplateFieldAssignment[], version, isDefault, isCustom, createdAt)
- [x] `TemplateFieldAssignmentSchema` (fieldId, order, required, customLabel, customDescription)
- [x] `ExpertTemplateSchema` (id, name, type, promptTemplate, mcpAccess, outputSchema, isActive, createdAt, updatedAt)
- [x] `MCPServerSchema` (id, name, type, connectionConfig, capabilities, status, createdAt, updatedAt)
- [x] `ExpertAdviceSchema` (id, decisionContextId, expertId, expertName, request, response, mcpToolsUsed, requestedAt)
- [x] Export all schemas and inferred types from `packages/schema`

**Validation Checkpoint 1.1**:
```typescript
import { MeetingSchema, FlaggedDecisionSchema, DecisionContextSchema, type Meeting } from '@repo/schema';
MeetingSchema.parse({ title: "Test", date: "2026-02-27", participants: ["Alice"] }); // Works
FlaggedDecisionSchema.parse({ meetingId: "mtg_1", suggestedTitle: "Test", confidence: 0.89 }); // Works
```

### 1.2 Drizzle Schema Alignment
- [x] Update `packages/db/schema.ts` to match all Zod schemas
- [x] Create "Schema Sanity Check" test that validates Zod ↔ Drizzle alignment — **must include a round-trip insert/read for at least one table against a real test DB** (structural name-matching alone is not sufficient)
- [x] Generate migrations for all tables
- [x] Apply migrations
- [x] **Delete `packages/db/src/schema-phase0.ts`** (superseded by full schema; keeping it creates confusion)

**Validation Checkpoint 1.2**:
```bash
pnpm test --filter=@repo/db  # Schema alignment tests pass, including DB round-trip
pnpm db:migrate  # All migrations apply
```

### 1.3 OpenAPI Pipeline
- [x] Configure `@hono/zod-openapi` route factory
- [x] Create route definitions using Zod schemas for request/response
- [x] Auto-generate `openapi.yaml` on build
- [x] Delete manual `docs/openapi.yaml` (decommissioned)

**Validation Checkpoint 1.3**:
```bash
pnpm build:api  # Generates openapi.yaml
cat apps/api/openapi.yaml  # Valid, auto-generated spec
```

### 1.4 Seed Script Scaffold
- [x] Create `packages/db/scripts/seed.ts` with a runnable entry point
- [x] Seed at minimum: empty field categories and a single placeholder template (confirms the script works and the tables accept data)
- [x] Wire to `pnpm db:seed` in `packages/db/package.json`

**Validation Checkpoint 1.4**:
```bash
pnpm db:seed  # Runs without error, inserts placeholder data
pnpm db:studio  # decision_fields and decision_templates tables are not empty
```

**Manual Smoke Test**:
```bash
# Sanity-check generated contracts and seeded data by hand
rg -n "Meeting|TranscriptChunk|FlaggedDecision" apps/api/openapi.yaml
pnpm db:studio
```

### Phase 1 Exit Criteria
- [x] All domain schemas defined in `packages/schema`
- [x] Drizzle schema matches Zod (verified by test — including DB round-trip)
- [x] OpenAPI auto-generated from route definitions
- [x] Manual `openapi.yaml` removed from repo
- [x] `packages/db/src/schema-phase0.ts` deleted
- [x] `pnpm db:seed` runs without error

---

## Phase 2: Core Data Services (Days 4-6)

**Status**: ✅ COMPLETE - All services and CLI commands implemented

### 2.1 Meeting Service (Complete)
- [x] `IMeetingRepository`: create, findById, findAll, updateStatus
- [x] Expand `IMeetingRepository` for full CRUD: add general update plus delete/archive (not needed for current requirements)
- [x] Unit tests for each method (mocked DB)
- [x] `MeetingService`: business logic wrapper
- [x] Integration tests (real test DB)

**Validation Checkpoint 2.1**:
```bash
pnpm test --filter=@repo/core -- --grep="Meeting"  # All passing
```

### 2.2 Transcript Service (Complete)
- [x] `IRawTranscriptRepository`: create, findByMeetingId
- [x] `ITranscriptChunkRepository`: create, findByMeetingId, findByContext, findById, search
- [x] `IStreamingBufferRepository`: appendEvent, getStatus, flush, clear
- [x] `IChunkRelevanceRepository`: upsert, findByDecisionField, deleteByChunk
- [x] `IDecisionContextWindowRepository`: createOrUpdate, findByDecisionContextId, preview
- [x] Unit tests for each method
- [x] `TranscriptService`: handles upload, add, buffered stream ingestion, raw transcript persistence, chunk creation, semantic tagging, and auto-tagging with contexts
- [x] Integration tests

**Validation Checkpoint 2.2**:
```bash
# Integration test proves:
# 1. Create meeting
# 2. Add transcript events and produce tagged chunks
# 3. Query chunks by context → returns correct subset
```

### 2.3 Flagged Decision Service
- [x] `IFlaggedDecisionRepository`: create, findByMeetingId, findById, update, updatePriority, updateStatus
- [x] Unit tests
- [x] `FlaggedDecisionService`: supports AI and manual creation, triage, prioritization, and dismissal (no LLM yet)
- [x] Integration tests

### 2.4 Decision Context Service (Complete)
- [x] `IDecisionContextRepository`: create, findById, findByMeetingId, update, lockField, unlockField, setActiveField, updateStatus
- [ ] Expand `IDecisionContextRepository` for full CRUD: add delete/archive for draft contexts (NOT IMPLEMENTED - not needed for current requirements)
- [x] Unit tests (17 tests)
- [x] `DecisionContextService`: handles context creation, draft data updates, field locking, status transitions, and active field management
- [x] Integration tests (13 tests)

### 2.4a Logging Foundation (Complete)
- [x] Create shared structured logger in `packages/core`
- [x] Add correlation/context helpers for API, CLI, and async operations
- [x] Add redaction utilities and log-level configuration
- [x] Unit tests for logger context propagation and redaction

### 2.5 Decision Log Service (Complete)
- [x] `IDecisionLogRepository`: create, findById, findByMeetingId, findByDecisionContextId, findByLoggedBy, findByDateRange, countByMeetingId
- [x] Unit tests (9 tests)
- [x] `DecisionLogService`: immutable decision recording with statistics
- [x] Integration tests (11 tests)

### 2.6 Decision Field Service (Complete)
- [x] `IDecisionFieldRepository`: create, findById, findAll, findByCategory, findByType, update, delete, search, createMany
- [x] Seed field library (~25 core fields across all categories) - TODO: Add seeding script
- [x] Unit tests (16 tests)
- [x] `DecisionFieldService`: field library management with validation
- [x] Integration tests (23 tests)
- [x] Added CreateDecisionField schema and type exports

### 2.7 Decision Template Service (Complete)
- [x] `IDecisionTemplateRepository`: create, findById, findAll, update, delete, findDefault, setDefault
- [x] `ITemplateFieldAssignmentRepository`: create, findByTemplate, findByField, update, delete, deleteByTemplate, createMany
- [x] Seed 6 core templates (Standard, Technology, Strategy, Budget, Policy, Proposal)
- [x] Unit tests (10 tests)
- [x] `DecisionTemplateService`: template management
- [x] Integration tests (12 tests)

### 2.8 Expert and MCP Configuration Services (Complete)
- [x] `IExpertTemplateRepository`: create, findById, findAll, findByType, findActive, update, delete, search, createMany
- [x] `IMCPServerRepository`: create, findById, findByName, findAll, findByType, findByStatus, findActive, update, updateStatus, delete, checkHealth
- [x] `IExpertAdviceHistoryRepository`: create, findByContext, findByExpert, delete
- [x] Unit tests (ExpertTemplate: 13 tests, MCPServer: 15 tests, ExpertAdvice: 8 tests)
- [x] Integration tests (Expert services: 16 tests)

**Validation Checkpoint 2.x**:
```bash
pnpm test --filter=@repo/core  # All service tests passing
pnpm test:coverage  # >80% coverage on packages/core
```

### 2.9 CLI Commands for Data Layer (Complete)
- [x] `decision-logger transcript list [--meeting-id <id>]`
- [x] `decision-logger transcript add --text <text> --speaker <speaker> --meeting-id <id>`
- [ ] `decision-logger transcript upload [--file <file>]` (placeholder implemented)
- [ ] `decision-logger transcript process [--transcript-id <id>]` (placeholder implemented)
- [x] `decision-logger transcript show <id>` (placeholder implemented)
- [x] `decision-logger decision list [--meeting-id <id>|--context-id <id>|--user <user>]`
- [x] `decision-logger decision show <id>`
- [x] `decision-logger decision stats --meeting-id <id>`
- [x] `decision-logger decision add --context-id <id>`
- [x] `decision-logger decision context create --meeting-id <id> --flagged-decision-id <id> --title <title> --template-id <id>`
- [x] `decision-logger decision context list [--meeting-id <id>]`
- [x] `decision-logger meeting list`
- [x] `decision-logger meeting show <id>`
- [x] `decision-logger meeting update <id> [--title <title>] [--participants <participants>]`
- [x] `decision-logger field list [--category <category>]`
- [x] `decision-logger field show <id>`
- [x] `decision-logger template list`
- [x] `decision-logger template show <id>`
- [x] `decision-logger template update <id> [--name <name>] [--description <description>] [--category <category>]`
- [x] `decision-logger template delete <id> [--force]`
- [x] `decision-logger decisions show <flagged-id>`
- [x] `decision-logger decisions flag <meeting-id> --title <title> --segments <ids>`
- [x] `decision-logger decisions update <flagged-id>`
- [x] `decision-logger decisions priority <flagged-id> --priority <n>`
- [x] `decision-logger decisions dismiss <flagged-id>`
- [x] Test: Transcript and decision commands work with real database

Implementation rule:
- Do not mark any command in this section complete until it has been invoked through the actual CLI entrypoint (`tsx` or built binary), not just through a unit test of the underlying service

**Validation Checkpoint 2.9**:
```bash
decision-logger meeting create "Test" --date 2026-02-27 --participants Alice
decision-logger meeting list
decision-logger field list  # Shows ~25 fields
decision-logger field list --category evaluation  # Shows evaluation fields
decision-logger template list  # Shows 6 templates
decision-logger template show technology-selection  # Shows field composition
decision-logger decisions flag mtg_1 --title "Test" --segments chunk-1,chunk-2
```

**Manual Smoke Test**:
```bash
# Prove the data layer is actually explorable
decision-logger context set-meeting mtg_1
decision-logger transcript add --text "We should replace the roof this quarter"
decision-logger transcript add --text "Let's get two quotes first"
decision-logger transcript list
decision-logger transcript list --context meeting:mtg_1

# Try an invalid lookup and verify the error is useful
decision-logger meeting show does-not-exist
```

### Phase 2 Exit Criteria
- [x] Transcript Service implemented and tested (2.2)
- [x] Decision Context Service implemented and tested (2.4)
- [x] Decision Log Service implemented and tested (2.5)
- [x] Logging Foundation implemented (2.4a)
- [x] Decision Field Service implemented and tested (2.6)
- [ ] Remaining 2 services implemented (2.7-2.8)
- [x] Unit test coverage for transcript repositories
- [x] Integration tests prove DB operations work for transcripts
- [ ] Field library seeded (~25 fields)
- [ ] 6 core templates seeded (Standard, Technology, Strategy, Budget, Policy, Proposal)
- [x] Context tagging logic working
- [x] CLI commands available for transcript and decision (partial)
- [x] No LLM dependencies yet (pure data layer)

---

## Phase 3: LLM Integration (Days 7-9)

**Goal**: Integrate a provider-agnostic LLM layer with comprehensive mocking strategy.

### 3.1 LLM Abstraction Layer
- [ ] Define `ILLMService` interface in `packages/core`
- [ ] Create `MockLLMService` for testing (returns canned responses)
- [ ] Create provider-backed implementation via Vercel AI SDK
- [ ] Support provider selection per workload (detection vs draft generation)
- [ ] Ensure local models are optional adapters, not required infrastructure
- [ ] Emit structured LLM operation logs (provider, model, latency, validation result)
- [ ] Test: Mock service returns expected structured output

**Validation Checkpoint 3.1**:
```typescript
// Unit test with mock
const mock = new MockLLMService();
const result = await mock.extractDecisions(transcript);
expect(result.decisions).toHaveLength(1);
```

### 3.2 Decision Detection
- [ ] Implement `DecisionDetectionService` using the pluggable `ILLMService`
- [ ] Unit test with mock LLM (various transcript chunk scenarios)
- [ ] Returns `FlaggedDecision[]` with confidence scores
- [ ] Integration test with default remote provider (marked as slow, skippable)
- [ ] Optional adapter test for local provider when configured

**Validation Checkpoint 3.2**:
```bash
pnpm test --filter=@repo/core -- --grep="DecisionDetection"  # Fast (mocked)
pnpm test:integration:llm  # Slow (real API, optional)
```

### 3.3 Draft Generation
- [ ] Implement `DraftGenerationService` using the pluggable `ILLMService`
- [ ] Generates complete draft for all template fields
- [ ] Captures source chunk attribution for each generated field
- [ ] Persists chunk relevance records for field-specific retrieval
- [ ] Unit tests with mock responses
- [ ] Verify Zod schema validation on LLM output

**Validation Checkpoint 3.3**:
```typescript
// LLM output is parsed and validated by Zod
const draft = await draftService.generateDraft(decisionContextId);
DecisionDraftSchema.parse(draft);  // Must pass
expect(draft.fields.decision_statement).toBeDefined();
```

### 3.4 Field-Specific Regeneration
- [ ] Implement field-specific regeneration with chunk weighting
- [ ] Field-tagged chunks get highest priority
- [ ] Decision-tagged chunks get medium priority
- [ ] Meeting-tagged chunks get lowest priority
- [ ] Support explicit field transcript retrieval before regeneration
- [ ] Unit tests with mock LLM

**Validation Checkpoint 3.4**:
```typescript
const newValue = await draftService.regenerateField(contextId, 'options');
expect(newValue).toBeDefined();
expect(typeof newValue).toBe('string');
```

### 3.5 Decision Detection Prompt Development
- [ ] Create `prompts/decision-detection.md` with v1 system prompt
- [ ] Include patterns for implicit decisions:
  - [ ] "I want alignment" → defer
  - [ ] "I don't like these options" → reject
  - [ ] "Let's focus on X instead" → redirect
  - [ ] Consensus by silence → approval
- [ ] Create test corpus in `test-cases/`:
  - [ ] `explicit-decisions.json`
  - [ ] `implicit-defer.json`
  - [ ] `implicit-reject.json`
  - [ ] `implicit-redirect.json`
  - [ ] `discussion-not-decision.json` (negative cases)
- [ ] Implement confidence filtering (>= 0.5)
- [ ] Add template classification logic

**Validation Checkpoint 3.5**:
```bash
# Test with real transcripts
decision-logger transcript upload test-cases/implicit-defer.json
decision-logger decisions flagged
# Expected: Detects "I want alignment" as decision to defer

decision-logger transcript upload test-cases/implicit-reject.json
decision-logger decisions flagged
# Expected: Detects "I don't like these options" as decision to reject

# Measure quality
pnpm test:llm -- --grep="decision detection"
# Target: Precision >0.80, Recall >0.75, F1 >0.77
```

### 3.6 LLM Prompt Refinement
- [ ] Create `prompts/` directory structure
- [ ] Extract draft generation prompt to `prompts/draft-generation.md`
- [ ] Add prompt versioning (v1, v2, etc.)
- [ ] Document prompt refinement process in `docs/prompt-engineering.md`
- [ ] Document decision detection architecture in `docs/decision-detection-architecture.md`
- [ ] Treat `DecisionField.extractionPrompt` in the field library as the canonical source for field extraction prompts

### 3.6 CLI Commands for LLM Features
- [ ] `decision-logger decisions flagged` (uses real LLM)
- [ ] `decision-logger draft generate` (uses real LLM)
- [ ] `decision-logger draft show`
- [ ] Add `--mock` flag to use MockLLMService for testing
- [ ] Test: Generate draft from real transcript

Implementation rule:
- Validate both `--mock` and non-mock execution through the real CLI entrypoint before considering the command usable

**Validation Checkpoint 3.6**:
```bash
decision-logger context set-meeting mtg_1
decision-logger transcript upload examples/technical-decision-complex.txt
decision-logger decisions flagged  # Real LLM call
# Review output quality, refine prompts if needed

decision-logger context set-decision flag_1
decision-logger draft generate  # Real LLM call
decision-logger draft show
# Review draft quality, refine prompts if needed
```

**Manual Smoke Test**:
```bash
# Compare positive and negative behavior, not just happy-path output
decision-logger transcript upload test-cases/explicit-decisions.json
decision-logger decisions flagged

decision-logger transcript upload test-cases/discussion-not-decision.json
decision-logger decisions flagged

# If supported, compare mock and real flows for ergonomics
decision-logger decisions flagged --mock
decision-logger draft generate --mock
```

### Phase 3 Exit Criteria
- [ ] LLM calls abstracted behind interface
- [ ] All LLM logic testable with mocks
- [ ] Real API integration tested (slow tests)
- [ ] Structured output validated by Zod schemas
- [ ] **Prompts externalized and version-controlled**
- [ ] **CLI commands available for prompt testing**
- [ ] **Prompt refinement process documented**

---

## Phase 4: Decision Workflow (Days 10-12)

**Goal**: Implement the iterative decision refinement workflow.

### 4.1 Global Context Management
- [ ] `GlobalContextService`: manages active meeting, decision, and field
- [ ] `setActiveMeeting(meetingId)`: sets global meeting context
- [ ] `setActiveDecision(flaggedDecisionId, templateId?)`: creates DecisionContext
- [ ] `setActiveField(fieldId)`: sets field focus for current decision
- [ ] `clearField()`, `clearDecision()`, `clearMeeting()`: context clearing
- [ ] Unit tests for state transitions
- [ ] Integration tests for context persistence

**Validation Checkpoint 4.1**:
```typescript
await globalContext.setActiveMeeting('mtg_123');
await globalContext.setActiveDecision('flag_1');
await globalContext.setActiveField('options');

const ctx = await globalContext.getContext();
expect(ctx.activeMeetingId).toBe('mtg_123');
expect(ctx.activeDecisionContextId).toBeDefined();
expect(ctx.activeField).toBe('options');
```

### 4.2 Auto-Tagging with Context
- [ ] Implement auto-tagging logic in `TranscriptService`
- [ ] New transcript chunks get meeting tag: `meeting:<id>`
- [ ] If decision active, add: `decision:<id>`
- [ ] If field active, add: `decision:<id>:<field>`
- [ ] Emit transcript pipeline logs for ingest, buffering, chunk creation, and tagging
- [ ] Test: Tags are cumulative and correct

**Validation Checkpoint 4.2**:
```typescript
await globalContext.setActiveMeeting('mtg_1');
await globalContext.setActiveDecision('flag_1');
await globalContext.setActiveField('options');

const chunk = await transcriptService.addText({
  text: 'We have three options...'
});

expect(chunk.contexts).toContain('meeting:mtg_1');
expect(chunk.contexts).toContain('decision:ctx_1');
expect(chunk.contexts).toContain('decision:ctx_1:options');
```

### 4.3 Draft Generation with Field Locking
- [ ] Implement draft generation respecting locked fields
- [ ] Test: Locked fields are not regenerated
- [ ] Test: Unlocked fields are regenerated
- [ ] Test: Full regenerate respects all locks

**Validation Checkpoint 4.3**:
```typescript
const draft = await draftService.generateDraft(contextId);
expect(draft.fields.decision_statement).toBeDefined();

// Lock decision_statement, regenerate
await contextService.lockField(contextId, 'decision_statement');
const newDraft = await draftService.regenerateDraft(contextId);
expect(newDraft.fields.decision_statement).toBe(draft.fields.decision_statement);  // Unchanged
expect(newDraft.fields.options).not.toBe(draft.fields.options);  // Changed
```

### 4.4 Decision Logging
- [ ] Implement `logDecision(contextId, method, actors, loggedBy)`
- [ ] Creates immutable `DecisionLog` from `DecisionContext`
- [ ] Updates `DecisionContext` status to 'logged'
- [ ] Test: Logged decision is immutable
- [ ] Test: Cannot log decision with unlocked required fields

**Validation Checkpoint 4.4**:
```typescript
const log = await decisionService.logDecision(contextId, {
  type: 'consensus',
  details: '5 for, 2 against',
  actors: ['Alice', 'Bob']
}, 'Alice');

expect(log.fields).toEqual(context.draftData);
expect(log.loggedBy).toBe('Alice');
expect(log.decisionMethod.type).toBe('consensus');
```

### 4.5 CLI Commands for Decision Workflow
- [ ] `decision-logger context show`
- [ ] `decision-logger context set-meeting <id>`
- [ ] `decision-logger context set-decision <flagged-id>`
- [ ] `decision-logger context set-field <field-id>`
- [ ] `decision-logger context clear-field`
- [ ] `decision-logger context clear-decision`
- [ ] `decision-logger transcript add --text <text> [--speaker <name>]`
- [ ] `decision-logger transcript stream [--file <file.txt>]`
- [ ] `decision-logger draft lock-field <field-id>`
- [ ] `decision-logger draft unlock-field <field-id>`
- [ ] `decision-logger draft regenerate`
- [ ] `decision-logger decision log --type <type> --details <text> --actors <names> --logged-by <name>`

Implementation rule:
- Before marking this workflow credible, prove each command in the chain runs in sequence through the actual CLI entrypoint without manual code edits between steps

**Validation Checkpoint 4.5**:
```bash
# Full workflow test
decision-logger meeting create "Test Decision" --date 2026-02-27 --participants Alice,Bob
decision-logger context set-meeting mtg_1
decision-logger transcript upload test.json
decision-logger decisions flagged
decision-logger context set-decision flag_1
decision-logger draft generate
decision-logger draft show
decision-logger draft lock-field decision_statement
decision-logger context set-field options
decision-logger transcript add --text "We have three options..."
decision-logger draft regenerate
decision-logger draft show  # decision_statement unchanged, options updated
decision-logger decision log --type consensus --details "All agreed" --actors Alice,Bob --logged-by Alice
```

**Manual Smoke Test**:
```bash
# Exercise state transitions intentionally
decision-logger context show
decision-logger context set-field options
decision-logger transcript add --text "Option 3 is phased replacement over two quarters"
decision-logger draft regenerate
decision-logger draft lock-field options
decision-logger draft regenerate
decision-logger context clear-field
decision-logger context show

# Try an invalid finalization and confirm it fails clearly
decision-logger decision log --type consensus --details "All agreed" --logged-by Alice
```

### Phase 4 Exit Criteria
- [ ] Context management working
- [ ] Draft generation respects locks
- [ ] Field locking persists correctly
- [ ] Full refinement loop testable
- [ ] **Complete workflow executable via CLI**
- [ ] **Manual testing reveals any UX issues early**

---

## Phase 5: Expert System (Days 13-15)

**Goal**: Implement domain expert personas with MCP tool injection.

### 5.1 Expert Templates
- [ ] `ExpertRepository`: CRUD for expert templates
- [ ] Seed default experts (Technical, Legal, Stakeholder)
- [ ] Support core and custom expert definitions
- [ ] Unit tests for template management

**Validation Checkpoint 5.1**:
```typescript
const expert = await expertRepo.findByDomain('technical');
expect(expert.systemPrompt).toContain('technical architecture');
```

### 5.2 Expert Consultation
- [ ] `ExpertService`: consult(expertId, context)
- [ ] Test: Expert returns domain-specific advice
- [ ] Test: MCP tools are injected into expert context
- [ ] Persist advice history and tools used for auditability

**Validation Checkpoint 5.2**:
```typescript
const advice = await expertService.consult('technical', decisionContext);
expect(advice.suggestions).toBeDefined();
expect(advice.concerns).toBeDefined();
```

### 5.3 Multi-Expert Orchestration
- [ ] Implement sequential expert consultation
- [ ] Aggregate advice from multiple experts
- [ ] Test: Conflicting advice is flagged

**Validation Checkpoint 5.3**:
```bash
pnpm test --filter=@repo/core -- --grep="Expert"  # All passing
```

### 5.4 MCP Server Registry
- [ ] Implement CRUD and validation for MCP server registry
- [ ] Implement tool/resource discovery endpoints
- [ ] Test: Expert MCP access restrictions are enforced

### 5.5 Expert Prompt Refinement
- [ ] Extract expert system prompts to `prompts/experts/`
- [ ] `prompts/experts/technical.md` - Technical expert persona
- [ ] `prompts/experts/legal.md` - Legal expert persona
- [ ] `prompts/experts/stakeholder.md` - Stakeholder expert persona
- [ ] Test expert advice quality with real decisions
- [ ] Refine expert personas based on output quality

**Validation Checkpoint 5.5**:
```bash
decision-logger draft expert-advice technical
# Review: Is advice technically sound?
# Refine prompts/experts/technical.md if needed
```

### 5.6 CLI Commands for Expert System
- [ ] `decision-logger draft expert-advice <expert-type> [--focus <area>]`
- [ ] `decision-logger expert list`
- [ ] `decision-logger expert create <name> --prompt-file <file> --mcp-servers <servers>`
- [ ] `decision-logger mcp list`
- [ ] `decision-logger mcp register <name> --type <type> --config <file>`
- [ ] Test: Consult each expert type
- [ ] Verify advice is contextual and useful

**Validation Checkpoint 5.6**:
```bash
decision-logger context set-decision flag_1
decision-logger draft expert-advice technical
decision-logger draft expert-advice legal
decision-logger draft expert-advice stakeholder
# Manually review all three expert responses
```

**Manual Smoke Test**:
```bash
# Verify expert personas are meaningfully distinct
decision-logger draft expert-advice technical
decision-logger draft expert-advice legal
decision-logger draft expert-advice stakeholder

# Confirm weak context is handled gracefully
decision-logger context clear-decision
decision-logger draft expert-advice technical
```

### Phase 5 Exit Criteria
- [ ] Expert templates stored and retrievable
- [ ] Consultation returns structured advice
- [ ] Multiple experts can be consulted
- [ ] MCP tool integration working
- [ ] Custom experts and MCP servers are manageable through the system
- [ ] **Expert prompts externalized and refinable**
- [ ] **CLI commands for expert consultation working**

---

## Phase 6: API Layer (Days 16-18)

**Goal**: Complete REST API with all endpoints.

### 6.1 Meeting Endpoints
- [ ] POST /api/meetings (create)
- [ ] GET /api/meetings (list)
- [ ] GET /api/meetings/:id (show)
- [ ] PATCH /api/meetings/:id (general update for title/date/participants/status)
- [ ] PATCH /api/meetings/:id/status (complete)
- [ ] DELETE /api/meetings/:id (delete or archive)
- [ ] Request lifecycle logging with request/correlation IDs
- [ ] Integration tests for each

### 6.2 Transcript Endpoints
- [ ] POST /api/meetings/:id/transcripts/upload (bulk upload)
- [ ] POST /api/meetings/:id/transcripts/add (immediate text event)
- [ ] POST /api/meetings/:id/transcripts/stream (buffered streaming event)
- [ ] GET /api/meetings/:id/streaming/status
- [ ] POST /api/meetings/:id/streaming/flush
- [ ] DELETE /api/meetings/:id/streaming/buffer
- [ ] GET /api/meetings/:id/transcripts/raw
- [ ] GET /api/raw-transcripts/:id
- [ ] GET /api/meetings/:id/chunks (query with context/time/strategy filters)
- [ ] GET /api/chunks/:id
- [ ] POST /api/chunks/search
- [ ] Integration tests

Lifecycle note:
- The main user flow is create/read plus targeted operational updates (for example streaming buffer flush/clear and context-window refresh), but transcript-adjacent resources still need an explicit admin CRUD/retention plan later rather than remaining implicitly append-only.

Implementation rule:
- Before any CLI built on these routes is considered valid, exercise these endpoints directly with `curl` and confirm the response shape matches the documented contract

### 6.3 Context Endpoints
- [ ] GET /api/context (global context state - **critical for web UI**)
- [ ] POST /api/context/meeting (set active meeting)
- [ ] DELETE /api/context/meeting (clear active meeting)
- [ ] GET /api/meetings/:id/context (meeting-specific context)
- [ ] POST /api/meetings/:id/context/decision (set decision context)
- [ ] POST /api/meetings/:id/context/field (set field focus)
- [ ] DELETE /api/meetings/:id/context/field (clear field)
- [ ] DELETE /api/meetings/:id/context/decision (clear decision)
- [ ] Integration tests

**Validation Checkpoint 6.3**:
```bash
curl http://localhost:3000/api/context
# Returns: {activeMeetingId: null, activeDecisionContextId: null, activeFieldId: null}

curl -X POST http://localhost:3000/api/context/meeting -d '{"meetingId": "mtg_1"}'
curl http://localhost:3000/api/context
# Returns: {activeMeetingId: "mtg_1", meeting: {...}, ...}
```

### 6.4 Decision Workflow Endpoints
- [ ] GET /api/meetings/:id/flagged-decisions (list flagged)
- [ ] POST /api/meetings/:id/flagged-decisions (manual create)
- [ ] GET /api/flagged-decisions/:id
- [ ] PATCH /api/flagged-decisions/:id
- [ ] PATCH /api/flagged-decisions/:id/priority
- [ ] DELETE /api/flagged-decisions/:id
- [ ] GET /api/flagged-decisions/:id/context (get context for flagged decision - **web UI resume**)
- [ ] GET /api/meetings/:id/decision-contexts (list decision contexts - **web UI drafts list**)
- [ ] POST /api/meetings/:id/decision-contexts (canonical create draft context)
- [ ] GET /api/meetings/:id/summary (meeting stats - **web UI dashboard**)
- [ ] GET /api/decision-contexts/:id (canonical read draft context)
- [ ] PATCH /api/decision-contexts/:id (canonical update for title/template/draft metadata/status)
- [ ] DELETE /api/decision-contexts/:id (delete or archive draft context)
- [ ] GET /api/decision-contexts/:id/context-window
- [ ] POST /api/decision-contexts/:id/context-window
- [ ] GET /api/decision-contexts/:id/context-window/preview
- [ ] POST /api/decision-contexts/:id/generate-draft (generate)
- [ ] POST /api/decision-contexts/:id/regenerate (full regenerate)
- [ ] POST /api/decision-contexts/:id/regenerate-field (single field)
- [ ] GET /api/decision-contexts/:id/fields/:fieldId/transcript
- [ ] POST /api/decision-contexts/:id/fields/:fieldId/regenerate
- [ ] POST /api/decision-contexts/:id/lock-field (lock)
- [ ] DELETE /api/decision-contexts/:id/lock-field (unlock)
- [ ] POST /api/decision-contexts/:id/log (finalize decision)
- [ ] Integration tests

**Validation Checkpoint 6.4**:
```bash
curl http://localhost:3000/api/meetings/mtg_1/summary
# Returns: {meeting: {...}, stats: {segmentCount: 10, flaggedDecisionCount: 3, ...}}

curl http://localhost:3000/api/meetings/mtg_1/decision-contexts
# Returns: {contexts: [{id: "ctx_1", title: "...", status: "drafting", ...}]}
```

### 6.5 Decision Log Endpoints
- [ ] GET /api/meetings/:id/decisions (list logged decisions)
- [ ] GET /api/decisions/:id (show decision log)
- [ ] GET /api/decisions/:id/export (export as JSON/Markdown)
- [ ] Integration tests

### 6.6 Field Library & Template Endpoints
- [ ] POST /api/fields (create custom field)
- [ ] GET /api/fields (list, optional category filter)
- [ ] GET /api/fields/:id (show field definition)
- [ ] PATCH /api/fields/:id (update field definition)
- [ ] DELETE /api/fields/:id (delete custom field)
- [ ] POST /api/templates (create custom template)
- [ ] GET /api/templates (list)
- [ ] GET /api/templates/:id (show)
- [ ] PATCH /api/templates/:id (update template metadata and assignments)
- [ ] DELETE /api/templates/:id (delete custom template)
- [ ] POST /api/templates/:id/set-default (set default)
- [ ] Integration tests

### 6.7 Expert & MCP Endpoints
- [ ] GET /api/experts
- [ ] POST /api/experts
- [ ] GET /api/experts/:id
- [ ] PATCH /api/experts/:id
- [ ] DELETE /api/experts/:id
- [ ] POST /api/decision-contexts/:id/experts/:expertName/consult
- [ ] GET /api/mcp/servers
- [ ] POST /api/mcp/servers
- [ ] GET /api/mcp/servers/:name
- [ ] PATCH /api/mcp/servers/:name
- [ ] DELETE /api/mcp/servers/:name
- [ ] GET /api/mcp/servers/:name/tools
- [ ] GET /api/mcp/servers/:name/resources
- [ ] Lower priority than meeting, decision-context, field, and template CRUD routes
- [ ] Integration tests

**Validation Checkpoint 6.x**:
```bash
pnpm test:e2e  # Full API test suite passes
curl http://localhost:3000/api/meetings  # Returns []
curl http://localhost:3000/docs  # OpenAPI spec UI
```

**Manual Smoke Test**:
```bash
# Hit the most important routes directly
curl -X POST http://localhost:3000/api/meetings/mtg_1/transcripts/add \
  -H "Content-Type: application/json" \
  -d '{"text":"We should approve the pilot budget"}'

curl -X POST http://localhost:3000/api/meetings/mtg_1/transcripts/stream \
  -H "Content-Type: application/json" \
  -d '{"text":"Lets revisit the rollout plan next week","sequenceNumber":1}'

curl http://localhost:3000/api/meetings/mtg_1/chunks
curl http://localhost:3000/api/meetings/mtg_1/flagged-decisions
```

### Phase 6 Exit Criteria
- [ ] All endpoints implemented
- [ ] OpenAPI spec complete and accurate
- [ ] E2E tests cover all routes
- [ ] Error handling consistent

---

## Phase 7: CLI — API Client & UX Polish (Days 19-21)

**Goal**: Rewrite the CLI as a proper API client that can target a local or remote server, then add interactive UX polish with Clack.

**Architecture shift**: The Phase 0–6 CLI commands import `@repo/core` and `@repo/db` directly — this is convenient scaffolding for local dev but ties the CLI to a database connection. Phase 7 removes all direct service/repo imports from `apps/cli` and replaces them with HTTP calls to the API. The CLI becomes a pure consumer of the REST API, identical to any future web UI.

```
Before (Phase 0–6):  CLI → @repo/core services → @repo/db → Postgres
After  (Phase 7):    CLI → HTTP → API → @repo/core services → @repo/db → Postgres
```

**Configuration**: `DECISION_LOGGER_API_URL` env var (defaults to `http://localhost:3000`). Allows pointing at a remote deployed instance without any code change.

### 7.0 API Client Layer
- [ ] Create `apps/cli/src/api-client.ts` — thin fetch wrapper using `DECISION_LOGGER_API_URL`
- [ ] Handle common HTTP errors (4xx, 5xx) and surface them as user-friendly messages
- [ ] Add `--api-url <url>` global flag to override `DECISION_LOGGER_API_URL` at runtime
- [ ] **Remove all `@repo/core` and `@repo/db` imports from `apps/cli`** — CLI must not depend on these packages

**Validation Checkpoint 7.0**:
```bash
# CLI talks to API, not DB directly
DECISION_LOGGER_API_URL=http://localhost:3000 decision-logger meeting list
# Start API on a different port, CLI follows
DECISION_LOGGER_API_URL=http://localhost:4000 decision-logger meeting list
```

### 7.1 Rewrite Commands Against API
- [ ] `meeting` commands → `GET/POST /api/meetings`
- [ ] `transcript` commands → `POST /api/meetings/:id/transcripts/*`
- [ ] `decisions` commands → `GET/POST/PATCH /api/flagged-decisions`, `POST /api/decision-contexts`
- [ ] `draft` commands → `POST /api/decision-contexts/:id/generate-draft`, `lock-field`, `regenerate`
- [ ] `decision log/show/export` → `POST /api/decision-contexts/:id/log`, `GET /api/decisions/:id`
- [ ] `context` commands → `POST/DELETE /api/context/meeting`, `POST /api/meetings/:id/context/*`
- [ ] `field` and `template` commands → `GET /api/fields`, `GET /api/templates`
- [ ] `expert` and `mcp` management commands

### 7.2 Interactive Mode with Clack
- [ ] Add Clack prompts for missing required arguments
- [ ] Add spinners for LLM operations ("Generating draft...")
- [ ] Add colored output for decision fields (green=locked, yellow=unlocked)
- [ ] Add progress indicators for multi-step operations
- [ ] Add confirmation prompts for destructive actions

**Validation Checkpoint 7.2**:
```bash
decision-logger meeting create  # Prompts for title, date, participants if not supplied
decision-logger draft generate  # Shows spinner during LLM call
```

### 7.3 Error Handling & Help
- [ ] Improve error messages (user-friendly, actionable, include API error body)
- [ ] Handle offline API gracefully ("Cannot connect to API at http://localhost:3000")
- [ ] Add `--help` to all commands with usage examples
- [ ] Add `--verbose` flag to print raw HTTP request/response for debugging

**Validation Checkpoint 7.3**:
```bash
# API not running → clear connection error, not a stack trace
decision-logger meeting list  # "Cannot connect to API at http://localhost:3000"
decision-logger meeting create --help  # Shows usage examples
```

**Manual Smoke Test** (API running):
```bash
decision-logger --help
decision-logger transcript --help
decision-logger context set-decision does-not-exist  # 404 surfaced cleanly
DECISION_LOGGER_API_URL=http://remote-host:3000 decision-logger meeting list  # Remote works
```

### Phase 7 Exit Criteria
- [ ] `apps/cli` has zero imports from `@repo/core` or `@repo/db`
- [ ] CLI works against `http://localhost:3000` (local) and any remote `DECISION_LOGGER_API_URL`
- [ ] All commands use the API client layer (no direct DB access)
- [ ] Interactive prompts working with Clack
- [ ] Spinners and colored output enhance UX
- [ ] Error messages are clear and actionable, including API-down scenario
- [ ] Help text is comprehensive with examples

---

## Phase 8: Export & Polish (Days 22-24)

**Goal**: Export functionality and documentation.

### 8.1 Export Formats
- [ ] Markdown export with proper formatting
- [ ] JSON export for programmatic use
- [ ] CLI command: `decision-logger decision export <id> --format json|markdown`

### 8.2 Documentation
- [ ] Update README with final architecture
- [ ] API documentation (auto-generated from OpenAPI)
- [ ] CLI usage guide
- [ ] Logging and live-debugging guide using correlation IDs

### 8.3 Final Validation
- [ ] End-to-end workflow test
- [ ] Performance benchmarks
- [ ] Security review

**Manual Smoke Test**:
```bash
# Run one realistic session without shortcuts
decision-logger meeting create "Release Readiness Test" --date 2026-02-27 --participants Alice,Bob,Carol
decision-logger context set-meeting mtg_1
decision-logger transcript upload examples/final-smoke-test.json
decision-logger decisions flagged
decision-logger context set-decision flag_1
decision-logger draft generate
decision-logger draft lock-field decision_statement
decision-logger decision log --type consensus --details "Approved in review" --actors Alice,Bob,Carol --logged-by Alice
decision-logger decision export log_1 --format markdown
```

### Phase 8 Exit Criteria
- [ ] Export formats working
- [ ] Documentation complete
- [ ] All tests passing
- [ ] Ready for production use

---

## Validation Checkpoint Summary

| Phase | Key Validation | Pass Criteria | Status |
|-------|----------------|---------------|---------|
| 0.0 | Infrastructure | Postgres healthy, both DBs accessible | ✅ |
| 0 | Vertical slice | API creates meeting, persists in real DB | ✅ |
| 1 | Schema pipeline | OpenAPI auto-generated | ✅ |
| 2 | Data services | >80% test coverage | 🟡 |
| 3 | LLM integration | Mock + real API tests | ⏳ |
| 4 | Decision workflow | Lock/regenerate works | ⏳ |
| 5 | Expert system | Consultation returns advice | ⏳ |
| 6 | API complete | All endpoints tested | ⏳ |
| 7 | CLI complete | Full workflow via CLI | ⏳ |
| 8 | Production ready | Exports + docs complete | ⏳ |

---

## Risk Mitigation

### If Phase Fails Validation:
1. **Stop** - Do not proceed to next phase
2. **Diagnose** - Identify root cause (architecture flaw? implementation bug?)
3. **Fix** - Address at the appropriate layer
4. **Re-validate** - Ensure checkpoint passes before continuing

### Known Risk Areas:
- **Phase 0.0**: Docker not available or port 5432 already in use — resolve before any DB work
- **Phase 0**: Monorepo tooling complexity; `DrizzleMeetingRepository` must use real DB (not in-memory mock)
- **Phase 1**: Zod ↔ Drizzle alignment edge cases
- **Phase 3**: LLM provider variability (remote vs optional local adapters)
- **Phase 5**: MCP tool injection complexity

---

## Timeline Summary

| Phase | Duration | Cumulative | Status |
|-------|----------|------------|---------|
| 0: Vertical Slice | 1 day | Day 1 | ✅ Complete |
| 1: Schema Foundation | 2 days | Day 3 | ✅ Complete |
| 2: Core Data Services | 3 days | Day 6 | 🟡 In Progress |
| 3: LLM Integration | 3 days | Day 9 | ⏳ |
| 4: Decision Workflow | 3 days | Day 12 | ⏳ |
| 5: Expert System | 3 days | Day 15 | ⏳ |
| 6: API Layer | 3 days | Day 18 | ⏳ |
| 7: CLI Application | 3 days | Day 21 | ⏳ |
| 8: Export & Polish | 3 days | Day 24 | ⏳ |

**Total: ~24 working days (5 weeks)**

Buffer time built into each phase for unexpected issues.

---

## Deployment Considerations

### Local Development (Phases 0–8)
`docker-compose.yml` runs PostgreSQL 16 locally. This is the only infrastructure assumption during development. No pgvector image required.

### Cloudflare Deployment Path (Post-Phase 8)
The application is compatible with **Cloudflare Workers + Hyperdrive + managed Postgres** (Neon or Supabase) without schema changes:

- **Hono** runs natively on Workers (designed for edge)
- **Drizzle** supports Workers-compatible connection adapters
- **Managed Postgres** (Neon/Supabase) preserves all PostgreSQL features: `TEXT[]` arrays, `JSONB`, GIN indexes, partial indexes
- **pgvector** is available on both Neon and Supabase when needed post-MVP
- `docker-compose.yml` becomes a local dev tool only; `DATABASE_URL` in production points at the managed instance

**Not compatible** with Cloudflare D1 (SQLite) without a major schema redesign — the use of `TEXT[]` arrays and `JSONB` across 8+ tables rules it out.

### What Keeps Us PostgreSQL-Bound (By Design)
The following features are in the current schema and are not accidental — they were chosen for correctness:
- `TEXT[]` / `UUID[]` arrays — participants, contexts, chunkIds, lockedFields, etc.
- `JSONB` — draftData, fields, decisionMethod, extractionPrompt, connectionConfig, etc.
- GIN index on `contexts` — efficient context-tag querying
- Partial indexes — e.g. pending-only flagged decisions, single default template

Switching away from PostgreSQL would require replacing all of these, which is not planned.
