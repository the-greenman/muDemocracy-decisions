# Web UI Plan

**Status**: authoritative
**Must sync with**: `docs/ui-ux-overview.md`, `docs/web-ui-design-system.md`, `docs/plans/iterative-implementation-plan.md`, `docs/manual-decision-workflow.md`, `docs/ux-workflow-examples.md`
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
| `/prototype` | **Dev only** | Component gallery and flow walkthrough — not shipped |

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
- As a facilitator, I can upload a transcript file (plain text, no attribution required) to the active meeting and trigger decision detection *(G1 — from `docs/ux-workflow-examples.md` Flow 1)*
- As a facilitator, I can create a new decision context directly by entering a title, summary, and choosing a template — without requiring a prior detected candidate *(G2)*
- As a facilitator, I can generate an initial draft for the active decision context
- As a facilitator, I can regenerate all unlocked fields at once; the regenerate action exposes an optional "Focus for this pass" text input sent as `additionalContext` (ephemeral — not saved after the pass) *(G5 — UI only, no new API)*
- As a facilitator, I can lock a field when the group agrees on its content
- As a facilitator, I can unlock a locked field and regenerate it with new guidance
- As a facilitator, I can zoom into a single field to edit it directly or add specific guidance text
- As a facilitator, I can add transcript segments to the active decision context without leaving the workspace
- As a facilitator, I can provide inline text guidance for a specific field's next regeneration
- As a facilitator, I can paste supplementary text as evidence for a specific field — saved and tagged at the field scope — so the LLM incorporates it on the next regeneration alongside transcript segments *(G4)*
- As a facilitator, I can add a supplementary text item at the decision context level as supporting material for all fields in that context *(G4)*
- As a facilitator, I can view the LLM interaction log for the current context (collapsible)
- As a facilitator, I can view field version history and restore a prior version (within field zoom)
- As a facilitator, I can finalise the decision with decision method, actors, and logged-by details
- As a facilitator, I can add or remove tags on the active context by name
- As a facilitator, I can add a relation from the current context to another decision or context
- As a facilitator, I can add an existing open decision context (from a prior meeting or sub-committee) to the current meeting's agenda without cloning it *(G6 — Flow 2)*
- As a facilitator, I can find related meetings by date, title, and tag when adding cross-meeting context *(G6 extension)*
- As a facilitator, I can use autocomplete search and a calendar popup to select related meetings quickly *(G6 extension)*
- As a facilitator, I can start a live transcript stream for the current meeting, see its status and row count, and stop it when the meeting ends *(G8 — Flow 2)*
- As a facilitator, I can see how many new transcript rows have arrived since the last regeneration pass *(G9 — Flow 2)*
- As a facilitator, I can quickly flag a future decision by title only — adding it to the candidate queue without switching away from the current active context *(G10 — Flow 2)*
- As a facilitator, I can defer an open decision context, removing it from today's agenda while preserving all content for resumption in any future meeting *(G11 — Flow 2)*

**Scope boundary**: meeting agenda management (procedural items, running order) is **out of scope**. The `Agenda` tab shows the decision agenda only.

**Naming note — two entities, two milestones**: the candidate queue is served by different API families depending on milestone. In M5 (pre-AI-detection), all queue items are `FlaggedDecision` records — `Suggested` tab = `status: pending`, `Agenda` tab = `status: accepted`. In M6+, AI-detected `DecisionCandidate` records also appear in `Suggested`; promoting one creates a `FlaggedDecision`. Web wiring must not conflate these: `/api/meetings/:id/flagged-decisions` (exists from M1) and `/api/meetings/:id/decision-candidates` (added in M6.6) are separate routes for separate entities. Phase 2 implementation uses `flagged-decisions` only.

**Layout**:
- Header action strip: `[ + Flag decision ]  [ Live stream ● ]  [ Generate draft ]  [ Finalise ]`
- Left panel: candidate queue with `Suggested` / `Agenda` tabs; agenda items are reorderable; "Add existing context" action at bottom of Agenda tab
- Related-meeting picker (within "Add existing context"): autocomplete by title/tag/date text plus calendar month view
- Main panel: decision workspace — same field view as shared display, plus per-field controls
- Per-field controls: lock/unlock toggle · regenerate (+ recency badge when new rows since last pass) · zoom · inline guidance input
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
- `POST /api/meetings/:id/transcripts/upload` — transcript upload with attribution-optional flag (G1)
- `POST /api/supplementary-content` — add supplementary evidence item (G4, after M4.11)
- `GET /api/supplementary-content?context={tag}` — retrieve items by context tag (G4, after M4.11)
- `DELETE /api/supplementary-content/:id` — remove supplementary item (G4, after M4.11)
- `GET /api/decision-contexts?status=open` — open context picker for add-to-agenda (G6, after M4.9)
- `POST /api/meetings/:id/decision-contexts/:contextId/activate` — add existing context to this meeting (G6, after M4.9)
- `POST /api/meetings/:id/decision-contexts/:contextId/defer` — defer context from this meeting (G11, after M4.9)
- `GET /api/meetings?query=<text>&dateFrom=<iso>&dateTo=<iso>&tag=<name>` — related-meeting autocomplete source (G6 extension, after M5.1)
- `GET /api/meetings/calendar?month=<YYYY-MM>` — related-meeting calendar popup source (G6 extension, after M5.1)
- `POST /api/meetings/:id/transcripts/stream` — start live transcript stream (G8)
- `GET /api/meetings/:id/streaming/status` — live stream status (G8)

---

### Screen 4 — Transcript / Segment Selection (`/meetings/:id/facilitator/transcript`)

**Primary goal**: select transcript evidence quickly and accurately for a specific decision or field.

**User stories**:
- As a facilitator, I can read the transcript in a clean non-overlapping view (reading mode) by default
- As a facilitator, I can search the transcript by text and narrow by sequence range
- As a facilitator, I can jump directly to a specific sequence number in the transcript to orient quickly in a long session — a one-step jump control in the toolbar, qualitatively different from range-narrowing *(G3 — from `docs/ux-workflow-examples.md` Flow 1)*
- As a facilitator, I can drag-select a range of rows with mouse or touch
- As a facilitator, I can see a compact indicator when a row has overlap from another meeting (hidden by default, toggle to reveal)
- As a facilitator, I can toggle to include transcript from other meetings in the same context
- As a facilitator, I can confirm my selection and return to the facilitator workspace — selection is persisted with both reading-row IDs and resolved chunk IDs for auditability
- As a facilitator, I can use AI-suggested segments as a starting point, then adjust before confirming

**Display rules**: facilitator only — this route is not linked from the shared display.

**Prototype vs plan**: the current `TranscriptPage.tsx` prototype implements click-to-toggle row selection, text search, row count display, and jump-to-row (G3). Drag-select, overlap indicators, cross-meeting transcript toggle, and AI suggestions are Phase 3 planned capabilities (M5.1a–b), not yet in the prototype.

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
| `POST /api/supplementary-content` | Screen 3 field-zoom evidence add (G4) | M4.11 |
| `GET /api/supplementary-content?context={tag}` | Screen 3 context builder retrieval (G4) | M4.11 |
| `DELETE /api/supplementary-content/:id` | Screen 3 evidence remove (G4) | M4.11 |
| `POST /api/meetings/:id/transcripts/upload` | Screen 3 transcript upload (G1) | M5.1 |
| `POST /api/meetings/:id/transcripts/stream` | Screen 3 live stream start (G8) | M5.1 |
| `GET /api/meetings/:id/streaming/status` | Screen 3 live stream indicator (G8) | M5.1 |
| `GET /api/decision-contexts?status=open` | Screen 3 add-to-agenda picker (G6) | M4.9 |
| `POST /api/meetings/:id/decision-contexts/:contextId/activate` | Screen 3 add existing context (G6) | M4.9 |
| `POST /api/meetings/:id/decision-contexts/:contextId/defer` | Screen 3 deferral (G11) | M4.9 |
| `GET /api/meetings?query=<text>&dateFrom=<iso>&dateTo=<iso>&tag=<name>` | Screen 3 related-meeting autocomplete picker (G6 extension) | M5.1 |
| `GET /api/meetings/calendar?month=<YYYY-MM>` | Screen 3 related-meeting calendar popup (G6 extension) | M5.1 |

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
*Fill API gaps first*: `GET /api/meetings/:id/flagged-decisions`, `PATCH /api/meetings/:id`, `POST /api/decision-contexts/:id/regenerate`, `POST /api/meetings/:id/transcripts/upload` (G1), `POST /api/meetings/:id/transcripts/stream` + `GET /api/meetings/:id/streaming/status` (G8), supplementary content endpoints from M4.11 (G4), cross-meeting context endpoints from M4.9 (G6, G11)

Build:
- Facilitator meeting view (`/meetings/:id/facilitator`)
- Transcript upload action in header (G1 — attribution-optional, triggers detection)
- Live stream start/stop action + status indicator in header (G8)
- Direct context creation dialog — title + summary + template picker, no prior candidate required (G2)
- "Add existing context to agenda" action at bottom of Agenda tab — open context picker (G6)
- "Flag for later" — lightweight title-only capture into Suggested queue without changing active context (G10)
- Candidate queue with `Suggested` / `Agenda` tabs
- Candidate promotion flow: edit title/summary → select template → promote to agenda
- Deferral action per agenda item — removes from today's agenda, preserves context (G11)
- Field controls: lock/unlock, regenerate (+ recency badge for new rows since last pass — G9), zoom, inline guidance
- Regenerate dialog with optional "Focus for this pass" text input, sent as `additionalContext` (G5)
- Field zoom: supplementary evidence add/remove UI (G4 — paste text, label, save at field scope)
- Field zoom: `outstanding_issues` field visible and editable when present in template (G12)
- Finalise flow with method/actors/logged-by

### Phase 3 — Transcript / segment selection
*Fill API gaps first*: `GET /api/meetings/:id/transcript-reading`, `POST /api/meetings/:id/segment-suggestions`

Build:
- Reading mode transcript view (`/meetings/:id/facilitator/transcript`)
- Text search + sequence range filter toolbar
- Jump-to-row control in toolbar: sequence number input → scroll and highlight (G3)
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

### File map

The prototype in `apps/web/` establishes the naming conventions. The table below lists existing prototype files (already created) and planned additions (not yet created). The file map is descriptive of intent, not a rename instruction — the prototype filenames are the accepted names.

**Existing prototype pages** (`apps/web/src/pages/`):

| File | Screen | Route |
|---|---|---|
| `MeetingListPage.tsx` | Screen 1 | `/` |
| `SharedMeetingPage.tsx` | Screen 2 | `/meetings/:id` |
| `FacilitatorMeetingPage.tsx` | Screen 3 | `/meetings/:id/facilitator` |
| `TranscriptPage.tsx` | Screen 4 | `/meetings/:id/facilitator/transcript` |
| `LoggedDecisionPage.tsx` | Screen 5 | `/decisions/:id` |
| `PrototypeGallery.tsx` | Dev only | `/prototype` — not shipped |

**Existing prototype components** (`apps/web/src/components/`):

| File | Purpose |
|---|---|
| `shared/FieldCard.tsx` | Single field — display or facilitator density variant |
| `shared/AgendaItem.tsx` | Single agenda row with status icon |
| `shared/TagPill.tsx` | Coloured tag pill by category |
| `shared/StatusBadge.tsx` | Status badge for agenda items |
| `facilitator/FacilitatorFieldCard.tsx` | Field card + control strip (lock/unlock/regen/zoom) |
| `facilitator/FieldZoom.tsx` | Full-screen field edit with guidance + evidence + history |
| `facilitator/RegenerateDialog.tsx` | Regenerate modal with optional focus input |
| `facilitator/FinaliseDialog.tsx` | Finalise modal with method/actors/logged-by |
| `facilitator/CreateContextDialog.tsx` | Create decision context — title + summary + template |
| `facilitator/UploadTranscript.tsx` | Transcript upload with drag-drop and attribution option |
| `facilitator/CandidateCard.tsx` | Candidate with dismiss/promote actions |

**Planned additions** (not yet created — added when API integration begins):

| File | Purpose |
|---|---|
| `apps/web/src/api/client.ts` | Typed fetch wrapper, `VITE_API_URL`, error handling |
| `apps/web/src/api/endpoints.ts` | One typed function per API endpoint |
| `apps/web/src/components/shared/TagPills.tsx` | Tag pill list (wrapping existing `TagPill`) |
| `apps/web/src/components/shared/RelationsList.tsx` | Related decisions compact list |
| `apps/web/src/components/facilitator/LLMLog.tsx` | Collapsible LLM interaction log |
| `apps/web/src/hooks/useDecisionContext.ts` | Fetch + poll active context state |
| `apps/web/src/hooks/useStreamingDraft.ts` | SSE field-by-field streaming |
| `apps/web/src/hooks/useMeetingAgenda.ts` | Fetch flagged decisions + contexts |

### Files to update

| File | Change |
|---|---|
| `apps/api/src/routes/decision-workflow.ts` | Add missing list/get endpoints for Phase 1 and 2 |
| `apps/api/src/routes/supplementary-content.ts` | New route file — M4.11 supplementary content endpoints |
| `apps/api/src/index.ts` | Register `tags.ts`, `decision-relations.ts` (M4.10), `supplementary-content.ts` (M4.11) |
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
