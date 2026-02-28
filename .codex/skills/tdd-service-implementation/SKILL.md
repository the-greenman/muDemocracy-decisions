---
name: tdd-service-implementation
description: Use when creating or modifying services in packages/core using the service-repository pattern, strict TDD, dependency injection, and coverage verification.
---

# TDD Service Implementation

Use this workflow for service-layer business logic.

## Workflow

1. Read the relevant architecture guidance before changing service structure.
2. Define or update the service interface.
3. Write the failing unit test first.
4. Implement the minimal service logic with constructor-injected dependencies.
5. Re-run unit tests.
6. Add or update integration tests for repository-backed behavior.
7. Re-run coverage checks.

## Rules

- Tests first.
- Services contain business logic; repositories contain persistence logic.
- Keep dependency flow aligned with `apps -> core -> db -> schema`.

## Checks

```bash
pnpm test --filter=@repo/core
pnpm test:coverage
```

## References

- `docs/architecture-proposal.md`
- `docs/agentic-development-standards.md`
- `.claude/skills/tdd-service-implementation.md`
