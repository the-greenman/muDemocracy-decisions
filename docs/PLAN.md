# Decision Logger - Final Implementation Plan

**Document Role**: This is the consolidated product and scope summary. Specialist docs own detailed behavior, schema additions, and endpoint families for their domain. `packages/schema` is the single source of truth for domain contracts.

A context-driven decision logging system with LLM-assisted extraction, iterative field refinement with locking, CLI interface, and API backend for managing meeting transcripts and structured decision logs.

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
9. **Expert System** - Support core and custom experts, with MCP-backed tool access and advice history
10. **Decision Methods** - Record how decision was made (text metadata)
11. **CLI Interface** - Command-line tool for testing workflow
12. **API Backend** - API is sufficient to support future UI consumers even though no dedicated web app is in scope
13. **Export** - Markdown/JSON export of final decisions

**Not in Scope (Initially):**
- ❌ Audio capture and raw audio processing inside the core system
- ❌ Actor identification from transcripts
- ❌ Real-time collaboration
- ❌ Authentication
- ❌ A dedicated first-party web application in the initial release

**Integration Assumptions:**
- Transcript ingestion is transport-agnostic: the core system accepts text transcript events, not raw audio.
- Local transcription can be added as a separate upstream component, but is not required for the product to function.
- Local LLMs are supported as an optional inference path for detection/classification, not a hard dependency.

> **See**: `docs/transcription-service-plan.md` for the separate containerized transcription service boundary and integration contract
- Detailed workflow and endpoint expansions in specialist docs are authoritative unless they conflict with the Zod schema source-of-truth rule.

## Simplified Data Model

> **Canonical Source**: `packages/schema` is the single source of truth for all domain contracts. Detailed entity requirements are maintained in the specialist architecture docs.

For high-level understanding, the system revolves around these core entities:
1. **Meeting** - The top-level container for a discussion.
2. **TranscriptChunk** - Standardized segments of the meeting transcript with context tags.
3. **FlaggedDecision** - Potential decisions identified by AI or users.
4. **DecisionContext** - The active drafting environment for a specific decision.
5. **DecisionLog** - The final, immutable record of a logged decision.
6. **DecisionField & Template** - The building blocks for structured decision logging.

> **See**: `docs/iterative-implementation-plan.md` for the implementation sequence of these schemas.


## Field Library & Templates

> **Canonical Source**: `docs/field-library-architecture.md` owns the detailed field definitions, extraction prompts, and template compositions.

The system uses a **field library** architecture where atomic fields are reused across multiple templates. 

### Field Categories
Core, Evaluation, Impact, Risk, Financial, Stakeholder, Implementation, Governance.

### Core Templates
Standard Decision, Technology Selection, Budget Approval, Strategy Decision, Policy Change, Proposal Acceptance.

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
1. All transcript chunks get meeting context tag
2. When decision context active → add decision tag
3. When field focus active → add field tag
4. Tags are cumulative
5. One active meeting at a time (global)
6. One decision context active at a time (per meeting)
7. One field focus active at a time (per decision)

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
chunk 5: ["meeting:abc", "decision:xyz"]
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
# Upload complete transcript (context-aware, uses active meeting)
$ decision-logger transcript upload transcript.json

# Or add transcript text immediately
$ decision-logger transcript add \
  --text "I think we should approve the roof repair" \
  --speaker "Alice"

# Or stream transcript events from an external producer
$ decision-logger transcript stream < live.txt
```

LLM automatically flags potential decisions.

### 3. View Flagged Decisions
```bash
$ decision-logger decisions flagged
1. [0.89] Approve roof repair budget (chunks 12-18)
2. [0.76] Update guest parking policy (chunks 25-30)
```

### 4. Set Decision Context
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

All new transcript chunks now auto-tagged with `decision:dec_xyz`.

### 5. Add More Context
```bash
$ decision-logger transcript add \
  --text "The contractor quoted £45,000 for full replacement" \
  --speaker "Bob"
# Auto-tagged chunk: ["meeting:mtg_123", "decision:dec_xyz"]
```

### 6. Focus on Specific Field
```bash
$ decision-logger context set-field options
Active field: options
```

All new transcript chunks now auto-tagged with `decision:dec_xyz:options`.

### 7. Add Field-Specific Content
```bash
$ decision-logger transcript add \
  --speaker "Carol" \
  --text "Option 1: Full replacement for £45k, lasts 20 years"

$ decision-logger transcript add \
  --speaker "Carol" \
  --text "Option 2: Patch repair for £12k, lasts 3 years"
# Both auto-tagged with field context
```

### 8. Generate Draft
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

### 9. Lock Satisfied Fields
```bash
$ decision-logger draft lock-field options
Locked field: options

$ decision-logger draft lock-field decision_statement
Locked field: decision_statement
```

### 10. Refine Other Fields
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

### 11. Iterate Until Satisfied
Repeat steps 6-10 for each field until all fields are locked.

### 12. Log Final Decision
```bash
$ decision-logger decision log \
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
-- Raw transcript inputs (immutable)
CREATE TABLE raw_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  source TEXT NOT NULL,  -- 'upload', 'stream', 'api', 'external-transcriber'
  format TEXT,
  content TEXT NOT NULL,
  metadata JSONB,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT
);

-- Transcript Chunks
CREATE TABLE transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  raw_transcript_id UUID REFERENCES raw_transcripts(id),
  speaker TEXT, -- optional metadata only
  text TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  start_time INTEGER,
  end_time INTEGER,
  chunk_strategy TEXT NOT NULL CHECK (chunk_strategy IN ('semantic', 'fixed-time', 'speaker-turn', 'sentence')),
  token_count INTEGER,
  word_count INTEGER,
  contexts TEXT[] NOT NULL DEFAULT '{}',
  topics TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, sequence_number)
);

-- Decision Fields Library
CREATE TABLE decision_fields (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('core', 'evaluation', 'impact', 'risk', 'financial', 'stakeholder', 'implementation', 'governance')),
  extraction_prompt JSONB NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('short_text', 'long_text', 'list', 'structured', 'numeric', 'date')),
  placeholder TEXT,
  validation_rules JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Decision Templates
CREATE TABLE decision_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('general', 'technical', 'strategic', 'financial', 'governance', 'operational')),
  version INTEGER NOT NULL DEFAULT 1,
  is_default BOOLEAN DEFAULT false,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Template-Field Assignments (many-to-many)
CREATE TABLE template_field_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL REFERENCES decision_templates(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL REFERENCES decision_fields(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  custom_label TEXT,
  custom_description TEXT,
  UNIQUE(template_id, field_id),
  UNIQUE(template_id, order_index)
);

-- Flagged Decisions
CREATE TABLE flagged_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  suggested_title TEXT NOT NULL,
  context_summary TEXT,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
  chunk_ids UUID[] NOT NULL,
  suggested_template_id TEXT REFERENCES decision_templates(id) ON DELETE SET NULL,
  template_confidence REAL CHECK (template_confidence >= 0 AND template_confidence <= 1),
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
  template_id TEXT NOT NULL REFERENCES decision_templates(id),
  active_field TEXT,
  locked_fields JSONB DEFAULT '{}',
  draft_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'drafting' CHECK (status IN ('drafting', 'ready', 'logged')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision Logs (immutable once created)
CREATE TABLE decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  decision_context_id UUID NOT NULL REFERENCES decision_contexts(id),
  template_id TEXT NOT NULL REFERENCES decision_templates(id),
  template_version INTEGER NOT NULL,
  fields JSONB NOT NULL,
  decision_method JSONB NOT NULL,
  source_chunk_ids UUID[] NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  logged_by TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_raw_transcripts_meeting ON raw_transcripts(meeting_id);
CREATE INDEX idx_chunks_meeting ON transcript_chunks(meeting_id);
CREATE INDEX idx_chunks_contexts ON transcript_chunks USING GIN(contexts);
CREATE INDEX idx_chunks_sequence ON transcript_chunks(meeting_id, sequence_number);
CREATE INDEX idx_field_category ON decision_fields(category);
CREATE INDEX idx_template_fields ON template_field_assignments(template_id, order_index);
CREATE INDEX idx_flagged_meeting ON flagged_decisions(meeting_id);
CREATE INDEX idx_flagged_status ON flagged_decisions(status) WHERE status = 'pending';
CREATE INDEX idx_contexts_meeting ON decision_contexts(meeting_id);
CREATE INDEX idx_contexts_status ON decision_contexts(status);
CREATE INDEX idx_logs_meeting ON decision_logs(meeting_id);
CREATE UNIQUE INDEX idx_templates_default ON decision_templates(is_default) WHERE is_default = true;
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
Body: {
  content: string,
  format?: 'txt' | 'vtt' | 'srt' | 'json',
  chunkingStrategy?: 'semantic' | 'fixed-time' | 'speaker-turn' | 'sentence'
}
Response: {
  rawId: string,
  chunkCount: number,
  flaggedDecisions: FlaggedDecision[]
}

POST /api/meetings/:id/transcripts/add
Body: {
  text: string,
  speaker?: string,
  timestamp?: string,
  sequenceNumber?: number
}
Response: {
  chunkId: string,
  sequenceNumber: number,
  contexts: string[],
  flaggedDecisions?: FlaggedDecision[]
}

POST /api/meetings/:id/transcripts/stream
Body: {
  text: string,
  speaker?: string,
  timestamp?: string,
  sequenceNumber?: number
}
Response:
  | { buffering: true, bufferSize: number }
  | { chunkCreated: true, chunkId: string, potentialDecision?: FlaggedDecision }

GET /api/meetings/:id/streaming/status
Response: {
  bufferSize: number,
  bufferedTokens: number,
  lastChunkAt?: string
}

POST /api/meetings/:id/streaming/flush
Response: {
  flushed: true,
  chunkIds: string[]
}

DELETE /api/meetings/:id/streaming/buffer
Response: { cleared: true }

GET /api/meetings/:id/chunks
Query: {context?: string, limit?: number, strategy?: string, timeRange?: string}
Response: {chunks: TranscriptChunk[]}

GET /api/chunks/:id
Response: TranscriptChunk

POST /api/chunks/search
Body: {query: string, meetingId?: string, limit?: number}
Response: {chunks: TranscriptChunk[]}

GET /api/meetings/:id/transcripts/raw
Response: {rawTranscripts: RawTranscript[]}

GET /api/raw-transcripts/:id
Response: RawTranscript

GET /api/decision-contexts/:id/context-window
Response: DecisionContextWindow

POST /api/decision-contexts/:id/context-window
Body: {strategy?: string, chunkIds?: string[], maxTokens?: number}
Response: DecisionContextWindow

GET /api/decision-contexts/:id/context-window/preview
Response: {chunks: TranscriptChunk[], totalTokens: number}
```

### Context Management
```typescript
// Global context (for web UI state management)
GET /api/context
Response: {
  activeMeetingId?: string,
  activeDecisionContextId?: string,
  activeFieldId?: string,
  meeting?: Meeting,              // Populated if active
  decisionContext?: DecisionContext,  // Populated if active
  field?: DecisionField           // Populated if active
}

POST /api/context/meeting
Body: {meetingId: string}
Response: {activeMeetingId: string}

DELETE /api/context/meeting
Response: {cleared: true}

// Meeting-specific context (legacy, kept for compatibility)
GET /api/meetings/:id/context
Response: {
  activeDecisionContextId?: string,
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

POST /api/meetings/:id/flagged-decisions
Body: {title: string, contextSummary?: string, segmentIds: string[], priority?: number, createdBy?: string}
Response: FlaggedDecision

GET /api/flagged-decisions/:id
Response: FlaggedDecision

PATCH /api/flagged-decisions/:id
Body: {title?: string, contextSummary?: string, priority?: number, segmentIds?: string[]}
Response: FlaggedDecision

PATCH /api/flagged-decisions/:id/priority
Body: {priority: number}
Response: FlaggedDecision

DELETE /api/flagged-decisions/:id
Response: {dismissed: true}

GET /api/flagged-decisions/:id/context
Response: DecisionContext | null

GET /api/meetings/:id/decision-contexts
Query: {status?: 'drafting' | 'ready' | 'logged'}
Response: {contexts: DecisionContext[]}

GET /api/meetings/:id/summary
Response: {
  meeting: Meeting,
  stats: {
  chunkCount: number,
    flaggedDecisionCount: number,
    draftDecisionCount: number,
    loggedDecisionCount: number
  }
}

POST /api/decision-contexts/:id/generate-draft
Response: {draftData: Record<string, DecisionFieldValue>}

POST /api/decision-contexts/:id/regenerate
Response: {draftData: Record<string, DecisionFieldValue>}

POST /api/decision-contexts/:id/regenerate-field
Body: {fieldId: string}
Response: {fieldId: string, value: DecisionFieldValue}

GET /api/decision-contexts/:id/fields/:fieldId/transcript
Query: {includeNeighbors?: boolean, maxTokens?: number}
Response: {chunks: TranscriptChunk[], totalTokens: number}

POST /api/decision-contexts/:id/fields/:fieldId/regenerate
Body: {includeChunks?: string[], additionalContext?: string, preserveExisting?: boolean}
Response: {fieldId: string, value: DecisionFieldValue}

GET /api/decision-contexts/:id
Response: DecisionContext

POST /api/decision-contexts/:id/lock-field
Body: {fieldId: string}
Response: DecisionContext

DELETE /api/decision-contexts/:id/lock-field
Query: {fieldId: string}
Response: DecisionContext

POST /api/decision-contexts/:id/log
Body: {
  type: string,
  details: string,
  actors: string[],
  loggedBy: string
}
Response: DecisionLog

GET /api/meetings/:id/decisions
Response: {decisions: DecisionLog[]}

GET /api/decisions/:id
Response: DecisionLog

GET /api/decisions/:id/export
Query: {format: 'json' | 'markdown'}
Response: File (download)
```

### Experts & MCP
```typescript
GET /api/experts
Response: {experts: ExpertTemplate[]}

POST /api/experts
Body: CreateExpertTemplate
Response: ExpertTemplate

GET /api/experts/:id
Response: ExpertTemplate

PATCH /api/experts/:id
Body: UpdateExpertTemplate
Response: ExpertTemplate

DELETE /api/experts/:id
Response: {deleted: true}

POST /api/decision-contexts/:id/experts/:expertName/consult
Body: {focusArea?: string}
Response: ExpertAdvice

GET /api/mcp/servers
Response: {servers: MCPServer[]}

POST /api/mcp/servers
Body: CreateMCPServer
Response: MCPServer

GET /api/mcp/servers/:name/tools
Response: {tools: MCPTool[]}

GET /api/mcp/servers/:name/resources
Response: {resources: string[]}
```

### Field Library & Templates
```typescript
GET /api/fields
Query: {category?: string}
Response: {fields: DecisionField[]}

GET /api/fields/:id
Response: DecisionField

GET /api/templates
Response: {templates: DecisionTemplate[]}

GET /api/templates/:id
Response: DecisionTemplate

POST /api/templates/:id/set-default
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
decision-logger decisions flag --title <title> --segments <ids> [--priority <n>] [--created-by <name>]
decision-logger decisions show <flagged-id>
decision-logger decisions update <flagged-id> [--title <title>] [--context <text>] [--priority <n>] [--segments <ids>]
decision-logger decisions priority <flagged-id> --priority <n>
decision-logger decisions dismiss <flagged-id>
decision-logger decisions delete <flagged-id>
decision-logger draft generate
decision-logger draft regenerate
decision-logger draft regenerate-field <field-id>
decision-logger draft show
decision-logger draft update-field <field-id> --value <text>
decision-logger draft lock-field <field-id>
decision-logger draft unlock-field <field-id>
decision-logger draft expert-advice <expert-type> [--focus <area>]
decision-logger decision log --type <type> --details <text> --actors <comma-separated> --logged-by <name>
decision-logger decision show <decision-log-id>
decision-logger decision export <decision-log-id> --format <json|markdown> [--output <file>]

# Templates
decision-logger field list [--category <category>]
decision-logger field show <field-id>
decision-logger template list
decision-logger template show <template-id>
decision-logger template set-default <template-id>

# Experts & MCP
decision-logger expert list
decision-logger expert show <expert-id>
decision-logger expert create <name> --prompt-file <file> --mcp-servers <servers>
decision-logger expert update <expert-id> --prompt-file <file>
decision-logger expert delete <expert-id>
decision-logger expert test <expert-id> --decision-context <id>
decision-logger mcp list
decision-logger mcp show <server-name>
decision-logger mcp register <name> --type <type> --config <file>
decision-logger mcp test <server-name>
decision-logger mcp tools <server-name>
decision-logger mcp resources <server-name>
```

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

```typescript
import { generateObject } from 'ai';
import { FlaggedDecisionsSchema } from '@repo/schema';
import decisionDetectionPrompt from '../../../prompts/decision-detection.md';

async function detectDecisions(
  meetingId: string,
  chunks: TranscriptChunk[]
): Promise<FlaggedDecision[]> {
  const { object } = await generateObject({
    model: llmProvider.getDetectionModel(), // local or remote implementation
    schema: FlaggedDecisionsSchema,
    system: decisionDetectionPrompt.system, // Versioned prompt (currently v3)
    prompt: `
Transcript:
${chunks.map(c => `[${c.sequenceNumber}] ${c.speaker ? `${c.speaker}: ` : ''}${c.text}`).join('\n')}

Identify ALL decisions, including implicit decisions and decisions not to act.
    `.trim()
  });
  
  // Filter low-confidence decisions (< 0.5)
  const decisions = object.decisions.filter(d => d.confidence >= 0.5);
  
  return decisions.map(d => ({
    ...d,
    meetingId,
    status: 'pending'
  }));
}
```

### Draft Generation
```typescript
import { generateObject } from 'ai';
import { DecisionDraftSchema } from '@repo/schema';

async function generateDraft(decisionContextId: string) {
  const context = await getDecisionContext(decisionContextId);
  const chunks = await getChunksByContext(`decision:${decisionContextId}`);
  
  const { object } = await generateObject({
    model: llmProvider.getDraftModel(), // usually remote, but swappable
    schema: DecisionDraftSchema,
    system: "Extract decision details from this transcript and fill template fields...",
    prompt: `Transcript: ${chunks.map(c => `[${c.sequenceNumber}] ${c.speaker ? `${c.speaker}: ` : ''}${c.text}`).join('\n')}`
  });
  
  return object.fields;
}
```

### Field-Specific Regeneration
```typescript
async function regenerateField(
  decisionContextId: string,
  fieldId: string
): Promise<DecisionFieldValue> {
  const context = await getDecisionContext(decisionContextId);
  
  // Check if locked
  if (context.lockedFields[fieldId]) {
    throw new Error('Field is locked');
  }
  
  const template = await getTemplate(context.templateId);
  const assignment = template.fields.find(f => f.fieldId === fieldId);
  if (!assignment) {
    throw new Error('Field is not part of the active template');
  }

  const field = await fieldRepo.findById(fieldId);
  const displayLabel = assignment.customLabel ?? field.name;
  const displayDescription = assignment.customDescription ?? field.description;
  
  // Get field-specific chunks (highest priority)
  const fieldChunks = await getChunksByContext(
    `decision:${decisionContextId}:${fieldId}`
  );
  
  // Get general decision chunks (context)
  const decisionChunks = await getChunksByContext(
    `decision:${decisionContextId}`
  );
  
  // Combine, prioritizing field-specific
  const allChunks = [...fieldChunks, ...decisionChunks];
  
  const { object } = await generateObject({
    model: llmProvider.getDraftModel(),
    schema: getFieldOutputSchema(field.fieldType),
    system: field.extractionPrompt.system,
    prompt: `
Extract the value for the "${displayLabel}" field from this transcript.

Field: ${displayLabel}
Description: ${displayDescription}

Transcript (chunks tagged with this field are most relevant):
${allChunks.map(c => {
  const isFieldSpecific = c.contexts.includes(`decision:${decisionContextId}:${fieldId}`);
  return `[${c.sequenceNumber}]${isFieldSpecific ? ' ***' : ''} ${c.speaker ? `${c.speaker}: ` : ''}${c.text}`;
}).join('\n')}

Recent field-tagged chunks have the highest weight. Preserve the field's native shape.
`.trim()
  });

  return object.value;
}
```

## Export Format

Exports are **template-driven**, not hardcoded to a single fixed field set.

### Markdown Rendering Rules

- Use the active template's ordered field assignments to determine section order.
- For each field, render `customLabel` when present; otherwise use the field library name.
- Omit empty optional fields by default.
- Render values by field type:
  - `short_text`, `long_text`, `date`, `numeric`: prose/value block
  - `list`: markdown list
  - `structured`: formatted JSON block or field-specific formatter
- Prepend shared metadata (`Meeting`, `Date`, `Decision Method`, `Logged By`).

### Example Renderer Shape

```typescript
function renderDecisionLogMarkdown(log: DecisionLog, template: DecisionTemplate) {
  const sections = template.fields
    .sort((a, b) => a.order - b.order)
    .map((assignment) => {
      const value = log.fields[assignment.fieldId];
      if (value == null || value === '') return null;

      const label = assignment.customLabel ?? getFieldName(assignment.fieldId);
      return renderSection(label, value);
    })
    .filter(Boolean);

  return [renderMetadata(log), ...sections].join('\n\n');
}
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
- **Database**: PostgreSQL 16+
- **ORM**: Drizzle ORM
- **LLM**: Vercel AI SDK with swappable providers (remote by default, local-capable)
- **Validation**: Zod
- **Testing**: Vitest

> **Note**: pgvector extension is not required for initial implementation. See `docs/pgvector-justification.md` for future considerations.

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
- **Phase 3**: LLM Integration - Mock-first, provider-agnostic, real remote API optional
- **Phase 4**: Decision Workflow - Context, drafts, field locking
- **Phase 5**: Expert System - Domain personas with MCP tools
- **Phase 6**: API Layer - Complete REST endpoints, including field-level retrieval and expert/MCP management
- **Phase 7**: CLI Application - Interactive Clack interface plus decision triage and expert/MCP commands
- **Phase 8**: Export & Polish - Documentation and production readiness

### Phase Summary (Reference)

### Phase 1: Foundation (Week 1)
- [ ] Initialize Turborepo monorepo structure
- [ ] Set up `packages/schema` - Single source of truth (Zod)
- [ ] Implement `@hono/zod-openapi` pipeline in `apps/api`
- [ ] Automate `openapi.yaml` generation and decommission manual file
- [ ] Set up `packages/db` with `drizzle-zod` alignment
- [ ] Define field-library schemas (`DecisionField`, `DecisionTemplate`, `TemplateFieldAssignment`)
- [ ] Set up `packages/core` with Service-Repository pattern and DI container
- [ ] Configure PostgreSQL 16+
- [ ] Configure Vitest for monorepo testing (TDD ready)
- [ ] Implement shared error handling and domain exceptions in `packages/core`

### Phase 2: Core Data Layer (Week 1-2 - TDD Approach)
- [ ] TDD: Meeting Repository and Service
- [ ] TDD: Transcript Segment Repository and Service
- [ ] TDD: Context Tagging logic and Service
- [ ] TDD: Chunk relevance and context-window repositories/services
- [ ] TDD: Flagged decision triage (manual create/update/prioritize/dismiss)
- [ ] TDD: Decision Field Repository and Service
- [ ] TDD: Decision Template Repository and Service
- [ ] TDD: Field library + core template seeding

### Phase 3: LLM & Expert Integration (Week 2)
- [ ] Implement provider-agnostic LLM abstraction layer in `@repo/core`
- [ ] Test: default remote provider connectivity and structured output
- [ ] Test: decision detection via pluggable detection model
- [ ] Implement: semantic tagging/topic extraction and field source-chunk attribution
- [ ] Implement: context-window building for draft generation and expert consultation
- [ ] Implement: Expert template system with MCP tool injection
- [ ] Implement: custom experts, MCP server registry, and expert advice history
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
- [ ] Implement: Manual flagged-decision management endpoints
- [ ] Implement: Context-window and field-level transcript endpoints
- [ ] Implement: Template endpoints
- [ ] Implement: Expert and MCP management endpoints
- [ ] Add: Request validation (Zod)
- [ ] Add: Error handling
- [ ] Test: Integration tests

### Phase 7: CLI (Week 4)
- [ ] Set up Commander.js routing in `apps/cli`
- [ ] Integrate Clack for interactive prompts and spinners
- [ ] Implement: Meeting management commands (interactive)
- [ ] Implement: Transcript ingestion and streaming UI
- [ ] Implement: Decision triage commands (manual flag, update, prioritize, dismiss)
- [ ] Implement: Decision refinement workflow with field locking
- [ ] Implement: Expert advice consultation and expert/MCP management UI
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
- [ ] Add more transcript chunks/events (auto-tagged)
- [ ] Set field focus
- [ ] Add field-specific content (auto-tagged with field)
- [ ] Generate draft decision log
- [ ] Lock satisfied fields
- [ ] Regenerate unlocked fields
- [ ] Iterate through all fields
- [ ] Log final decision with method and actors
- [ ] Export as Markdown with proper formatting
- [ ] All transcript chunks properly tagged with contexts
- [ ] Locked fields never regenerated
- [ ] Recent field-tagged chunks weighted higher in LLM extraction
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
    provider: 'anthropic' | 'openai' | 'local';
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
3. **Auto-tag transcript chunks** with meeting/decision/field contexts
4. **Flag decisions** using LLM analysis
5. **Support iterative refinement** with context switching and field locking
6. **Record decision methods** with text metadata and actors
7. **Provide CLI interface** for testing the full workflow
8. **Export decisions** in Markdown/JSON formats

All fields are text-only, actors are optional (only at final decision), and the workflow supports one active decision context at a time with field-by-field refinement.

Ready to begin implementation when confirmed.
