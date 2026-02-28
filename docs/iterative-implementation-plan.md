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
- [ ] Create `POST /meetings` endpoint using `@hono/zod-openapi`
- [ ] Wire endpoint to `MeetingService`
- [ ] Write integration test: POST creates meeting and returns it
- [ ] Verify OpenAPI spec is auto-generated

**Validation Checkpoint 0.5**:
```bash
curl -X POST http://localhost:3000/meetings \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Meeting"}'
# Returns: { "id": "uuid", "title": "Test Meeting", ... }

curl http://localhost:3000/docs  # OpenAPI spec available
```

### Phase 0 Exit Criteria
- [ ] Monorepo builds and tests pass
- [ ] Single meeting can be created via API
- [ ] OpenAPI spec auto-generated from Zod
- [ ] TDD workflow proven (test → implement → pass)
- [ ] DI pattern working (service uses injected repository)

---

## Phase 1: Schema Foundation (Days 2-3)

**Goal**: Complete the Zod schema layer and establish the "Zod-to-All" pipeline.

### 1.1 Domain Schemas
- [ ] `MeetingSchema` (id, title, participants, dates, status)
- [ ] `TranscriptSegmentSchema` (id, meetingId, speaker, content, timestamp)
- [ ] `DecisionSchema` (id, meetingId, title, status, confidence, fields)
- [ ] `DecisionFieldSchema` (problem, options, rationale, outcome, etc.)
- [ ] `ExpertSchema` (id, domain, systemPrompt, toolDefinitions)
- [ ] Export all schemas and inferred types from `packages/schema`

**Validation Checkpoint 1.1**:
```typescript
import { MeetingSchema, type Meeting } from '@repo/schema';
MeetingSchema.parse({ title: "Test" }); // Works
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
- [ ] `IMeetingRepository`: create, findById, findAll, update, delete
- [ ] Unit tests for each method (mocked DB)
- [ ] `MeetingService`: business logic wrapper
- [ ] Integration tests (real test DB)

**Validation Checkpoint 2.1**:
```bash
pnpm test --filter=@repo/core -- --grep="Meeting"  # All passing
```

### 2.2 Transcript Service
- [ ] `ITranscriptRepository`: create, findByMeetingId, appendSegment
- [ ] Unit tests for each method
- [ ] `TranscriptService`: handles segment ingestion, chunking
- [ ] Integration tests

**Validation Checkpoint 2.2**:
```bash
# Integration test proves:
# 1. Create meeting
# 2. Add 3 transcript segments
# 3. Query segments by meeting → returns 3
```

### 2.3 Decision Service (CRUD Only)
- [ ] `IDecisionRepository`: create, findById, findByMeetingId, update
- [ ] Unit tests
- [ ] `DecisionService`: CRUD operations only (no LLM yet)
- [ ] Integration tests

**Validation Checkpoint 2.3**:
```bash
pnpm test --filter=@repo/core  # All service tests passing
pnpm test:coverage  # >80% coverage on packages/core
```

### Phase 2 Exit Criteria
- [ ] All CRUD services implemented and tested
- [ ] Unit test coverage >80%
- [ ] Integration tests prove DB operations work
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
- [ ] Implement `DecisionDetector` service
- [ ] Unit test with mock LLM (various transcript scenarios)
- [ ] Integration test with real Claude API (marked as slow, skippable)

**Validation Checkpoint 3.2**:
```bash
pnpm test --filter=@repo/core -- --grep="DecisionDetector"  # Fast (mocked)
pnpm test:integration:llm  # Slow (real API, optional)
```

### 3.3 Structured Output Extraction
- [ ] Implement field extraction (problem, options, rationale, etc.)
- [ ] Unit tests with mock responses
- [ ] Verify Zod schema validation on LLM output

**Validation Checkpoint 3.3**:
```typescript
// LLM output is parsed and validated by Zod
const result = await extractor.extractFields(context);
DecisionFieldsSchema.parse(result);  // Must pass
```

### Phase 3 Exit Criteria
- [ ] LLM calls abstracted behind interface
- [ ] All LLM logic testable with mocks
- [ ] Real API integration tested (slow tests)
- [ ] Structured output validated by Zod schemas

---

## Phase 4: Decision Workflow (Days 10-12)

**Goal**: Implement the iterative decision refinement workflow.

### 4.1 Context Management
- [ ] `ContextService`: setDecisionContext, setFieldFocus, clearContext
- [ ] Unit tests for state transitions
- [ ] Integration tests for context persistence

**Validation Checkpoint 4.1**:
```typescript
await contextService.setDecisionContext(decisionId);
await contextService.setFieldFocus('rationale');
const ctx = await contextService.getContext();
expect(ctx.decisionId).toBe(decisionId);
expect(ctx.fieldFocus).toBe('rationale');
```

### 4.2 Draft Generation
- [ ] `DraftService`: generateDraft, regenerateDraft
- [ ] Test: Draft respects locked fields
- [ ] Test: Draft uses recent segments with higher weight
- [ ] Integration test: Full draft generation flow

**Validation Checkpoint 4.2**:
```typescript
const draft = await draftService.generateDraft(decisionId);
expect(draft.fields.problem).toBeDefined();

// Lock problem, regenerate
await draftService.lockField(decisionId, 'problem');
const newDraft = await draftService.regenerateDraft(decisionId);
expect(newDraft.fields.problem).toBe(draft.fields.problem);  // Unchanged
```

### 4.3 Field Locking
- [ ] `FieldLockService`: lock, unlock, getLocks
- [ ] Test: Locked fields persist across regenerations
- [ ] Test: Unlock allows field to be regenerated

**Validation Checkpoint 4.3**:
```bash
pnpm test --filter=@repo/core -- --grep="FieldLock"  # All passing
```

### Phase 4 Exit Criteria
- [ ] Context management working
- [ ] Draft generation respects locks
- [ ] Field locking persists correctly
- [ ] Full refinement loop testable

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

### Phase 5 Exit Criteria
- [ ] Expert templates stored and retrievable
- [ ] Consultation returns structured advice
- [ ] Multiple experts can be consulted
- [ ] MCP tool integration working

---

## Phase 6: API Layer (Days 16-18)

**Goal**: Complete REST API with all endpoints.

### 6.1 Meeting Endpoints
- [ ] GET /meetings, POST /meetings, GET /meetings/:id
- [ ] PUT /meetings/:id, DELETE /meetings/:id
- [ ] Integration tests for each

### 6.2 Transcript Endpoints
- [ ] POST /meetings/:id/transcript (append segment)
- [ ] GET /meetings/:id/transcript
- [ ] POST /meetings/:id/transcript/upload (bulk)

### 6.3 Decision Endpoints
- [ ] GET /meetings/:id/decisions
- [ ] POST /decisions/:id/draft
- [ ] PUT /decisions/:id/fields/:field/lock
- [ ] POST /decisions/:id/log

### 6.4 Context Endpoints
- [ ] POST /context/decision/:id
- [ ] POST /context/field/:field
- [ ] DELETE /context

### 6.5 Expert Endpoints
- [ ] GET /experts
- [ ] POST /decisions/:id/consult/:expertId

**Validation Checkpoint 6.x**:
```bash
pnpm test:e2e  # Full API test suite passes
curl http://localhost:3000/openapi.json  # Complete spec
```

### Phase 6 Exit Criteria
- [ ] All endpoints implemented
- [ ] OpenAPI spec complete and accurate
- [ ] E2E tests cover all routes
- [ ] Error handling consistent

---

## Phase 7: CLI Application (Days 19-21)

**Goal**: Implement interactive CLI with Clack.

### 7.1 Core Commands
- [ ] `decision-logger meeting create`
- [ ] `decision-logger meeting list`
- [ ] `decision-logger transcript add`

### 7.2 Decision Workflow Commands
- [ ] `decision-logger context set`
- [ ] `decision-logger draft generate`
- [ ] `decision-logger field lock/unlock`

### 7.3 Interactive Mode
- [ ] Clack prompts for missing arguments
- [ ] Spinners for LLM operations
- [ ] Colored output for decision fields

**Validation Checkpoint 7.x**:
```bash
# Manual testing of full workflow
decision-logger meeting create "Architecture Review"
decision-logger transcript add < transcript.txt
decision-logger context set --decision 1
decision-logger draft generate
decision-logger field lock problem
decision-logger draft regenerate
decision-logger decision log
```

### Phase 7 Exit Criteria
- [ ] All CLI commands functional
- [ ] Interactive prompts working
- [ ] Full workflow executable via CLI

---

## Phase 8: Export & Polish (Days 22-24)

**Goal**: Export functionality and documentation.

### 8.1 Export Formats
- [ ] Markdown export with proper formatting
- [ ] JSON export for programmatic use
- [ ] CLI commands: `decision-logger export --format md|json`

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
