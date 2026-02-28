# Iterative Implementation Plan

This document defines a detailed, phased implementation plan with validation checkpoints. Each phase delivers testable functionality, enabling rapid detection of architectural misunderstandings and impractical elements.

## Philosophy

- **Vertical Slice First**: Prove the entire stack works before expanding horizontally
- **TDD at Every Step**: Tests before code, always
- **Checkpoint Validation**: Each phase ends with a concrete, demonstrable outcome
- **Fail Fast**: Small iterations expose problems early
- **Mock External Dependencies**: LLM calls are expensive; mock them until integration phase

---

## Phase 0: Vertical Slice (Day 1)

**Goal**: Prove the entire stack works end-to-end with minimal functionality.

### 0.1 Monorepo Scaffold
- [ ] Initialize Turborepo with `apps/` and `packages/` structure
- [ ] Create `packages/schema` with single Zod schema: `MeetingSchema`
- [ ] Create `packages/db` with Drizzle config (no tables yet)
- [ ] Create `packages/core` with empty service structure
- [ ] Create `apps/api` with Hono "hello world"
- [ ] Verify: `pnpm build` and `pnpm test` pass across all packages

**Validation Checkpoint 0.1**:
```bash
pnpm build  # All packages compile
pnpm test   # Zero tests, but harness works
curl http://localhost:3000/health  # Returns { "status": "ok" }
```

### 0.2 First Database Table
- [ ] Define `meetings` table in `packages/db/schema.ts`
- [ ] Run `drizzle-kit generate` to create migration
- [ ] Apply migration to local PostgreSQL
- [ ] Verify: Table exists via `psql` or Drizzle Studio

**Validation Checkpoint 0.2**:
```bash
pnpm db:migrate  # Migration applies cleanly
pnpm db:studio   # Can view empty meetings table
```

### 0.3 First Repository (TDD)
- [ ] Define `IMeetingRepository` interface in `packages/core`
- [ ] Write failing test: `MeetingRepository.create()` returns a meeting
- [ ] Implement `DrizzleMeetingRepository`
- [ ] Test passes

**Validation Checkpoint 0.3**:
```bash
pnpm test --filter=@repo/core  # 1 passing test
```

### 0.4 First Service (TDD)
- [ ] Define `IMeetingService` interface
- [ ] Write failing test: `MeetingService.create()` validates input and calls repo
- [ ] Implement `MeetingService` with DI
- [ ] Test passes (uses mock repository)

**Validation Checkpoint 0.4**:
```bash
pnpm test --filter=@repo/core  # 2+ passing tests (unit + integration)
```

### 0.5 First API Endpoint
- [ ] Create `POST /api/meetings` endpoint using `@hono/zod-openapi`
- [ ] Wire endpoint to `MeetingService`
- [ ] Write integration test: POST creates meeting and returns it
- [ ] Verify OpenAPI spec is auto-generated

**Validation Checkpoint 0.5**:
```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Meeting", "date": "2026-02-27", "participants": ["Alice"]}'
# Returns: { "id": "uuid", "title": "Test Meeting", ... }

curl http://localhost:3000/docs  # OpenAPI spec available
```

### 0.6 First CLI Command
- [ ] Create `apps/cli` with Commander.js
- [ ] Implement `decision-logger meeting create <title>` command
- [ ] Wire to API or directly to service
- [ ] Test: CLI creates meeting and displays ID

**Validation Checkpoint 0.6**:
```bash
decision-logger meeting create "Test Meeting" --date 2026-02-27 --participants Alice,Bob
# Output: Created meeting: mtg_abc123
```

### Phase 0 Exit Criteria
- [ ] Monorepo builds and tests pass
- [ ] Single meeting can be created via API
- [ ] Single meeting can be created via CLI
- [ ] OpenAPI spec auto-generated from Zod
- [ ] TDD workflow proven (test → implement → pass)
- [ ] DI pattern working (service uses injected repository)
- [ ] **Primary UX validated early** (CLI is the main interface)

---

## Phase 1: Schema Foundation (Days 2-3)

**Goal**: Complete the Zod schema layer and establish the "Zod-to-All" pipeline.

### 1.1 Domain Schemas
- [ ] `MeetingSchema` (id, title, date, participants, status, createdAt)
- [ ] `TranscriptSegmentSchema` (id, meetingId, sequenceNumber, speaker, text, timestamp, contexts, createdAt)
- [ ] `FlaggedDecisionSchema` (id, meetingId, suggestedTitle, contextSummary, confidence, segmentIds, suggestedTemplateId, templateConfidence, status, createdAt)
- [ ] `DecisionContextSchema` (id, meetingId, flaggedDecisionId, title, templateId, activeField, lockedFields, draftData, status, createdAt, updatedAt)
- [ ] `DecisionLogSchema` (id, meetingId, decisionContextId, templateId, templateVersion, fields, decisionMethod, sourceSegmentIds, loggedAt, loggedBy)
- [ ] `DecisionFieldSchema` (id, name, description, category, extractionPrompt, fieldType, placeholder, validationRules, version, isCustom, createdAt)
- [ ] `DecisionTemplateSchema` (id, name, description, category, fields: TemplateFieldAssignment[], version, isDefault, isCustom, createdAt)
- [ ] `TemplateFieldAssignmentSchema` (fieldId, order, required, customLabel, customDescription)
- [ ] Export all schemas and inferred types from `packages/schema`

**Validation Checkpoint 1.1**:
```typescript
import { MeetingSchema, FlaggedDecisionSchema, DecisionContextSchema, type Meeting } from '@repo/schema';
MeetingSchema.parse({ title: "Test", date: "2026-02-27", participants: ["Alice"] }); // Works
FlaggedDecisionSchema.parse({ meetingId: "mtg_1", suggestedTitle: "Test", confidence: 0.89 }); // Works
```

### 1.2 Drizzle Schema Alignment
- [ ] Update `packages/db/schema.ts` to match all Zod schemas
- [ ] Create "Schema Sanity Check" test that validates Zod ↔ Drizzle alignment
- [ ] Generate migrations for all tables
- [ ] Apply migrations

**Validation Checkpoint 1.2**:
```bash
pnpm test --filter=@repo/db  # Schema alignment tests pass
pnpm db:migrate  # All migrations apply
```

### 1.3 OpenAPI Pipeline
- [ ] Configure `@hono/zod-openapi` route factory
- [ ] Create route definitions using Zod schemas for request/response
- [ ] Auto-generate `openapi.yaml` on build
- [ ] Delete manual `docs/openapi.yaml` (decommissioned)

**Validation Checkpoint 1.3**:
```bash
pnpm build:api  # Generates openapi.yaml
cat apps/api/openapi.yaml  # Valid, auto-generated spec
```

### Phase 1 Exit Criteria
- [ ] All domain schemas defined in `packages/schema`
- [ ] Drizzle schema matches Zod (verified by test)
- [ ] OpenAPI auto-generated from route definitions
- [ ] Manual `openapi.yaml` removed from repo

---

## Phase 2: Core Data Services (Days 4-6)

**Goal**: Implement all data access layers with full TDD coverage.

### 2.1 Meeting Service (Complete)
- [ ] `IMeetingRepository`: create, findById, findAll, updateStatus
- [ ] Unit tests for each method (mocked DB)
- [ ] `MeetingService`: business logic wrapper
- [ ] Integration tests (real test DB)

**Validation Checkpoint 2.1**:
```bash
pnpm test --filter=@repo/core -- --grep="Meeting"  # All passing
```

### 2.2 Transcript Service
- [ ] `ITranscriptSegmentRepository`: create, findByMeetingId, findByContext, appendSegment
- [ ] Unit tests for each method
- [ ] `TranscriptService`: handles segment ingestion, auto-tagging with contexts
- [ ] Integration tests

**Validation Checkpoint 2.2**:
```bash
# Integration test proves:
# 1. Create meeting
# 2. Add 3 transcript segments with context tags
# 3. Query segments by context → returns correct subset
```

### 2.3 Flagged Decision Service
- [ ] `IFlaggedDecisionRepository`: create, findByMeetingId, updateStatus
- [ ] Unit tests
- [ ] `FlaggedDecisionService`: CRUD operations only (no LLM yet)
- [ ] Integration tests

### 2.4 Decision Context Service
- [ ] `IDecisionContextRepository`: create, findById, findByMeetingId, update, lockField, unlockField
- [ ] Unit tests
- [ ] `DecisionContextService`: manages draft state and field locking
- [ ] Integration tests

### 2.5 Decision Log Service
- [ ] `IDecisionLogRepository`: create, findById, findByMeetingId
- [ ] Unit tests
- [ ] `DecisionLogService`: immutable decision recording
- [ ] Integration tests

### 2.6 Decision Field Service
- [ ] `IDecisionFieldRepository`: create, findById, findAll, findByCategory
- [ ] Seed field library (~25 core fields across all categories)
- [ ] Unit tests
- [ ] `DecisionFieldService`: field library management
- [ ] Integration tests

### 2.7 Decision Template Service
- [ ] `IDecisionTemplateRepository`: create, findById, findAll, findDefault, setDefault
- [ ] `ITemplateFieldAssignmentRepository`: manage field assignments
- [ ] Seed 6 core templates (Standard, Technology, Strategy, Budget, Policy, Proposal)
- [ ] Unit tests
- [ ] `DecisionTemplateService`: template management
- [ ] Integration tests

**Validation Checkpoint 2.x**:
```bash
pnpm test --filter=@repo/core  # All service tests passing
pnpm test:coverage  # >80% coverage on packages/core
```

### 2.8 CLI Commands for Data Layer
- [ ] `decision-logger meeting list`
- [ ] `decision-logger meeting show <id>`
- [ ] `decision-logger transcript list [--context <tag>]`
- [ ] `decision-logger field list [--category <category>]`
- [ ] `decision-logger field show <id>`
- [ ] `decision-logger template list`
- [ ] `decision-logger template show <id>`
- [ ] Test: All commands work with real database

**Validation Checkpoint 2.8**:
```bash
decision-logger meeting create "Test" --date 2026-02-27 --participants Alice
decision-logger meeting list
decision-logger field list  # Shows ~25 fields
decision-logger field list --category evaluation  # Shows evaluation fields
decision-logger template list  # Shows 6 templates
decision-logger template show technology-selection  # Shows field composition
```

### Phase 2 Exit Criteria
- [ ] All 7 core services implemented and tested (including DecisionFieldService)
- [ ] Unit test coverage >80%
- [ ] Integration tests prove DB operations work
- [ ] **Field library seeded (~25 fields)**
- [ ] **6 core templates seeded (Standard, Technology, Strategy, Budget, Policy, Proposal)**
- [ ] Context tagging logic working
- [ ] **CLI commands available for manual testing**
- [ ] No LLM dependencies yet (pure data layer)

---

## Phase 3: LLM Integration (Days 7-9)

**Goal**: Integrate Vercel AI SDK with comprehensive mocking strategy.

### 3.1 LLM Abstraction Layer
- [ ] Define `ILLMService` interface in `packages/core`
- [ ] Create `MockLLMService` for testing (returns canned responses)
- [ ] Create `VercelAILLMService` implementation
- [ ] Test: Mock service returns expected structured output

**Validation Checkpoint 3.1**:
```typescript
// Unit test with mock
const mock = new MockLLMService();
const result = await mock.extractDecisions(transcript);
expect(result.decisions).toHaveLength(1);
```

### 3.2 Decision Detection
- [ ] Implement `DecisionDetectionService` using Vercel AI SDK
- [ ] Unit test with mock LLM (various transcript scenarios)
- [ ] Returns `FlaggedDecision[]` with confidence scores
- [ ] Integration test with real Claude API (marked as slow, skippable)

**Validation Checkpoint 3.2**:
```bash
pnpm test --filter=@repo/core -- --grep="DecisionDetection"  # Fast (mocked)
pnpm test:integration:llm  # Slow (real API, optional)
```

### 3.3 Draft Generation
- [ ] Implement `DraftGenerationService` using Vercel AI SDK
- [ ] Generates complete draft for all template fields
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
- [ ] Implement field-specific regeneration with segment weighting
- [ ] Field-tagged segments get highest priority
- [ ] Decision-tagged segments get medium priority
- [ ] Meeting-tagged segments get lowest priority
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

### 3.6 CLI Commands for LLM Features
- [ ] `decision-logger decisions flagged` (uses real LLM)
- [ ] `decision-logger draft generate` (uses real LLM)
- [ ] `decision-logger draft show`
- [ ] Add `--mock` flag to use MockLLMService for testing
- [ ] Test: Generate draft from real transcript

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
- [ ] New segments get meeting tag: `meeting:<id>`
- [ ] If decision active, add: `decision:<id>`
- [ ] If field active, add: `decision:<id>:<field>`
- [ ] Test: Tags are cumulative and correct

**Validation Checkpoint 4.2**:
```typescript
await globalContext.setActiveMeeting('mtg_1');
await globalContext.setActiveDecision('flag_1');
await globalContext.setActiveField('options');

const segment = await transcriptService.addSegment({
  speaker: 'Alice',
  text: 'We have three options...'
});

expect(segment.contexts).toContain('meeting:mtg_1');
expect(segment.contexts).toContain('decision:ctx_1');
expect(segment.contexts).toContain('decision:ctx_1:options');
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
- [ ] `decision-logger transcript add --speaker <name> --text <text>`
- [ ] `decision-logger draft lock-field <field-id>`
- [ ] `decision-logger draft unlock-field <field-id>`
- [ ] `decision-logger draft regenerate`
- [ ] `decision-logger decision log --type <type> --details <text> --actors <names> --logged-by <name>`

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
decision-logger transcript add --speaker Alice --text "We have three options..."
decision-logger draft regenerate
decision-logger draft show  # decision_statement unchanged, options updated
decision-logger decision log --type consensus --details "All agreed" --actors Alice,Bob --logged-by Alice
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

### 5.4 Expert Prompt Refinement
- [ ] Extract expert system prompts to `prompts/experts/`
- [ ] `prompts/experts/technical.md` - Technical expert persona
- [ ] `prompts/experts/legal.md` - Legal expert persona
- [ ] `prompts/experts/stakeholder.md` - Stakeholder expert persona
- [ ] Test expert advice quality with real decisions
- [ ] Refine expert personas based on output quality

**Validation Checkpoint 5.4**:
```bash
decision-logger draft expert-advice technical
# Review: Is advice technically sound?
# Refine prompts/experts/technical.md if needed
```

### 5.5 CLI Commands for Expert System
- [ ] `decision-logger draft expert-advice <expert-type> [--focus <area>]`
- [ ] Test: Consult each expert type
- [ ] Verify advice is contextual and useful

**Validation Checkpoint 5.5**:
```bash
decision-logger context set-decision flag_1
decision-logger draft expert-advice technical
decision-logger draft expert-advice legal
decision-logger draft expert-advice stakeholder
# Manually review all three expert responses
```

### Phase 5 Exit Criteria
- [ ] Expert templates stored and retrievable
- [ ] Consultation returns structured advice
- [ ] Multiple experts can be consulted
- [ ] MCP tool integration working
- [ ] **Expert prompts externalized and refinable**
- [ ] **CLI commands for expert consultation working**

---

## Phase 6: API Layer (Days 16-18)

**Goal**: Complete REST API with all endpoints.

### 6.1 Meeting Endpoints
- [ ] POST /api/meetings (create)
- [ ] GET /api/meetings (list)
- [ ] GET /api/meetings/:id (show)
- [ ] PATCH /api/meetings/:id/status (complete)
- [ ] Integration tests for each

### 6.2 Transcript Endpoints
- [ ] POST /api/meetings/:id/transcripts/upload (bulk upload)
- [ ] POST /api/meetings/:id/transcripts/add (single segment)
- [ ] GET /api/meetings/:id/segments (query with context filter)
- [ ] Integration tests

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
- [ ] GET /api/flagged-decisions/:id/context (get context for flagged decision - **web UI resume**)
- [ ] GET /api/meetings/:id/decision-contexts (list decision contexts - **web UI drafts list**)
- [ ] GET /api/meetings/:id/summary (meeting stats - **web UI dashboard**)
- [ ] POST /api/decision-contexts/:id/generate-draft (generate)
- [ ] POST /api/decision-contexts/:id/regenerate (full regenerate)
- [ ] POST /api/decision-contexts/:id/regenerate-field (single field)
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
- [ ] GET /api/fields (list, optional category filter)
- [ ] GET /api/fields/:id (show field definition)
- [ ] GET /api/templates (list)
- [ ] GET /api/templates/:id (show)
- [ ] POST /api/templates/:id/set-default (set default)
- [ ] Integration tests

**Validation Checkpoint 6.x**:
```bash
pnpm test:e2e  # Full API test suite passes
curl http://localhost:3000/api/meetings  # Returns []
curl http://localhost:3000/docs  # OpenAPI spec UI
```

### Phase 6 Exit Criteria
- [ ] All endpoints implemented
- [ ] OpenAPI spec complete and accurate
- [ ] E2E tests cover all routes
- [ ] Error handling consistent

---

## Phase 7: CLI Polish & UX (Days 19-21)

**Goal**: Add interactive features and polish to the CLI (commands already built in Phases 0-5).

### 7.1 Interactive Mode with Clack
- [ ] Add Clack prompts for missing required arguments
- [ ] Add spinners for LLM operations ("Generating draft...")
- [ ] Add colored output for decision fields (green=locked, yellow=unlocked)
- [ ] Add progress indicators for multi-step operations
- [ ] Add confirmation prompts for destructive actions

**Validation Checkpoint 7.1**:
```bash
# Test interactive prompts
decision-logger meeting create  # Should prompt for title, date, participants
decision-logger draft generate  # Should show spinner during LLM call
```

### 7.2 Additional Commands
- [ ] `decision-logger transcript stream [--file <file.txt>]` (streaming input)
- [ ] `decision-logger draft update-field <field-id> --value <text>` (manual edit)
- [ ] `decision-logger decision show <id>` (show logged decision)
- [ ] `decision-logger decision export <id> --format <json|markdown>`
- [ ] `decision-logger context clear-meeting`
- [ ] `decision-logger template set-default <id>`

### 7.3 Error Handling & Help
- [ ] Improve error messages (user-friendly, actionable)
- [ ] Add `--help` to all commands
- [ ] Add examples to help text
- [ ] Handle common errors gracefully (no meeting context, no API key, etc.)

**Validation Checkpoint 7.3**:
```bash
decision-logger draft generate  # No meeting context → clear error message
decision-logger meeting create --help  # Shows usage examples
```

### Phase 7 Exit Criteria
- [ ] Interactive prompts working with Clack
- [ ] Spinners and colored output enhance UX
- [ ] Error messages are clear and actionable
- [ ] Help text is comprehensive
- [ ] CLI feels polished and professional

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

### 8.3 Final Validation
- [ ] End-to-end workflow test
- [ ] Performance benchmarks
- [ ] Security review

### Phase 8 Exit Criteria
- [ ] Export formats working
- [ ] Documentation complete
- [ ] All tests passing
- [ ] Ready for production use

---

## Validation Checkpoint Summary

| Phase | Key Validation | Pass Criteria |
|-------|----------------|---------------|
| 0 | Vertical slice | API creates meeting |
| 1 | Schema pipeline | OpenAPI auto-generated |
| 2 | Data services | >80% test coverage |
| 3 | LLM integration | Mock + real API tests |
| 4 | Decision workflow | Lock/regenerate works |
| 5 | Expert system | Consultation returns advice |
| 6 | API complete | All endpoints tested |
| 7 | CLI complete | Full workflow via CLI |
| 8 | Production ready | Exports + docs complete |

---

## Risk Mitigation

### If Phase Fails Validation:
1. **Stop** - Do not proceed to next phase
2. **Diagnose** - Identify root cause (architecture flaw? implementation bug?)
3. **Fix** - Address at the appropriate layer
4. **Re-validate** - Ensure checkpoint passes before continuing

### Known Risk Areas:
- **Phase 0**: Monorepo tooling complexity
- **Phase 1**: Zod ↔ Drizzle alignment edge cases
- **Phase 3**: LLM response variability
- **Phase 5**: MCP tool injection complexity

---

## Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 0: Vertical Slice | 1 day | Day 1 |
| 1: Schema Foundation | 2 days | Day 3 |
| 2: Core Data Services | 3 days | Day 6 |
| 3: LLM Integration | 3 days | Day 9 |
| 4: Decision Workflow | 3 days | Day 12 |
| 5: Expert System | 3 days | Day 15 |
| 6: API Layer | 3 days | Day 18 |
| 7: CLI Application | 3 days | Day 21 |
| 8: Export & Polish | 3 days | Day 24 |

**Total: ~24 working days (5 weeks)**

Buffer time built into each phase for unexpected issues.
