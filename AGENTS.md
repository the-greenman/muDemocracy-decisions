# AGENTS.md instructions for /home/greenman/dev/CascadeProjects/windsurf-project

## Skills

A skill is a set of local instructions stored in a `SKILL.md` file. Use the repo-local Codex skills below when the task matches their described workflow.

### Available skills

- `api-endpoint-implementation`: Add or update Hono API endpoints, including Zod schemas, integration tests, `@hono/zod-openapi` routes, and OpenAPI verification. (file: `/home/greenman/dev/CascadeProjects/windsurf-project/.codex/skills/api-endpoint-implementation/SKILL.md`)
- `field-library-management`: Add or update decision fields, template field assignments, and field-library seed data. (file: `/home/greenman/dev/CascadeProjects/windsurf-project/.codex/skills/field-library-management/SKILL.md`)
- `tdd-service-implementation`: Create or modify `packages/core` services using strict TDD, DI, and the service-repository pattern. (file: `/home/greenman/dev/CascadeProjects/windsurf-project/.codex/skills/tdd-service-implementation/SKILL.md`)
- `validation-checkpoint`: Run the relevant validation checkpoint from the iterative implementation plan before moving forward. (file: `/home/greenman/dev/CascadeProjects/windsurf-project/.codex/skills/validation-checkpoint/SKILL.md`)
- `zod-schema-management`: Create or update Zod schemas and inferred types in `packages/schema`. (file: `/home/greenman/dev/CascadeProjects/windsurf-project/.codex/skills/zod-schema-management/SKILL.md`)

## How to use skills

- If the user names a skill explicitly, use it for that turn.
- If the task clearly matches one of the skills above, use the matching skill.
- Read only the `SKILL.md` file first, then load referenced docs only as needed.
- Treat `docs/PLAN.md` and `docs/iterative-implementation-plan.md` as product and implementation source-of-truth when a skill references them.
- Treat passing tests or validation checkpoints as the default commit boundary: make small, coherent commits only after the relevant chunk is validated.
