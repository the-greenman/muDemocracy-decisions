# Web UI Wiring Plan

**Milestone**: M5.5 Phases 0–2
**Status**: In progress (updated March 11, 2026)
**Reference docs**: `docs/web-ui-plan.md`, `docs/web-ui-api-connection.md`, `docs/ui-ux-overview.md`, `docs/web-ui-design-system.md`

---

## Goal

Wire the existing `apps/web/` prototype (currently backed by `src/lib/mock-data.ts`) to the real `apps/api/` endpoints. All UI components in `src/components/` remain unchanged. Only pages receive new data sources and a new API infrastructure layer is added.

---

## Current Wiring Snapshot (March 11, 2026)

This reflects the current implementation state in `apps/web/src`.

### Completed

- ✅ Phase 0 infrastructure is in place:
  - `src/api/client.ts`
  - `src/api/types.ts`
  - `src/api/endpoints.ts`
  - `src/api/adapters.ts`
  - `src/hooks/useMeeting.ts`
  - `src/hooks/useMeetingAgenda.ts`
  - `src/hooks/useDecisionContext.ts`
  - `src/hooks/useTemplates.ts`

- ✅ Read pages wired to API:
  - `MeetingListPage` uses `listMeetings()`/`createMeeting()`.
  - `SharedMeetingPage` uses meeting + agenda hooks, polls every 4s, and applies localStorage overlay sync.
  - `LoggedDecisionPage` uses `getDecisionLog()`, `getTemplateFields()`, and export endpoint.

### Partially Wired

- ⚠️ `FacilitatorMeetingPage` has mixed real API + prototype state.
  - Wired mutations: lock/unlock field, update field value, regenerate field, regenerate draft, dismiss candidate, create candidate, list LLM interactions.
  - Still prototype/local-state for major workflows: promote candidate, create context, defer/reorder behavior persistence, finalise/log flow, tag/relation persistence, stream control.
  - Hardcoded meeting route references still exist (`mtg-1` links and field zoom meeting id).

- ⚠️ `FacilitatorMeetingHomePage` is partially wired.
  - Wired: load/update meeting basics.
  - Still local-only: agenda planner state and meeting materials state (not persisted to API).

### Not Wired Yet

- ❌ `TranscriptPage` remains mock-driven (`MOCK_ROWS`) and still navigates using hardcoded `mtg-1` route targets.
- ❌ Browser recording controls are not yet connected to transcription session endpoints (`/sessions`, `/sessions/:id/chunks`, `/sessions/:id/stop`).

### Practical Phase Status

- Phase 0: ✅ complete
- Phase 1: ✅ mostly complete for target pages
- Phase 2: ⏳ in progress (facilitator and transcript flows still need full API wiring)

---

## Architecture

See `docs/web-ui-api-connection.md` for the full layer diagram, type mapping, polling strategy, localStorage sync contract, and error handling patterns.

**Key decisions:**
- No new state management library (useState + useEffect, matching existing prototype pattern)
- Adapter pattern isolates API shape differences from UI component expectations
- Optimistic updates for all facilitator mutations
- Polling (4s) on SharedMeetingPage to reflect facilitator changes on projected screen

---

## Phase 0 — Infrastructure

**Goal**: Create all new files. No page changes. Dev server still shows mock data.

**Checkpoint**: `pnpm --filter=@repo/web type-check` passes with zero errors.

### New files

| File | Purpose |
|---|---|
| `apps/web/src/api/client.ts` | `apiFetch<T>()` wrapper; `VITE_API_URL`; `ApiError` class |
| `apps/web/src/api/types.ts` | TypeScript interfaces for all API response shapes (no Zod) |
| `apps/web/src/api/endpoints.ts` | One typed function per API endpoint |
| `apps/web/src/api/adapters.ts` | `buildUIFields()`, `buildCandidates()`, `buildAgendaItems()`, `formatFieldName()` |
| `apps/web/src/hooks/useMeeting.ts` | `{ meeting, summary, loading, error, refresh }` |
| `apps/web/src/hooks/useMeetingAgenda.ts` | `{ decisions, contexts, loading, error, refresh }` — optional 4s poll |
| `apps/web/src/hooks/useDecisionContext.ts` | `{ context, fields, templateFields, loading, error, refresh }` |
| `apps/web/src/hooks/useTemplates.ts` | `{ templates, loading, error }` |
| `apps/web/.env.local` | `VITE_API_URL=http://localhost:3001` |

### Updated files

| File | Change |
|---|---|
| `apps/web/tailwind.config.ts` | Add missing design tokens from `docs/web-ui-design-system.md` |
| `apps/web/index.html` | Add Atkinson Hyperlegible font if missing |

---

## Phase 1 — Read Pages

**Goal**: All read-only pages show real API data. No mutations yet.

**Checkpoint**: Smoke test each page against live API + seeded DB.

### Pages to wire (in order)

#### 1. `MeetingListPage`
- On mount: `listMeetings()` → populate meeting rows
- Create form submit: `createMeeting(body)` → append to list
- Row actions: `deleteMeeting(id)` → remove from list
- Loading: skeleton rows
- Error: banner with retry

#### 2. `FacilitatorMeetingHomePage`
- On mount: `getMeeting(id)` → populate title/date/participants form
- Title/participants save: `updateMeeting(id, body)` on blur
- Transcript upload (from `UploadTranscript` dialog): `uploadTranscript(meetingId, body)`
- Agenda planner: keep as local state (cross-meeting context deferred to M4.9)

#### 3. `SharedMeetingPage`
- On mount: `getMeeting(id)` + initial `useMeetingAgenda(id, { poll: true })`
- Active context: most recently updated non-logged context from contexts list
- Context fields: `useDecisionContext(activeContextId)` → `buildUIFields(templateFields, context)`
- Poll `useMeetingAgenda` every 4s; when active context changes, re-fetch via `useDecisionContext`
- Keep localStorage reads for `dl:meeting-focus:` and `dl:meeting-fields:` (field-zoom sync)

#### 4. `LoggedDecisionPage`
- On mount: `getDecisionLog(id)` → render fields from `log.fields` Record
- Field labels: look up field names from template fields (best effort — `log.templateId` → `getTemplateFields`)
- Export button: `exportDecisionLog(id, 'markdown')` → download file or copy to clipboard

---

## Phase 2 — Facilitator Page

**Goal**: Full facilitator workflow works against real API. SharedMeetingPage reflects changes within 4s.

**Checkpoint**: Full E2E browser workflow — flag → generate → lock → finalise → export. Dual-screen smoke test.

### `FacilitatorMeetingPage` wiring

**On mount:**
- `useMeeting(id)` → meeting header
- `useMeetingAgenda(id)` → `buildCandidates(decisions)` + `buildAgendaItems(decisions, contexts)`
- `useTemplates()` → template picker options for modals

**Active context lifecycle:**
- User clicks agenda item → set `activeContextId` state
- `useDecisionContext(activeContextId)` → fields via `buildUIFields`
- Notify SharedMeetingPage via `dl:meeting-fields:${id}` localStorage key

**Field mutations (all optimistic):**
- Lock: update field `status: 'locked'` locally → `lockField(contextId, fieldId)` → replace with API response
- Unlock: update field `status: 'idle'` locally → `unlockField(contextId, fieldId)` → replace
- Edit value: update field `value` locally → `updateFieldValue(contextId, fieldId, value)` → replace; write to `dl:meeting-fields:` localStorage
- Regenerate field: set `status: 'generating'` → `regenerateField(contextId, fieldId, guidance)` → update field value + set `status: 'idle'`
- Regenerate all: set all unlocked fields to `status: 'generating'` → `regenerateDraft(contextId, guidance)` → `buildUIFields(templateFields, updatedContext)`

**Candidate queue (Suggested tab):**
- Display: `decisions.filter(d => d.status === 'pending')` → `buildCandidates()`
- Create new flag: `createFlaggedDecision(meetingId, body)` → refresh agenda
- Edit candidate: `updateFlaggedDecision(id, { suggestedTitle, contextSummary })` in-place
- Dismiss: `updateFlaggedDecision(id, { status: 'dismissed' })` → remove from list
- Promote: `updateFlaggedDecision(id, { status: 'accepted', priority })` then `createDecisionContext({ meetingId, flaggedDecisionId, title, templateId })` → refresh

**Agenda (Agenda tab):**
- Display: `decisions.filter(d => d.status === 'accepted')` sorted by priority → `buildAgendaItems()`
- Reorder: `updateFlaggedDecision(id, { priority })` for each affected item
- Defer: `updateFlaggedDecision(id, { status: 'rejected' })` (closest available status — no dedicated defer endpoint before M4.9)

**Template change:**
- `changeDecisionContextTemplate(contextId, newTemplateId)` → refresh `useDecisionContext`

**Finalise:**
- `logDecision(contextId, { loggedBy, decisionMethod })` → navigate to `/decisions/:log.id`

**LLM log panel:**
- Load on panel open: `listLLMInteractions(contextId)`

**Supplementary evidence (field zoom):**
- Load on zoom open: `listSupplementaryContent('decision:contextId:fieldId')`
- Add: `createSupplementaryContent({ meetingId, body, label, contexts: ['decision:contextId:fieldId'] })`
- Delete: `deleteSupplementaryContent(id)` then remove from local list

### `TranscriptPage` wiring

- On mount: `getTranscriptReading(meetingId)` → populate rows
- Fallback if empty: `listMeetingChunks(meetingId)` → map chunks to row format
- All selection/search/drag-select/jump-to-row logic stays as-is

---

## What Does NOT Change

- `src/components/` — all shared and facilitator components stay unchanged
- `src/lib/mock-data.ts` — kept as type reference; page imports removed one at a time as each page is wired
- `src/router.tsx` — routes already correct
- `src/lib/cn.ts` — utility unchanged

---

## Verification Commands

```bash
# Phase 0: Type safety
pnpm --filter=@repo/web type-check

# Phase 0: Dev server
pnpm --filter=apps/api dev &
pnpm --filter=@repo/web dev

# Phase 1: Smoke test (needs live API + seeded DB)
# Navigate to each page and verify real data loads:
# http://localhost:5173/
# http://localhost:5173/meetings/<real-id>
# http://localhost:5173/decisions/<real-log-id>

# Phase 2: Facilitator E2E
# http://localhost:5173/meetings/<id>/facilitator
# Verify: candidate queue → generate draft → fields populate → lock → finalise

# Dual-screen smoke test
# Browser A: http://localhost:5173/meetings/<id>           (shared display)
# Browser B: http://localhost:5173/meetings/<id>/facilitator  (facilitator)
# Generate in B → fields appear in A within 4s poll
# Lock in B → lock indicator appears in A
# Finalise in B → A shows completion state
```
