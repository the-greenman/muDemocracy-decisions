# Decision Logger - Final Implementation Plan

A context-driven decision logging system with LLM-assisted extraction, iterative field refinement with locking, CLI interface, and API backend for managing meeting transcripts and structured decision logs.

## Core Requirements (Finalized)

### What We're Building

**Primary Goal**: Help teams create structured decision logs from meeting transcripts through iterative, context-aware refinement.

**Key Features:**
1. **Meeting Management** - Create meetings with participants (simple names)
2. **Transcript Ingestion** - Upload complete, add chunks, or stream segments
3. **Context Tagging** - Auto-tag segments with meeting/decision/field contexts
4. **LLM Decision Detection** - Flag potential decisions automatically
5. **Context Switching** - Set active decision and field contexts
6. **Iterative Refinement** - Add content, regenerate fields, lock when satisfied
7. **Decision Methods** - Record how decision was made (text metadata)
8. **CLI Interface** - Command-line tool for testing workflow
9. **Export** - Markdown/JSON export of final decisions

**Not in Scope (Initially):**
- ❌ Actor identification from transcripts
- ❌ Real-time collaboration
- ❌ Authentication
- ❌ Web UI (CLI only)

## Simplified Data Model

```typescript
// Meeting
interface Meeting {
  id: string;
  title: string;
  date: Date;
  participants: string[]; // simple names: ["Alice", "Bob", "Carol"]
  status: 'active' | 'completed';
  createdAt: Date;
}

// Transcript Segment with Context Tags
interface TranscriptSegment {
  id: string;
  meetingId: string;
  timestamp?: string;
  speaker: string; // may not be a known participant
  text: string;
  sequenceNumber: number;
  contexts: string[]; // ['meeting:abc', 'decision:xyz', 'decision:xyz:options']
  createdAt: Date;
}

// Flagged Decision
interface FlaggedDecision {
  id: string;
  meetingId: string;
  suggestedTitle: string;
  contextSummary: string;
  confidence: number;
  segmentIds: string[];
  status: 'pending' | 'active' | 'logged' | 'dismissed';
  createdAt: Date;
}

// Decision Context (working draft)
interface DecisionContext {
  id: string;
  meetingId: string;
  flaggedDecisionId?: string;
  title: string;
  templateId: string;
  
  // Active focus (one at a time)
  activeField?: string;
  
  // Field locking
  lockedFields: {
    [fieldId: string]: {
      value: string; // all fields are text
      lockedAt: Date;
    };
  };
  
  // Draft state (all text fields)
  draftData: Record<string, string>;
  
  status: 'drafting' | 'ready' | 'logged';
  createdAt: Date;
  updatedAt: Date;
}

// Decision Log (final recorded decision)
interface DecisionLog {
  id: string;
  meetingId: string;
  decisionContextId: string;
  templateId: string;
  templateVersion: number;
  
  // All fields are text
  fields: Record<string, string>;
  
  // Decision method (simplified)
  decisionMethod: {
    type: string; // "consensus", "majority-vote", "chair-decision", etc.
    details: string; // free-form text: "5 for, 2 against, 1 abstain"
    actors: string[]; // ["Alice", "Bob"] - who made/owns the decision
  };
  
  // Source tracking
  sourceSegmentIds: string[];
  
  // Audit
  loggedAt: Date;
  loggedBy: string;
}

// Decision Template (simplified - all text fields)
interface DecisionTemplate {
  id: string;
  name: string;
  version: number;
  fields: TemplateField[];
  isDefault: boolean; // only one template can be default
  createdAt: Date;
}

interface TemplateField {
  id: string;
  name: string;
  label: string;
  description?: string; // help text for LLM
  required: boolean;
  order: number;
}
```

## Standard Decision Template

**Default Template: "Standard Decision"**

Fields (all text):
1. **decision_statement** - The decision being made
2. **decision_context** - Background and context
3. **evaluation_criteria** - Criteria used to evaluate options
4. **options** - Available options (Option1, Option2, Option3, etc.)
5. **tradeoffs** - Trade-offs between options
6. **consequences_positive** - Positive consequences
7. **consequences_negative** - Negative consequences
8. **assumptions** - Assumptions made
9. **reversibility** - How reversible is this decision
10. **review_triggers** - When should this decision be reviewed

## Context Management

### Global Context State

The system maintains a global context with three levels:

1. **Active Meeting** - Which meeting you're currently working with
2. **Active Decision** - Which decision within that meeting is in focus
3. **Active Field** - Which field of that decision you're refining

This allows working with multiple meetings without specifying meeting ID in every command.

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
1. All segments get meeting context tag
2. When decision context active → add decision tag
3. When field focus active → add field tag
4. Tags are cumulative
5. One active meeting at a time (global)
6. One decision context active at a time (per meeting)
7. One field focus active at a time (per decision)

### Example Flow
```bash
# No context set
segment 1: ["meeting:abc"]

# Set decision context
$ decision-logger context set-decision abc flag_1
segment 2: ["meeting:abc", "decision:xyz"]

# Set field focus
$ decision-logger context set-field xyz options
segment 3: ["meeting:abc", "decision:xyz", "decision:xyz:options"]

# Change field focus
$ decision-logger context set-field xyz tradeoffs
segment 4: ["meeting:abc", "decision:xyz", "decision:xyz:tradeoffs"]

# Clear field focus
$ decision-logger context clear-field
segment 5: ["meeting:abc", "decision:xyz"]
```

## Workflow

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

### 3. Add Transcripts
```bash
# Upload complete transcript
$ decision-logger transcript upload mtg_123 transcript.json

# Or add segments manually
$ decision-logger transcript add mtg_123 \
  --speaker "Alice" \
  --text "I think we should approve the roof repair"

# Or stream
$ decision-logger transcript stream mtg_123 < live.txt
```

LLM automatically flags potential decisions.

### 3. View Flagged Decisions
```bash
$ decision-logger decisions flagged mtg_123
1. [0.89] Approve roof repair budget (segments 12-18)
2. [0.76] Update guest parking policy (segments 25-30)
```

### 4. Set Decision Context
```bash
# Option 1: Use default template
$ decision-logger context set-decision mtg_123 flag_1
Active decision: "Approve roof repair budget" (dec_xyz)
Template: Standard Decision (default)

# Option 2: Specify template explicitly
$ decision-logger context set-decision mtg_123 flag_1 --template budget-approval
Active decision: "Approve roof repair budget" (dec_xyz)
Template: Budget Approval
```

All new segments now auto-tagged with `decision:dec_xyz`.

### 5. Add More Context
```bash
$ decision-logger transcript add mtg_123 \
  --speaker "Bob" \
  --text "The contractor quoted £45,000 for full replacement"
# Auto-tagged: ["meeting:mtg_123", "decision:dec_xyz"]
```

### 6. Focus on Specific Field
```bash
$ decision-logger context set-field dec_xyz options
Active field: options
```

All new segments now auto-tagged with `decision:dec_xyz:options`.

### 7. Add Field-Specific Content
```bash
$ decision-logger transcript add mtg_123 \
  --speaker "Carol" \
  --text "Option 1: Full replacement for £45k, lasts 20 years"

$ decision-logger transcript add mtg_123 \
  --speaker "Carol" \
  --text "Option 2: Patch repair for £12k, lasts 3 years"
# Both auto-tagged with field context
```

### 8. Generate Draft
```bash
$ decision-logger draft generate dec_xyz
Generated draft decision log

$ decision-logger draft show dec_xyz
Decision: Approve roof repair budget
Template: Standard Decision

Fields:
  decision_statement: [unlocked] "Approve budget for roof repair"
  decision_context: [unlocked] "Building requires roof maintenance..."
  options: [unlocked] "Option 1: Full replacement..."
  ...
```

### 9. Lock Satisfied Fields
```bash
$ decision-logger draft lock-field dec_xyz options
Locked field: options

$ decision-logger draft lock-field dec_xyz decision_statement
Locked field: decision_statement
```

### 10. Refine Other Fields
```bash
# Focus on consequences
$ decision-logger context set-field dec_xyz consequences_positive

$ decision-logger transcript add mtg_123 \
  --speaker "Alice" \
  --text "This will prevent water damage and increase property value"

# Regenerate only unlocked fields
$ decision-logger draft regenerate dec_xyz
Regenerated draft (locked fields preserved)
```

### 11. Iterate Until Satisfied
Repeat steps 6-10 for each field until all fields are locked.

### 12. Log Final Decision
```bash
$ decision-logger decision log dec_xyz \
  --type "consensus" \
  --details "All committee members agreed" \
  --actors "Alice,Bob,Carol,David" \
  --logged-by "Alice"

Logged decision: log_final_123
```

### 13. Export
```bash
$ decision-logger decision export log_final_123 --format markdown > decision.md
```

## Database Schema

```sql
-- Meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  participants TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcript Segments
CREATE TABLE transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  timestamp TEXT,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  contexts TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, sequence_number)
);

-- Flagged Decisions
CREATE TABLE flagged_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  suggested_title TEXT NOT NULL,
  context_summary TEXT,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
  segment_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'logged', 'dismissed')),
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  priority INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision Contexts
CREATE TABLE decision_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  flagged_decision_id UUID REFERENCES flagged_decisions(id),
  title TEXT NOT NULL,
  template_id UUID NOT NULL,
  active_field TEXT,
  locked_fields JSONB DEFAULT '{}',
  draft_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'drafting' CHECK (status IN ('drafting', 'ready', 'logged')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision Templates
CREATE TABLE decision_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  fields JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, version)
);

-- Index for default template lookup
CREATE UNIQUE INDEX idx_templates_default ON decision_templates(is_default) WHERE is_default = true;

-- Decision Logs (immutable once created)
CREATE TABLE decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  decision_context_id UUID NOT NULL REFERENCES decision_contexts(id),
  template_id UUID NOT NULL,
  template_version INTEGER NOT NULL,
  fields JSONB NOT NULL,
  decision_method JSONB NOT NULL,
  source_segment_ids UUID[] NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  logged_by TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_segments_meeting ON transcript_segments(meeting_id);
CREATE INDEX idx_segments_contexts ON transcript_segments USING GIN(contexts);
CREATE INDEX idx_segments_sequence ON transcript_segments(meeting_id, sequence_number);
CREATE INDEX idx_flagged_meeting ON flagged_decisions(meeting_id);
CREATE INDEX idx_flagged_status ON flagged_decisions(status) WHERE status = 'pending';
CREATE INDEX idx_contexts_meeting ON decision_contexts(meeting_id);
CREATE INDEX idx_contexts_status ON decision_contexts(status);
CREATE INDEX idx_logs_meeting ON decision_logs(meeting_id);
```

## API Endpoints

### Meeting Management
```typescript
POST /api/meetings
Body: {title: string, date: string, participants: string[]}
Response: Meeting

GET /api/meetings/:id
Response: Meeting

GET /api/meetings
Response: {meetings: Meeting[]}

PATCH /api/meetings/:id/status
Body: {status: 'completed'}
Response: Meeting
```

### Transcript Ingestion
```typescript
POST /api/meetings/:id/transcripts/upload
Body: {segments: Array<{timestamp?, speaker, text}>}
Response: {
  segmentIds: string[],
  flaggedDecisions: FlaggedDecision[]
}

POST /api/meetings/:id/transcripts/add
Body: {speaker: string, text: string, timestamp?: string}
Response: {
  segmentId: string,
  contexts: string[],
  flaggedDecisions?: FlaggedDecision[]
}

GET /api/meetings/:id/segments
Query: {context?: string, limit?: number}
Response: {segments: TranscriptSegment[]}
```

### Context Management
```typescript
GET /api/meetings/:id/context
Response: {
  activeDecisionId?: string,
  activeField?: string
}

POST /api/meetings/:id/context/decision
Body: {flaggedDecisionId: string}
Response: {decisionContext: DecisionContext}

POST /api/meetings/:id/context/field
Body: {decisionContextId: string, fieldId: string}
Response: {decisionContext: DecisionContext}

DELETE /api/meetings/:id/context/field
Response: {cleared: true}

DELETE /api/meetings/:id/context/decision
Response: {cleared: true}
```

### Decision Workflow
```typescript
GET /api/meetings/:id/flagged-decisions
Response: {flagged: FlaggedDecision[]}

POST /api/decision-contexts/:id/generate-draft
Response: {draftData: Record<string, string>}

POST /api/decision-contexts/:id/regenerate
Response: {draftData: Record<string, string>}

GET /api/decision-contexts/:id
Response: DecisionContext

POST /api/decision-contexts/:id/lock-field
Body: {fieldId: string}
Response: DecisionContext

POST /api/decision-contexts/:id/unlock-field
Body: {fieldId: string}
Response: DecisionContext

POST /api/decision-contexts/:id/log
Body: {
  type: string,
  details: string,
  actors: string[],
  loggedBy: string
}
Response: DecisionLog

GET /api/decision-logs/:id
Response: DecisionLog

GET /api/decision-logs/:id/export
Query: {format: 'json' | 'markdown'}
Response: File (download)
```

### Templates
```typescript
GET /api/templates
Response: {templates: DecisionTemplate[]}

GET /api/templates/:id
Response: DecisionTemplate
```

## CLI Commands

```bash
# Meeting Management
decision-logger meeting create <title> --date <YYYY-MM-DD> --participants <comma-separated>
decision-logger meeting list
decision-logger meeting show
decision-logger meeting complete

# Context Management
decision-logger context show
decision-logger context set-meeting <meeting-id>
decision-logger context clear-meeting
decision-logger context set-decision <flagged-id> [--template <template-id>]
decision-logger context set-field <field-id>
decision-logger context clear-field
decision-logger context clear-decision

# Transcript Ingestion (uses active meeting context)
decision-logger transcript upload <file.json>
decision-logger transcript add --speaker <name> --text <text> [--timestamp <HH:MM:SS>]
decision-logger transcript stream [--file <file.txt>]
decision-logger transcript list [--context <context-tag>]

# Decision Workflow (uses active meeting/decision context)
decision-logger decisions flagged
decision-logger draft generate
decision-logger draft regenerate
decision-logger draft show
decision-logger draft update-field <field-id> --value <text>
decision-logger draft lock-field <field-id>
decision-logger draft unlock-field <field-id>
decision-logger draft expert-advice <expert-type> [--focus <area>]
decision-logger decision log --type <type> --details <text> --actors <comma-separated> --logged-by <name>
decision-logger decision show <decision-log-id>
decision-logger decision export <decision-log-id> --format <json|markdown> [--output <file>]

# Templates
decision-logger template list
decision-logger template show <template-id>
decision-logger template set-default <template-id>
```

## LLM Integration (Vercel AI SDK)

### Decision Detection
```typescript
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { FlaggedDecisionsSchema } from '@repo/types';

async function detectDecisions(segments: TranscriptSegment[]) {
  const { object } = await generateObject({
    model: anthropic('claude-3-5-sonnet-latest'),
    schema: FlaggedDecisionsSchema,
    system: "Analyze this meeting transcript and identify all decisions made...",
    prompt: `Transcript: ${segments.map(s => `[${s.sequenceNumber}] ${s.speaker}: ${s.text}`).join('\n')}`
  });
  
  return object.decisions;
}
```

### Draft Generation
```typescript
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { DecisionDraftSchema } from '@repo/types';

async function generateDraft(decisionContextId: string) {
  const context = await getDecisionContext(decisionContextId);
  const segments = await getSegmentsByContext(`decision:${decisionContextId}`);
  
  const { object } = await generateObject({
    model: anthropic('claude-3-5-sonnet-latest'),
    schema: DecisionDraftSchema,
    system: "Extract decision details from this transcript and fill template fields...",
    prompt: `Transcript: ${segments.map(s => `[${s.sequenceNumber}] ${s.speaker}: ${s.text}`).join('\n')}`
  });
  
  return object.fields;
}
```

### Field-Specific Regeneration
```typescript
async function regenerateField(
  decisionContextId: string,
  fieldId: string
): Promise<string> {
  const context = await getDecisionContext(decisionContextId);
  
  // Check if locked
  if (context.lockedFields[fieldId]) {
    throw new Error('Field is locked');
  }
  
  const template = await getTemplate(context.templateId);
  const field = template.fields.find(f => f.id === fieldId);
  
  // Get field-specific segments (highest priority)
  const fieldSegments = await getSegmentsByContext(
    `decision:${decisionContextId}:${fieldId}`
  );
  
  // Get general decision segments (context)
  const decisionSegments = await getSegmentsByContext(
    `decision:${decisionContextId}`
  );
  
  // Combine, prioritizing field-specific
  const allSegments = [...fieldSegments, ...decisionSegments];
  
  const prompt = `
Extract the value for the "${field.label}" field from this transcript.

Field: ${field.label}
Description: ${field.description || 'N/A'}

Transcript (segments tagged with this field are most relevant):
${allSegments.map(s => {
  const isFieldSpecific = s.contexts.includes(`decision:${decisionContextId}:${fieldId}`);
  return `[${s.sequenceNumber}]${isFieldSpecific ? ' ***' : ''} ${s.speaker}: ${s.text}`;
}).join('\n')}

Extract the value as plain text. Recent segments have higher weight.

Return JSON:
{
  "value": "extracted text value"
}
`;

  const response = await llmService.complete(prompt);
  return parseFieldValue(response);
}
```

## Export Format

### Markdown Template
```markdown
# {decision_statement}

**Meeting:** {meeting_title}
**Date:** {meeting_date}
**Decision Method:** {decision_method.type}
**Details:** {decision_method.details}
**Decision Makers:** {decision_method.actors}

## Context

{decision_context}

## Evaluation Criteria

{evaluation_criteria}

## Options

{options}

## Trade-offs

{tradeoffs}

## Consequences

### Positive
{consequences_positive}

### Negative
{consequences_negative}

## Assumptions

{assumptions}

## Reversibility

{reversibility}

## Review Triggers

{review_triggers}

---
*Logged by {logged_by} on {logged_at}*
```

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
- **Database**: PostgreSQL 16+ with pgvector
- **ORM**: Drizzle ORM
- **LLM**: Vercel AI SDK (with Claude 3.5 Sonnet)
- **Validation**: Zod
- **Testing**: Vitest

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

## Implementation Phases

> **Detailed Plan**: See [iterative-implementation-plan.md](./iterative-implementation-plan.md) for the full phased implementation with validation checkpoints.

The implementation follows an iterative approach with 9 phases (0-8), each with concrete validation checkpoints. Key highlights:

- **Phase 0**: Vertical Slice - Prove entire stack works end-to-end
- **Phase 1**: Schema Foundation - Zod-to-All pipeline
- **Phase 2**: Core Data Services - TDD with >80% coverage
- **Phase 3**: LLM Integration - Mock-first, real API optional
- **Phase 4**: Decision Workflow - Context, drafts, field locking
- **Phase 5**: Expert System - Domain personas with MCP tools
- **Phase 6**: API Layer - Complete REST endpoints
- **Phase 7**: CLI Application - Interactive Clack interface
- **Phase 8**: Export & Polish - Documentation and production readiness

### Phase Summary (Original Reference)

### Phase 1: Foundation (Week 1)
- [ ] Initialize Turborepo monorepo structure
- [ ] Set up `packages/schema` - Single source of truth (Zod)
- [ ] Implement `@hono/zod-openapi` pipeline in `apps/api`
- [ ] Automate `openapi.yaml` generation and decommission manual file
- [ ] Set up `packages/db` with `drizzle-zod` alignment
- [ ] Set up `packages/core` with Service-Repository pattern and DI container
- [ ] Configure PostgreSQL 16+ with pgvector
- [ ] Configure Vitest for monorepo testing (TDD ready)
- [ ] Implement shared error handling and domain exceptions in `packages/core`

### Phase 2: Core Data Layer (Week 1-2 - TDD Approach)
- [ ] TDD: Meeting Repository and Service
- [ ] TDD: Transcript Segment Repository and Service
- [ ] TDD: Context Tagging logic and Service
- [ ] TDD: Decision Template Repository and Service
- [ ] TDD: Standard Decision Template seeding

### Phase 3: LLM & Expert Integration (Week 2)
- [ ] Implement Vercel AI SDK abstraction layer in `@repo/core`
- [ ] Test: Claude 3.5 Sonnet connectivity and structured output
- [ ] Test: Decision detection via Vercel AI SDK
- [ ] Implement: Expert template system with MCP tool injection
- [ ] Test: Field-specific extraction and auto-tagging

### Phase 4: Context Management (Week 2-3)
- [ ] Test: Set decision context
- [ ] Implement: Decision context creation
- [ ] Test: Set field focus
- [ ] Implement: Field focus tracking
- [ ] Test: Context state persistence
- [ ] Implement: Context manager
- [ ] Test: Context clearing
- [ ] Implement: Clear operations

### Phase 5: Decision Workflow (Week 3)
- [ ] Test: Generate draft
- [ ] Implement: Draft generation with locked fields
- [ ] Test: Regenerate draft
- [ ] Implement: Regeneration preserving locks
- [ ] Test: Lock/unlock fields
- [ ] Implement: Field locking
- [ ] Test: Log decision
- [ ] Implement: Decision logging with method
- [ ] Test: Decision retrieval
- [ ] Implement: Decision queries

### Phase 6: API Layer (Week 3-4)
- [ ] Set up Hono server
- [ ] Implement: Meeting endpoints
- [ ] Implement: Transcript endpoints
- [ ] Implement: Context endpoints
- [ ] Implement: Decision endpoints
- [ ] Implement: Template endpoints
- [ ] Add: Request validation (Zod)
- [ ] Add: Error handling
- [ ] Test: Integration tests

### Phase 7: CLI (Week 4)
- [ ] Set up Commander.js routing in `apps/cli`
- [ ] Integrate Clack for interactive prompts and spinners
- [ ] Implement: Meeting management commands (interactive)
- [ ] Implement: Transcript ingestion and streaming UI
- [ ] Implement: Decision refinement workflow with field locking
- [ ] Implement: Expert advice consultation UI
- [ ] Test: End-to-end CLI workflows

### Phase 8: Export & Polish (Week 4-5)
- [ ] Test: Markdown export
- [ ] Implement: Markdown formatter
- [ ] Test: JSON export
- [ ] Implement: JSON formatter
- [ ] Write: README documentation
- [ ] Write: API documentation
- [ ] Write: CLI usage guide
- [ ] End-to-end testing
- [ ] Performance optimization

## Success Criteria

- [ ] Create meeting via CLI
- [ ] Upload transcript and see flagged decisions
- [ ] Set decision context
- [ ] Add more transcript segments (auto-tagged)
- [ ] Set field focus
- [ ] Add field-specific content (auto-tagged with field)
- [ ] Generate draft decision log
- [ ] Lock satisfied fields
- [ ] Regenerate unlocked fields
- [ ] Iterate through all fields
- [ ] Log final decision with method and actors
- [ ] Export as Markdown with proper formatting
- [ ] All segments properly tagged with contexts
- [ ] Locked fields never regenerated
- [ ] Recent segments weighted higher in LLM extraction
- [ ] One decision context active at a time
- [ ] Context switching works seamlessly
- [ ] All tests passing with >80% coverage
- [ ] CLI commands intuitive and well-documented

## Configuration

```typescript
// .env
DATABASE_URL=postgresql://user:pass@localhost:5432/decision_logger
ANTHROPIC_API_KEY=sk-ant-...
# Or other providers supported by Vercel AI SDK
# OPENAI_API_KEY=sk-... 
API_PORT=3000

// packages/core/src/config.ts
interface Config {
  database: {
    url: string;
  };
  llm: {
    provider: 'anthropic' | 'openai';
    model: string;
  };
  api: {
    port: number;
    host: string;
  };
}
```

## Next Steps

This plan is ready for implementation. The system will:

1. **Manage meetings** with simple participant lists
2. **Ingest transcripts** flexibly (upload/chunks/stream)
3. **Auto-tag segments** with meeting/decision/field contexts
4. **Flag decisions** using LLM analysis
5. **Support iterative refinement** with context switching and field locking
6. **Record decision methods** with text metadata and actors
7. **Provide CLI interface** for testing the full workflow
8. **Export decisions** in Markdown/JSON formats

All fields are text-only, actors are optional (only at final decision), and the workflow supports one active decision context at a time with field-by-field refinement.

Ready to begin implementation when confirmed.
