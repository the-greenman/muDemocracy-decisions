# Web Prototype Tasks

Tracks all documented user stories and functionality not yet reflected in the prototype.
Cross-reference: `docs/web-ui-plan.md`, `docs/ux-workflow-examples.md`.

Prototype lives in `apps/web/src/`. All tasks are UI/interaction only — no API wiring unless noted.

---

## Screen 1 — Meeting List (`/`)

- [ ] Link meeting row to the shared display route (`/meetings/:id`) as a secondary action alongside the existing facilitator link
- [ ] Show deferred context count per meeting row (alongside Drafted / Logged stat chips)

---

## Screen 2 — Shared Meeting Display (`/meetings/:id`)

- [ ] Render related decisions section below fields (mirrors LoggedDecisionPage — `relationType · targetTitle` list)
- [ ] Add per-field "generating" visual state to `FieldCard` at `density="display"` (spinner replacing content while `status === 'generating'`)
- [ ] Add decision-finalised signal — e.g. a settled-coloured banner "Decision logged — ready to move on" when context status is `logged`

---

## Screen 3 — Facilitator View (`/meetings/:id/facilitator`)

### Candidate queue

- [ ] Wire `onPromote` in `FacilitatorMeetingPage` — currently passed as undefined to `CandidateCard`; button renders but does nothing
- [ ] Promotion flow: open a dialog on Promote — step 1 edit title/summary, step 2 pick template, step 3 choose agenda position (append or insert before item N); on confirm move candidate to Agenda tab and add to agenda list
- [ ] Agenda reordering — add drag handle or up/down arrows on Agenda tab items; reorder the local list

### Active context

- [ ] Tag management — replace read-only TagPill list with inline add/remove: text input to add by name, × button on each pill to remove
- [ ] Relation creation — add a small "Add relation" action below the context summary; opens a picker (target title + relation type); renders new relation inline

### Supporting panels

- [ ] LLM interaction log — collapsible right sidebar panel in `FacilitatorMeetingPage` (below the field list); shows log entries as timestamped accordion items; collapsed by default

### Live transcript streaming (G8)

- [ ] Start/stop stream controls in the header strip (alongside Upload transcript)
- [ ] Streaming status indicator in header — idle / connecting / live / stopped states with appropriate colour

### Recency signal (G9)

- [ ] "N new rows since last generation" badge displayed adjacent to the Regenerate button; resets to 0 after each regeneration pass

### Flag for later / future decision capture (G10)

- [ ] "Flag for later" action in header strip — opens a minimal form (title only); on confirm adds a new candidate to the Suggested queue without changing the active context

### Deferral (G11)

- [ ] Defer action on the active context — button in the header strip or context header; sets status to `deferred` in mock state; moves item in Agenda tab to a "Deferred" section with muted styling

### Cross-meeting context loading (G6)

- [ ] "Add existing context" entry point in the Agenda tab footer (below "Select transcript segments" link)
- [ ] Picker dialog — list of open/deferred contexts (mock data); on select, adds the context to the Agenda tab as an additional agenda item
- [ ] Related-meeting autocomplete in picker — search by meeting title, date text, or tag
- [ ] Calendar popup in picker — month view for fast date-based meeting selection
- [ ] Picker result chips show meeting date + title + key tags to reduce selection ambiguity

### FieldZoom

- [ ] Per-field regenerate button in `FieldZoom` — "Regenerate this field" action in the header, disabled when field is locked; simulates single-field generation with a brief generating state
- [ ] Context-scoped supplementary content — a second supplementary section in `FieldZoom` (or a top-level panel in `FacilitatorMeetingPage`) for evidence scoped to the whole context rather than a single field

### Inline transcript attach

- [ ] Quick transcript attach on `FacilitatorFieldCard` — small "Add segments" icon button that navigates to TranscriptPage with a field-scope parameter in the URL; on confirm, returns and shows a segment count badge on the card

### Mock data

- [ ] Add `outstanding_issues` field definition to mock template fields for Proposal Acceptance, Strategy Decision, and Standard Decision templates (G12)

---

## Screen 4 — Transcript / Segment Selection (`/meetings/:id/facilitator/transcript`)

- [ ] Drag-select range — mouse down on a row, drag over adjacent rows, mouse up selects the contiguous range; keyboard shift-click for the same
- [ ] Overlap indicators — subtle icon/badge on rows already tagged to another context in this meeting (hidden by default, toggled by a toolbar control)
- [ ] Cross-meeting transcript toggle — toolbar checkbox "Include transcript from related meetings"; when enabled, shows rows from other meetings in a visually distinct style
- [ ] AI-suggested segments — "Suggest segments" button in toolbar; shows a proposed range highlighted in a different colour; facilitator can accept/reject before confirming
- [ ] Selection persistence — on Confirm, emit the selected row IDs and a resolved chunk-ID array back to the calling view (via navigation state or a callback); show a success toast in the facilitator workspace confirming how many rows were added

---

## Screen 5 — Logged Decision View (`/decisions/:id`)

- [ ] Export format picker — clicking Export opens a small dropdown or dialog with options: Download Markdown / Download JSON / Copy link; replace the current single Export button
- [ ] Clickable relation links — wrap each relation row with a `<Link to={/decisions/${rel.targetId}}>` so clicking navigates to the linked decision

---

## Ordering guidance

Suggested build order within each phase of `docs/web-ui-plan.md`:

**Do first (unblock core flow):**
1. Promote wire-up + promotion dialog (Screen 3)
2. Deferral action (Screen 3 — G11)
3. Cross-meeting context loading (Screen 3 — G6)
4. Per-field regenerate in FieldZoom (Screen 3)
5. Selection persistence on TranscriptPage (Screen 4)

**Do second (enrich facilitator workspace):**
6. Tag management (Screen 3)
7. Relation creation (Screen 3)
8. Recency signal (Screen 3 — G9)
9. Flag for later (Screen 3 — G10)
10. Live streaming controls + indicator (Screen 3 — G8)
11. `outstanding_issues` mock data + field (Screen 3 — G12)
12. LLM interaction log panel (Screen 3)

**Do third (shared/display polish):**
13. Related decisions on SharedMeetingPage (Screen 2)
14. Generating state on FieldCard display density (Screen 2)
15. Finalised state banner (Screen 2)
16. Export format picker (Screen 5)
17. Clickable relation links (Screen 5)
18. Meeting list secondary actions (Screen 1)

**Phase 3 (planned, not immediate):**
19. Drag-select on TranscriptPage (Screen 4)
20. Overlap indicators (Screen 4)
21. Cross-meeting transcript toggle (Screen 4)
22. AI-suggested segments (Screen 4)
23. Inline transcript attach from field card (Screen 3)
24. Agenda reordering (Screen 3)
25. Context-scoped supplementary content (Screen 3)
