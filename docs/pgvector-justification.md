# pgvector Requirement Justification

## Current Status: **DEFERRED**

PostgreSQL with pgvector is specified in the tech stack, but the initial implementation phases (0-8) do not include any vector-based features.

## Potential Future Use Cases

### 1. Semantic Segment Retrieval
When generating drafts or regenerating fields, we could use embedding-based similarity search to find the most relevant transcript segments, rather than relying solely on context tags.

**Implementation**:
- Embed transcript segments using OpenAI/Anthropic embeddings
- Store embeddings in `transcript_segments.embedding vector(1536)`
- Query: "Find segments semantically similar to 'budget constraints'"

### 2. Similar Decision Search
Find past decisions that are semantically similar to the current decision context.

**Implementation**:
- Embed decision logs using field content
- Store in `decision_logs.embedding vector(1536)`
- Query: "Show me past decisions about roof repairs"

### 3. Expert Recommendation
Automatically suggest which expert to consult based on decision content similarity to expert domains.

## Decision

**For Phase 0-8**: Remove pgvector from required stack. Use standard PostgreSQL 16.

**Rationale**:
1. No vector features in initial scope
2. Adds unnecessary complexity to development environment
3. Can be added later if semantic search proves valuable
4. Context tagging provides sufficient retrieval for MVP

## Migration Path (if needed later)

```sql
-- Add pgvector extension
CREATE EXTENSION vector;

-- Add embedding columns
ALTER TABLE transcript_segments 
  ADD COLUMN embedding vector(1536);

ALTER TABLE decision_logs 
  ADD COLUMN embedding vector(1536);

-- Create indexes
CREATE INDEX ON transcript_segments 
  USING ivfflat (embedding vector_cosine_ops);
```

## Recommendation

Update `docker-compose.yml` and documentation to use `postgres:16-alpine` instead of `pgvector/pgvector:pg16` for initial development.
