---
name: validation-checkpoint
description: Use after completing a phase or significant change to run the relevant validation checkpoint from the iterative implementation plan and confirm exit criteria before proceeding.
---

# Validation Checkpoint

Use this workflow to verify implementation against the current phase.

## Workflow

1. Identify the current phase in `docs/iterative-implementation-plan.md`.
2. Find the matching validation checkpoint and exit criteria.
3. Run the listed commands exactly or the nearest current equivalent.
4. Confirm command success, expected output, and stated thresholds.
5. If any check fails, stop, diagnose, fix, and re-run before continuing.

## Rules

- Do not proceed on failing checkpoints.
- Use the plan document as the source of truth for what “done” means.

## Common Checks

```bash
pnpm test --filter=@repo/core
pnpm test:e2e
curl http://localhost:3000/docs
```

## References

- `docs/iterative-implementation-plan.md`
- `docs/PLAN.md`
- `.claude/skills/validation-checkpoint.md`
