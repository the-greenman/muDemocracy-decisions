---
decision-id: db864e27-c7a9-4ef2-afb6-070a07529159
flagged-decision-id: 61f06c22-33fb-41a0-b1fc-b6eefa31a1dc
log-id: 3144eef9-0576-4921-9877-a0f9e752322a
date: 2026-03-17
status: accepted
affects: packages/core, packages/db, packages/schema, apps/api, apps/cli, apps/mcp, apps/web, apps/transcription
---

# ADR: Connection-Based Context Sync with SSE Push Across All Interfaces

**Meeting:** Architectural Decision Records - Usage and Process
**Participants:** Peter, Claude
**Logged by:** Peter · 2026-03-17 · consensus

---

## Context

The decision-logger system stores active context (active meeting, decision, field) in a file at `~/.decision-logger/context.json`. This causes multiple problems: context is invisible to other interfaces (web, CLI, MCP each drift independently), context is lost on server restart, and there is no mechanism to push context changes to connected clients. A concurrent write race condition was observed where the web UI and MCP server both write to the same file without locking, causing partial write interleaving that corrupts the JSON. Multiple browser tabs on different decisions compound the problem as each tab reads and writes the same global context file independently. The streaming transcript buffer is an in-memory `Map` with no source labeling and no durability, creating race condition risks with multiple concurrent stream sources.

## Tension

Two forces drive this decision: a credibility gap at public release where the project needs to walk its talk on decision capture, and the reality that AI-assisted development makes architectural decisions on the spot without proper diligence. The concurrent write race condition in the file store was demonstrated live during this session — the context file contained two merged JSON objects after simultaneous writes from the web UI and MCP server.

## Decision Question

How should the decision-logger system manage and synchronise active context (active meeting, decision, field) across its three interfaces — CLI, web, and MCP — and how should the streaming transcript buffer be made durable and safe for concurrent writers?

## Options Considered

**Option A — Keep the file store, add atomic writes as a guard**
Write to a `.tmp` file and use `rename()` for atomic swap. Prevents partial-write corruption but does not address persistence across restarts, cross-interface drift, lack of push, or concurrent stream races.

**Option B — PostgreSQL connections table (chosen)**
Replace the file store with a `connections` table where each record holds active meeting/decision/field state. Propagate a connection UUID via `X-Connection-ID` header on every request from CLI, MCP, and web. Add `GET /api/connections/:id/events` SSE endpoint for real-time push. Replace the in-memory streaming buffer `Map` with a `stream_events` table; use `pg_try_advisory_xact_lock(hashtextextended(meetingId, 0))` for idempotent concurrent flush.

**Option C — Redis for state and pub/sub push**
Redis would handle both persistence and push. Rejected: adds a new operational dependency not already present in the stack.

## Evaluation Criteria

1. Context persists across API server restarts
2. CLI, web, and MCP all read/write the same context when sharing a connection ID
3. Web UI receives context changes in real-time without polling
4. Multiple concurrent stream writers produce correct, labelled transcript chunks with no data loss
5. No new operational dependencies beyond PostgreSQL (already in the stack)
6. Backward compatibility for single-user local operation

## Analysis

The file-backed approach fails on criteria 1 (context lost on restart), 2 (each interface drifts independently), 3 (no push mechanism), and 4 (demonstrated race condition). The atomic rename patch addresses the corruption symptom but not the underlying architecture.

The PostgreSQL approach satisfies all six criteria: persistence survives restarts, shared connection IDs enable cross-interface synchronisation, SSE enables real-time push, advisory locks prevent concurrent flush races, PostgreSQL is already a stack dependency, and backward compatibility is maintained through a single-user connection UUID from `DECISION_LOGGER_CONNECTION_ID`.

Redis (Option C) satisfies the same criteria but adds operational cost for no benefit given PostgreSQL is already present.

## Decision

Replace the file-backed global context store with a PostgreSQL `connections` table. Propagate a connection UUID via `X-Connection-ID` header across all interfaces. Add SSE push on `GET /api/connections/:id/events` for real-time context synchronisation. Use a DB-backed `stream_events` table with `pg_try_advisory_xact_lock` for idempotent concurrent flush.

Connection IDs must be server-issued UUIDs — never guessable strings. The `"default"` literal is prohibited at runtime; all interfaces must be configured with a UUID from `DECISION_LOGGER_CONNECTION_ID`.

See `docs/connection-context-architecture.md` for the full contract and `docs/plans/connection-context-implementation.md` for the phased TDD implementation plan.

## Conditions for Revisiting

- Multi-node deployment is required (SSE ring buffer is in-memory and per-process; would need Redis-backed event store)
- Full authentication beyond unguessable connection UUID becomes a requirement

## Outstanding Issues

1. SSE ring buffer is in-memory and per-process — server restart loses buffered events; clients reconnecting after restart receive a `resync` event and re-fetch state via REST
2. Connection UUID security relies on the ID being unguessable; full auth is a separate future concern
3. The atomic file rename patch on `FileGlobalContextStore` is a short-term guard only — it must be removed once Phase 1 (DB-backed context) is implemented

---

*Exported from Decision Logger · Template: Deliberation Decision*
