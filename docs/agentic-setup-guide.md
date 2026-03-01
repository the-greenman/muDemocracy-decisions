# Agentic Development Setup Guide

## For Claude Code & Cascade

This project is designed to be **agentic-friendly** - structured so AI coding assistants can navigate, understand, and contribute effectively.

## Current Agentic-Safe Features

### 1. **Single Source of Truth Architecture**

**Zod schemas as SSOT**:
- All domain models defined in `packages/schema` using Zod
- TypeScript types inferred from schemas (not manually written)
- Database schema generated from Zod via `drizzle-zod`
- OpenAPI spec auto-generated from Zod via `@hono/zod-openapi`

**Why this helps agents**:
- One place to change a field definition → propagates everywhere
- No manual sync between types, DB, and API
- Agents can't create drift between layers

### 2. **Comprehensive Documentation**

**Architecture docs** (read these first):
- `docs/PLAN.md` - Product spec and finalized architecture (SOURCE OF TRUTH)
- `docs/agentic-development-standards.md` - Strict architectural guardrails (Service-Repository, DI, layering, TDD)
- `docs/iterative-implementation-plan.md` - Milestone-based implementation plan (M1–M8)

**Domain-specific docs**:
- `docs/field-library-architecture.md` - Field library + template system
- `docs/decision-detection-architecture.md` - LLM decision detection with implicit patterns
- `docs/field-regeneration-strategy.md` - Field-specific prompts strategy
- `docs/prompt-engineering.md` - Prompt refinement workflow

**Why this helps agents**:
- Agents can read context before making changes
- Clear architectural constraints prevent invalid implementations
- Domain knowledge is explicit, not implicit

### 3. **Test-Driven Development**

**TDD workflow enforced**:
- Write failing test first
- Implement minimal code to pass
- Refactor
- All services have unit + integration tests

**Why this helps agents**:
- Tests serve as executable specifications
- Agents can verify their changes don't break existing behavior
- Clear success criteria for each feature

### 4. **Strict Layering**

**One-way dependencies**:
```
apps (CLI, API)
  ↓
packages/core (services, business logic)
  ↓
packages/db (repositories, Drizzle)
  ↓
packages/schema (Zod schemas - SSOT)
```

**Why this helps agents**:
- Can't accidentally create circular dependencies
- Clear boundaries between layers
- Easy to understand where code belongs

### 5. **Validation Checkpoints**

**Every milestone has concrete validation and exit criteria**:
- M1: Real LLM generates populated draft; `draft debug` shows prompt; LLM interaction stored in DB
- M2: Draft versions stored; rollback restores prior draft; auto-tagging works
- M6: `decisions detect` flags implicit decisions (F1 > 0.77)

**Why this helps agents**:
- Clear definition of "done"
- Agents can self-verify their work
- Prevents proceeding with broken implementations

## Recommended Agentic Workflow

### Step 0: Context Loading

**Before starting work, have the agent read**:

1. **Product context**:
   ```
   Read docs/PLAN.md
   Focus on: Domain entities, API endpoints, CLI commands
   ```

2. **Technical context**:
   ```
   Read docs/agentic-development-standards.md
   Focus on: Service-Repository pattern, DI, strict layering, TDD workflow
   ```

3. **Current milestone**:
   ```
   Read docs/iterative-implementation-plan.md
   Find: Current milestone (M1–M8) and active tasks
   ```

### Step 1: Understand the Task

**Agent should**:
1. Identify which milestone they're implementing
2. Read the milestone goals and tasks
3. Understand validation checkpoints and exit criteria
4. Check for related domain docs (e.g., field-library-architecture.md for field-related work)

### Step 2: TDD Implementation

**Agent workflow**:

1. **Write test first**:
   ```typescript
   // packages/core/src/services/__tests__/meeting.service.test.ts
   describe('MeetingService', () => {
     it('should create meeting with valid data', async () => {
       const service = new MeetingService(mockRepo);
       const meeting = await service.create({
         title: "Test",
         date: "2026-02-27",
         participants: ["Alice"]
       });
       expect(meeting.id).toBeDefined();
     });
   });
   ```

2. **Implement minimal code**:
   ```typescript
   // packages/core/src/services/meeting.service.ts
   export class MeetingService {
     constructor(private repo: IMeetingRepository) {}
     
     async create(data: CreateMeetingInput): Promise<Meeting> {
       return this.repo.create(data);
     }
   }
   ```

3. **Run test**:
   ```bash
   pnpm test --filter=@repo/core
   ```

4. **Verify checkpoint**:
   ```bash
   # From iterative-implementation-plan.md
   pnpm test --filter=@repo/core  # Should pass
   ```

### Step 3: Validation

**Agent should**:
1. Run the validation checkpoint from the milestone plan
2. Verify all tests pass
3. Check coverage if specified
4. Test CLI/API manually if required

### Step 4: Documentation

**Agent should update**:
- Add JSDoc comments to new functions
- Update README if new features added
- Do NOT add comments unless explicitly required

## Agentic Safety Features

### 1. **Automated Consistency Checks**

**Planned for Phase 1**:
```bash
pnpm check:consistency
```

This will verify:
- Zod schemas match Drizzle schemas
- OpenAPI spec matches Zod schemas
- No circular dependencies
- All imports resolve

**Agent benefit**: Can't accidentally create drift.

### 2. **Prompt Versioning**

**All LLM prompts are versioned**:
- `prompts/decision-detection.md` (v3)
- Field extraction prompts in database with version numbers

**Agent benefit**: Can track prompt changes and measure improvements.

### 3. **Field Library as Data**

**Fields are database records, not code**:
- Field definitions in `decision_fields` table
- Extraction prompts stored as JSONB
- Templates reference fields by ID

**Agent benefit**: Can modify prompts without code changes.

### 4. **Immutable Decision Logs**

**Once logged, decisions can't be changed**:
- `decision_logs` table has no UPDATE operations
- Audit trail preserved

**Agent benefit**: Can't accidentally corrupt historical data.

## Common Agentic Tasks

### Task: Add a New Field to the Library

**Steps**:
1. Read `docs/field-library-architecture.md`
2. Add field definition to seed data:
   ```typescript
   // packages/db/src/seed/fields.ts
   {
     id: "implementation_timeline",
     name: "Implementation Timeline",
     category: "implementation",
     extractionPrompt: {
       system: "Extract timeline and milestones...",
       examples: [...],
       constraints: [...]
     },
     fieldType: "structured"
   }
   ```
3. Add to relevant templates in `seed/templates.ts`
4. Run seed: `pnpm db:seed`
5. Verify: `decision-logger field list --category implementation`

### Task: Refine Decision Detection Prompt

**Steps**:
1. Read `docs/decision-detection-architecture.md`
2. Identify failure pattern (e.g., missing "table this" → defer)
3. Update `prompts/decision-detection.md`:
   - Add pattern to implicit defer section
   - Increment version (v3 → v4)
   - Add example
4. Test: `pnpm test:llm -- --grep="decision detection"`
5. Measure: Check precision/recall/F1 improvement
6. Commit with metrics in message

### Task: Add a New API Endpoint

**Steps**:
1. Check `docs/PLAN.md` for endpoint spec
2. Add Zod schema in `packages/schema` if needed
3. Write test in `apps/api/src/__tests__/`
4. Implement route in `apps/api/src/routes/`
5. Use `@hono/zod-openapi` for auto-spec generation
6. Run: `pnpm test:e2e`
7. Verify: `curl http://localhost:3000/docs` shows new endpoint

### Task: Implement a Service

**Steps**:
1. Read milestone tasks in `docs/iterative-implementation-plan.md`
2. Define interface in `packages/core/src/interfaces/`
3. Write unit tests with mock repository
4. Implement service with DI
5. Write integration tests with real DB
6. Run: `pnpm test --filter=@repo/core`
7. Check coverage: `pnpm test:coverage`

## File Organization for Agents

### Quick Reference

**Start here**:
- `docs/PLAN.md` - What we're building
- `docs/iterative-implementation-plan.md` - How we're building it

**Architecture**:
- `docs/agentic-development-standards.md` - Service-Repository pattern, strict layering, TDD rules

**Domain knowledge**:
- `docs/field-library-architecture.md` - Field + template system
- `docs/decision-detection-architecture.md` - Implicit decision patterns
- `docs/prompt-engineering.md` - Prompt refinement process

**Implementation**:
- `packages/schema/` - Zod schemas (SSOT)
- `packages/db/` - Drizzle + repositories
- `packages/core/` - Services + business logic
- `apps/api/` - Hono API
- `apps/cli/` - Commander CLI

**Tests**:
- `packages/*/src/__tests__/` - Unit tests
- `apps/*/src/__tests__/` - Integration tests
- `test-cases/` - LLM test corpus

**Prompts**:
- `prompts/decision-detection.md` - Decision detection
- Database: `decision_fields.extraction_prompt` - Field extraction

## Agent Collaboration Tips

### 1. **Always Read Before Writing**

```bash
# Bad: Start coding immediately
# Good: Read context first
Read docs/PLAN.md
Read docs/iterative-implementation-plan.md (find current phase)
Read relevant domain docs
Then implement
```

### 2. **Follow TDD Strictly**

```bash
# Bad: Write implementation first
# Good: Write test first
1. Write failing test
2. Run test (should fail)
3. Implement minimal code
4. Run test (should pass)
5. Refactor if needed
```

### 3. **Use Validation Checkpoints**

```bash
# Bad: Assume it works
# Good: Run validation checkpoint
From iterative-implementation-plan.md:
  **Validation Checkpoint 2.7**:
  ```bash
  decision-logger field list  # Shows ~25 fields
  ```
Run this exact command and verify output
```

### 4. **Update Documentation**

```bash
# Bad: Leave docs stale
# Good: Update as you go
- Add JSDoc to new functions
- Update README if user-facing changes
- Do NOT add inline comments unless required
```

### 5. **Commit with Context**

```bash
# Bad: Generic commit message
git commit -m "fix bug"

# Good: Descriptive with metrics
git commit -m "refactor(prompts): improve implicit decision detection (v3→v4)

- Added 'table this' pattern for defer decisions
- F1 score: 0.78 → 0.86
- Test: test-cases/implicit-defer.json"
```

## Common Pitfalls for Agents

### ❌ Don't: Create Manual Type Definitions

```typescript
// Bad: Manual type
interface Meeting {
  id: string;
  title: string;
}

// Good: Infer from Zod
import { MeetingSchema } from '@repo/schema';
type Meeting = z.infer<typeof MeetingSchema>;
```

### ❌ Don't: Hardcode Field Lists

```typescript
// Bad: Hardcoded fields
const fields = ['decision_statement', 'options', 'consequences'];

// Good: Query from database
const template = await templateRepo.findById(templateId);
const fields = template.fields.map(f => f.fieldId);
```

### ❌ Don't: Skip Tests

```typescript
// Bad: No tests
export class MeetingService { ... }

// Good: TDD
describe('MeetingService', () => {
  it('should create meeting', async () => { ... });
});
```

### ❌ Don't: Create Circular Dependencies

```typescript
// Bad: apps imports from apps
import { something } from '../../apps/api';

// Good: apps only import from packages
import { something } from '@repo/core';
```

### ❌ Don't: Modify Prompts Without Testing

```typescript
// Bad: Change prompt, commit
Update prompts/decision-detection.md
git commit

// Good: Change, test, measure, commit
Update prompts/decision-detection.md
pnpm test:llm -- --grep="decision detection"
Check metrics (precision/recall/F1)
git commit -m "refactor(prompts): ... F1: 0.78 → 0.86"
```

## Agent-Friendly Commands

### Development

```bash
# Install dependencies
pnpm install

# Start dev environment
docker-compose up -d
pnpm db:push
pnpm db:seed

# Run tests
pnpm test                    # All tests
pnpm test --filter=@repo/core  # Core only
pnpm test:coverage           # With coverage
pnpm test:llm                # LLM integration tests

# Start dev servers
pnpm dev                     # All apps
pnpm dev --filter=apps/api   # API only
pnpm dev --filter=apps/cli   # CLI only

# Consistency checks (planned)
pnpm check:consistency       # Verify Zod ↔ Drizzle ↔ OpenAPI
pnpm check:deps              # Check for circular deps
```

### Validation

```bash
# M1 - LLM draft generation
pnpm cli draft generate --guidance "Focus on cost and timeline"
pnpm cli draft debug      # shows prompt segments + response
pnpm cli draft export --output decision.md

# M2 - Versions
pnpm cli draft versions   # shows snapshots
pnpm cli draft rollback 1

# M5 - API completeness
curl http://localhost:3000/api/context
curl http://localhost:3000/docs

# M6 - Decision detection
pnpm cli decisions detect --meeting-id <id>
pnpm test:llm -- --grep="decision detection"
```

## Success Metrics for Agents

**Agent is working well if**:
1. ✅ All tests pass after changes
2. ✅ Validation checkpoints succeed
3. ✅ No circular dependencies
4. ✅ Coverage stays >80%
5. ✅ OpenAPI spec auto-updates
6. ✅ CLI commands work as documented

**Agent needs guidance if**:
1. ❌ Tests fail after changes
2. ❌ Validation checkpoints fail
3. ❌ Creating manual type definitions
4. ❌ Skipping TDD workflow
5. ❌ Modifying multiple layers for one change
6. ❌ Adding features not in the plan

## Next Steps for Agentic Setup

### Immediate (M1)

1. **Create consistency checker**:
   ```bash
   pnpm check:consistency
   ```
   Verifies Zod ↔ Drizzle ↔ OpenAPI alignment

2. **Add pre-commit hooks**:
   ```bash
   pnpm test
   pnpm check:consistency
   ```

3. **Create agent-friendly README**:
   - Quick start for agents
   - Link to this guide
   - Common tasks

### Future Enhancements

1. **Automated test generation**:
   - Agent generates tests from Zod schemas
   - Property-based testing with fast-check

2. **Prompt test automation**:
   - CI runs LLM tests on prompt changes
   - Blocks merge if F1 score drops

3. **Schema migration automation**:
   - Agent detects schema changes
   - Generates Drizzle migration
   - Updates seed data

4. **Documentation linting**:
   - Verify all public APIs have JSDoc
   - Check for broken links in docs
   - Ensure examples are runnable

## Summary

**This project is agentic-friendly because**:
- Single source of truth (Zod schemas)
- Comprehensive documentation
- TDD enforced
- Strict layering
- Validation checkpoints
- Prompts as data (versionable, testable)

**Agents should**:
- Read docs before coding
- Follow TDD strictly
- Use validation checkpoints
- Avoid manual type definitions
- Test prompt changes with metrics

**Agents should NOT**:
- Skip tests
- Create circular dependencies
- Hardcode field lists
- Modify prompts without testing
- Add features not in the plan
