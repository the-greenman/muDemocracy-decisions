# Decision Logger - AI Assistant Context

## Project Overview

**Decision Logger** is a meeting decision documentation system that captures, structures, and logs decisions from meeting transcripts using LLM-powered analysis.

**Core Innovation**: Detects **implicit decisions** (decisions NOT to act) - often the most important decisions to document.

## Key Concepts

### The Decision Workflow

1. **Transcript Upload** → LLM detects decisions (including implicit ones)
2. **Flagged Decisions** → User selects which to document
3. **Decision Context** → Iterative refinement with field locking
4. **Decision Log** → Immutable final record

### Critical: Implicit Decision Detection

**Patterns we must catch**:
- "I want alignment" → Decision to defer
- "I don't like these options" → Decision to reject and seek alternatives
- "Let's focus on X instead" → Decision to deprioritize Y
- Consensus by silence → Implicit approval

See `docs/decision-detection-architecture.md` for complete patterns.

### Field Library Architecture

**Fields are atomic units**:
- Defined once in library (e.g., `decision_statement`, `options`, `roi_analysis`)
- Reusable across templates
- Each has its own extraction prompt
- Stored in database, not code

**Templates are field collections**:
- Technology Selection (11 fields)
- Budget Approval (10 fields)
- Strategy Decision (9 fields)
- Standard Decision (10 fields)
- Policy Change (8 fields)
- Proposal Acceptance (7 fields)

See `docs/field-library-architecture.md` for details.

## Architecture Principles

### 1. Zod as Single Source of Truth

**All schemas defined in Zod** (`packages/schema`):
- TypeScript types → inferred from Zod
- Database schema → generated via `drizzle-zod`
- OpenAPI spec → auto-generated via `@hono/zod-openapi`

**Never write manual types** - always infer from Zod.

### 2. Strict Layering (One-Way Dependencies)

```
apps (CLI, API)
  ↓
packages/core (services, business logic)
  ↓
packages/db (repositories, Drizzle ORM)
  ↓
packages/schema (Zod schemas - SSOT)
```

**Cannot create circular dependencies**.

### 3. Test-Driven Development (Required)

**Workflow**:
1. Write failing test
2. Implement minimal code
3. Run test (should pass)
4. Refactor if needed

**Every service has**:
- Unit tests (with mocks)
- Integration tests (with real DB)
- >80% coverage required

### 4. Service-Repository Pattern

**Services** (business logic):
```typescript
export class MeetingService {
  constructor(private repo: IMeetingRepository) {}
  
  async create(data: CreateMeetingInput): Promise<Meeting> {
    // Validation and business logic
    return this.repo.create(data);
  }
}
```

**Repositories** (data access):
```typescript
export interface IMeetingRepository {
  create(data: NewMeeting): Promise<Meeting>;
  findById(id: string): Promise<Meeting | null>;
}
```

**Dependency Injection** - services receive dependencies via constructor.

### 5. Prompts as Data (Versioned)

**Decision detection prompt**:
- Stored in `prompts/decision-detection.md`
- Versioned (currently v3)
- Tested with metrics (precision/recall/F1)

**Field extraction prompts**:
- Stored in database (`decision_fields.extraction_prompt`)
- Each field has its own prompt
- Version tracked per field

## Current Implementation Status

**Phase 0**: Not started (vertical slice)
**Target**: Phase 0-8 over ~24 days

See `docs/iterative-implementation-plan.md` for complete roadmap.

## File Organization

### Documentation (Read First)

**Product & Architecture**:
- `docs/PLAN.md` - **Product spec (SOURCE OF TRUTH)**
- `docs/architecture-proposal.md` - Technical patterns
- `docs/iterative-implementation-plan.md` - Phase-by-phase roadmap

**Domain Knowledge**:
- `docs/field-library-architecture.md` - Field + template system
- `docs/decision-detection-architecture.md` - Implicit decision patterns
- `docs/prompt-engineering.md` - Prompt refinement workflow
- `docs/api-state-visibility-analysis.md` - API completeness

**Agentic Development**:
- `docs/agentic-setup-guide.md` - **Complete workflow for AI agents**
- `.cascade/README.md` - Quick reference

### Code Structure

```
windsurf-project/
├── apps/
│   ├── api/          # Hono API (@hono/zod-openapi)
│   └── cli/          # Commander CLI (Clack for prompts)
├── packages/
│   ├── schema/       # Zod schemas (SSOT)
│   ├── db/           # Drizzle ORM + repositories
│   └── core/         # Services + business logic
├── prompts/          # LLM system prompts
├── test-cases/       # LLM test corpus
└── docs/             # Architecture & domain docs
```

## Technology Stack

**Backend**:
- Node.js 20+
- Hono (web framework)
- PostgreSQL 16+ (no pgvector needed for MVP)
- Drizzle ORM
- Zod (validation + SSOT)

**LLM**:
- Vercel AI SDK
- Claude 3.5 Sonnet (via Anthropic API)
- Structured output with Zod schemas

**CLI**:
- Commander.js (routing)
- Clack (interactive prompts)

**Testing**:
- Vitest (unit + integration)
- Property-based testing (planned)

**Monorepo**:
- Turborepo
- pnpm workspaces

## Development Skills

Use the focused workflow guides in `.claude/skills/` instead of duplicating task procedures here.

**Current active skills**:
- `.claude/skills/zod-schema-management.md` - Zod-first schema changes
- `.claude/skills/tdd-service-implementation.md` - service implementation workflow
- `.claude/skills/api-endpoint-implementation.md` - API route + OpenAPI workflow
- `.claude/skills/field-library-management.md` - field and template library changes
- `.claude/skills/validation-checkpoint.md` - phase validation and exit checks

When a task matches one of these workflows, use the skill file as the procedural guide and use `docs/PLAN.md` plus `docs/iterative-implementation-plan.md` as the product/source-of-truth.

## Critical Rules

### ✅ DO

- **Infer types from Zod** - never write manual types
- **Write tests first** - TDD is required
- **Follow strict layering** - apps → core → db → schema
- **Use validation checkpoints** - verify each phase
- **Version prompts** - track improvements with metrics
- **Query field library** - don't hardcode field lists

### ❌ DON'T

- **Skip tests** - TDD is non-negotiable
- **Create circular dependencies** - violates layering
- **Hardcode field lists** - use database queries
- **Modify prompts without testing** - measure F1 score
- **Create manual type definitions** - always infer from Zod
- **Add features not in plan** - follow iterative roadmap

## Domain-Specific Knowledge

### Decision Types

**Technology Selection**: Choosing tools, frameworks, platforms
- Fields: problem_statement, requirements, evaluation_matrix, selected_option

**Strategy Decision**: Direction-setting, priorities
- Fields: strategic_question, current_state, chosen_direction, alignment_with_goals

**Budget Approval**: Financial decisions
- Fields: budget_amount, roi_analysis, cost_breakdown, budget_source

**Policy Change**: Governance and compliance
- Fields: current_policy, proposed_policy, affected_stakeholders, compliance_requirements

**Proposal Acceptance**: Yes/no on proposals
- Fields: proposal_title, proposer, acceptance_rationale, stakeholder_concerns

**Standard Decision**: General-purpose fallback
- Fields: decision_statement, options, consequences, assumptions

### Context Management

**Global context** (CLI state):
- Active meeting
- Active decision context
- Active field

**Context tagging** (transcript segments):
```
segment 1: ["meeting:abc"]
segment 2: ["meeting:abc", "decision:xyz"]
segment 3: ["meeting:abc", "decision:xyz", "decision:xyz:options"]
```

**Field-specific segments get highest priority** in LLM extraction.

### Field Locking

**Workflow**:
1. Generate initial draft (all fields)
2. Lock satisfied fields
3. Set field focus
4. Add more transcript segments
5. Regenerate (only unlocked fields)
6. Repeat until all fields locked
7. Log decision (immutable)

## API Endpoints (Key Ones)

**State visibility** (for web UI):
```typescript
GET /api/context  // Global state
GET /api/meetings/:id/summary  // Stats
GET /api/meetings/:id/decision-contexts  // Drafts list
GET /api/flagged-decisions/:id/context  // Resume work
```

**Decision workflow**:
```typescript
POST /api/meetings/:id/transcripts/upload  // Upload + detect
GET /api/meetings/:id/flagged-decisions  // List flagged
POST /api/decision-contexts/:id/generate-draft  // Generate
POST /api/decision-contexts/:id/lock-field  // Lock
POST /api/decision-contexts/:id/regenerate-field  // Regenerate one
POST /api/decision-contexts/:id/log  // Finalize
```

See `docs/PLAN.md` for complete API spec.

## Success Criteria

**Agent is working well if**:
- ✅ All tests pass after changes
- ✅ Validation checkpoints succeed
- ✅ Coverage stays >80%
- ✅ OpenAPI spec auto-updates
- ✅ No circular dependencies
- ✅ CLI commands work as documented

**Agent needs guidance if**:
- ❌ Tests fail after changes
- ❌ Creating manual type definitions
- ❌ Skipping TDD workflow
- ❌ Modifying prompts without metrics
- ❌ Adding features not in plan

## Development Commands

```bash
# Setup
pnpm install
docker-compose up -d
pnpm db:push
pnpm db:seed

# Development
pnpm dev                     # All apps
pnpm dev --filter=apps/api   # API only
pnpm dev --filter=apps/cli   # CLI only

# Testing
pnpm test                    # All tests
pnpm test --filter=@repo/core  # Core only
pnpm test:coverage           # With coverage
pnpm test:llm                # LLM integration tests
pnpm test:e2e                # API E2E tests

# Validation
pnpm check:consistency       # Zod ↔ Drizzle ↔ OpenAPI (planned)
pnpm check:deps              # Circular dependency check (planned)

# Database
pnpm db:push                 # Push schema changes
pnpm db:seed                 # Seed field library + templates
pnpm db:studio               # Drizzle Studio UI
```

## Next Steps

**Current phase**: Phase 0 (not started)

**Immediate tasks**:
1. Set up monorepo structure
2. Create Zod schemas for core entities
3. Implement first vertical slice (meeting CRUD)
4. Add first CLI command
5. Verify TDD workflow

See `docs/iterative-implementation-plan.md` for complete roadmap.

## Questions to Ask

**Before implementing**:
- Which phase am I working on?
- What are the validation checkpoints?
- Are there related domain docs to read?
- Does this follow TDD workflow?
- Does this respect strict layering?

**During implementation**:
- Am I inferring types from Zod?
- Have I written tests first?
- Am I using the field library (not hardcoding)?
- Am I following the Service-Repository pattern?

**After implementation**:
- Do all tests pass?
- Does the validation checkpoint succeed?
- Is coverage still >80%?
- Did OpenAPI spec auto-update?
- Are there any circular dependencies?

## Resources

**Essential reading**:
1. `docs/PLAN.md` - Product spec
2. `docs/iterative-implementation-plan.md` - Implementation roadmap
3. `docs/agentic-setup-guide.md` - Complete agent workflow

**Domain knowledge**:
- `docs/field-library-architecture.md`
- `docs/decision-detection-architecture.md`
- `docs/prompt-engineering.md`

**Quick reference**:
- `.cascade/README.md`
