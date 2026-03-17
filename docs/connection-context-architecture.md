# Connection Context Architecture

**Status**: authoritative
**Owns**: Connection model, context sync across interfaces, SSE push contract, multi-stream design
**Must sync with**: `docs/mcp-architecture-strategy.md`, `docs/transcript-context-management.md`, `docs/plans/connection-context-implementation.md`

---

## Problem

The current system stores active context (active meeting, decision, field) in a file on the API server (`~/.decision-logger/context.json`). This creates several problems:

- Context is invisible to other interfaces — web, CLI, and MCP each maintain their own view and can drift
- Context is not shared per-user — there is one global context for the entire server
- Context is lost if the server restarts
- No mechanism to push context changes to connected clients

---

## The Connection Model

A **Connection** is a database record representing one active participant session. All interfaces that declare the same connection ID share the same context state.

```
Connection {
  id            string (UUID — see Security section for the "default" exception)
  activeMeetingId?
  activeDecisionId?
  activeDecisionContextId?
  activeField?
  createdAt
  updatedAt
  lastSeen
}
```

### Relationship to Meetings

A meeting is the shared data root. Multiple connections can participate in the same meeting simultaneously — each with their own active context state (which decision they are currently focused on).

```
Meeting
  ├── TranscriptChunks (from all sources)
  ├── FlaggedDecisions
  └── DecisionLogs

Connection A (active in this meeting) ──┐
Connection B (active in this meeting) ──┤── both write to same transcript
Connection C (active in this meeting) ──┘   each has own active decision/field state
```

This is the foundation for multi-user support. Today all interfaces share a single connection UUID (from `DECISION_LOGGER_CONNECTION_ID`). Later, each authenticated user gets their own connection ID.

---

## ConnectionId Propagation

Every request includes a connection ID so the API knows whose context to read or update.

| Interface | How connectionId is provided |
|-----------|------------------------------|
| **HTTP requests** | `X-Connection-ID` request header |
| **SSE subscription** | Connection ID is in the URL path: `/api/connections/:id/events` |
| **CLI** | `DECISION_LOGGER_CONNECTION_ID` env var (see Security section below) |
| **Web app** | Server-issued UUID, stored in `localStorage`, added to all API calls as `X-Connection-ID` |
| **MCP server** | `DECISION_LOGGER_CONNECTION_ID` env var when registered |
| **Transcription service** | `DECISION_LOGGER_CONNECTION_ID` env var |

**Missing header**: If no `X-Connection-ID` header is present, the API returns `400 Bad Request`. There is no silent fallback — callers must always declare their connection ID explicitly. All clients (CLI, MCP, web) are configured with a UUID at startup and include it on every request.

---

## Security Model

**Pre-authentication (current scope)**: This system is designed for local, single-user operation. The connection ID is the only access control boundary. The design choices below minimise accidental exposure; full authentication is a separate future concern.

### Connection ID Format

Connection IDs **must be server-issued, opaque UUIDs** — never human-readable strings. The single-user `"default"` fallback is the only exception and is only permitted in local-dev mode.

| Mode | Connection ID | Risk |
|------|--------------|------|
| Local dev / single-user | Fixed UUID stored in `.env` as `DECISION_LOGGER_CONNECTION_ID` | Acceptable — not network-exposed |
| Production (future) | Issued by auth layer per authenticated session | Correct boundary |

**The literal string `"default"` must not be used in any production deployment.** The single-user convenience default must be a UUID generated at first run and persisted to `.env`.

### What "No Auth on SSE" Means

The SSE stream itself does not require a bearer token — the connection ID in the URL path is the credential. Clients that do not know the UUID cannot subscribe. This is equivalent to a bearer token in the URL and is acceptable for local use. For network-exposed deployments, the SSE endpoint should sit behind the same auth middleware as the rest of the API.

### Opaque IDs in Practice

```bash
# Generate a stable single-user connection ID (run once, store in .env)
DECISION_LOGGER_CONNECTION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
```

All interface env vars should point to this UUID, not to `"default"` or `"agent-1"`.

---

## SSE Push Contract

`GET /api/connections/:id/events` opens a persistent Server-Sent Events stream. Clients subscribe once and receive real-time updates when state changes.

### Wire Format

SSE frames use **named events** (the `event:` field). The `data:` field is a JSON-serialised payload specific to that event type. There is no outer `{type, data}` envelope — the event name carries the type.

```
id: <monotonic integer>
event: context
data: {"activeMeetingId":"...","activeMeeting":{...},...}

id: <monotonic integer>
event: chunks
data: [{"id":"...","text":"..."}]

id: <monotonic integer>
event: flagged
data: {"id":"...","suggestedTitle":"..."}

id: <monotonic integer>
event: logged
data: {"id":"...","loggedAt":"..."}
```

### Event Types

| Event name | Payload type | Trigger |
|-----------|-------------|---------|
| `context` | `GlobalContext` | Any mutation to active meeting/decision/field |
| `chunks` | `TranscriptChunk[]` | After a streaming flush creates new chunks |
| `flagged` | `FlaggedDecision` | New flagged decision created on the active meeting |
| `logged` | `DecisionLog` | Decision logged as immutable record |

### Behaviour

- Every event frame includes a monotonic `id:` field
- Events are broadcast to all open SSE streams sharing the same connection ID
- Heartbeat: server sends a `:` (comment-only) frame every 30 seconds to keep connections alive through proxies
- Access control: the connection UUID in the URL path is the credential (see Security section)

### Reconnection and Last-Event-ID

The browser `EventSource` API automatically reconnects on drop and sends the `Last-Event-ID` header. The server maintains a **per-connection in-memory ring buffer** of the last N events (N = 200 by default) keyed by their monotonic ID.

On reconnect:
1. Client sends `Last-Event-ID: <last-seen-id>`
2. Server replays all buffered events with `id >` that value
3. If the last-seen ID is no longer in the buffer (client was disconnected too long), the server sends a `resync` event instructing the client to re-fetch full state via REST

```
event: resync
data: {}
```

**Limitation**: The ring buffer is in-memory and per-server-process. A server restart loses buffered events; clients that reconnect after a restart will receive `resync`. This is acceptable for single-node deployment. Multi-node replay would require a Redis-backed event store (out of current scope).

### Web App Integration

The web app opens one `EventSource` on mount and closes it on unmount. It replaces the current polling loops for context, chunks, and flagged decisions.

```typescript
const connectionId = getOrCreateConnectionId(); // UUID from localStorage
const es = new EventSource(`/api/connections/${connectionId}/events`);

es.addEventListener("context",  (e) => setContext(JSON.parse(e.data)));
es.addEventListener("chunks",   (e) => addChunks(JSON.parse(e.data)));
es.addEventListener("flagged",  (e) => addFlaggedDecision(JSON.parse(e.data)));
es.addEventListener("logged",   (e) => addDecisionLog(JSON.parse(e.data)));
es.addEventListener("resync",   ()  => refetchAll());   // ring buffer miss
```

### MCP Integration

The MCP server does not subscribe to SSE (it is a stdio process that only runs when called). Instead, `resume_session` / `get_session` tool calls fetch the latest context from the API on demand. For a second agent to see decisions flagged by the first, it calls `resume_session`.

---

## Multi-Agent / Multi-Stream Scenario

Multiple agents (or multiple text interfaces) can all contribute to the same session:

```
Claude Code session 1  (connectionId: <uuid-a>)  ──┐
Claude Code session 2  (connectionId: <uuid-b>)  ──┤──→ same meetingId
Live transcription     (connectionId: <uuid-c>)  ──┘    same transcript
```

Each writes to `POST /api/meetings/:id/transcripts/stream` independently, labelled with their `streamSource`. The DB-backed buffer handles concurrent writes safely.

When one agent flags a decision, all others see it the next time they call `resume_session` or `get_session`. With SSE, they see it immediately.

**Practical setup for two agents:**

```bash
# Generate a UUID for each agent and store in .env or shell profile
AGENT_1_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
AGENT_2_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Agent 1 (primary)
DECISION_LOGGER_CONNECTION_ID=$AGENT_1_ID claude

# Agent 2 (secondary) — same meeting, separate context state
DECISION_LOGGER_CONNECTION_ID=$AGENT_2_ID claude
# → in session: resume_session with the known meetingId
```

---

## Stream Sources

Each event written to the transcript carries a `streamSource` label identifying its origin. This allows later filtering and attribution.

| Source | Description |
|--------|-------------|
| `"transcription"` | Live audio transcription via the transcription service |
| `"local-audio"` | Local audio via Whisper or similar |
| `"ai-chat"` | Text from a Claude Code / MCP conversation |
| `"manual"` | User-typed text submitted directly |
| `"upload"` | Batch-uploaded transcript file |

Source labels are stored on `transcript_chunks.stream_source` and visible in exports.

---

## Endpoints Scoped to Connection

The following endpoints read or write connection-scoped context. All require the `X-Connection-ID` header (or default to the UUID from `DECISION_LOGGER_CONNECTION_ID`; see Security section).

```
GET    /api/context                              reads context for connectionId
POST   /api/context/meeting                      sets active meeting for connectionId
DELETE /api/context/meeting                      clears active meeting for connectionId
POST   /api/meetings/:id/context/decision        sets active decision for connectionId
DELETE /api/meetings/:id/context/decision        clears active decision for connectionId
POST   /api/meetings/:id/context/field           sets active field for connectionId
DELETE /api/meetings/:id/context/field           clears active field for connectionId
POST   /api/meetings/:id/transcripts/stream      uses connectionId context for auto-tagging
GET    /api/connections/:id/events               SSE stream for connectionId
```

All other endpoints (meeting CRUD, decision log, template reads, etc.) are not connection-scoped — they are meeting-scoped or global.

---

## Migration from File Store

The `FileGlobalContextStore` (`~/.decision-logger/context.json`) is replaced by a `DrizzleConnectionRepository`. Migration steps:

1. Read the file on startup (if it exists)
2. Create or update the single-user connection record (keyed by `DECISION_LOGGER_CONNECTION_ID`) with the file's state
3. Delete the file
4. All subsequent reads/writes go through the DB

The `FileGlobalContextStore` and `InMemoryGlobalContextStore` classes are retained for use in tests only.

---

## Future: Multi-User

When authentication is added:
- Each authenticated user is issued a connection ID tied to their identity
- The `connections` table gains a `userId` foreign key
- The `"default"` connection is removed from production
- SSE streams require a valid session token

The schema, API, and interfaces are connection-aware from day one so this transition does not require breaking changes.
