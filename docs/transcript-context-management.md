# Transcript and Context Management Strategy

**Status**: authoritative
**Owns**: transcript ingestion/storage architecture, chunking strategy, context-window model, retrieval APIs
**Must sync with**: `packages/schema`, `docs/context-tagging-strategy.md`, `docs/PLAN.md`, `docs/iterative-implementation-plan.md`

## Problem Statement

Managing transcripts and segments presents several challenges:

1. **Variable Input Sizes**: 3-hour meeting transcript (bulk upload) vs. 10-second segments (streaming)
2. **Context Window Limits**: LLMs have token limits (Claude: ~200k tokens, ~150k words)
3. **Inconsistent Granularity**: Mixing large uploads with small segments creates management complexity
4. **Context Relevance**: Not all transcript content is relevant to a specific decision
5. **Performance**: Retrieving and processing large transcripts efficiently

## Proposed Strategy: Hybrid Approach

### Strategy Overview

**Three-Layer Architecture:**

```
Layer 1: Raw Transcripts (immutable, original uploads)
         ↓
Layer 2: Semantic Chunks (standardized, overlapping, indexed)
         ↓
Layer 3: Context Windows (decision-specific, LLM-optimized)
```

### Layer 1: Raw Transcript Storage

**Purpose:** Preserve original uploads for audit and reprocessing

```sql
CREATE TABLE raw_transcripts (
  id UUID PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  source TEXT NOT NULL,  -- 'upload', 'stream', 'api'
  format TEXT,           -- 'txt', 'vtt', 'srt', 'json'
  content TEXT NOT NULL, -- Original unprocessed content
  metadata JSONB,        -- {duration, file_size, encoding, etc}
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by TEXT
);

CREATE INDEX idx_raw_transcripts_meeting ON raw_transcripts(meeting_id);
```

**Benefits:**
- ✅ Immutable record of original input
- ✅ Can reprocess with different chunking strategies
- ✅ Audit trail for compliance
- ✅ Support multiple formats

### Layer 2: Semantic Chunks (Standardized Segments)

**Purpose:** Consistent, semantically meaningful chunks for processing

```sql
CREATE TABLE transcript_chunks (
  id UUID PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  raw_transcript_id UUID REFERENCES raw_transcripts(id),
  
  -- Content
  text TEXT NOT NULL,
  speaker TEXT,
  
  -- Positioning
  sequence_number INTEGER NOT NULL,
  start_time INTEGER,        -- Seconds from meeting start
  end_time INTEGER,          -- Seconds from meeting start
  
  -- Chunking metadata
  chunk_strategy TEXT NOT NULL,  -- 'semantic', 'fixed-time', 'speaker-turn', 'sentence'
  token_count INTEGER,           -- Approximate tokens
  word_count INTEGER,
  
  -- Semantic information
  embedding VECTOR(1536),         -- Vector embedding (dim depends on model, e.g., 1536 for OpenAI)
  summary TEXT,                  -- AI-generated summary of chunk
  topics TEXT[],                 -- Extracted topics/keywords
  
  -- Context tags
  contexts TEXT[] NOT NULL DEFAULT '{}',
  
  -- Overlap for continuity
  overlap_prev UUID REFERENCES transcript_chunks(id),  -- Previous chunk with overlap
  overlap_next UUID REFERENCES transcript_chunks(id),  -- Next chunk with overlap
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_meeting ON transcript_chunks(meeting_id);
CREATE INDEX idx_chunks_sequence ON transcript_chunks(meeting_id, sequence_number);
CREATE INDEX idx_chunks_time ON transcript_chunks(start_time, end_time);
CREATE INDEX idx_chunks_contexts ON transcript_chunks USING gin(contexts);
CREATE INDEX idx_chunks_embedding ON transcript_chunks USING ivfflat(embedding vector_cosine_ops);
```

**Chunking Strategies:**

#### 1. **Semantic Chunking** (Recommended)
- Chunk by topic/theme boundaries
- Use LLM to detect topic shifts
- Typical size: 500-1000 tokens (~375-750 words)
- Overlap: 100 tokens between chunks

#### 2. **Fixed-Time Chunking**
- Fixed duration chunks (e.g., 2 minutes)
- Good for streaming scenarios
- Typical size: 2-5 minutes of speech (~300-750 words)
- Overlap: 30 seconds

#### 3. **Speaker-Turn Chunking**
- Chunk by speaker changes
- Preserves conversational context
- Variable size (combine short turns)
- Overlap: Last sentence of previous speaker

#### 4. **Sentence Boundary Chunking**
- Chunk at sentence boundaries
- Target size: 500 tokens
- Never split mid-sentence
- Overlap: 1-2 sentences

### Layer 3: Context Windows (Decision-Specific)

**Purpose:** Optimized context for specific decision processing

```sql
CREATE TABLE decision_context_windows (
  id UUID PRIMARY KEY,
  decision_context_id UUID NOT NULL REFERENCES decision_contexts(id),
  
  -- Context selection
  chunk_ids UUID[] NOT NULL,           -- Ordered list of chunk IDs
  selection_strategy TEXT NOT NULL,    -- 'manual', 'semantic', 'temporal', 'hybrid'
  
  -- Window metadata
  total_tokens INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  time_span_seconds INTEGER,           -- Total time covered
  
  -- Relevance scoring
  relevance_scores JSONB,              -- {chunk_id: score}
  
  -- LLM usage
  used_for TEXT[],                     -- ['draft-generation', 'field-regeneration', 'expert-advice']
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_context_windows_decision ON decision_context_windows(decision_context_id);
```

**Context Selection Strategies:**

#### 1. **Semantic Similarity** (AI-Driven)
```typescript
// Find chunks most relevant to decision
const relevantChunks = await findSimilarChunks({
  query: decisionContext.title,
  meetingId: meeting.id,
  limit: 20,
  minSimilarity: 0.7
});
```

#### 2. **Temporal Window** (Time-Based)
```typescript
// Get chunks around decision timestamp
const timeWindow = await getChunksInTimeRange({
  meetingId: meeting.id,
  startTime: decisionTime - 300,  // 5 minutes before
  endTime: decisionTime + 300,    // 5 minutes after
});
```

#### 3. **Hybrid Approach** (Recommended)
```typescript
// Combine semantic + temporal + manual
const contextWindow = {
  // Core: Manually selected segments
  manual: flaggedDecision.segmentIds,
  
  // Expand: Semantically similar chunks
  semantic: await findSimilar(flaggedDecision.title, limit: 10),
  
  // Context: Temporal neighbors
  temporal: await getNeighbors(manual, windowSize: 2),
  
  // Total tokens: ~10k-20k (well within Claude's limit)
};
```

## Implementation

### Upload Flow

```typescript
// packages/core/src/services/transcript.service.ts
import { generateObject, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

async function uploadTranscript(meetingId, file) {
  // 1. Store raw transcript
  // ...
  
  // 2. Chunk semantically
  // ...
  
  // 3. Store chunks with embeddings
  // ...
  
  // 4. AI detection of potential decisions (Vercel AI SDK)
  const { object } = await generateObject({
    model: anthropic('claude-3-5-sonnet-latest'),
    schema: DecisionsSchema,
    prompt: `Analyze these transcript chunks and detect decisions: ...`
  });
  
  return {
    rawId: raw.id,
    chunkCount: chunks.length,
    flaggedDecisions: object.decisions
  };
}
```

### Context Window Building

```typescript
async function buildContextWindow(decisionContextId) {
  const decision = await db.decisionContexts.findById(decisionContextId);
  const flagged = await db.flaggedDecisions.findById(decision.flaggedDecisionId);
  
  // Strategy: Hybrid approach
  const window = {
    manual: [],
    semantic: [],
    temporal: []
  };
  
  // 1. Start with manually selected chunks
  if (flagged.segmentIds.length > 0) {
    window.manual = await db.transcriptChunks.findByIds(flagged.segmentIds);
  }
  
  // 2. Add semantically similar chunks
  const query = `${decision.title}\n${flagged.contextSummary || ''}`;
  window.semantic = await db.transcriptChunks.findSimilar({
    meetingId: decision.meetingId,
    query,
    limit: 10,
    minSimilarity: 0.75,
    excludeIds: window.manual.map(c => c.id)
  });
  
  // 3. Add temporal neighbors (chunks before/after manual selections)
  for (const chunk of window.manual) {
    const neighbors = await db.transcriptChunks.getNeighbors({
      chunkId: chunk.id,
      before: 2,
      after: 2
    });
    window.temporal.push(...neighbors);
  }
  
  // 4. Deduplicate and order by sequence
  const allChunks = deduplicateAndOrder([
    ...window.manual,
    ...window.semantic,
    ...window.temporal
  ]);
  
  // 5. Enforce token limit (e.g., 20k tokens for draft generation)
  const limitedChunks = enforceTokenLimit(allChunks, maxTokens: 20000);
  
  // 6. Store context window
  return await db.decisionContextWindows.create({
    decisionContextId,
    chunkIds: limitedChunks.map(c => c.id),
    selectionStrategy: 'hybrid',
    totalTokens: sumTokens(limitedChunks),
    totalChunks: limitedChunks.length,
    relevanceScores: calculateScores(limitedChunks)
  });
}
```

## Context Size Guidelines

### LLM Token Limits

| Model | Max Context | Recommended Usage | Reserve for Output |
|-------|-------------|-------------------|-------------------|
| Claude 3.5 Sonnet | 200k tokens | 150k tokens | 50k tokens |
| GPT-4 Turbo | 128k tokens | 100k tokens | 28k tokens |

### Decision Logger Context Budgets

**For Draft Generation:**
```
System Prompt:           ~1k tokens
Template Definition:     ~500 tokens
Decision Context:        ~500 tokens
Transcript Context:      15k-20k tokens  ← Main content
Previous Drafts:         ~2k tokens
Instructions:            ~1k tokens
─────────────────────────────────────
Total Input:             ~20k-25k tokens
Expected Output:         ~2k-5k tokens
─────────────────────────────────────
Total:                   ~25k-30k tokens
```

**For Expert Advice:**
```
System Prompt:           ~2k tokens (expert persona)
Decision Draft:          ~3k tokens
Transcript Context:      10k-15k tokens  ← Focused subset
MCP Tool Results:        ~5k tokens
Instructions:            ~1k tokens
─────────────────────────────────────
Total Input:             ~21k-26k tokens
Expected Output:         ~3k-5k tokens
─────────────────────────────────────
Total:                   ~25k-30k tokens
```

### Chunking Size Recommendations

**For 3-Hour Meeting (~27,000 words, ~36,000 tokens):**

```
Semantic Chunking:
- Chunk size: 750 tokens (~560 words)
- Overlap: 100 tokens (~75 words)
- Result: ~50 chunks
- Each chunk: ~2-3 minutes of speech

Context Window for Decision:
- Manual selection: 5-10 chunks (5k-7.5k tokens)
- Semantic expansion: 10-15 chunks (7.5k-11k tokens)
- Temporal neighbors: 5-10 chunks (3.5k-7.5k tokens)
- Total: 15-25 chunks (15k-20k tokens)
- Coverage: ~30-50 minutes of relevant discussion
```

**This is manageable!** A 3-hour meeting is ~36k tokens total. We only need 15k-20k tokens for a decision, which is:
- ✅ Well within Claude's 200k limit
- ✅ ~40-55% of the meeting content
- ✅ Highly relevant to the specific decision

## Transcript Ingestion Methods

### Method Comparison

The system supports three ways to ingest transcripts:

| Method | Endpoint | Processing | Use Case | Cost |
|--------|----------|------------|----------|------|
| **Bulk Upload** | `POST /transcripts/upload` | Background batch | Full transcript files | Medium |
| **Immediate Add** | `POST /transcripts/add` | Per-segment | Historical/manual entry | High |
| **Streaming** | `POST /transcripts/stream` | Buffered batch | Live meetings | Low |

### 1. Bulk Upload (3-Hour Transcript)

```typescript
POST /api/meetings/{id}/transcripts/upload
{
  "content": "...",  // Full 3-hour transcript
  "format": "txt",
  "chunkingStrategy": "semantic"  // Process in background
}

// Background processing:
1. Store raw transcript
2. Semantic chunking (~50 chunks)
3. Generate embeddings for each chunk
4. AI detection of potential decisions
5. Return flagged decisions
```

**Processing time:** 2-5 minutes (background job)

### 2. Immediate Add (Per-Segment Processing)

```typescript
POST /api/meetings/{id}/transcripts/add
{
  "speaker": "Alice",
  "text": "...",  // Single segment
  "timestamp": "00:15:30",
  "sequenceNumber": 42
}

// Immediate processing:
1. Create chunk directly (one segment = one chunk)
2. Generate embedding
3. Run full decision detection
4. Return immediately with results

// Response:
{
  "chunkId": "...",
  "sequenceNumber": 42,
  "contexts": ["meeting:123"],
  "flaggedDecisions": [...]
}
```

**Processing time:** Immediate (per segment)

**Use cases:**
- Adding historical segments from past meetings
- Manual segment entry
- Testing/debugging
- When you need immediate feedback per segment

**Trade-offs:**
- ✅ Immediate results
- ✅ Simple API
- ❌ Higher cost (LLM call per segment)
- ❌ More chunks created (less optimal)
- ❌ No intelligent boundary detection

### 3. Streaming (Buffered Processing)

```typescript
POST /api/meetings/{id}/transcripts/stream
{
  "timestamp": "00:15:30",
  "speaker": "Alice",
  "text": "...",  // 10 seconds of speech
  "sequenceNumber": 93
}

// Real-time processing:
1. Store in streaming_buffer table
2. Count total buffered tokens
3. Check chunking trigger:
   - Buffer >= 750 tokens AND speaker change
   - OR buffer >= 1000 tokens (force)
   - OR 3 minutes elapsed (timeout)
4. When triggered:
   - Combine buffered segments into chunk
   - Generate embedding
   - Quick decision pattern check
   - Mark buffer segments as processed
5. Return status:
   - {buffering: true, bufferSize: 5} OR
   - {chunkCreated: true, chunkId, potentialDecision}
```

**Processing time:** Real-time + hybrid chunking (token + time + speaker boundaries)

**Use cases:**
- Live meeting transcription
- Real-time streaming from transcription services
- When you want optimized chunking
- When you want cost-efficient processing

**Trade-offs:**
- ✅ Lower cost (batched LLM calls)
- ✅ Better chunk boundaries (respects speakers)
- ✅ Optimized token usage
- ✅ Real-time status feedback
- ❌ Delayed results (until chunk created)
- ❌ More complex API

**Streaming-Specific Endpoints:**
```yaml
POST /api/meetings/{id}/transcripts/stream
  - Add segment to buffer
  - Returns buffering status or chunk creation

GET /api/meetings/{id}/streaming/status
  - Get buffer status (size, tokens, last chunk time)

POST /api/meetings/{id}/streaming/flush
  - Force process buffer (meeting ended)

DELETE /api/meetings/{id}/streaming/buffer
  - Clear buffer (cancel meeting)
```

### Which Method Should You Use?

**Decision Guide:**

```
Do you have a complete transcript file?
├─ Yes → Use /transcripts/upload (bulk)
└─ No → Continue...

Are you processing a live meeting?
├─ Yes → Use /transcripts/stream (buffered)
└─ No → Continue...

Do you need immediate feedback per segment?
├─ Yes → Use /transcripts/add (immediate)
└─ No → Use /transcripts/stream (more efficient)

Are you adding historical/manual segments?
├─ Yes → Use /transcripts/add (immediate)
└─ No → Use /transcripts/stream (live)
```

**Cost Comparison (1-hour meeting, ~60 segments):**

| Method | Chunks Created | Embeddings | LLM Calls | Relative Cost |
|--------|----------------|------------|-----------|---------------|
| **Bulk Upload** | ~25 chunks | 25 | 1 detection pass | 1x (baseline) |
| **Immediate Add** | 60 chunks | 60 | 60 detection calls | 3-4x |
| **Streaming** | ~25 chunks | 25 | 1 detection pass | 1x (baseline) |

**Recommendation:** Use `/stream` for live meetings, `/add` only when you need immediate per-segment feedback.

### Unified Approach

All three methods converge to the same chunked representation:

```
Bulk Upload → Raw Storage → Semantic Chunking → Chunks
Streaming   → Buffer       → Periodic Chunking → Chunks
                                ↓
                        Same chunk format
                                ↓
                    Context Window Selection
                                ↓
                        LLM Processing
```

## API Updates

### New Endpoints

```yaml
# Raw transcript management
POST /api/meetings/{id}/transcripts/upload
  - Stores raw + creates chunks
  - Returns: {rawId, chunkCount, flaggedDecisions}

GET /api/meetings/{id}/transcripts/raw
  - List raw transcript uploads
  
GET /api/raw-transcripts/{id}
  - Get original raw transcript

# Chunk management
GET /api/meetings/{id}/chunks
  ?strategy=semantic|fixed-time|speaker-turn
  &timeRange=start-end
  &contexts=meeting:123,decision:456
  
GET /api/chunks/{id}
  - Get specific chunk with neighbors

POST /api/chunks/search
  Body: {query, meetingId, limit}
  - Semantic search for relevant chunks

# Context window management
GET /api/decision-contexts/{id}/context-window
  - Get current context window for decision
  
POST /api/decision-contexts/{id}/context-window
  Body: {strategy, chunkIds, maxTokens}
  - Build/update context window
  
GET /api/decision-contexts/{id}/context-window/preview
  - Preview what will be sent to LLM
```

## Configuration

### System-Wide Settings

```typescript
// config/chunking.ts
export const CHUNKING_CONFIG = {
  strategies: {
    semantic: {
      targetTokens: 750,
      overlap: 100,
      minTokens: 400,
      maxTokens: 1200
    },
    fixedTime: {
      durationSeconds: 120,  // 2 minutes
      overlapSeconds: 30
    },
    speakerTurn: {
      minTokens: 200,
      combineShortTurns: true
    }
  },
  
  contextWindows: {
    draftGeneration: {
      maxTokens: 20000,
      strategy: 'hybrid',
      semanticLimit: 15,
      temporalWindow: 2  // chunks before/after
    },
    expertAdvice: {
      maxTokens: 15000,
      strategy: 'semantic',
      minSimilarity: 0.75
    }
  }
};
```

### Per-Decision Configuration

```typescript
// Allow override per decision
POST /api/decision-contexts/{id}/generate-draft
{
  "contextWindow": {
    "strategy": "semantic",  // Override default
    "maxTokens": 25000,      // Use more context
    "includeChunks": ["chunk-1", "chunk-2"]  // Force include
  }
}
```

## Benefits Summary

✅ **Standardized chunking** - Consistent 750-token chunks regardless of input  
✅ **Raw preservation** - Original transcripts stored for reprocessing  
✅ **Semantic search** - Find relevant content via embeddings  
✅ **Flexible context** - Build optimal windows per decision  
✅ **Token management** - Stay within LLM limits efficiently  
✅ **Streaming support** - Handle real-time and bulk uploads  
✅ **Audit trail** - Track what context was used for each decision  
✅ **Performance** - Indexed chunks for fast retrieval  

## Recommended Approach

**Start with:**
1. ✅ Semantic chunking (750 tokens, 100 overlap)
2. ✅ Hybrid context selection (manual + semantic + temporal)
3. ✅ 15k-20k token budget for draft generation
4. ✅ Raw transcript preservation
5. ✅ Embedding-based similarity search

**This handles:**
- 3-hour meetings → ~50 chunks → select 15-25 relevant chunks
- 10-second streams → buffer → chunk every 2 minutes
- Context relevance → semantic search finds best chunks
- Token limits → well within Claude's 200k capacity
- Performance → indexed, searchable, efficient

A 3-hour meeting is **not too much context** - it's ~36k tokens total, and we only need 15k-20k tokens (40-55%) for any single decision, which is highly manageable!
