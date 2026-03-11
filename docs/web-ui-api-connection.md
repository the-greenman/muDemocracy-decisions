# Web UI / API Connection Layer

**Status**: authoritative
**Owns**: how the web UI fetches data, type mapping, adapter patterns, env config, polling strategy
**Must sync with**: `docs/web-ui-plan.md`, `docs/ui-ux-overview.md`, `docs/plans/iterative-implementation-plan.md`
**Implemented in**: `apps/web/src/api/`, `apps/web/src/hooks/`

---

## Environment Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | Base URL for all API calls |

Set in `apps/web/.env.local` for local development. The API runs on port 3001 (confirmed from docker-compose). Production deployments set `VITE_API_URL` at build time.

---

## Layer Overview

```
pages/
  ↓ call hooks
hooks/               ← React useState + useEffect data fetching
  ↓ call endpoints
api/endpoints.ts     ← one typed function per API endpoint
  ↓ call
api/client.ts        ← fetch wrapper (base URL, error handling, JSON helpers)
  ↓ returns raw API types
api/types.ts         ← TypeScript interfaces matching API response shapes
  ↓ transformed by
api/adapters.ts      ← API types → UI types (DecisionContext + DecisionField[] → Field[])
  ↑ consumed by
components/          ← receive UI types via props; no direct API knowledge
```

**Rule**: Components never import from `api/`. They receive all data via props from pages/hooks.

---

## Key Type Mapping: API → UI

### Field (the most important adapter)

The API stores draft values in `DecisionContext.draftData` (a `Record<string, string>` keyed by field UUID) and locked fields in `DecisionContext.lockedFields` (string array of field UUIDs). UI components expect `Field[]` with a status enum.

```ts
// adapters.ts
export function buildUIFields(
  templateFields: DecisionField[],
  context: DecisionContext
): Field[] {
  return templateFields.map(f => ({
    id: f.id,
    label: formatFieldName(f.name),   // "decision_statement" → "Decision Statement"
    value: context.draftData?.[f.id] ?? '',
    status: context.lockedFields.includes(f.id) ? 'locked' : 'idle',
    required: false,                   // templateFieldAssignment.required not in API response yet
  }));
}

export function formatFieldName(name: string): string {
  return name.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}
```

**Important**: `draftData` keys are field UUIDs, not field names. Always use `field.id` as the lookup key.

### Candidates and Agenda

`GET /api/meetings/:id/flagged-decisions` returns enriched items with `contextId`, `contextStatus`, `hasDraft`.

```
FlaggedDecision.status === 'pending'              → Suggested tab (Candidate[])
FlaggedDecision.status === 'accepted'             → Agenda tab (AgendaItem[])
FlaggedDecision.status === 'rejected' | 'dismissed' → hidden from both tabs
```

The `priority` field controls agenda order (ascending).

### Agenda status derivation

The `AgendaItem.status` (pending/active/drafted/logged) is derived from the associated `DecisionContext.status`:

```
No context yet                    → 'pending'
context.status === 'drafting'     → context.draftData has keys → 'drafted', else → 'pending'
context.status === 'logged'       → 'logged'
Current active context (selected) → 'active' (overlay on top of above)
```

---

## Polling Strategy

`SharedMeetingPage` polls every 4 seconds to reflect facilitator changes on the projected screen without WebSocket infrastructure:

- `GET /api/meetings/:id/decision-contexts` → identifies the active context (most recently updated with status !== 'logged')
- `GET /api/decision-contexts/:id` → current field values + lock state

`FacilitatorMeetingPage` refreshes explicitly after each mutation (optimistic update first, then replace with API response). No background polling on the facilitator page.

---

## localStorage Sync (temporary, pre-SSE)

Until SSE streaming is implemented (Phase 4 of `docs/web-ui-plan.md`), two localStorage keys coordinate the shared display and facilitator view when open in the same browser session:

| Key | Written by | Read by | Contains |
|---|---|---|---|
| `dl:meeting-focus:${meetingId}` | FacilitatorMeetingPage | SharedMeetingPage | `{ fieldId: string, label: string }` |
| `dl:meeting-fields:${meetingId}` | FacilitatorMeetingPage | SharedMeetingPage | `Record<fieldId, value>` after each mutation |

The localStorage values provide instant visual feedback on the shared screen while the 4-second poll catches up with the full context state. When SSE is introduced these keys are replaced by server-sent field update events.

Other localStorage keys (panel widths, collapse states) are purely local facilitator UI preferences and are not part of the sync contract.

---

## Optimistic Updates

All facilitator mutations follow the optimistic update pattern:

1. **Update local state immediately** so the UI responds without network latency
2. **Call API endpoint**
3. **On success**: replace local state with API response to ensure server and client are in sync
4. **On error**: revert local state to pre-mutation value + show error banner

```ts
// Example: lock field
async function handleLockField(fieldId: string) {
  // 1. Optimistic update
  setFields(prev => prev.map(f => f.id === fieldId ? { ...f, status: 'locked' } : f));

  try {
    // 2. API call
    const updated = await lockField(contextId, fieldId);
    // 3. Replace with server truth
    setContext(updated);
    setFields(buildUIFields(templateFields, updated));
  } catch (err) {
    // 4. Revert
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, status: 'idle' } : f));
    setError(err.message);
  }
}
```

---

## Hooks Reference

| Hook | Fetches | Poll interval | Used by |
|---|---|---|---|
| `useMeeting(id)` | `GET /api/meetings/:id` + `/summary` | None | All meeting pages |
| `useMeetingAgenda(meetingId, options?)` | `GET /api/meetings/:id/flagged-decisions` + `/decision-contexts` | Optional 4s | SharedMeetingPage, FacilitatorMeetingPage |
| `useDecisionContext(id)` | `GET /api/decision-contexts/:id` + template fields | None | FacilitatorMeetingPage |
| `useTemplates()` | `GET /api/templates` | None | FacilitatorMeetingPage (modal pickers) |

All hooks return `{ ..data, loading: boolean, error: string | null, refresh: () => void }`.

---

## Error Handling

All API calls throw `ApiError extends Error` with:
- `status: number` — HTTP status code
- `message: string` — human-readable description from API response `{ error: "..." }`

Pages handle errors by:
- Showing an error banner with the message and a "Retry" button that calls `refresh()`
- Keeping previously-fetched data visible while in error state (no full-page crash)
- Loading states show skeleton placeholders, not full-page spinners

---

## Adding New Endpoints

1. Add response type to `api/types.ts` if the shape is new
2. Add a typed function to `api/endpoints.ts` using `apiFetch`
3. Add adapter function in `api/adapters.ts` if transformation is needed
4. Add or extend a hook in `hooks/` if multiple pages need the same data
5. Import the endpoint directly in the page for one-off mutations (no hook needed)

---

## Field ID Resolution

The API accepts both a field UUID and a field name string in most field-specific endpoints (lock, regenerate, PATCH). The adapter should always pass the field **UUID** from the template field list to avoid any ambiguity:

```ts
// Good: pass the UUID from templateFields
await lockField(contextId, field.id);  // field.id is UUID from DecisionField

// Avoid: passing field name (works but adds server-side resolution step)
await lockField(contextId, 'decision_statement');
```
