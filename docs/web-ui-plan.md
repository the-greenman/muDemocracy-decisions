# Web UI Plan

**Status**: authoritative
**Must sync with**: `docs/ui-ux-overview.md`, `docs/web-ui-design-system.md`, `docs/plans/iterative-implementation-plan.md`, `docs/manual-decision-workflow.md`
**Implementation milestone**: M5.5

## Purpose

Define the full design of the decision logger web UI: technology, route architecture, mode split, screen inventory with user stories, API dependency map, and phased build order. This document is the primary implementation reference for `apps/web/`.

---

## Technology

| Choice | Decision |
|---|---|
| Framework | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Package | `@repo/web` in monorepo (`apps/web/`) |
| API base URL | `VITE_API_URL` env var (default: `http://localhost:3000`) |
| Streaming | SSE via `EventSource` for draft generation progress |

---

## Mode Split: Separate Routes

The web app splits into two modes via separate routes — not a toggle — because:

- **Primary setup is dual-screen**: facilitator's laptop open to facilitator route, room screen projecting shared display route
- **Accidental control trigger prevention**: no action buttons exist in the shared display DOM — there is nothing to accidentally click
- **Enforceable at component level**: shared display components are structurally read-only; facilitator components live in a separate directory with a clear import boundary

### Simplicity invariants (enforced by structure, not convention)

1. `MeetingShared` and all components it imports have **zero** mutation event handlers
2. No UUIDs rendered in the shared display DOM — resolve to human-readable names before render
3. Facilitator-only components live under `src/components/facilitator/` — visible import boundary
4. Tags and status indicators use colours/icons on the shared screen — no raw enum strings

---

## Route Architecture

| Route | Audience | Description |
|---|---|---|
| `/` | Facilitator | Meeting list — create or open a meeting |
| `/meetings/:id` | **Projected to group** | Shared display — agenda + active workspace, read-only |
| `/meetings/:id/facilitator` | Facilitator device | Full controls — candidates, generate, lock, edit, finalise |
| `/meetings/:id/facilitator/transcript` | Facilitator | Segment selection in reading mode |
| `/decisions/:id` | Both | Logged decision — projectable, read-only, export |

---

## Screen Inventory

### Screen 1 — Meeting List (`/`)

**Primary goal**: start or resume a meeting session.

**User stories**:
- As a facilitator, I can see all meetings with their date and status at a glance
- As a facilitator, I can create a new meeting with title, date, and participant list
- As a facilitator, I can open an existing active meeting
- As a facilitator, I can see how many decisions are drafted and logged per meeting without opening it

**Shared display implications**: this screen is not projected. No special display rules apply.

**API**:
- `GET /api/meetings` — meeting list
- `POST /api/meetings` — create meeting

---

### Screen 2 — Shared Meeting Display (`/meetings/:id`)

**Primary goal**: give the group a clean, high-readability view of the agenda and the active decision throughout the meeting.

**User stories**:
- As a participant, I can see the meeting agenda — the ordered list of decisions being discussed — at all times
- As a participant, I can see which agenda item is currently active
- As a participant, I can read the current decision's field content in large, high-contrast text
- As a participant, I can see which fields are settled and which are still in progress — without technical terminology
- As a participant, I can see the tags on the active decision (topic, team, project) as coloured labels
- As a participant, I can see other decisions referenced from this one
- As a participant, I can watch a field populate progressively during draft generation without visual noise
- As a participant, I can see when a decision has been finalised and the meeting is ready to move on

**Display rules**:
- No action buttons, no UUIDs, no chunk counts, no confidence numbers
- Locked fields: muted background — no `[LOCKED]` label (technical term)
- Tags: coloured pills below the decision title
- Generation in progress: per-field spinner, not raw token stream
- Minimum font size 20px, high contrast ratio throughout
- Agenda panel always visible; workspace fills remaining width

**Live update strategy**: poll `GET /api/meetings/:id/decision-contexts` and `GET /api/decision-contexts/:id` every 3–5 seconds, or subscribe to SSE when the streaming endpoint is available. The facilitator's actions on their device are reflected on the shared screen within the poll interval.

**API**:
- `GET /api/meetings/:id` — meeting header (title, date, participants)
- `GET /api/meetings/:id/summary` — agenda stats
- `GET /api/meetings/:id/decision-contexts` — agenda with status
- `GET /api/decision-contexts/:id` — active workspace fields and lock state
- `GET /api/decisions/:id/tags` — tag pills (after M4.10)
- `GET /api/decisions/:id/relations` — related decisions (after M4.10)

---

### Screen 3 — Facilitator Meeting View (`/meetings/:id/facilitator`)

**Primary goal**: give the facilitator complete control over the decision workflow — flagging, promoting, generating, locking, editing, and finalising — on their own device while the group watches the shared screen.

**User stories**:
- As a facilitator, I can see newly suggested candidates separate from the confirmed agenda
- As a facilitator, I can review a candidate, edit its title and summary, and choose a template before promoting it
- As a facilitator, I can promote a candidate to the agenda and set its position (not just append to end)
- As a facilitator, I can dismiss a candidate that is not a real decision
- As a facilitator, I can generate an initial draft for the active decision context
- As a facilitator, I can regenerate all unlocked fields at once
- As a facilitator, I can lock a field when the group agrees on its content
- As a facilitator, I can unlock a locked field and regenerate it with new guidance
- As a facilitator, I can zoom into a single field to edit it directly or add specific guidance text
- As a facilitator, I can add transcript segments to the active decision context without leaving the workspace
- As a facilitator, I can provide inline text guidance for a specific field's next regeneration
- As a facilitator, I can view the LLM interaction log for the current context (collapsible)
- As a facilitator, I can view field version history and restore a prior version (within field zoom)
- As a facilitator, I can finalise the decision with decision method, actors, and logged-by details
- As a facilitator, I can add or remove tags on the active context by name
- As a facilitator, I can add a relation from the current context to another decision or context

**Layout**:
- Header action strip: `[ + Flag decision ]  [ Generate draft ]  [ Finalise ]`
- Left panel: candidate queue with `Suggested` / `Agenda` tabs; agenda items are reorderable
- Main panel: decision workspace — same field view as shared display, plus per-field controls
- Per-field controls: lock/unlock toggle · regenerate · zoom · inline guidance input
- Right sidebar (collapsible): LLM interaction log · field version history

**API**: all shared display endpoints plus:
- `GET /api/meetings/:id/flagged-decisions` — candidate queue
- `POST /api/meetings/:id/flagged-decisions` — manual flag
- `PATCH /api/flagged-decisions/:id` — edit candidate title/summary/priority
- `DELETE /api/flagged-decisions/:id` — dismiss candidate
- `POST /api/decision-contexts` — create context from promoted candidate
- `POST /api/decision-contexts/:id/generate-draft` — generate initial draft
- `POST /api/decision-contexts/:id/regenerate` — regenerate all unlocked fields
- `PUT /api/decision-contexts/:id/lock-field` — lock field
- `DELETE /api/decision-contexts/:id/lock-field` — unlock field
- `POST /api/decision-contexts/:id/fields/:fieldId/regenerate` — regenerate one field
- `PATCH /api/decision-contexts/:id/fields/:fieldId` — manual field edit
- `GET /api/decision-contexts/:id/llm-interactions` — LLM log
- `GET /api/decision-contexts/:id/versions` — draft version history
- `POST /api/decision-contexts/:id/rollback` — restore prior draft version
- `POST /api/decision-contexts/:id/log` — finalise decision
- `PATCH /api/meetings/:id` — update participants during session
- Tag and relation endpoints (after M4.10)

---

### Screen 4 — Transcript / Segment Selection (`/meetings/:id/facilitator/transcript`)

**Primary goal**: select transcript evidence quickly and accurately for a specific decision or field.

**User stories**:
- As a facilitator, I can read the transcript in a clean non-overlapping view (reading mode) by default
- As a facilitator, I can search the transcript by text and narrow by sequence range
- As a facilitator, I can drag-select a range of rows with mouse or touch
- As a facilitator, I can see a compact indicator when a row has overlap from another meeting (hidden by default, toggle to reveal)
- As a facilitator, I can toggle to include transcript from other meetings in the same context
- As a facilitator, I can confirm my selection and return to the facilitator workspace — selection is persisted with both reading-row IDs and resolved chunk IDs for auditability
- As a facilitator, I can use AI-suggested segments as a starting point, then adjust before confirming

**Display rules**: facilitator only — this route is not linked from the shared display.

**API**:
- `GET /api/meetings/:id/transcript-reading` — de-overlapped reading projection
- `POST /api/meetings/:id/segment-suggestions` — AI-suggested segments for a title/summary

---

### Screen 5 — Logged Decision View (`/decisions/:id`)

**Primary goal**: display the finalised decision in a clean, projectable format for end-of-meeting review and post-meeting reference.

**User stories**:
- As a participant, I can see the complete logged decision with all fields rendered in readable format
- As a participant, I can see the decision method and who logged it
- As a participant, I can see the tags on this decision
- As a participant, I can see other decisions related to this one
- As a facilitator, I can export the decision as markdown or JSON

**Display rules**: suitable for projection. Export actions are present but visually subordinate to content.

**API**:
- `GET /api/decisions/:id` — logged decision record
- `GET /api/decisions/:id/export?format=markdown|json` — export
- `GET /api/decisions/:id/tags` — tags (after M4.10)
- `GET /api/decisions/:id/relations` — related decisions (after M4.10)

---

## API Dependency Map

Endpoints that are **missing** and must be added before the dependent screen can ship:

| Endpoint | Blocks | Added in |
|---|---|---|
| `GET /api/meetings/:id/flagged-decisions` | Screen 3 candidate queue | M5.1 |
| `GET /api/meetings/:id/decision-contexts` | Screen 2 agenda, Screen 3 | M5.1 |
| `GET /api/decision-contexts/:id` | Screen 2 workspace, Screen 3 | M5.1 |
| `GET /api/meetings/:id/summary` | Screen 2 header stats | M5.1 |
| `PATCH /api/meetings/:id` | Screen 3 participant updates | M5.1 |
| `POST /api/decision-contexts/:id/regenerate` | Screen 3 full regen | M5.1 |
| `GET /api/meetings/:id/transcript-reading` | Screen 4 reading mode | M5.1a |
| `POST /api/meetings/:id/segment-suggestions` | Screen 4 AI suggestions | M5.1b |
| Tag endpoints | Screen 2/3/5 tag display and management | M4.10 |
| Relation endpoints | Screen 2/3/5 related decisions | M4.10 |

Endpoints that already exist and are immediately usable:
`POST /api/decision-contexts/:id/generate-draft`, `PUT/DELETE /api/decision-contexts/:id/lock-field`, `POST /api/decision-contexts/:id/fields/:fieldId/regenerate`, `PATCH /api/decision-contexts/:id/fields/:fieldId`, `GET /api/decision-contexts/:id/versions`, `POST /api/decision-contexts/:id/rollback`, `GET /api/decision-contexts/:id/llm-interactions`, `POST /api/decision-contexts/:id/log`, `GET /api/decisions/:id`, `GET /api/decisions/:id/export`, `GET /api/meetings`, `POST /api/meetings`, `GET /api/meetings/:id`

---

## Phased Build Order

### Phase 0 — App scaffolding
- `apps/web/` package: `vite.config.ts`, `package.json`, `index.html`, `tsconfig.json`
- Monorepo wiring: add `@repo/web` to `pnpm-workspace.yaml` and `turbo.json`
- Typed API client: `src/api/client.ts` (fetch wrapper, base URL from `VITE_API_URL`), `src/api/endpoints.ts` (one typed function per existing endpoint)
- React Router v6 setup with 5 routes
- Tailwind CSS configuration

### Phase 1 — Shared display (projectable)
*Fill API gaps first*: `GET /api/meetings/:id/decision-contexts`, `GET /api/decision-contexts/:id`, `GET /api/meetings/:id/summary`

Build:
- Meeting list page (`/`)
- Shared meeting view (`/meetings/:id`) — agenda panel + decision workspace in read-only display mode
- Logged decision view (`/decisions/:id`)

Goal: a non-technical participant group can watch the shared screen and see agenda order, field content, and lock state. Nothing else.

### Phase 2 — Facilitator view
*Fill API gaps first*: `GET /api/meetings/:id/flagged-decisions`, `PATCH /api/meetings/:id`, `POST /api/decision-contexts/:id/regenerate`

Build:
- Facilitator meeting view (`/meetings/:id/facilitator`)
- Candidate queue with `Suggested` / `Agenda` tabs
- Candidate promotion flow: edit title/summary → select template → promote to agenda
- Field controls: lock/unlock, regenerate, zoom, inline guidance
- Finalise flow with method/actors/logged-by

### Phase 3 — Transcript / segment selection
*Fill API gaps first*: `GET /api/meetings/:id/transcript-reading`, `POST /api/meetings/:id/segment-suggestions`

Build:
- Reading mode transcript view (`/meetings/:id/facilitator/transcript`)
- Text search + sequence range filter toolbar
- Drag-to-select rows (mouse and touch)
- Confirm selection → persist reading-row IDs + chunk IDs → return to facilitator workspace
- AI suggestion flow: suggest → pre-select → review → adjust → confirm

### Phase 4 — Streaming draft generation
- SSE connection to draft generation endpoint
- Per-field spinner on shared display during generation (no raw tokens)
- Collapsible token-level progress panel in facilitator view

### Phase 5 — Tags and relations
*Depends on*: M4.10 tag and relation API endpoints being implemented

Build:
- Tag pills on shared display and facilitator workspace
- Inline tag add/remove in facilitator (by name, resolve-or-create)
- Related decisions as a compact linked list in facilitator sidebar
- Tag display on logged decision view

---

## File Map

### New files (`apps/web/`)

| File | Purpose |
|---|---|
| `apps/web/src/api/client.ts` | Typed fetch wrapper, `VITE_API_URL`, error handling |
| `apps/web/src/api/endpoints.ts` | One typed function per API endpoint |
| `apps/web/src/pages/MeetingList.tsx` | Screen 1 — `/` |
| `apps/web/src/pages/MeetingShared.tsx` | Screen 2 — `/meetings/:id` |
| `apps/web/src/pages/MeetingFacilitator.tsx` | Screen 3 — `/meetings/:id/facilitator` |
| `apps/web/src/pages/TranscriptReader.tsx` | Screen 4 — `/meetings/:id/facilitator/transcript` |
| `apps/web/src/pages/DecisionLogView.tsx` | Screen 5 — `/decisions/:id` |
| `apps/web/src/components/AgendaPanel.tsx` | Agenda list (shared + facilitator) |
| `apps/web/src/components/DecisionWorkspace.tsx` | Field list in display or edit mode (prop-controlled) |
| `apps/web/src/components/FieldCard.tsx` | Single field — display or edit variant |
| `apps/web/src/components/TagPills.tsx` | Coloured tag pills |
| `apps/web/src/components/RelationsList.tsx` | Related decisions compact list |
| `apps/web/src/components/facilitator/CandidateQueue.tsx` | Candidate queue panel |
| `apps/web/src/components/facilitator/FieldControls.tsx` | Lock, regen, zoom, guidance input per field |
| `apps/web/src/components/facilitator/LLMLog.tsx` | Collapsible LLM interaction log |
| `apps/web/src/components/facilitator/FieldVersions.tsx` | Field version history + restore |
| `apps/web/src/hooks/useDecisionContext.ts` | Fetch + poll active context state |
| `apps/web/src/hooks/useStreamingDraft.ts` | SSE field-by-field streaming |
| `apps/web/src/hooks/useMeetingAgenda.ts` | Fetch flagged decisions + contexts |

### Files to update

| File | Change |
|---|---|
| `apps/api/src/routes/decision-workflow.ts` | Add missing list/get endpoints for Phase 1 and 2 |
| `apps/api/src/index.ts` | Register `tags.ts` and `decision-relations.ts` when M4.10 is ready |
| `docs/ui-ux-overview.md` | Add separate-route mode split; update screen catalog |
| `docs/plans/iterative-implementation-plan.md` | Expand M5.5 with this phased plan |

---

## Verification

```bash
# Phase 0: scaffolding
pnpm --filter=@repo/web dev          # dev server at localhost:5173
pnpm --filter=@repo/web build        # production build succeeds
pnpm --filter=@repo/web type-check   # zero TypeScript errors

# Phase 1: shared display (read-only smoke test — no API mutations)
# Run API first: pnpm --filter=apps/api dev
open http://localhost:5173/meetings/<id>
# Verify: agenda renders, active workspace renders, no UUIDs visible, no action buttons

# Phase 2: facilitator smoke test
open http://localhost:5173/meetings/<id>/facilitator
# Verify: candidate queue loads, generate draft fires POST and fields populate,
#         field lock toggle works, finalise creates a decision log

# Phase 3: segment selection
open http://localhost:5173/meetings/<id>/facilitator/transcript
# Verify: reading projection loads with no duplicate overlap text,
#         drag-select works, confirm persists selection and returns to facilitator view

# Dual-screen smoke test (core use case)
# Open shared display in browser A (or projector): /meetings/:id
# Open facilitator in browser B (laptop):         /meetings/:id/facilitator
# Generate draft in B → fields appear progressively in A within poll interval
# Lock a field in B → lock indicator appears in A
# Finalise in B → A shows completion state

# Full E2E
pnpm test:e2e   # existing API suite passes after new endpoints added
```
