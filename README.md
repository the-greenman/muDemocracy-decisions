# μ democracy

A context-driven decision logging system with LLM-assisted extraction, iterative field refinement with locking, and structured decision logs.

## Overview

μ democracy helps teams create structured decision logs from meeting transcripts through iterative, context-aware refinement. The system uses LLM (Claude) to detect decisions and extract structured information, while giving users full control over the refinement process through field locking and context tagging.

## Key Features

- **Meeting Management** - Create meetings with participants (simple names)
- **Transcript Ingestion** - Upload complete transcripts, add chunks, or stream segments
- **Context Tagging** - Auto-tag segments with meeting/decision/field contexts
- **LLM Decision Detection** - Automatically flag potential decisions using Claude
- **Context Switching** - Set active decision and field contexts for targeted content addition
- **Iterative Refinement** - Add content, regenerate fields, lock when satisfied
- **Field Locking** - Lock fields to prevent LLM regeneration while refining others
- **Expert AI Advice** - Request specialized AI consultation with MCP access to policies and archives
- **Decision Methods** - Record how decisions were made with flexible metadata
- **CLI Interface** - Command-line tool for testing the full workflow
- **Export** - Markdown/JSON export of final decisions

## Architecture

```
Meeting → Transcripts → LLM Detection → Flagged Decisions
                                              ↓
                                    Set Decision Context
                                              ↓
                                    Add More Content (auto-tagged)
                                              ↓
                                    Set Field Focus
                                              ↓
                                    Add Field-Specific Content
                                              ↓
                                    Generate Draft
                                              ↓
                                    Lock Satisfied Fields
                                              ↓
                                    Regenerate Unlocked Fields
                                              ↓
                                    Log Final Decision
```

## Context Tagging System

All transcript segments are tagged with contexts:

- `meeting:abc123` - Belongs to meeting
- `decision:xyz789` - Related to specific decision
- `decision:xyz789:options` - Related to decision's options field

This allows:
- Targeted content addition (new segments auto-tagged with active context)
- Field-specific LLM extraction (using only relevant segments)
- One decision context active at a time
- One field focus active at a time

## Standard Decision Template

All fields are text-based:

1. **decision_statement** - The decision being made
2. **decision_context** - Background and context
3. **evaluation_criteria** - Criteria used to evaluate options
4. **options** - Available options (Option1, Option2, etc.)
5. **tradeoffs** - Trade-offs between options
6. **consequences_positive** - Positive consequences
7. **consequences_negative** - Negative consequences
8. **assumptions** - Assumptions made
9. **reversibility** - How reversible is this decision
10. **review_triggers** - When should this decision be reviewed

## For AI Agents (Claude Code / Cascade)

**Start here**: Read `.cascade/README.md` for agentic development workflow.

**Full guide**: See `docs/agentic-setup-guide.md` for complete instructions.

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (via Docker — see `docker-compose.yml`)
- Claude API key

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and ANTHROPIC_API_KEY

# Start a working DB + API stack
pnpm up:stack

# Build
pnpm build
```

### Workspace validation notes

- Run `pnpm build` before assuming downstream workspace packages can consume published declarations.
- Run `pnpm type-check` after package metadata, tsconfig layering, or declaration output changes.
- If package-local app type-check differs from root validation, verify whether the app is resolving workspace source paths or published declaration entrypoints.
- Keep declaration ownership explicit: if `tsc` emits declarations for a package, `tsup` should bundle JavaScript only.
- `pnpm dev` remains sensitive to workspace declaration surfaces under `tsx`; if dev fails while build and type-check pass, inspect package declaration barrel imports before reopening broader tsconfig changes.

### Package declaration rules

- Workspace package API declarations must be emitted from TypeScript source by `tsc`.
- `tsup` owns JavaScript bundling only and must not be the declaration owner for workspace packages.
- Checked-in package API `.d.ts` files are not allowed under `packages/**`; the only allowed checked-in `.d.ts` files are explicit ambient declarations such as `apps/web/src/vite-env.d.ts`.
- App build/dev tsconfigs should resolve workspace packages through normal workspace source/package entrypoints.
- If an app needs consumer-style declaration validation, use a dedicated `tsconfig.typecheck.json` that resolves package declaration entrypoints separately from the build/dev config.
- Run `pnpm lint:workspace` after changing package build scripts, tsconfig layering, or declaration output behavior.

### Schema, type, and database change workflow

When a change affects schema, types, or the database, use this order:

1. Update the canonical schema/type definitions in `packages/schema`.
2. Update `packages/db/src/schema.ts` and any affected DB/runtime code.
3. Run `pnpm db:generate` to produce committed Drizzle SQL and metadata.
4. Review the generated migration artifacts in `packages/db/drizzle/`.
5. Run `pnpm db:migrate` to apply committed migrations.
6. Run validation:

```bash
pnpm build
pnpm type-check
pnpm lint:workspace
pnpm --filter @repo/db test
pnpm db:migrate
```

### Running the system

```bash
# One command: start postgres, apply committed migrations, build/start API, and wait for health
pnpm up:stack
```

This starts:

- PostgreSQL on `localhost:5433`
- API on `http://localhost:3001`

Useful follow-up commands:

```bash
# Stop compose services
docker compose down

# Apply committed schema changes
pnpm db:migrate

# Direct-push current schema to a disposable local DB only
pnpm db:push
```

### Usage

```bash
# Create a meeting
dlogger meeting create "Housing Coop Committee - Feb 2026" \
  --date 2026-02-27 \
  --participants "Alice,Bob,Carol,David"

# Set active meeting context
dlogger context set-meeting mtg_abc123

# Upload transcript (uses active meeting)
dlogger transcript upload transcript.json

# View flagged decisions (uses active meeting)
dlogger decisions flagged

# Set decision context (uses default template if not specified)
dlogger context set-decision flag_xyz

# Or specify a template explicitly
# dlogger context set-decision flag_xyz --template budget-approval

# Add more content (auto-tagged with decision context)
dlogger transcript add \
  --speaker "Alice" \
  --text "The contractor quoted £45,000 for full replacement"

# Focus on specific field
dlogger context set-field options

# Add field-specific content
dlogger transcript add \
  --speaker "Bob" \
  --text "Option 1: Full replacement for £45k, lasts 20 years"

# Generate draft (uses active decision context)
dlogger draft generate

# View draft
dlogger draft show

# Manually update a field value (provide feedback to AI)
dlogger draft update-field options \
  --value "Option 1: Full replacement for £45k, lasts 20 years\nOption 2: Patch repair for £12k, lasts 3 years"

# Request expert AI advice (with MCP access to policies and archive)
dlogger draft expert-advice policy-compliance
dlogger draft expert-advice risk-assessment --focus "budget implications"

# Lock satisfied fields
dlogger draft lock-field options

# Regenerate unlocked fields
dlogger draft regenerate

# Log final decision (immutable once created)
dlogger decision log \
  --type "consensus" \
  --details "All committee members agreed" \
  --actors "Alice,Bob,Carol,David" \
  --logged-by "Alice"

# Export
dlogger decision export log_final_123 --format markdown > decision.md
```

## API

The system provides a REST API built with Hono. When the API is running, use `/docs` for Swagger UI or `/openapi.json` for the generated OpenAPI document. The checked-in [OpenAPI spec](./docs/openapi.yaml) is a transitional reference until the static file is fully decommissioned.

### Docker Compose

Use Docker Compose when you want PostgreSQL and the built API server running together.

```bash
# Recommended: one command for a working stack
pnpm up:stack
```

Equivalent manual flow:

```bash
docker compose up -d postgres
pnpm db:migrate
docker compose up --build -d api
```

Safe LLM configuration examples:

```bash
# Anthropic
export ANTHROPIC_API_KEY=your-key-here
export LLM_PROVIDER=anthropic
export LLM_MODEL=claude-opus-4-5
pnpm up:stack
```

```bash
# OpenAI
export OPENAI_API_KEY=your-key-here
export LLM_PROVIDER=openai
export LLM_MODEL=gpt-4o
pnpm up:stack
```

The compose file reads API keys from your shell environment and does not hardcode secrets.

By default, the compose-based API is exposed on `http://localhost:3001`. Override with `COMPOSE_API_PORT` if needed.

### Key Endpoints

**Context Management:**
- `GET /api/context` - Get global context (active meeting, decision, field)
- `POST /api/context/meeting` - Set active meeting
- `DELETE /api/context/meeting` - Clear active meeting

**Meetings:**
- `POST /api/meetings` - Create meeting
- `GET /api/meetings` - List meetings
- `GET /api/meetings/{id}` - Get meeting details

**Transcripts:**
- `POST /api/meetings/{id}/transcripts/upload` - Upload transcript

**Decisions:**
- `POST /api/meetings/{id}/flagged-decisions` - Create a flagged decision
- `POST /api/decision-contexts` - Create decision context
- `POST /api/decision-contexts/{id}/generate-draft` - Generate draft
- `GET /api/decision-contexts/{id}/export/markdown` - Export markdown
- `PUT /api/decision-contexts/{id}/lock-field` - Lock field
- `DELETE /api/decision-contexts/{id}/lock-field` - Unlock field
- `GET /api/decision-contexts/{id}/llm-interactions` - Inspect stored LLM interactions

**Templates:**
- `GET /api/templates` - List templates
- `POST /api/templates/{id}/set-default` - Set default template

## Project Structure (Monorepo)

```
decision-logger/
├── apps/
│   ├── api/              # Hono API server
│   ├── cli/              # CLI commands (Commander + Clack)
│   └── mcp/              # MCP Server (optional/future)
├── packages/
│   ├── core/             # Shared business logic & LLM services
│   ├── db/               # Drizzle schema, migrations & client
│   └── types/            # Shared TypeScript types & Zod schemas
├── docs/                 # Documentation
├── turbo.json            # Turborepo configuration
└── package.json          # Workspace root
```

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Hono (API) + Commander.js/Clack (CLI)
- **Database**: PostgreSQL 16+ with Drizzle ORM
- **LLM**: Claude 3.5 Sonnet via Vercel AI SDK
- **Validation**: Zod
- **Testing**: Vitest
- **CLI**: Commander.js, Clack, chalk
- **Monorepo**: Turborepo

## Development

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type check
pnpm type-check

# Lint
pnpm lint

# Format
pnpm format

# Start working stack
pnpm up:stack

# Start API server only in local dev mode
pnpm --filter=@repo/api dev

# Build
pnpm build
```

## Documentation

- [Implementation Plan](./docs/PLAN.md) - Detailed implementation plan
- [OpenAPI Spec](./docs/openapi.yaml) - Transitional static reference; runtime docs are served from the API
- [Example Transcript](./examples/technical-decision-complex.txt) - Sample transcript

## License

MIT

## Contributing

Contributions welcome! Please read the implementation plan and follow the existing code structure.
