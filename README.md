# μ democracy

Decision Logger is a schema-first monorepo for turning meeting discussion into structured decision records. It combines transcript ingestion, AI-assisted decision triage and draft generation, iterative field refinement, and exportable final decision logs across a shared core used by the API, CLI, web UI, and a separate transcription service.

## What this repository contains

- **Core decision workflow**
  - meetings, transcript ingestion, flagged decisions, decision contexts, draft generation, locking/regeneration, final decision logs
- **Multiple interfaces over one shared core**
  - Hono API, HTTP client CLI, web app, and a standalone transcription service
- **Schema-first architecture**
  - `packages/schema` is the canonical source for domain contracts and shared validation
- **Architecture docs**
  - evergreen semantics and boundaries in `docs/`
  - sequencing, proposals, and rollout detail in `docs/plans/`

## Architecture at a glance

```text
apps/web ─┐
apps/cli ─┼──> apps/api ───> packages/core ───> packages/db
          │                         │               │
          │                         └───────────────┴──> packages/schema
          │
apps/transcription ────────────────> apps/api text endpoints
```

- **`packages/schema`**
  - canonical Zod schemas and inferred types
- **`packages/db`**
  - Drizzle schema, migrations, repositories, seed data
- **`packages/core`**
  - services, orchestration, LLM integration, business logic
- **`apps/api`**
  - Hono routes and OpenAPI surface
- **`apps/cli`**
  - HTTP client over the API
- **`apps/web`**
  - facilitator and shared-display meeting UI
- **`apps/transcription`**
  - separate audio-to-text service that feeds text events into the core API

## Start here

- **Project and architecture hub**
  - `docs/OVERVIEW.md`
- **Local setup and validation**
  - `docs/development-setup.md`
- **Agentic contributor workflow**
  - `docs/agentic-setup-guide.md`
- **Architectural guardrails**
  - `docs/agentic-development-standards.md`
- **Implementation sequencing**
  - `docs/plans/iterative-implementation-plan.md`

## Quick start

### Prerequisites

- **Node.js**
  - `20+` recommended
- **pnpm**
  - `8+`
- **Docker**
  - required for the local PostgreSQL stack
- **LLM API key**
  - `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

### Minimal happy path

```bash
pnpm install
cp .env.example .env
pnpm up:stack
pnpm build
```

The compose-backed stack starts:

- **PostgreSQL**
  - `localhost:5433`
- **API**
  - `http://localhost:3001`

When the API is running:

- **Swagger UI**
  - `http://localhost:3001/docs`
- **OpenAPI JSON**
  - `http://localhost:3001/openapi.json`

For detailed setup, validation, migration flow, and troubleshooting, use `docs/development-setup.md`.

## Working with the system

### Common root commands

```bash
pnpm up:stack
pnpm down:stack
pnpm build
pnpm test
pnpm type-check
pnpm lint
pnpm validate:fast
```

### Focused app commands

```bash
pnpm --filter @repo/api dev
pnpm --filter @repo/web dev
pnpm --filter @repo/transcription build
```

## Documentation map

### Overview and doc map

- **`docs/OVERVIEW.md`**
  - product scope, domain model, package boundaries, reading order, architecture hub

### Architecture and behavior

- **`docs/versioning-architecture.md`**
  - decision context, field versioning, rollback, completion model
- **`docs/transcription-architecture.md`**
  - separate transcription boundary, batch/live flows, service contract
- **`docs/ui-ux-overview.md`**
  - facilitator vs shared-display UX and route-level product behavior
- **`docs/field-library-architecture.md`**
  - field/template semantics and prompt ownership

### Setup and contributor guidance

- **`docs/development-setup.md`**
  - local environment, migrations, validation, troubleshooting
- **`docs/agentic-setup-guide.md`**
  - recommended context-loading and execution workflow for coding agents
- **`docs/agentic-development-standards.md`**
  - guardrails for layering, schema ownership, and service boundaries

### Plans and proposals

- **`docs/plans/iterative-implementation-plan.md`**
  - milestone order and current delivery status
- **`docs/plans/`**
  - proposal docs, rollout plans, and time-bound implementation sequencing

## README ownership in this repo

- **Root `README.md`**
  - project entrypoint, monorepo orientation, core links
- **`docs/OVERVIEW.md`**
  - authoritative docs hub and scope summary
- **Package or app README files**
  - local setup, commands, and troubleshooting for that surface only

## Notes for contributors

- **Schema-first rule**
  - structural domain changes start in `packages/schema`
- **Docs rule**
  - evergreen docs explain semantics and responsibilities; `docs/plans/` explains rollout and proposed changes
- **Transcription boundary**
  - audio processing lives outside the core API; the API accepts text events

## Related README files

- **Transcription service**
  - `apps/transcription/README.md`
- **Web prototype**
  - `apps/web-prototype/README.md`
- **Transcription fixtures**
  - `test-cases/transcription/README.md`

## License

MIT
