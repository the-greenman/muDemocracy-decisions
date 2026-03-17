# Plan: Connection-Based Context Sync (TDD)

**Status**: active
**Branch**: `feature/drizzle-release-guardrails` (or new branch per phase)
**Related docs**: `docs/connection-context-architecture.md`, `docs/mcp-architecture-strategy.md`
**GitHub issue**: https://github.com/the-greenman/muDemocracy-decisions/issues/12

---

## Goal

Replace the file-backed global context store with a `connections` table in PostgreSQL, add SSE push for real-time sync across interfaces, make the streaming buffer durable and source-aware, and wire `X-Connection-ID` through all interface clients.

---

## Acceptance Criteria

- Context persists across API server restarts
- CLI, web, and MCP all read/write the same context when sharing a connection ID
- Web UI receives context changes in real-time via SSE (no polling)
- Multiple concurrent stream writers to the same meeting produce correct, labelled transcript chunks
- All endpoints that mutate context are scoped to a `connectionId`
- The single-user connection UUID (from `DECISION_LOGGER_CONNECTION_ID`) is auto-created on first use for backward-compatible single-user operation

---

## TDD Execution Strategy

Work in phases. Each phase is a self-contained vertical slice:
1. Write failing test(s) that capture the desired behaviour
2. Implement the minimum change to make the test pass
3. Refactor if needed
4. Keep the system working after each phase

**Prefer integration tests** for Phase 1 (DB-backed context), unit tests for Phase 2 (SSE emitter), and manual smoke tests for Phases 3–4.

---

## Phase 0 — Docs and Issue

### Work
- `docs/connection-context-architecture.md` ✓
- This plan ✓
- `gh issue create` with title, body, and labels

### Done when
- Issue exists and is linked at the top of this plan

---

## Phase 1 — Context → Database

### Test intent

```
GIVEN: API server starts fresh (no context.json)
WHEN: POST /api/context/meeting { meetingId } with X-Connection-ID: <uuid-a>
THEN: context is stored in connections table, not a file

WHEN: API server restarts
AND:  GET /api/context with X-Connection-ID: <uuid-a>
THEN: returns the previously set meetingId (survived restart)

WHEN: POST /api/context/meeting with X-Connection-ID: <uuid-b>
THEN: returns different context than X-Connection-ID: <uuid-a>
```

### Schema changes

**`packages/schema/src/index.ts`** — add:
```typescript
export const ConnectionSchema = z.object({
  id: z.string().min(1),
  activeMeetingId: z.string().uuid().optional().nullable(),
  activeDecisionId: z.string().uuid().optional().nullable(),
  activeDecisionContextId: z.string().uuid().optional().nullable(),
  activeField: z.string().uuid().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSeen: z.string().datetime(),
}).openapi("Connection");

export const CreateConnectionSchema = ConnectionSchema.pick({ id: true });
export type Connection = z.infer<typeof ConnectionSchema>;
export type CreateConnection = z.infer<typeof CreateConnectionSchema>;
```

**`packages/db/src/schema.ts`** — add:
```typescript
export const connections = pgTable("connections", {
  id: text("id").primaryKey(),
  activeMeetingId: uuid("active_meeting_id").references(() => meetings.id).nullable(),
  activeDecisionId: uuid("active_decision_id").references(() => flaggedDecisions.id).nullable(),
  activeDecisionContextId: uuid("active_decision_context_id").references(() => decisionContexts.id).nullable(),
  activeField: uuid("active_field").nullable(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
});
```

### New repository

**`packages/db/src/repositories/connection-repository.ts`**

```typescript
interface IConnectionRepository {
  findById(id: string): Promise<Connection | null>;
  upsert(id: string, state: Partial<ConnectionState>): Promise<Connection>;
  updateLastSeen(id: string): Promise<void>;
}
```

`upsert` uses `ON CONFLICT (id) DO UPDATE` — creates the single-user connection record on first use if it doesn't exist.

### Service changes

**`packages/core/src/interfaces/i-global-context-service.ts`**

All methods gain `connectionId: string` as first parameter:
```typescript
interface IGlobalContextService {
  getContext(connectionId: string): Promise<GlobalContext>;
  setActiveMeeting(connectionId: string, meetingId: string): Promise<void>;
  clearActiveMeeting(connectionId: string): Promise<void>;
  setActiveDecision(connectionId: string, flaggedDecisionId: string, ...): Promise<void>;
  clearActiveDecision(connectionId: string): Promise<void>;
  setActiveField(connectionId: string, fieldId: string): Promise<void>;
  clearActiveField(connectionId: string): Promise<void>;
}
```

**`packages/core/src/services/global-context-service.ts`**

Replace `FileGlobalContextStore` backend with `IConnectionRepository`. `FileGlobalContextStore` and `InMemoryGlobalContextStore` are kept for tests only.

Migration on startup: if `~/.decision-logger/context.json` exists, read it, upsert into the connection record for `DECISION_LOGGER_CONNECTION_ID`, then delete the file.

### API changes

**`apps/api/src/index.ts`**

Extract `connectionId` from request in all context handlers:
```typescript
const connectionId = c.req.header("X-Connection-ID");
if (!connectionId) return c.json({ error: "X-Connection-ID header is required" }, 400);
```

Pass to `globalContextService.getContext(connectionId)` etc.

### DB migration

```bash
pnpm db:generate   # generates SQL from schema changes
pnpm db:migrate    # applies to local DB
```

### Done when

```bash
pnpm --filter @repo/db test        # connection repo tests pass
pnpm --filter @repo/core test      # context service tests pass
pnpm test:e2e                      # context API tests pass with connection header
dlogger context set-meeting <id>
# kill API
pnpm dev --filter=apps/api
dlogger context show               # still shows the meeting
```

---

## Phase 2 — SSE Push

### Test intent

```
GIVEN: client subscribed to GET /api/connections/<uuid>/events
WHEN: POST /api/context/meeting { meetingId } with X-Connection-ID: <uuid>
THEN: client receives an SSE frame:
       id: 1
       event: context
       data: {"activeMeetingId":"..."}
     within 200ms (no polling)
```

### New route

**`apps/api/src/routes/connections.ts`**

```typescript
export const connectionEventsRoute = createRoute({
  method: "get",
  path: "/api/connections/:id/events",
  // produces: text/event-stream
})
```

Handler uses Hono's `streamSSE`. Events include a monotonic `id` for reconnect support:
```typescript
return streamSSE(c, async (stream) => {
  const connectionId = c.req.param("id");
  const lastEventId = Number(c.req.header("Last-Event-ID") ?? "0");

  // Replay missed events from ring buffer (may send resync if gap too large)
  await replayMissedEvents(stream, connectionId, lastEventId);

  const unsubscribe = contextEventBus.subscribe(connectionId, async (event) => {
    await stream.writeSSE({
      id: String(event.id),       // monotonic integer
      event: event.type,          // named event, not an envelope
      data: JSON.stringify(event.payload),
    });
  });
  // heartbeat — comment-only frame, no event name, no data
  const interval = setInterval(() => stream.writeSSE({ comment: "" }), 30000);
  stream.onAbort(() => { unsubscribe(); clearInterval(interval); });
});
```

### Event bus with ring buffer

**`packages/core/src/events/context-event-bus.ts`**

```typescript
interface ContextEvent {
  id: number;           // auto-incremented, per connection
  type: "context" | "chunks" | "flagged" | "logged";
  payload: unknown;     // typed per event
}

class ContextEventBus {
  private listeners = new Map<string, Set<(event: ContextEvent) => void>>();
  private ringBuffers = new Map<string, ContextEvent[]>(); // last 200 per connection
  private counters   = new Map<string, number>();

  subscribe(connectionId: string, fn: (event: ContextEvent) => void): () => void { ... }
  emit(connectionId: string, type: ContextEvent["type"], payload: unknown): void { ... }
  replay(connectionId: string, afterId: number): ContextEvent[] | "resync" { ... }
}
```

- `emit()` increments the counter, prepends to the ring buffer (capped at 200), then calls all listeners
- `replay()` returns events since `afterId`; returns `"resync"` if `afterId` is older than the oldest buffered event

`GlobalContextService` calls `eventBus.emit(connectionId, "context", context)` after every mutation.

**Note**: Ring buffer is in-memory and per-process. A server restart loses buffered events; clients that reconnect after restart receive a `resync` event and must re-fetch state via REST. This is acceptable for single-node. Multi-node replay requires a Redis-backed store (out of current scope).

### Test: reconnect behaviour

```
GIVEN: client subscribed to SSE for connectionId X
WHEN: server emits 5 events (ids 1–5)
AND:  client disconnects after id 3
AND:  client reconnects with Last-Event-ID: 3
THEN: server replays events 4 and 5 immediately

WHEN: client reconnects with Last-Event-ID older than ring buffer
THEN: server sends event: resync, client re-fetches via REST
```

### Web app

**`apps/web/src/hooks/useConnectionEvents.ts`** — new hook:
```typescript
export function useConnectionEvents(connectionId: string) {
  // Opens EventSource with URL /api/connections/:id/events
  // Handles "resync" by calling refetchAll()
  // Replaces polling in FacilitatorMeetingPage and similar
}
```

**`apps/web/src/api/endpoints.ts`** — add `connectionId` to all API calls as `X-Connection-ID` header.

### Done when

```bash
curl -N "http://localhost:3001/api/connections/<uuid>/events" &
dlogger context set-meeting <id>
# curl output shows:
# id: 1
# event: context
# data: {"activeMeetingId":"..."}
```

---

## Phase 3 — DB-Backed Streaming Buffer + Stream Source Labels

### Test intent

```
GIVEN: two concurrent POST /api/meetings/:id/transcripts/stream requests
       (different streamSource values)
WHEN: both complete
AND:  POST /api/meetings/:id/streaming/flush
THEN: both chunks appear in transcript with correct streamSource labels
AND:  no events are lost
```

### Schema changes

**`packages/schema/src/index.ts`**

```typescript
// Add to StreamTranscriptEventSchema
streamSource: z.enum(["transcription", "local-audio", "ai-chat", "manual", "upload"]).optional()

// New
export const StreamEventSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  streamSource: z.string().optional().nullable(),
  text: z.string(),
  speaker: z.string().optional().nullable(),
  timestamp: z.string().optional().nullable(),
  sequenceNumber: z.number().int().optional().nullable(),
  contexts: z.array(z.string()),
  flushed: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
```

**`packages/db/src/schema.ts`**

```typescript
// New table
export const streamEvents = pgTable("stream_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id").references(() => meetings.id).notNull(),
  streamSource: text("stream_source"),
  text: text("text").notNull(),
  speaker: text("speaker"),
  timestamp: text("timestamp"),
  sequenceNumber: integer("sequence_number"),
  contexts: text("contexts").array().notNull().default([]),
  flushed: boolean("flushed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Add column to transcript_chunks
streamSource: text("stream_source"),
```

### Repository changes

**`packages/db/src/repositories/streaming-buffer-repository.ts`**

Replace `Map<string, BufferState>` with DB-backed implementation:
- `appendEvent()` → `INSERT INTO stream_events (...) VALUES (...)`
- `getStatus()` → `SELECT COUNT(*) WHERE flushed = false AND meeting_id = ?`
- `flush()` → see below (requires advisory lock to prevent double-flush)
- `clear()` → `DELETE FROM stream_events WHERE meeting_id = ?`

**Flush must be idempotent under concurrent calls.** Use a PostgreSQL advisory lock scoped to `meetingId` to serialise concurrent flushes:

```typescript
async flush(meetingId: string): Promise<TranscriptChunk[]> {
  return db.transaction(async (tx) => {
    // Advisory lock: only one flush per meetingId at a time
    // pg_try_advisory_xact_lock returns false if lock is held; bail out silently
    const [{ locked }] = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${meetingId}, 0)) AS locked`
    );
    if (!locked) return []; // another flush is in progress; caller should retry

    // Read only unflushed rows (safe: lock held)
    const events = await tx
      .select()
      .from(streamEvents)
      .where(and(eq(streamEvents.meetingId, meetingId), eq(streamEvents.flushed, false)))
      .orderBy(streamEvents.createdAt);

    if (events.length === 0) return [];

    // Create transcript chunks
    const chunks = await createChunksFromEvents(tx, meetingId, events);

    // Mark flushed atomically
    await tx
      .update(streamEvents)
      .set({ flushed: true })
      .where(inArray(streamEvents.id, events.map(e => e.id)));

    return chunks;
  });
}
```

Key properties:
- `pg_try_advisory_xact_lock` is transaction-scoped — released automatically on commit/rollback
- If a second flush arrives while the first is in progress it returns `[]` immediately (no duplicate chunks)
- Callers that receive `[]` from a concurrent flush should treat it as a no-op

### Test: concurrent flush safety

```
GIVEN: 10 events buffered for meetingId M
WHEN: two concurrent flush() calls are made simultaneously
THEN: exactly 10 transcript chunks are created (no duplicates)
AND:  one flush returns the 10 chunks, the other returns []
```

### Done when

```bash
pnpm --filter @repo/db test   # streaming buffer repo tests pass (incl. concurrent flush test)
# Manual: restart API mid-stream, flush still works
# Manual: two concurrent streams → both labelled correctly in chunks
```

---

## Phase 4 — Interface Wiring

### CLI

**`apps/cli/src/client.ts`**
```typescript
// DECISION_LOGGER_CONNECTION_ID must be set to a UUID in .env (see Security section in architecture doc)
// No fallback — fail fast if the env var is missing so misconfiguration is caught early
const CONNECTION_ID = process.env.DECISION_LOGGER_CONNECTION_ID;
if (!CONNECTION_ID) throw new Error("DECISION_LOGGER_CONNECTION_ID is required");

// In request():
init.headers = {
  ...(body ? { "Content-Type": "application/json" } : {}),
  "X-Connection-ID": CONNECTION_ID,
};
```

### MCP

**`apps/mcp/src/client.ts`** — same pattern as CLI.

### Web

**`apps/web/src/api/client.ts`** (or wherever base fetch config lives)
- Read connectionId from `localStorage.getItem("connectionId") ?? generateId()`
- Store it back if generated
- Add `X-Connection-ID` header to all requests

### Transcription service

**`apps/transcription/src/api-client.ts`**
- Add `streamSource: "transcription"` to every `postStreamEvent()` call

### Done when

```bash
# Set context via CLI
DECISION_LOGGER_CONNECTION_ID=<uuid> dlogger context set-meeting <id>

# Observe web UI updates without page refresh (Phase 2 prerequisite)

# MCP tool call updates context visible to web
# (start Claude Code with DECISION_LOGGER_CONNECTION_ID=<uuid>)
```

---

## Full Validation Checklist

```bash
# 1. Build and type-check
pnpm build
pnpm type-check
pnpm lint:workspace

# 2. Tests
pnpm --filter @repo/schema test
pnpm --filter @repo/db test
pnpm --filter @repo/core test
pnpm test:e2e

# 3. DB migration clean
pnpm db:generate   # no unexpected changes
pnpm db:migrate

# 4. Manual smoke
#    Phase 1: context survives restart
#    Phase 2: SSE delivers events in < 200ms
#    Phase 3: concurrent stream sources appear correctly in chunks
#    Phase 4: CLI + MCP + web all see same context
```
