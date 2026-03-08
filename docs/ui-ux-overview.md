# UI/UX Overview

**Status**: authoritative
**Owns**: page-level UX goals, core user journeys, display-mode rules (projection vs facilitator), uncluttered meeting-first interaction principles
**Must sync with**: `docs/OVERVIEW.md`, `docs/web-ui-plan.md`, `docs/web-ui-design-system.md`, `docs/transcript-reading-and-segment-selection-architecture.md`, `docs/manual-decision-workflow.md`, `docs/decision-detection-implementation-reference.md`, `docs/plans/iterative-implementation-plan.md`

## Purpose

Maintain a text-first, durable description of the UI/UX so implementation stays aligned with meeting realities and does not drift into cluttered, developer-only screens.

## Primary Product UX Goal (v1)

Provide a simple, presentable interface for larger meetings that is easy to project and easy to follow.

Required characteristics:
- High readability at distance (large text, strong contrast, minimal visual noise).
- Clear next action per screen.
- Transcript details hidden unless the user is explicitly selecting evidence.
- Candidate/agenda workflow visible without exposing low-value technical details.

## UX Modes

### 1. Shared Display Mode (default)

Audience-facing meeting view.

Rules:
- Keep screens uncluttered and action-oriented.
- Hide implementation details (IDs, verbose metadata, raw chunk overlap text).
- Prefer compact confidence/status indicators over dense numeric blocks.
- Keep candidate list and agenda status highly visible.

### 2. Facilitator Mode

Operator-focused view for detailed triage and control, running on the facilitator's own device.

Rules:
- Exposes all controls: segment links, provenance, field version history, LLM log, diagnostics.
- Never required for normal participant-facing flow.
- Implemented as a **separate route** (`/meetings/:id/facilitator`), not a toggle on the shared display.

**Mode split: separate routes (decided)**

The web app implements mode separation via separate routes. The primary use case is a dual-screen setup:
- Room projector: `http://…/meetings/:id` — shared display, read-only
- Facilitator laptop: `http://…/meetings/:id/facilitator` — full controls

This is a structural guarantee: shared display components contain zero mutation event handlers. There is nothing for a participant to accidentally click on the projected screen.

## Core UX Principles

1. Candidate-first workflow: meetings revolve around candidate queue and agenda order.
2. Decision contexts are long-lived: they persist across meetings until closed.
3. Meeting context is local: meeting agenda selects open contexts; it does not own context lifecycle.
4. Human confirmation gate: AI can suggest, humans confirm before promotion/finalization.
5. Reading-first evidence selection: transcript appears in reading mode for segment selection tasks only.
6. Recoverability: users can always return to flagged list and see newly detected items.

## Route and Screen Catalog

The web app has five routes. Routes 1 and 3–5 are facilitator-operated. Route 2 is projected to the group.
Full user stories and API dependencies: `docs/web-ui-plan.md`.

### Route 1 — Meeting List (`/`)

Mode: facilitator only.

Primary goal: start or resume a meeting session.

Key user stories:
- As a facilitator, I can see all meetings with their date and status at a glance.
- As a facilitator, I can create a new meeting with title, date, and participant list.
- As a facilitator, I can open an existing active meeting.
- As a facilitator, I can see how many decisions are drafted and logged per meeting without opening it.

### Route 2 — Shared Meeting Display (`/meetings/:id`) ← projected

Mode: shared display (read-only). This route is open on the room projector throughout the meeting.

Primary goal: give the group a clean, high-readability view of the agenda and active decision content.

Key user stories:
- As a participant, I can see the meeting agenda — ordered list of decisions — at all times.
- As a participant, I can see which agenda item is currently active.
- As a participant, I can read field content in large, high-contrast text.
- As a participant, I can see which fields are settled and which are still in progress — without technical terminology.
- As a participant, I can see the tags on the active decision as coloured labels.
- As a participant, I can see other decisions referenced from this one.
- As a participant, I can watch a field populate progressively during generation without visual noise.
- As a participant, I can see when a decision has been finalised.

Mode implications: no UUIDs, no chunk counts, no confidence numbers, no action buttons. Locked fields shown with muted background — no `[LOCKED]` label. Tags as coloured pills. Per-field spinner during generation (not raw tokens). Minimum 20px font.

### Route 3 — Facilitator Meeting View (`/meetings/:id/facilitator`)

Mode: facilitator only. This route runs on the facilitator’s laptop while the group watches Route 2.

Primary goal: give the facilitator complete control over the decision workflow without the group seeing the controls.

Key user stories:
- As a facilitator, I can see newly suggested candidates separate from the confirmed agenda.
- As a facilitator, I can review a candidate, edit its title/summary, and choose a template before promoting it.
- As a facilitator, I can promote a candidate to the agenda and set its position (not just append).
- As a facilitator, I can dismiss a candidate that is not a real decision.
- As a facilitator, I can generate an initial draft for the active decision context.
- As a facilitator, I can regenerate all unlocked fields at once.
- As a facilitator, I can lock a field when the group agrees on its content.
- As a facilitator, I can unlock a field and regenerate it with new guidance.
- As a facilitator, I can zoom into a single field to edit it or add specific guidance text.
- As a facilitator, I can add transcript segments without leaving the workspace.
- As a facilitator, I can view the LLM interaction log (collapsible).
- As a facilitator, I can view field version history and restore a prior version (in field zoom).
- As a facilitator, I can finalise the decision with method, actors, and logged-by details.
- As a facilitator, I can add or remove tags on the active context by name.
- As a facilitator, I can add a relation to another decision or context.

Mode implications: candidate queue panel, per-field lock/unlock/regenerate/zoom/guidance controls, LLM log sidebar, action strip in header. Facilitator-only components are isolated in `src/components/facilitator/`.

### Route 4 — Segment Selection (`/meetings/:id/facilitator/transcript`)

Mode: facilitator only. Launched from Route 3 when adding transcript evidence.

Primary goal: select transcript evidence quickly and accurately for a specific decision or field.

Key user stories:
- As a facilitator, I can read the transcript in a clean non-overlapping view (reading mode) by default.
- As a facilitator, I can search by text and narrow by sequence range.
- As a facilitator, I can drag-select a range of rows with mouse or touch.
- As a facilitator, I can see compact overlap indicators (hidden by default, toggle to reveal).
- As a facilitator, I can toggle to include transcript from other meetings.
- As a facilitator, I can confirm my selection — persisted with reading-row IDs and resolved chunk IDs.
- As a facilitator, I can use AI-suggested segments as a starting point, then adjust before confirming.

Mode implications: facilitator only — not linked from Route 2. Overlap indicators hidden by default.

### Route 5 — Logged Decision View (`/decisions/:id`)

Mode: both. Suitable for projection at end of meeting or post-meeting reference.

Primary goal: show the finalised decision in a clean format for review and export.

Key user stories:
- As a participant, I can see the complete logged decision with all fields rendered.
- As a participant, I can see the decision method and who logged it.
- As a participant, I can see tags and related decisions.
- As a facilitator, I can export the decision as markdown or JSON.

Mode implications: projectable. Export buttons present but visually subordinate to content.

## Facilitator Interface Direction

The shared display must stay simple even as operator controls grow:
- Participant-facing routes contain zero mutation handlers — enforced structurally, not by convention.
- Advanced controls live in the facilitator route only.
- Both routes use identical backend API contracts.

The mode split is implemented as separate routes (decided). See "Route and Screen Catalog" above and `docs/web-ui-plan.md` for the full rationale and route inventory.

## Alignment With API/CLI

UI behavior must map cleanly to API/CLI workflows:
- Candidate queue and agenda ordering semantics must match API/CLI commands.
- Reading mode filters and sequence semantics must be consistent across UI/API/CLI.
- Promotion, locking, regeneration, and completion states must be represented identically in all interfaces.

## Maintenance Rules

- Update this document when adding/removing screens or changing primary user flow.
- Each new screen must include:
  - one primary goal
  - key user stories
  - mode implications (shared display vs facilitator)
- If a workflow becomes too dense for shared display, document its move to facilitator mode here and in iterative planning.
