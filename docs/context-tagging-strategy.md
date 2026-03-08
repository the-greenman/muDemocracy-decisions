# Context Tagging Strategy

**Status**: authoritative
**Owns**: chunk tagging model, chunk relevance model, field-level retrieval and regeneration API details, supplementary content model
**Must sync with**: `packages/schema`, `docs/transcript-context-management.md`, `docs/OVERVIEW.md`, `docs/plans/iterative-implementation-plan.md`, `docs/ux-workflow-examples.md`

## Overview

Context tags enable precise retrieval of content for specific decision fields. The tagging model applies to two parallel content stores:

1. **Transcript chunks** — derived from uploaded meeting transcripts via semantic chunking
2. **Supplementary content** — non-transcript text items added manually by the facilitator (pasted comparison tables, background notes, reference material)

Both stores use the same `{scope}:{id}[:{field}]` tag hierarchy and participate in the same retrieval queries. The context builder queries both by tag and feeds the combined results to the LLM. The `source_type` field (`transcript` | `manual`) distinguishes origin but does not affect retrieval priority.

When refining a field like "options" or "stakeholders", we need to retrieve only the relevant content for that field — not the entire meeting — from both sources.

## Supplementary Content Model

### What it is

A `supplementary_content` table holding free-form text items created by the facilitator. Items can be:
- A pasted comparison table from a pre-meeting document
- A reference to a prior decision (quoted text)
- A background note written during the session
- Any non-transcript text the facilitator wants the LLM to incorporate

### Tagging granularity

Items are tagged at creation time based on where they are added:

| UI entry point | Auto-tag applied |
|---|---|
| Meeting setup / background material | `meeting:{id}` |
| Decision workspace (context level) | `decision:{contextId}` |
| Field zoom | `decision:{contextId}:{fieldId}` |

Tags can also be adjusted manually after creation.

### Schema (planned)

```sql
CREATE TABLE supplementary_content (
  id          UUID PRIMARY KEY,
  meeting_id  UUID NOT NULL REFERENCES meetings(id),
  label       TEXT,                          -- Optional human-readable name
  body        TEXT NOT NULL,                 -- The pasted/typed text
  source_type TEXT NOT NULL DEFAULT 'manual',
  contexts    TEXT[] NOT NULL DEFAULT '{}',  -- Same tag format as transcript chunks
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supcontent_meeting ON supplementary_content(meeting_id);
CREATE INDEX idx_supcontent_contexts ON supplementary_content USING GIN(contexts);
```

### API (planned)

```yaml
POST /api/supplementary-content
  Body: { meetingId, label?, body, contexts[] }

GET /api/supplementary-content?context={tag}
  # Returns all items whose contexts array contains the tag
  # Used by context builder alongside transcript chunk retrieval

DELETE /api/supplementary-content/:id
```

### Context builder integration

The context builder currently queries transcript chunks by tag. It must be extended to also query `supplementary_content` by the same tags and merge results before sending to the LLM. The LLM receives both without needing to know which source each item came from.

This extension should be planned before M5.1 so the field context window is complete from the first live regeneration.

## Two Types of Tagging

### Context Tagging (Hierarchical)
**What:** Where the chunk belongs in the decision workflow  
**Format:** `{scope}:{id}[:{field}]`  
**Purpose:** Retrieve chunks for specific decisions/fields  
**Applied:** Automatically during workflow (decision flagging, field generation)

**Examples:**
```
meeting:abc-123                          # All chunks from this meeting
decision:xyz-789                         # All chunks related to this decision
decision:xyz-789:options                 # Chunks about decision options field
decision:xyz-789:stakeholders:concerns   # Chunks about stakeholder concerns field
```

### Semantic Tagging (Topic-Based)
**What:** What the chunk is actually about (content/topics)  
**Format:** Free-form topic keywords  
**Purpose:** Find chunks by subject matter across decisions  
**Applied:** Automatically during semantic chunking via LLM

**Examples:**
```
topics: ["budget", "roof-repair", "contractor-quotes", "maintenance"]
topics: ["risk-assessment", "timeline", "vendor-selection"]
topics: ["stakeholder-concerns", "resident-feedback", "board-approval"]
```

### Why Both?

**Context tags** answer: "Which decision/field does this relate to?"  
**Semantic tags** answer: "What is this chunk about?"

**Example:**
```typescript
chunk: {
  text: "The contractor quoted £45,000 for full roof replacement...",
  
  // Context tagging (workflow)
  contexts: [
    "meeting:abc-123",
    "decision:xyz-789",
    "decision:xyz-789:options",
    "decision:xyz-789:budget"
  ],
  
  // Semantic tagging (content)
  topics: [
    "contractor-quotes",
    "roof-replacement",
    "budget-estimates",
    "full-replacement-option"
  ]
}
```

**Use cases:**
- Context: "Get all chunks for the 'options' field of decision xyz"
- Semantic: "Find all chunks about 'contractor quotes' across all meetings"
- Combined: "Get 'budget' field chunks that mention 'risk assessment'"

## Hierarchical Context Tag Format

### Tag Structure

```
{scope}:{id}[:{field}]
```

### Tag Levels

**Level 1: Meeting Scope**
```
meeting:{meetingId}
```
- Applied to: All chunks from the meeting
- Auto-tagged: During chunk creation
- Use case: Retrieve all meeting content

**Level 2: Decision Scope**
```
decision:{decisionContextId}
```
- Applied to: Chunks related to a specific decision
- Auto-tagged: When decision is flagged or created
- Use case: Retrieve all content for a decision

**Level 3: Field Scope**
```
decision:{decisionContextId}:{fieldId}
```
- Applied to: Chunks relevant to a specific field
- Auto-tagged: During LLM field generation/refinement
- Use case: Retrieve content for field refinement

**Level 4: Sub-field Scope**
```
decision:{decisionContextId}:{fieldId}:{subfield}
```
- Applied to: Chunks for nested field aspects
- Auto-tagged: During detailed analysis
- Use case: Granular field refinement

## Automatic Tagging Workflow

### 1. Initial Chunk Creation (Dual Tagging)

```typescript
// When chunk is created via semantic chunking
async function createSemanticChunk(text: string, meetingId: string) {
  // 1. Create chunk metadata
  // 2. Context tagging (automatic)
  const contexts = [`meeting:${meetingId}`];
  
  // 3. Semantic tagging (LLM extraction via Vercel AI SDK)
  const { object } = await generateObject({
    model: anthropic('claude-3-5-sonnet-latest'),
    schema: z.object({
      topics: z.array(z.string()).describe("3-5 key topics in kebab-case")
    }),
    prompt: `Extract topics from this transcript chunk: ${text}`
  });
  
  return {
    text,
    contexts,
    topics: object.topics,
    // ...
  };
}

// Example result:
{
  text: "The contractor quoted £45,000...",
  contexts: ["meeting:abc-123"],           // Context tags
  topics: ["contractor-quotes", "budget"], // Semantic tags
  embedding: [...],                         // For similarity search
  summary: "Contractor pricing discussion" // Human-readable
}
```

### 2. Decision Flagging

```typescript
// When AI flags a decision or user manually creates one
const flaggedDecision = {
  segmentIds: [chunk1.id, chunk2.id, chunk3.id]
};

// Auto-tag associated chunks
for (const chunkId of flaggedDecision.segmentIds) {
  await addContextTag(chunkId, `decision:${decisionContextId}`);
}
```

### 3. Field Generation (LLM Auto-Tagging)

```typescript
// When LLM generates a field value
POST /api/decision-contexts/{id}/generate-draft

// LLM prompt includes:
"Analyze the transcript and identify which chunks are relevant to each field.
For each field you populate, return the chunk IDs that informed your response."

// LLM response:
{
  fields: {
    statement: {
      value: "Approve roof repair budget",
      sourceChunks: ["chunk-1", "chunk-2"]  // LLM identifies relevant chunks
    },
    options: {
      value: ["Full replacement", "Partial repair"],
      sourceChunks: ["chunk-3", "chunk-4", "chunk-5"]
    },
    stakeholders: {
      value: ["Residents", "Board", "Contractor"],
      sourceChunks: ["chunk-2", "chunk-6"]
    }
  }
}

// Auto-tag chunks based on LLM response
await addContextTag("chunk-1", "decision:xyz:statement");
await addContextTag("chunk-2", "decision:xyz:statement");
await addContextTag("chunk-3", "decision:xyz:options");
await addContextTag("chunk-4", "decision:xyz:options");
await addContextTag("chunk-5", "decision:xyz:options");
await addContextTag("chunk-2", "decision:xyz:stakeholders");
await addContextTag("chunk-6", "decision:xyz:stakeholders");
```

### 4. Field Refinement (User-Directed Tagging)

```typescript
// User sets field focus
POST /api/meetings/{id}/context/field
{
  decisionContextId: "xyz",
  fieldId: "options"
}

// User adds transcript segment while focused on field
POST /api/meetings/{id}/transcripts/add
{
  speaker: "Alice",
  text: "We could also consider a phased approach..."
}

// Auto-tag with current field context
const chunk = createChunk(segment);
chunk.contexts.push(`decision:xyz:options`);  // Auto-tagged from active field
```

### 5. Manual Tagging

```typescript
// User manually tags a chunk
POST /api/chunks/{chunkId}/tags
{
  contexts: [
    "decision:xyz:risks",
    "decision:xyz:timeline"
  ]
}
```

## Retrieval API (Context + Semantic)

### Get Chunks by Context (Hierarchical)

```yaml
GET /api/chunks?context={contextTag}
  - Returns chunks matching the context tag
  - Supports hierarchical filtering

Examples:
  GET /api/chunks?context=meeting:abc-123
    → All chunks from meeting
  
  GET /api/chunks?context=decision:xyz-789
    → All chunks for this decision
  
  GET /api/chunks?context=decision:xyz-789:options
    → Only chunks about options field
```

### Get Chunks by Topic (Semantic)

```yaml
GET /api/chunks?topics={topic1,topic2}
  - Returns chunks tagged with any of the topics
  - Cross-meeting, cross-decision search

Examples:
  GET /api/chunks?topics=budget,contractor-quotes
    → All chunks about budget or contractor quotes
  
  GET /api/chunks?topics=risk-assessment&meetingId=abc-123
    → Risk assessment chunks from specific meeting
```

### Semantic Search (Similarity)

```yaml
POST /api/chunks/search
  Body: {
    query: "What did we discuss about contractor pricing?",
    meetingId: "abc-123",  // Optional: scope to meeting
    limit: 10
  }
  
  - Uses embedding similarity
  - Returns most relevant chunks
  - Ranked by relevance score
```

### Combined Retrieval (Context + Semantic)

```yaml
GET /api/chunks
  ?context=decision:xyz-789:budget
  &topics=contractor-quotes,risk-assessment
  &limit=20
  
  - Filters by BOTH context AND topics
  - Returns chunks that match context AND contain topics
  - Most powerful for precise retrieval

Example:
  "Get budget field chunks that discuss contractor quotes"
  → context=decision:xyz:budget
  → topics=contractor-quotes
```

### Get Context Window for Field

```yaml
GET /api/decision-contexts/{id}/fields/{fieldId}/transcript
  - Returns chunks tagged for this specific field
  - Includes semantic neighbors
  - Optimized for field regeneration

Response:
{
  fieldId: "options",
  chunks: [
    {
      id: "chunk-3",
      text: "...",
      speaker: "Alice",
      timestamp: "00:15:30",
      relevance: 0.95,
      tags: ["decision:xyz:options"]
    }
  ],
  totalTokens: 2500,
  coverage: "30 seconds of discussion"
}
```

### Get Multi-Level Context

```yaml
GET /api/decision-contexts/{id}/transcript
  ?fields=options,stakeholders
  &includeGeneral=true

Returns:
{
  general: [...],           // decision:xyz tagged chunks
  options: [...],           // decision:xyz:options chunks
  stakeholders: [...]       // decision:xyz:stakeholders chunks
}
```

### LLM Integration for Auto-Tagging

#### Enhanced LLM Prompt (Vercel AI SDK generateObject)

```typescript
// packages/core/src/services/draft.service.ts
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { DraftSchema } from '@repo/types';

const { object } = await generateObject({
  model: anthropic('claude-3-5-sonnet-latest'),
  schema: DraftSchema, // Zod schema including sourceChunks identification
  system: "You are analyzing a meeting transcript to populate decision fields...",
  prompt: `Transcript chunks: ...`
});
```

### Processing LLM Response

```typescript
async function processDraftWithTagging(response, decisionContextId) {
  const draft = {};
  
  for (const [fieldId, fieldData] of Object.entries(response)) {
    // Store field value
    draft[fieldId] = fieldData.value;
    
    // Auto-tag source chunks
    for (const source of fieldData.sourceChunks) {
      await db.transcriptChunks.update(source.chunkId, {
        contexts: sql`array_append(contexts, ${`decision:${decisionContextId}:${fieldId}`})`
      });
      
      // Store relevance score
      await db.chunkRelevance.create({
        chunkId: source.chunkId,
        decisionContextId,
        fieldId,
        relevance: source.relevance
      });
    }
  }
  
  return draft;
}
```

## Chunk Relevance Tracking

### New Table: chunk_relevance

```sql
CREATE TABLE chunk_relevance (
  id UUID PRIMARY KEY,
  chunk_id UUID NOT NULL REFERENCES transcript_chunks(id),
  decision_context_id UUID NOT NULL REFERENCES decision_contexts(id),
  field_id TEXT NOT NULL,
  relevance DECIMAL(3,2) NOT NULL,  -- 0.00 to 1.00
  tagged_by TEXT NOT NULL,           -- 'llm', 'user', 'system'
  tagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(chunk_id, decision_context_id, field_id)
);

CREATE INDEX idx_relevance_decision_field 
  ON chunk_relevance(decision_context_id, field_id, relevance DESC);
```

**Purpose:**
- Track which chunks are most relevant to each field
- Enable weighted context window selection
- Audit trail of tagging decisions

## Field Regeneration Workflow

### Scenario: User wants to refine "options" field

```typescript
// 1. Get current field value
const currentValue = decisionContext.draftData.options;

// 2. Retrieve field-specific transcript
GET /api/decision-contexts/{id}/fields/options/transcript

Response:
{
  chunks: [
    {id: "chunk-3", text: "...", relevance: 0.95},
    {id: "chunk-4", text: "...", relevance: 0.88},
    {id: "chunk-5", text: "...", relevance: 0.75}
  ],
  totalTokens: 2500
}

// 3. User adds more context (optional)
POST /api/meetings/{id}/context/field
{
  decisionContextId: "xyz",
  fieldId: "options"
}

// Now any new transcript added is auto-tagged with decision:xyz:options

// 4. Regenerate field with focused context
POST /api/decision-contexts/{id}/fields/options/regenerate
{
  includeChunks: ["chunk-3", "chunk-4", "chunk-5"],  // Field-specific
  additionalContext: "Consider cost implications"
}

// LLM receives only relevant chunks + current value
// Returns updated value + new source chunks
```

## Tagging Best Practices

### 1. Automatic Tagging (Preferred)

**When:**
- Chunk creation → `meeting:{id}`
- Decision flagging → `decision:{id}`
- LLM field generation → `decision:{id}:{field}`

**Why:**
- Consistent
- No user effort
- LLM identifies relevance

### 2. User-Directed Tagging

**When:**
- User sets field focus
- User manually associates chunks
- User refines existing tags

**Why:**
- User knows context best
- Handles edge cases
- Corrects LLM mistakes

### 3. Semantic Tagging

**When:**
- LLM analyzes chunk content
- Automatic topic extraction
- Cross-decision relevance

**Why:**
- Discovers implicit connections
- Enables semantic search
- Improves over time

## API Endpoints Summary

### Chunk Tagging

```yaml
# Add tags to chunk
POST /api/chunks/{chunkId}/tags
  Body: {contexts: ["decision:xyz:options"]}

# Remove tags from chunk
DELETE /api/chunks/{chunkId}/tags
  Body: {contexts: ["decision:xyz:options"]}

# Get chunk tags
GET /api/chunks/{chunkId}/tags
  Response: {contexts: [...], relevance: {...}}
```

### Context Retrieval

```yaml
# Get chunks by context
GET /api/chunks?context={tag}&limit={n}&sortBy=relevance

# Get field-specific transcript
GET /api/decision-contexts/{id}/fields/{fieldId}/transcript
  ?includeNeighbors=true
  &maxTokens=5000

# Get multi-field transcript
GET /api/decision-contexts/{id}/transcript
  ?fields=options,stakeholders,risks
  &includeGeneral=true
```

### Field Regeneration

```yaml
# Regenerate single field with field-specific context
POST /api/decision-contexts/{id}/fields/{fieldId}/regenerate
  Body: {
    includeChunks: [...],      # Optional: specific chunks
    additionalContext: "...",   # Optional: user guidance
    preserveExisting: false     # Optional: merge or replace
  }

# Regenerate multiple fields
POST /api/decision-contexts/{id}/regenerate
  Body: {
    fields: ["options", "risks"],
    useFieldContext: true  # Use field-tagged chunks only
  }
```

## Example: Complete Field Refinement Flow

```bash
# 1. Initial draft generation
POST /api/decision-contexts/xyz/generate-draft
# → LLM auto-tags chunks for each field

# 2. User reviews "options" field, wants more detail
GET /api/decision-contexts/xyz/fields/options/transcript
# → Returns 3 chunks, 2500 tokens

# 3. User sets field focus to add more context
POST /api/meetings/abc/context/field
{
  "decisionContextId": "xyz",
  "fieldId": "options"
}

# 4. User streams in new relevant transcript
POST /api/meetings/abc/transcripts/stream
{
  "speaker": "Bob",
  "text": "We also discussed a hybrid approach...",
  "sequenceNumber": 95
}
# → Auto-tagged with decision:xyz:options (from active field)

# 5. User regenerates field with expanded context
POST /api/decision-contexts/xyz/fields/options/regenerate
{
  "additionalContext": "Include cost comparison"
}
# → LLM uses field-tagged chunks (now 4 chunks, 3200 tokens)
# → Returns updated options + tags new chunk

# 6. User reviews and accepts
PATCH /api/decision-contexts/xyz/fields/options/lock
```

## Benefits

✅ **Precise retrieval** - Get only relevant transcript for each field  
✅ **Automatic tagging** - LLM identifies and tags relevant chunks  
✅ **Efficient regeneration** - Use minimal context for field updates  
✅ **User control** - Manual tagging for edge cases  
✅ **Audit trail** - Track which chunks informed each field  
✅ **Cost optimization** - Smaller context windows for refinement  
✅ **Hierarchical filtering** - From meeting → decision → field → subfield  

## Implementation Priority

**Phase 1: Basic Tagging**
1. ✅ Meeting-level tags (automatic)
2. ✅ Decision-level tags (on flagging)
3. ✅ Context array in chunks table

**Phase 2: Field-Level Tagging**
1. LLM source chunk identification
2. Auto-tagging during draft generation
3. Field-specific retrieval API

**Phase 3: Advanced Features**
1. Relevance scoring
2. Semantic tagging
3. Cross-decision tagging
4. Tag analytics

Start with Phase 2 - this is the key differentiator for field refinement.
