# Decision Logger Overview

**Document Role**: This is the consolidated product overview, repository orientation, and scope summary. Specialist docs own detailed behavior, schema additions, and endpoint families for their domain. `packages/schema` is the single source of truth for domain contracts.

Decision Logger is a schema-first monorepo for turning meeting discussion into structured decision records. It combines transcript ingestion, AI-assisted decision triage and draft generation, iterative field refinement, and exportable final decision logs across a shared core used by the API, CLI, web UI, and a separate transcription service.

## Recommended Reading Order

- `../README.md`
  - top-level repository entrypoint and quick start
- `docs/OVERVIEW.md`
  - product scope, domain model, package boundaries, and doc map
- `docs/development-setup.md`
  - local setup, migrations, validation, troubleshooting
- `docs/agentic-development-standards.md`
  - layering, schema ownership, and service boundaries
- `docs/plans/iterative-implementation-plan.md`
  - current delivery status and milestone sequencing

Then move into the specialist architecture docs for the area you are changing.

## Repository Shape

The repository is organised as a monorepo with shared business logic and multiple interfaces:

- `apps/api`
  - Hono API and OpenAPI surface
- `apps/cli`
  - HTTP client CLI over the API
- `apps/web`
  - facilitator and shared-display UI
- `apps/transcription`
  - separate audio-to-text service that feeds text events into the API
- `packages/core`
  - business logic, orchestration, LLM integration, service layer
- `packages/db`
  - Drizzle schema, migrations, repositories, seed data
- `packages/schema`
  - canonical Zod schemas and inferred shared types

## Architecture Document Map

Use this document as the hub for the architecture set. Use the root `README.md` for top-level orientation, then move here for the fuller doc map and package/domain boundaries.

### Core product and domain overview

- `docs/OVERVIEW.md`
  - product scope
  - domain model overview
  - capability boundaries
  - architecture document map

### Core decision and versioning model

- `docs/versioning-architecture.md`
  - authoritative semantic rules for field-centric versioning, template changes, rollback, and finalization
- `docs/field-template-versioning-explainer.md`
  - rationale, examples, and operational guidance for the versioning model

### Field, prompt, and regeneration architecture

- `docs/field-library-architecture.md`
  - field-library semantics, template composition model, and prompt ownership
- `docs/field-regeneration-strategy.md`
  - regeneration behavior and evidence-weighting rules

### Transcript and context architecture

- `docs/transcript-context-management.md`
  - transcript ingestion/storage strategy and context-window model
- `docs/context-tagging-strategy.md`
  - chunk tagging and field-level retrieval model
- `docs/transcript-reading-and-segment-selection-architecture.md`
  - readable transcript projection and segment selection behavior
- `docs/ui-ux-overview.md`
  - page-level UX goals, shared-display constraints, and facilitator-mode direction

### Decision detection and workflow architecture

- `docs/decision-detection-architecture.md`
  - prompt design and detection rules
- `docs/decision-detection-implementation-reference.md`
  - detection execution workflow and candidate persistence/refinement behavior
- `docs/manual-decision-workflow.md`
  - manual candidate creation and triage workflows

### Expert and MCP architecture

- `docs/expert-system-architecture.md`
  - expert-system scope and architecture
- `docs/mcp-architecture-strategy.md`
  - MCP integration direction and shared-core pattern

### Export and presentation

- `docs/decision-export-formats.md`
  - export targets, rendering concerns, and export behavior

### Temporal planning and proposals

- `docs/plans/iterative-implementation-plan.md`
  - milestone order, implementation sequencing, validation checkpoints
- `docs/plans/field-versioning-schema-proposal.md`
  - proposed schema changes not yet fully established in canonical code
- `docs/plans/field-versioning-api-proposal.md`
  - proposed API changes not yet fully established in canonical code
- `docs/plans/logging-observability-plan.md`
  - observability rollout plan
- `docs/plans/transcription-service-plan.md`
  - upstream transcription-service planning
- `docs/plans/sliding-window-live-transcription-plan.md`
  - rollout plan for 30s window / 10s step live transcription and dedupe defaults

## Reference vs plan rules

- Evergreen docs in `docs/` should describe stable semantics, responsibilities, and invariants.
- Exact domain structure belongs in `packages/schema`.
- If an architecture doc needs to mention schema or API changes that are not yet canonical, it should reference the relevant `docs/plans/` document instead of restating speculative structure inline.
- `docs/plans/` owns temporal sequencing, rollout order, and proposed-but-not-yet-canonical changes.

## Current Product Shape

- The API, CLI, web UI, and transcription service are all part of the working repository surface.
- The API and CLI share business behavior through `packages/core`.
- The web app is the primary meeting UI surface, with a facilitator route and a separate shared-display route.
- The transcription service remains outside the core API boundary and delivers text events into the system.
- Evergreen docs in `docs/` should describe stable semantics and boundaries; detailed rollout or incomplete proposals should stay in `docs/plans/`.

## Core Requirements (Finalized)

### What We're Building

**Primary Goal**: Help teams create structured decision logs from meeting transcripts through iterative, context-aware refinement.

**Key Features:**
1. **Meeting Management** - Create meetings with participants (simple names)
2. **Transcript Ingestion** - Accept complete uploads, immediate text entries, or buffered streaming transcript events while preserving raw transcript records
3. **Transcript Intelligence** - Build semantic chunks with topics, context tags, optional embeddings, and decision-specific context windows
4. **Decision Triage** - Support AI-flagged and manually flagged decisions, including refinement, prioritization, and dismissal
5. **Context Tagging** - Auto-tag transcript chunks with meeting/decision/field contexts and track field-level chunk relevance
6. **LLM Decision Detection** - Flag potential decisions automatically, with provider choice
7. **Context Switching** - Set active decision and field contexts
8. **Iterative Refinement** - Add content, retrieve field-specific transcript context, regenerate fields, and lock when satisfied
9. **Operational Observability** - Emit structured logs with correlation IDs so requests, commands, streaming, and LLM operations can be debugged live
10. **Expert System** - Support core and custom experts, with MCP-backed tool access and advice history
11. **Decision Methods** - Record how decision was made (text metadata)
12. **CLI Interface** - Command-line and automation-friendly workflow over the API
13. **API Backend** - API surface supporting CLI, web UI, and service integrations
14. **Web UI** - facilitator workflow and shared-display meeting interface
15. **Export** - Markdown/JSON export of final decisions

**Not in Scope:**
- ❌ Audio capture and raw audio processing inside the core system
- ❌ Actor identification from transcripts
- ❌ Real-time collaboration
- ❌ Authentication
- ❌ Embedding audio-processing infrastructure directly into the core API

**Integration Assumptions:**
- Transcript ingestion is transport-agnostic: the core system accepts text transcript events, not raw audio.
- Live transcript events may be produced from upstream windowed audio processing (default 30s window with 10s step) before delivery to core streaming endpoints.
- Local transcription can be added as a separate upstream component, but is not required for the product to function.
- Local LLMs are supported as an optional inference path for detection/classification, not a hard dependency.

> **See**: `docs/plans/transcription-service-plan.md` for the separate containerized transcription service boundary and integration contract
- Detailed workflow and endpoint expansions in specialist docs are authoritative unless they conflict with the Zod schema source-of-truth rule.
- Runtime logging, correlation, and redaction rules are defined in `docs/plans/logging-observability-plan.md`.

## Simplified Data Model

> **Canonical Source**: `packages/schema` is the single source of truth for all domain contracts. Detailed entity requirements are maintained in the specialist architecture docs.

For high-level understanding, the system revolves around these core entities:
1. **Meeting** - The top-level container for a discussion.
2. **TranscriptChunk** - Standardized segments of the meeting transcript with context tags.
3. **FlaggedDecision** - Potential decisions identified by AI or users.
4. **DecisionContext** - The active drafting environment for a specific decision topic, independent of any single meeting.
5. **DecisionLog** - The final, immutable record of a logged decision at a specific decision moment.
6. **DecisionField & Template** - Separately managed definition entities: fields are the primary semantic units, and templates are versioned compositions over fields.

> **Implementation sequencing**: See `docs/plans/iterative-implementation-plan.md` for milestone order, delivery sequencing, validation checkpoints, and rollout details.

### CRUD Expectations

- **Meeting**: full CRUD is required. Meetings need create, list/show, general update (title/date/participants/status), and delete/archive support.
- **FlaggedDecision**: full CRUD is required for manual and AI-assisted triage workflows.
- **DecisionContext**: full CRUD is required. In addition to workflow actions, the system needs canonical create/read/update/delete access to draft contexts.
- **DecisionField** and **DecisionTemplate**: full CRUD is required. The field library and template catalog must support seeded defaults plus user-managed custom records.
- **MCPServer**: full CRUD is required, but this is lower priority than meetings, decision contexts, fields, and templates.
- **RawTranscript**, **TranscriptChunk**, **DecisionContextWindow**, and **ExpertAdvice**: current operational flow is primarily create/read plus targeted updates during use, but these records should still have a planned CRUD lifecycle (including admin cleanup or retention paths) rather than being left unspecified.
- **DecisionLog**: intentionally immutable after creation; expose create/read/export, not update/delete in the normal product flow.


## Field Library & Templates

> **Canonical Source**: `docs/field-library-architecture.md` owns the detailed field definitions, extraction prompts, and template compositions.

The system uses a **field library** architecture where atomic fields are reused across multiple templates.

Fields are the primary reusable definitions. Templates provide broader decision-type framing by composing fields without redefining field meaning.

When a `DecisionContext` is created, it should bind to a specific template definition version and the resolved field-definition set referenced by that template version.

Field and template definition management is separate from draft editing inside a `DecisionContext`.

### Field Categories
Core, Evaluation, Impact, Risk, Financial, Stakeholder, Implementation, Governance.

### Core Templates
Standard Decision, Technology Selection, Budget Approval, Strategy Decision, Policy Change, Proposal Acceptance.

### v1 and v2 boundary

The iterative delivery plan includes local field/template definition management and runtime context migration.

Public definition-package distribution, community sharing, upstream sync, and diff re-import are v2 scope.

### Template Selection

When decisions are flagged, the LLM suggests the most appropriate template:

```bash
decision-logger decisions flagged
# 1. [0.89] Select database technology
#    Template: Technology Selection (confidence: 0.95)
# 2. [0.76] Approve roof repair budget
#    Template: Budget Approval (confidence: 0.88)

# Accept suggested template
decision-logger context set-decision flag_1

# Or override
decision-logger context set-decision flag_1 --template standard-decision
```

## Context Management

### Global Context State

The system maintains a global context with three levels:

1. **Active Meeting** - Which meeting you're currently working with
2. **Active Decision** - Which decision context is in focus
3. **Active Field** - Which field of that decision you're refining

This allows working with multiple meetings without specifying meeting ID in every command.

Important semantic rule:

- the active meeting is workflow context
- it does not own the lifetime of the active `DecisionContext`
- a `DecisionContext` may continue across multiple meetings and off-meeting work periods

### Context Tagging System

#### Tag Format
```
<type>:<id>[:<field>]

Examples:
- "meeting:abc123"
- "decision:xyz789"
- "decision:xyz789:options"
- "decision:xyz789:consequences_positive"
```

#### Tagging Rules
1. All transcript chunks get meeting context tag
2. When decision context active → add decision tag
3. When field focus active → add field tag
4. Tags are cumulative
5. One active meeting at a time (global)
6. One decision context active at a time in the current user workflow
7. One field focus active at a time (per decision)

Additional rules:

- transcript evidence from many meetings may link into the same decision context
- meetings may select open decision contexts into an ordered agenda
- automatically detected or manually flagged decision candidates do not become decision contexts until explicitly promoted

### Example Flow
```bash
# No context set
chunk 1: ["meeting:abc"]

# Set decision context
$ decision-logger context set-decision flag_1
chunk 2: ["meeting:abc", "decision:xyz"]

# Set field focus
$ decision-logger context set-field options
chunk 3: ["meeting:abc", "decision:xyz", "decision:xyz:options"]

# Change field focus
$ decision-logger context set-field decision_rationale
chunk 4: ["meeting:abc", "decision:xyz", "decision:xyz:decision_rationale"]

# Clear field focus
$ decision-logger context clear-field
chunk 5: ["decision:xyz"]
```

## Example Product Workflow

### 1. Create Meeting
```bash
$ decision-logger meeting create "Housing Coop Committee - Feb 2026" \
  --date 2026-02-27 \
  --participants "Alice,Bob,Carol,David"
Created meeting: mtg_123
```

### 2. Set Active Meeting
```bash
$ decision-logger context set-meeting mtg_123
Active meeting: Housing Coop Committee - Feb 2026
```

Now all subsequent commands will use this meeting by default.

The meeting provides immediate workflow context, transcript capture scope, and agenda scope, but it does not define the full lifetime of any decision context.

### 3. Add Transcripts
```bash
# Upload complete transcript (context-aware, uses active meeting)
$ decision-logger transcript upload transcript.json

# Or add transcript text immediately
$ decision-logger transcript add \
  --text "I think we should approve the roof repair" \
  --speaker "Alice"

# Or stream transcript events from an external producer
$ decision-logger transcript stream < live.txt
```

Transcript entries captured in one meeting may later support a decision context that remains open across future meetings.

### 4. View Flagged Decisions

```bash
$ decision-logger decisions flagged
1. [0.89] Approve roof repair budget (chunks 12-18)
2. [0.76] Update guest parking policy (chunks 25-30)
```

### 5. Candidate review and promotion

Potential decisions may be detected or flagged before a `DecisionContext` exists.

Important rule:

- a `FlaggedDecision` is a candidate
- a `DecisionContext` is the actively managed drafting workspace
- promotion is the explicit boundary between them

Promotion should:

- create or link a `DecisionContext`
- make the decision topic eligible for ordered meeting agendas
- preserve the distinction between lightweight candidate review and long-running draft ownership

### 6. Set Decision Context
```bash
# Option 1: Use default template
$ decision-logger context set-decision flag_1
Active decision: "Approve roof repair budget" (dec_xyz)
Template: Standard Decision (default)

# Option 2: Specify template explicitly
$ decision-logger context set-decision flag_1 --template budget-approval
Active decision: "Approve roof repair budget" (dec_xyz)
Template: Budget Approval
```

All new transcript chunks may now also be tagged with `decision:dec_xyz` when decision context is active.

### 7. Decision contexts and meeting agendas

Meetings need ordered agendas, but meetings should select from open decision contexts rather than own them.

That means:

- one decision context may appear in multiple meetings over time
- agendas are meeting-level ordering structures
- decision history and field history remain attached to the decision context

### 8. Add More Context
```bash
$ decision-logger transcript add \
  --text "The contractor quoted £45,000 for full replacement" \
  --speaker "Bob"
# Auto-tagged chunk: ["meeting:mtg_123", "decision:dec_xyz"]
```

### 9. Focus on Specific Field
```bash
$ decision-logger context set-field options
Active field: options
```

All new transcript chunks may now also be tagged with `decision:dec_xyz:options`.

### 10. Add Field-Specific Content
```bash
$ decision-logger transcript add \
  --text "Option A: patch repair for £8k. Option B: full replacement for £45k." \
  --speaker "Carol"

$ decision-logger transcript add \
  --speaker "Carol" \
  --text "Option 2: Patch repair for £12k, lasts 3 years"
# Both auto-tagged with field context
```

### 11. Generate Draft
```bash
$ decision-logger draft generate
Generated draft decision log

$ decision-logger draft show
Decision: Approve roof repair budget
Template: Standard Decision

Fields:
  decision_statement: [unlocked] "Approve budget for roof repair"
  decision_context: [unlocked] "Building requires roof maintenance..."
  options: [unlocked] "Option 1: Full replacement..."
  ...
```

### 12. Lock Satisfied Fields
```bash
$ decision-logger draft lock-field options
Locked field: options

$ decision-logger draft lock-field decision_statement
Locked field: decision_statement
```

### 13. Refine Other Fields
```bash
# Focus on consequences
$ decision-logger context set-field consequences_positive

$ decision-logger transcript add \
  --speaker "Alice" \
  --text "This will prevent water damage and increase property value"

# Regenerate only unlocked fields
$ decision-logger draft regenerate
Regenerated draft (locked fields preserved)
```

### 14. Iterate Until Satisfied
Repeat steps 9-13 for each field until all fields are locked.

### 15. Log Final Decision
```bash
$ decision-logger decision log \
  --type "consensus" \
  --details "All committee members agreed" \
  --actors "Alice,Bob,Carol,David" \
  --logged-by "Alice"

Logged decision: log_final_123
```

### 16. Export
```bash
$ decision-logger decision export log_final_123 --format markdown > decision.md
```

## Database And Contract Ownership

> **Canonical Source**: `packages/schema` owns the exact domain shapes. Database table details in `packages/db` and route contracts in `apps/api` must follow those canonical schemas.

This document should not restate full SQL or full API contract shapes.

Instead, it defines the end-state capabilities and semantic boundaries.

### Required persistence capabilities

- **Meetings**
  - meeting metadata and participant lists
  - ordered agenda structures that can reference open decision contexts

- **Transcripts**
  - raw transcript ingestion records
  - chunked transcript records with meeting and decision context tags
  - support for evidence from many meetings linking into one decision context

- **Flagged decisions / candidates**
  - candidate persistence independent of decision-context creation
  - explicit promotion into decision contexts

- **Decision contexts**
  - long-running drafting state independent of any single meeting
  - template reference, field history, lock state, and active field focus

- **Decision logs**
  - immutable finalized decision record
  - final decision moment metadata
  - authority participant list for the final decision event

For detailed schema direction, see:

- `docs/versioning-architecture.md`
- `docs/field-template-versioning-explainer.md`
- `docs/plans/field-versioning-schema-proposal.md`

## API Surface Ownership

> **Canonical Source**: route contracts should be derived from `packages/schema` and the specialist API docs, not hand-maintained as a second API source here.

### Required API capability families

- **Meeting management**
  - create, read, list, update status/metadata
  - agenda management over open decision contexts

- **Transcript ingestion and retrieval**
  - upload, append, stream, flush, inspect chunks/raw transcripts
  - search and context-window retrieval

- **Candidate workflows**
  - create/list/update/dismiss candidates
  - explicit promotion from candidate to decision context

- **Decision-context workflows**
  - create/read/update/delete decision contexts
  - generate draft, regenerate field(s), lock/unlock fields, inspect transcript evidence
  - resume a decision context independently of a meeting-scoped page or command flow

- **Decision-log workflows**
  - finalize a decision context into a decision log
  - capture the final decision moment, meeting/event identity, and authority participant list
  - retrieve and export final logs

- **Field/template workflows**
  - field library CRUD and template CRUD
  - field-history, restore, and template-change surfaces as defined by the versioning architecture

For concrete endpoint sequencing and contract detail, see:

- `docs/plans/iterative-implementation-plan.md`
- `docs/plans/field-versioning-api-proposal.md`

### Additional contract ownership notes

- Expert and MCP contract expansion belongs primarily to:
  - `docs/expert-system-architecture.md`
  - `docs/mcp-architecture-strategy.md`
  - `docs/plans/iterative-implementation-plan.md`

- Field/template API expansion belongs primarily to:
  - `docs/field-library-architecture.md`
  - `docs/versioning-architecture.md`
  - `docs/plans/field-versioning-api-proposal.md`

## CLI Commands

The CLI should provide capability coverage for:

- meeting management
- transcript ingestion and retrieval
- candidate review and promotion
- decision-context draft generation and refinement
- decision logging and export
- field/template management
- expert consultation
- MCP inspection and management where implemented

For exact command evolution and milestone-specific command surfaces, see `docs/plans/iterative-implementation-plan.md`.

## LLM Integration (Provider-Agnostic)

### Decision Detection

**Critical**: Decision detection must catch **implicit decisions**, especially decisions NOT to act.

> **See**: `docs/decision-detection-architecture.md` for complete prompt architecture and refinement process

**Key patterns to detect**:
- Explicit: "We decided to use X"
- Implicit defer: "I want alignment" → decision to delay
- Implicit reject: "I don't like these options" → decision to reject and seek alternatives
- Implicit redirect: "Let's focus on X instead" → decision to deprioritize Y
- Consensus by silence: No objections → implicit approval

### Draft Generation

Draft generation should:

- use canonical schemas from `packages/schema`
- operate over context-linked transcript evidence
- remain aligned with field-library prompt ownership and versioning rules

See:

- `docs/field-library-architecture.md`
- `docs/field-regeneration-strategy.md`
- `docs/versioning-architecture.md`
- `docs/plans/iterative-implementation-plan.md`

### Field-Specific Regeneration

Field-specific regeneration should:

- validate field assignment against the active template
- respect lock state
- prefer field-specific evidence over broader decision/meeting evidence
- use field-owned extraction guidance

See:

- `docs/field-regeneration-strategy.md`
- `docs/context-tagging-strategy.md`
- `docs/transcript-context-management.md`
- `docs/plans/iterative-implementation-plan.md`

## Export Format

Exports are **template-driven**, not hardcoded to a single fixed field set.

### Markdown Rendering Rules

- Use the active template's ordered field assignments to determine section order.
- For each field, render the canonical field definition label or other non-semantic presentation metadata derived from the resolved active configuration.
- Omit empty optional fields by default.
- Render values by field type:
  - `short_text`, `long_text`, `date`, `numeric`: prose/value block
  - `list`: bullet list
  - `structured`: formatted JSON block or field-specific formatter
- Prepend shared metadata (`Meeting`, `Date`, `Decision Method`, `Logged By`).

Detailed renderer behavior and future export-surface expansion belong primarily to:

- `docs/decision-export-formats.md`
- `docs/plans/iterative-implementation-plan.md`

## Development Philosophy (Agentic-Safe)

To ensure consistency, minimize duplication, and facilitate high-quality agentic development, the project follows the [Agentic Development Standards](./agentic-development-standards.md).

### Core Guardrails:
1. **Zod-First**: All domain schemas are defined in `packages/schema` using Zod. All types are inferred.
2. **One-Way Dependencies**: `apps` → `packages/core` → `packages/db` & `packages/schema`.
3. **Logic Neutrality**: Business logic resides exclusively in `packages/core` services. Apps are thin interface adapters.
4. **Service-Based Orchestration**: Services manage the flow between DB, LLM, and Validation.

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Hono (lightweight, fast)
- **Database**: PostgreSQL 16+
- **ORM**: Drizzle ORM
- **LLM**: Vercel AI SDK with swappable providers (remote by default, local-capable)
- **Validation**: Zod
- **Testing**: Vitest

> **Note**: pgvector is not required for initial implementation. If vector similarity search becomes necessary (e.g. semantic chunk retrieval at scale), it can be added as a schema migration. Both Neon and Supabase support pgvector on managed Postgres, which aligns with the Cloudflare deployment path described below.

### CLI
- **Framework**: Commander.js (routing)
- **Prompts**: Clack (modern, interactive terminal UI)
- **Progress**: Clack spinners
- **Tables**: cli-table3
- **Colors**: chalk
- **File handling**: fs-extra

### Development
- **Monorepo**: Turborepo
- **Language**: TypeScript
- **Build**: tsup
- **Linting**: ESLint
- **Formatting**: Prettier

## Project Structure (Monorepo)

```
decision-logger/
├── apps/
│   ├── api/                # Hono REST API (@hono/zod-openapi)
│   ├── cli/                # Commander/Clack CLI
│   └── mcp/                # MCP Server
├── packages/
│   ├── core/               # Shared business logic
│   ├── db/                 # Drizzle & migrations
│   ├── schema/             # SSOT: Zod domain schemas
│   └── ui/                 # Shared UI components (if needed later)
├── docs/                   # Strategy & Design docs
├── turbo.json
└── package.json
```

## Delivery And Sequencing

This document describes the target product and architectural overview.

All milestone ordering, rollout constraints, implementation status, and validation checkpoints belong in:

- `docs/plans/iterative-implementation-plan.md`

## Product Outcomes

- Users can create and manage meetings with transcript records and participant lists.
- Users can capture transcript evidence incrementally and retrieve it by meeting, decision context, and field context.
- Potential decisions can exist as candidates before promotion into decision contexts.
- Decision contexts can persist across multiple meetings and off-meeting preparation.
- Users can iteratively refine fields, lock satisfied fields, and preserve field-specific history.
- Decision logs can capture the final decision moment, decision method, authority participants, and exportable output.
- Context tagging and retrieval should keep relevant evidence available for draft generation and field regeneration.
- The system should support both CLI and API usage over the same core decision workflow.

## Configuration

Runtime configuration should provide database connectivity, LLM provider/model selection, and API host/port settings.

Exact environment variable names and config structure should be treated as implementation-owned rather than overview-owned.

See:

- `docs/development-setup.md`
- `docs/agentic-development-standards.md`
- `docs/plans/iterative-implementation-plan.md`

All fields are text-only, actors are optional (only at final decision), and the workflow supports one active decision context at a time with field-by-field refinement.
