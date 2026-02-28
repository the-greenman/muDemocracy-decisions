---
name: field-library-management
description: Use when adding or updating decision fields, template field assignments, or field-library seed data, including prompt metadata and verification through field/template commands.
---

# Field Library Management

Use this workflow when changing the field library or template composition.

## Workflow

1. Read `docs/field-library-architecture.md`.
2. Update field definitions in the field-library seed source.
3. Update template assignments in the template seed source.
4. Keep field definitions reusable; do not hardcode template-specific copies.
5. If extraction behavior changes, bump the field prompt version.
6. Run the relevant seed/setup command if the repo uses one.
7. Verify the new field and template composition through CLI or tests.

## Rules

- Never hardcode field lists in application logic.
- Prefer reusable field definitions over template-specific duplication.
- Treat the database-backed field library as the source of truth.

## Checks

```bash
decision-logger field list
decision-logger field show <field-id>
decision-logger template show <template-id>
```

## References

- `docs/field-library-architecture.md`
- `docs/prompt-engineering.md`
- `.claude/skills/field-library-management.md`
