# MCP Architecture Strategy

**Status**: authoritative
**Owns**: MCP architecture direction, shared-core integration pattern, MCP-specific implementation scope
**Must sync with**: `packages/schema`, `docs/expert-system-architecture.md`, `docs/PLAN.md`, `docs/iterative-implementation-plan.md`

## Question: How to Build Consistent API + MCP System?

You're asking the right questions. Let's evaluate the options systematically.

## Architecture Options

### Option 1: MCP Wraps REST API (Thin Wrapper)

```
LLM → MCP Server → HTTP Client → REST API → Business Logic → Database
```

**Implementation:**
```typescript
// MCP tool definition
{
  name: "create_meeting",
  description: "Create a new meeting",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      date: { type: "string" },
      participants: { type: "array", items: { type: "string" } }
    }
  }
}

// MCP handler (thin wrapper)
async function handleCreateMeeting(args) {
  const response = await fetch('http://localhost:3000/api/meetings', {
    method: 'POST',
    body: JSON.stringify(args)
  });
  return response.json();
}
```

**Pros:**
- ✅ Simple to implement
- ✅ REST API is source of truth
- ✅ No code duplication
- ✅ Easy to maintain consistency

**Cons:**
- ❌ Network overhead (localhost HTTP calls)
- ❌ Requires REST API to be running
- ❌ Less efficient for LLM use cases
- ❌ Can't optimize for MCP-specific patterns

### Option 2: Shared Business Logic Core

```
                    ┌─────────────────┐
                    │ Business Logic  │
                    │ (Core Services) │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    ┌─────────▼────────┐         ┌─────────▼────────┐
    │   REST API       │         │   MCP Server     │
    │  (HTTP Layer)    │         │  (MCP Protocol)  │
    └──────────────────┘         └──────────────────┘
              │                             │
              ▼                             ▼
         Web Clients                    LLM Agents
```

**Implementation:**
```typescript
// Core business logic (shared)
class DecisionService {
  async createMeeting(data: CreateMeetingInput) {
    // Validation
    // Business logic
    // Database operations
    return meeting;
  }
}

// REST API handler
app.post('/api/meetings', async (req, res) => {
  const meeting = await decisionService.createMeeting(req.body);
  res.json(meeting);
});

// MCP handler
async function handleCreateMeeting(args) {
  const meeting = await decisionService.createMeeting(args);
  return meeting;
}
```

**Pros:**
- ✅ No network overhead
- ✅ Single source of truth for business logic
- ✅ Can optimize each interface independently
- ✅ Better performance
- ✅ Can work offline (MCP doesn't need REST API running)

**Cons:**
- ❌ More initial setup
- ❌ Need to maintain two interface layers
- ❌ Requires careful dependency management

### Option 3: Protobuf-First Architecture

```
                    ┌─────────────────┐
                    │  Protobuf IDL   │
                    │  (Definitions)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼────────┐    │    ┌─────────▼────────┐
    │   gRPC Server    │    │    │   MCP Server     │
    │  (Protobuf)      │    │    │  (Protobuf)      │
    └──────────────────┘    │    └──────────────────┘
                            │
                   ┌────────▼────────┐
                   │  REST Gateway   │
                   │  (JSON/HTTP)    │
                   └─────────────────┘
```

**Implementation:**
```protobuf
// decision.proto
syntax = "proto3";

message CreateMeetingRequest {
  string title = 1;
  string date = 2;
  repeated string participants = 3;
}

message Meeting {
  string id = 1;
  string title = 2;
  string date = 3;
  repeated string participants = 4;
  string status = 5;
}

service DecisionService {
  rpc CreateMeeting(CreateMeetingRequest) returns (Meeting);
  rpc GetMeeting(GetMeetingRequest) returns (Meeting);
  // ... all operations
}
```

**Pros:**
- ✅ Strongest type safety
- ✅ Single source of truth (proto files)
- ✅ Efficient serialization
- ✅ Language-agnostic
- ✅ Auto-generated code
- ✅ Versioning built-in

**Cons:**
- ❌ Significant complexity
- ❌ Steeper learning curve
- ❌ Overkill for single-language project
- ❌ REST API becomes a translation layer
- ❌ Less flexible for rapid iteration

## Recommended Approach: **Option 2 (Shared Core)**

For your use case, I recommend **Option 2: Shared Business Logic Core** with TypeScript.

### Why Not Option 1 (MCP Wraps API)?

While simple, it has critical drawbacks:
- **Performance**: Every MCP call makes an HTTP request to localhost
- **Dependency**: MCP server requires REST API to be running
- **Inefficiency**: Double serialization (JSON → HTTP → JSON)
- **LLM Context**: Can't optimize for conversational patterns

### Why Not Option 3 (Protobuf)?

While powerful, it's overkill because:
- **Single language**: You're using TypeScript/Node.js
- **Complexity**: Adds significant overhead for marginal benefit
- **Flexibility**: Harder to iterate quickly on schema changes
- **Tooling**: TypeScript already provides excellent type safety

### Why Option 2 (Shared Core)?

Perfect balance of:
- **Performance**: Direct function calls, no network overhead
- **Consistency**: Single business logic implementation
- **Flexibility**: Can optimize each interface for its use case
- **Simplicity**: TypeScript types provide consistency
- **Maintainability**: Clear separation of concerns

## Recommended Architecture

### Layer Structure

```
┌─────────────────────────────────────────────────────┐
│                  Interface Layer                    │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │   REST Routes    │      │   MCP Handlers   │   │
│  │  (Express.js)    │      │  (MCP Protocol)  │   │
│  └────────┬─────────┘      └────────┬─────────┘   │
└───────────┼──────────────────────────┼─────────────┘
            │                          │
            └──────────┬───────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              Application Services                   │
│  ┌────────────────────────────────────────────┐    │
│  │  DecisionService, MeetingService,          │    │
│  │  TranscriptService, ExportService, etc.    │    │
│  └────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────┐
│                  Data Layer                         │
│  ┌────────────────────────────────────────────┐    │
│  │  Drizzle ORM, Database Access              │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Implementation Pattern

```typescript
// ============================================================================
// TYPES (Shared across REST and MCP)
// ============================================================================

// types/meeting.ts
export interface CreateMeetingInput {
  title: string;
  date: Date;
  participants: string[];
}

export interface Meeting {
  id: string;
  title: string;
  date: Date;
  participants: string[];
  status: 'active' | 'completed';
  createdAt: Date;
}

// ============================================================================
// BUSINESS LOGIC (Shared Core)
// ============================================================================

// services/meeting.service.ts
export class MeetingService {
  constructor(private db: Database) {}

  async createMeeting(input: CreateMeetingInput): Promise<Meeting> {
    // Validation
    if (!input.title || input.title.trim().length === 0) {
      throw new ValidationError('Title is required');
    }

    // Business logic
    const meeting = await this.db.meetings.create({
      title: input.title,
      date: input.date,
      participants: input.participants,
      status: 'active'
    });

    return meeting;
  }

  async getMeeting(id: string): Promise<Meeting> {
    const meeting = await this.db.meetings.findById(id);
    if (!meeting) {
      throw new NotFoundError(`Meeting ${id} not found`);
    }
    return meeting;
  }
}

// ============================================================================
// REST API LAYER
// ============================================================================

// api/routes/meetings.ts
import { MeetingService } from '../../services/meeting.service';

const meetingService = new MeetingService(db);

router.post('/meetings', async (req, res) => {
  try {
    const meeting = await meetingService.createMeeting(req.body);
    res.status(201).json(meeting);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

router.get('/meetings/:id', async (req, res) => {
  try {
    const meeting = await meetingService.getMeeting(req.params.id);
    res.json(meeting);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// ============================================================================
// MCP SERVER LAYER (apps/mcp)
// ============================================================================

// apps/mcp/src/tools/meetings.ts
import { MeetingService } from '@repo/core';
import { db } from '@repo/db';

const meetingService = new MeetingService(db);

export const meetingTools = {
  create_meeting: {
    description: "Create a new meeting for decision logging",
    parameters: z.object({
      title: z.string().describe("Meeting title"),
      date: z.string().describe("Meeting date (ISO 8601)"),
      participants: z.array(z.string()).describe("List of participant names")
    }),
    execute: async (args) => {
      return await meetingService.createMeeting({
        ...args,
        date: new Date(args.date)
      });
    }
  }
};
```

## MCP-Specific Optimizations

### 1. Conversational Context

MCP can maintain state across tool calls:

```typescript
// MCP-specific: Maintain active context
class MCPContextManager {
  private activeMeetingId?: string;
  private activeDecisionId?: string;

  setActiveMeeting(id: string) {
    this.activeMeetingId = id;
  }

  // Tools can use implicit context
  async addTranscript(text: string) {
    if (!this.activeMeetingId) {
      throw new Error("No active meeting. Use set_active_meeting first.");
    }
    return transcriptService.addSegment(this.activeMeetingId, text);
  }
}

// MCP tools
{
  name: "set_active_meeting",
  description: "Set the active meeting context for subsequent operations"
}

{
  name: "add_transcript",
  description: "Add transcript to the active meeting (no need to specify meeting ID)"
}
```

### 2. Streaming Support

MCP supports streaming for long-running operations:

```typescript
// MCP-specific: Stream draft generation
{
  name: "generate_draft_stream",
  description: "Generate decision draft with streaming updates",
  // Returns SSE stream of partial results
}
```

### 3. Batch Operations

MCP can optimize for LLM workflows:

```typescript
// MCP-specific: Batch operations
{
  name: "process_meeting_workflow",
  description: "Complete workflow: upload transcript, flag decisions, generate drafts",
  inputSchema: {
    type: "object",
    properties: {
      transcript: { type: "string" },
      autoGenerateDrafts: { type: "boolean" }
    }
  }
}

// Single MCP call does multiple operations
async function processMeetingWorkflow(args) {
  const meeting = await meetingService.createMeeting(args.meeting);
  const chunks = await transcriptService.uploadTranscript(meeting.id, args.transcript);
  const flagged = await decisionService.flagDecisions(meeting.id);
  
  if (args.autoGenerateDrafts) {
    const drafts = await Promise.all(
      flagged.map(f => decisionService.generateDraft(f.id))
    );
    return { meeting, flagged, drafts };
  }
  
  return { meeting, flagged };
}
```

## Type Safety Without Protobuf

Use TypeScript's type system effectively:

```typescript
// ============================================================================
// SHARED TYPE DEFINITIONS (@repo/schema)
// ============================================================================

// packages/schema/src/meeting.ts - Single source of truth
import { z } from 'zod';

export const CreateMeetingSchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  participants: z.array(z.string()).min(1)
});

export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>;

// ============================================================================
// AUTOMATIC VALIDATION
// ============================================================================

// Both REST and MCP use same validation
export class MeetingService {
  async createMeeting(input: unknown): Promise<Meeting> {
    // Runtime validation
    const validated = CreateMeetingSchema.parse(input);
    
    // Business logic with type-safe input
    return this.db.meetings.create(validated);
  }
}

// REST API
router.post('/meetings', async (req, res) => {
  try {
    const meeting = await meetingService.createMeeting(req.body);
    res.json(meeting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
    }
  }
});

// MCP
async function handleCreateMeeting(args: unknown) {
  // Same validation, same error handling
  return await meetingService.createMeeting(args);
}
```

## Project Structure

```
decision-logger/
├── apps/
│   ├── api/                # Hono REST API
│   ├── cli/                # Commander/Clack CLI
│   └── mcp/                # MCP handlers using shared core services
├── packages/
│   ├── core/               # Shared business logic
│   ├── db/                 # Drizzle & pgvector
│   └── schema/             # Zod schemas & inferred types
├── docs/
└── turbo.json
```

## Implementation Checklist

### Phase 1: Refactor to Shared Core
- [ ] Extract business logic from REST routes into services
- [ ] Create shared type definitions
- [ ] Add Zod schemas for validation
- [ ] Update REST API to use services

### Phase 2: Add MCP Layer
- [ ] Create MCP server setup
- [ ] Define MCP tools (mirror REST endpoints)
- [ ] Implement MCP handlers using shared services
- [ ] Add MCP-specific optimizations (context, batching)

### Phase 3: Testing
- [ ] Unit tests for services (test once, works for both)
- [ ] Integration tests for REST API
- [ ] Integration tests for MCP server
- [ ] End-to-end workflow tests

## Benefits of This Approach

✅ **Consistency**: Single business logic implementation  
✅ **Performance**: No network overhead for MCP  
✅ **Type Safety**: TypeScript types shared across both interfaces  
✅ **Maintainability**: Changes to business logic automatically apply to both  
✅ **Flexibility**: Can optimize each interface independently  
✅ **Testability**: Test business logic once, works for both  
✅ **Simplicity**: No protobuf complexity, pure TypeScript  
✅ **MCP Optimizations**: Can add conversational context, streaming, batching  

## Answer to Your Questions

**Q: Should MCP simply wrap around the API?**  
A: No. Use shared business logic core instead. Wrapping adds unnecessary network overhead.

**Q: Does MCP benefit from a different type of interface?**  
A: Yes! MCP can leverage:
- Conversational context (active meeting/decision)
- Batch operations (complete workflows in one call)
- Streaming (for long operations)
- Simplified parameters (context-aware)

**Q: Should I design all the architecture as protobuf to ensure consistency?**  
A: No. For a TypeScript project, use TypeScript types + Zod validation. Protobuf is overkill and adds complexity without significant benefit. TypeScript already provides excellent type safety and consistency.

## Recommended: Shared Core with TypeScript

Build a **shared business logic core** in TypeScript with:
- Shared type definitions
- Zod schemas for validation
- Service classes for business logic
- Separate interface layers (REST + MCP) that both use the core

This gives you consistency, performance, and flexibility without the complexity of protobuf.
