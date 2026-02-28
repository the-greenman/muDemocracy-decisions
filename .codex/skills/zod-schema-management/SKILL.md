---
name: zod-schema-management
description: Use when creating or updating Zod schemas in packages/schema, including inferred TypeScript types, validation rules, and downstream API/database contract checks.
---

# Zod Schema Management

Use this workflow for schema-first changes.

## Workflow

1. Read the existing schema definitions in `packages/schema`.
2. Add or update the Zod schema.
3. Export the inferred TypeScript type from the schema.
4. Avoid manual duplicate interfaces for the same entity.
5. Verify downstream consumers such as API routes and persistence mappings still align.

## Rules

- Zod is the schema source of truth.
- Prefer `z.infer<typeof Schema>` over manual type duplication.
- Re-check request/response contracts after schema changes.

## Checks

```bash
pnpm test --filter=@repo/schema
curl http://localhost:3000/docs
```

## References

- `docs/architecture-proposal.md`
- `docs/agentic-development-standards.md`
- `.claude/skills/zod-schema-management.md`
