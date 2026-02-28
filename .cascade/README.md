# Cascade Agent Instructions

## Quick Start for AI Agents

This project is designed for agentic development with Claude Code and Cascade.

### Before You Start

**Read these files in order**:
1. `docs/PLAN.md` - Product specification (what we're building)
2. `docs/iterative-implementation-plan.md` - Implementation roadmap (how we're building it)
3. `docs/agentic-setup-guide.md` - **Complete agentic workflow guide**

### Current Phase

Check `docs/iterative-implementation-plan.md` to find the current phase and tasks.

### Architecture Rules

**CRITICAL**: Follow these strictly:

1. **Zod is SSOT**: All schemas in `packages/schema`, types inferred
2. **TDD Required**: Write test first, then implement
3. **One-way deps**: `apps` → `packages/core` → `packages/db` → `packages/schema`
4. **No manual types**: Always infer from Zod
5. **Validation checkpoints**: Run after each phase

### Common Tasks

**Add a field**:
```bash
# 1. Read docs/field-library-architecture.md
# 2. Add to packages/db/src/seed/fields.ts
# 3. Run: pnpm db:seed
# 4. Verify: decision-logger field list
```

**Add an endpoint**:
```bash
# 1. Check docs/PLAN.md for spec
# 2. Write test in apps/api/src/__tests__/
# 3. Implement route with @hono/zod-openapi
# 4. Run: pnpm test:e2e
```

**Refine a prompt**:
```bash
# 1. Read docs/prompt-engineering.md
# 2. Update prompts/decision-detection.md
# 3. Test: pnpm test:llm
# 4. Measure: Check F1 score improvement
```

### Validation

After making changes:
```bash
pnpm test                    # All tests pass
pnpm test:coverage           # >80% coverage
pnpm check:consistency       # Zod ↔ Drizzle ↔ OpenAPI aligned
```

### Documentation

**Read before coding**:
- `docs/agentic-setup-guide.md` - **Complete agent workflow**
- `docs/architecture-proposal.md` - Technical patterns
- `docs/field-library-architecture.md` - Field system
- `docs/decision-detection-architecture.md` - LLM decision detection

### Help

If stuck, read `docs/agentic-setup-guide.md` - it has:
- Common tasks with step-by-step instructions
- Pitfalls to avoid
- Validation commands
- Success criteria

## Project Structure

```
windsurf-project/
├── apps/
│   ├── api/          # Hono API server
│   └── cli/          # Commander CLI
├── packages/
│   ├── schema/       # Zod schemas (SSOT)
│   ├── db/           # Drizzle + repositories
│   └── core/         # Services + business logic
├── docs/             # Architecture & domain docs
├── prompts/          # LLM system prompts
└── test-cases/       # LLM test corpus
```

## Key Principles

1. **Zod First**: Define in Zod, generate everything else
2. **TDD**: Test → Implement → Pass → Refactor
3. **DI**: Services receive dependencies via constructor
4. **Layered**: Strict one-way dependencies
5. **Validated**: Every phase has concrete checkpoints

## Success Criteria

✅ All tests pass  
✅ Coverage >80%  
✅ Validation checkpoints succeed  
✅ No circular dependencies  
✅ OpenAPI spec auto-updates  

❌ Manual type definitions  
❌ Skipped tests  
❌ Hardcoded field lists  
❌ Untested prompt changes  
