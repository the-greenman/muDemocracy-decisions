# Decision Logger

A context-driven decision logging system with LLM-assisted extraction, iterative field refinement with locking, and structured decision logs.

## Overview

Decision Logger helps teams create structured decision logs from meeting transcripts through iterative, context-aware refinement. The system uses LLM (Claude) to detect decisions and extract structured information, while giving users full control over the refinement process through field locking and context tagging.

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
- PostgreSQL 16+ with pgvector
- Claude API key

### Installation

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and ANTHROPIC_API_KEY

# Run migrations
npm run db:migrate

# Build
npm run build
```

### Usage

```bash
# Create a meeting
decision-logger meeting create "Housing Coop Committee - Feb 2026" \
  --date 2026-02-27 \
  --participants "Alice,Bob,Carol,David"

# Set active meeting context
decision-logger context set-meeting mtg_abc123

# Upload transcript (uses active meeting)
decision-logger transcript upload transcript.json

# View flagged decisions (uses active meeting)
decision-logger decisions flagged

# Set decision context (uses default template if not specified)
decision-logger context set-decision flag_xyz

# Or specify a template explicitly
# decision-logger context set-decision flag_xyz --template budget-approval

# Add more content (auto-tagged with decision context)
decision-logger transcript add \
  --speaker "Alice" \
  --text "The contractor quoted £45,000 for full replacement"

# Focus on specific field
decision-logger context set-field options

# Add field-specific content
decision-logger transcript add \
  --speaker "Bob" \
  --text "Option 1: Full replacement for £45k, lasts 20 years"

# Generate draft (uses active decision context)
decision-logger draft generate

# View draft
decision-logger draft show

# Manually update a field value (provide feedback to AI)
decision-logger draft update-field options \
  --value "Option 1: Full replacement for £45k, lasts 20 years\nOption 2: Patch repair for £12k, lasts 3 years"

# Request expert AI advice (with MCP access to policies and archive)
decision-logger draft expert-advice policy-compliance
decision-logger draft expert-advice risk-assessment --focus "budget implications"

# Lock satisfied fields
decision-logger draft lock-field options

# Regenerate unlocked fields
decision-logger draft regenerate

# Log final decision (immutable once created)
decision-logger decision log \
  --type "consensus" \
  --details "All committee members agreed" \
  --actors "Alice,Bob,Carol,David" \
  --logged-by "Alice"

# Export
decision-logger decision export log_final_123 --format markdown > decision.md
```

## API

The system provides a REST API built with Hono. See [OpenAPI specification](./docs/openapi.yaml) for complete API documentation.

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
- `POST /api/meetings/{id}/transcripts/add` - Add single segment
- `GET /api/meetings/{id}/segments` - Get segments (with context filter)

**Decisions:**
- `GET /api/meetings/{id}/flagged-decisions` - Get flagged decisions
- `POST /api/meetings/{id}/context/decision` - Set decision context (optional templateId)
- `POST /api/meetings/{id}/context/field` - Set field focus
- `POST /api/decision-contexts/{id}/generate-draft` - Generate draft
- `POST /api/decision-contexts/{id}/update-field` - Manually update field value
- `POST /api/decision-contexts/{id}/expert-advice` - Request expert AI advice (with MCP)
- `POST /api/decision-contexts/{id}/lock-field` - Lock field
- `POST /api/decision-contexts/{id}/unlock-field` - Unlock field
- `POST /api/decision-contexts/{id}/log` - Log final decision (immutable)
- `GET /api/decision-logs/{id}` - Get decision log
- `GET /api/decision-logs/{id}/export` - Export decision

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
- **Database**: PostgreSQL 16+ with pgvector and Drizzle ORM
- **LLM**: Claude 3.5 Sonnet via Vercel AI SDK
- **Validation**: Zod
- **Testing**: Vitest
- **CLI**: Commander.js, Clack, chalk
- **Monorepo**: Turborepo

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format

# Start API server
npm run dev

# Build
npm run build
```

## Documentation

- [Implementation Plan](./docs/PLAN.md) - Detailed implementation plan
- [OpenAPI Spec](./docs/openapi.yaml) - Complete API documentation
- [Example Transcript](./examples/technical-decision-complex.txt) - Sample transcript

## License

MIT

## Contributing

Contributions welcome! Please read the implementation plan and follow the existing code structure.
