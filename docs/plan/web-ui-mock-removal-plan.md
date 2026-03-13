---
title: Web UI Mock Removal Plan
status: draft
updated: 2026-03-12
---

# Goal

Remove unused prototype surfaces from the web UI and prioritise the remaining mocked or stubbed elements by implementation readiness.

# Completed

- Removed the `/prototype` route from `apps/web/src/router.tsx`.

# Priority 1: Wiring only

These items appear to have enough backend support already and should be tackled first.

## 1. Replace mock open-context lists in facilitator dialogs

- **Current UI**
  - `apps/web/src/pages/FacilitatorMeetingPage.tsx`
  - `AddExistingContextDialog` receives `OPEN_CONTEXTS` from `apps/web/src/lib/mock-data.ts`
- **Visible effect**
  - "Add existing context" and relation-context pickers show hardcoded contexts.
- **Why this is wiring-first**
  - The web API already exposes meeting, decision-context, and logged-decision data structures.
  - This likely needs a real query path for reusable/open contexts rather than UI invention.
- **Implementation direction**
  - Add a real query hook/client call for selectable contexts.
  - Adapt the response to `OpenContextSummary`-like UI props or replace that UI type entirely.

## 2. Replace mock template sources in create/promote dialogs

- **Current UI**
  - `apps/web/src/components/facilitator/CreateContextDialog.tsx`
  - `apps/web/src/components/facilitator/PromoteCandidateDialog.tsx`
  - These use `TEMPLATES` from `apps/web/src/lib/mock-data.ts`
- **Visible effect**
  - Template pickers are not using the live template list.
- **Why this is wiring-first**
  - `apps/web/src/hooks/useTemplates.ts` already calls `listTemplates()`.
- **Implementation direction**
  - Pass live `templates` from parent state into these dialogs.
  - Remove `TEMPLATES` imports from dialog components.

## 3. Persist or reload transcript upload history on meeting home

- **Current UI**
  - `apps/web/src/pages/FacilitatorMeetingHomePage.tsx`
  - `manualTranscripts` is local-only state.
- **Visible effect**
  - Uploaded transcript entries disappear on refresh.
- **Why this is wiring-first**
  - Transcript upload is already persisted via `uploadTranscript()`.
  - This may only need a read-side transcript summary endpoint or reuse of existing transcript/chunk endpoints.
- **Implementation direction**
  - Prefer loading transcript metadata from the API.
  - If no dedicated metadata endpoint exists, derive a basic uploaded-state summary from transcript/chunk reads.

# Priority 2: Mixed wiring / product decision

These items are partly implemented but may require clarifying the desired data source or UX contract.

## 4. Replace hardcoded suggested tags on facilitator page

- **Current UI**
  - `apps/web/src/pages/FacilitatorMeetingPage.tsx`
  - Uses local `SUGGESTED_TAG_SEEDS`.
- **Visible effect**
  - Suggested tags are generated from static seed data.
- **Open question**
  - Should suggested tags come from decision-context tags, a transcript analysis endpoint, or be removed entirely?

## 5. Replace meeting-home attendee presence simulation

- **Current UI**
  - `apps/web/src/pages/FacilitatorMeetingHomePage.tsx`
  - Attendance state and event log are maintained entirely in component state.
- **Visible effect**
  - Presence and event history are session-local only.
- **Open question**
  - Is attendance intended to be persisted, or is this panel only for local facilitation support?

# No API support yet

These items are explicitly blocked by missing backend support or no real endpoint contract.

## 6. Shared meeting tags

- **Current UI**
  - `apps/web/src/pages/SharedMeetingPage.tsx`
- **Evidence**
  - The page renders an empty array with the note `Tags placeholder — no tags in API yet`.
- **Needed API support**
  - Decision-context tags on read APIs used by the shared display.

## 7. Meeting outcomes summary

- **Current UI**
  - `apps/web/src/pages/FacilitatorMeetingHomePage.tsx`
- **Evidence**
  - The panel shows placeholder copy only after ending a meeting.
- **Needed API support**
  - A meeting outcomes summary shape and endpoint, or a defined aggregation strategy from existing decision/log data.

## 8. Related meetings in transcript selection

- **Current UI**
  - `apps/web/src/pages/TranscriptPage.tsx`
- **Evidence**
  - `Include related meetings (planned)` is disabled.
- **Needed API support**
  - A relation model or query that can return transcript rows/chunks across linked meetings.

## 9. Field required-state fidelity in adapted UI fields

- **Current UI**
  - `apps/web/src/api/adapters.ts`
- **Evidence**
  - `required: false` is hardcoded because template assignment required-ness is not exposed.
- **Needed API support**
  - Template field assignment required-state in template/decision-context read responses.

# Follow-up cleanup

- Delete `apps/web/src/pages/PrototypeGallery.tsx` after confirming no internal tooling still depends on it.
- Reduce or remove `apps/web/src/lib/mock-data.ts` once live wiring replaces:
  - `OPEN_CONTEXTS`
  - `TEMPLATES`
  - `DECISION_METHODS` if moved to a shared non-mock constant module
- Move shared UI-only types out of `mock-data.ts` so production code no longer depends on a mock module for type definitions.

# Suggested order of work

1. Wire live templates into create/promote flows.
2. Replace open-context mock lists with API-backed data.
3. Decide whether attendee presence is local-only or persistent.
4. Replace transcript upload history local state with API-backed summary.
5. Add missing API support for tags, outcomes, related meetings, and required-state fidelity.
