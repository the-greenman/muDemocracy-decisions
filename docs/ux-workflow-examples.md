# UX Workflow Examples

**Status**: living document — updated as new flows are defined or gaps are resolved
**Owns**: end-to-end walkthrough scenarios for the web UI, mapped to user stories
**Must sync with**: `docs/web-ui-plan.md`, `docs/ui-ux-overview.md`, `docs/manual-decision-workflow.md`

## Purpose

Each workflow in this document traces a real use case through the UI step by step. The goals are:

1. Verify that the user story inventory in `docs/web-ui-plan.md` is complete — that every step in a realistic flow has a corresponding story.
2. Identify missing user stories, missing UI affordances, or ambiguous transitions before implementation begins.
3. Provide concrete scenarios for manual testing and acceptance criteria.

Each step records:
- What the facilitator does
- Which screen and route is active
- Which user story it exercises
- Any gap or open question the step surfaces

Gaps are labelled **G1**, **G2**, etc., collected in a summary at the end of each flow and tracked in the master gap register at the bottom of this document.

---

## How to read a flow entry

- **Route** references the 5 routes defined in `docs/web-ui-plan.md`.
- **Story** references are quoted from the Screen user stories in that document.
- **Gap** items are new or missing user stories, or ambiguous interactions not yet covered by any story.
- Gaps do **not** imply that implementation must change now — they are recorded so planners can decide.

---

## Flow 1 — Offline transcript, known decision, manual context

### Setting

A technical team of three is convening to formally document a decision they reached in a 90-minute offline working session. A plain-text transcript exists from that session but has no speaker attribution. They have one decision they know they want to document. They also want to see whether the AI detects anything they might have overlooked.

After drafting, they will talk through each field together on the shared display, refine the options with externally sourced content, link the decision to prior work, then lock it with a unanimous vote and export.

### Step-by-step

---

**Step 1 — Create the meeting**

Route: `/` (Meeting List)

The facilitator opens the meeting list. No prior meetings exist for this session. They click **New meeting**, enter a title and date, and add three participants by name.

Story exercised:
> As a facilitator, I can create a new meeting with title, date, and participant list.

Notes: Participant entry is by name only (no auth required at this stage). The created meeting opens directly to the facilitator view.

---

**Step 2 — Upload the offline transcript**

Route: `/meetings/:id/facilitator` (Facilitator Meeting View)

The facilitator is taken to the facilitator workspace. The transcript from the offline session is a plain `.txt` file with no speaker labels. They use an upload action to attach it to the meeting. The system processes it and begins LLM detection.

Story exercised: **none currently defined**.

Gap **G1**: No web UI user story covers uploading a transcript to a meeting. The API endpoint exists (`POST /api/meetings/:id/transcripts/upload`) and the CLI workflow is documented, but `docs/web-ui-plan.md` Screen 3 does not include a corresponding facilitator story.

Missing story: *As a facilitator, I can upload a transcript file (plain text, no attribution required) to the active meeting and trigger decision detection.*

Notes: The upload needs to communicate that attribution is optional. The UI should not require speaker names to proceed.

---

**Step 3 — Review AI-detected candidates**

Route: `/meetings/:id/facilitator` — **Suggested** tab in left panel

After detection completes, the left panel's "Suggested" tab shows several candidates the AI found in the transcript. The facilitator reads each one. They dismiss two that are not real decisions — procedural items that were flagged incorrectly.

Stories exercised:
> As a facilitator, I can see newly suggested candidates separate from the confirmed agenda.
> As a facilitator, I can dismiss a candidate that is not a real decision.

Notes: The detection may surface the known decision as a candidate. If it does, the facilitator can edit its title and promote it (Step 4b). If it does not, the facilitator creates a blank context (Step 4a). Both paths must work.

---

**Step 4a — Create a manual decision context directly**

Route: `/meetings/:id/facilitator` — header action strip

The known decision was not detected by the AI (or was detected imprecisely). The facilitator clicks **+ Flag decision** in the header action strip. A dialog or inline form appears where they enter a title, a brief summary, and select the **Technology Selection** template. The new decision context is created and added to the agenda.

Story exercised: **none currently defined**.

Gap **G2**: The `docs/web-ui-plan.md` user stories for Screen 3 do not explicitly cover creating a decision context directly from a blank form — only via *promoting* an existing candidate. The `POST /api/meetings/:id/flagged-decisions` endpoint plus `POST /api/decision-contexts` chain can support this, but the UI flow (dialog fields, template picker at creation time) is unspecified.

Missing story: *As a facilitator, I can create a new decision context directly by entering a title, summary, and choosing a template — without requiring a prior detected candidate.*

Notes: If the AI did detect the decision (Step 4b), the facilitator uses the existing promotion flow: edit the candidate's title/summary → select template → promote. That flow is covered by existing stories.

---

**Step 4b — [Alternative] Promote the detected candidate**

Route: `/meetings/:id/facilitator` — Suggested tab

If the AI correctly detected the decision, the facilitator clicks into the candidate card, edits the title to be precise, confirms the summary, selects the **Technology Selection** template in the promotion dialog, and promotes it to the top of the agenda.

Stories exercised:
> As a facilitator, I can review a candidate, edit its title and summary, and choose a template before promoting it.
> As a facilitator, I can promote a candidate to the agenda and set its position (not just append to end).

---

**Step 5 — Open segment selection (reading mode)**

Route: `/meetings/:id/facilitator/transcript` (Transcript / Segment Selection)

The 90-minute transcript has many rows. The facilitator opens the reading mode transcript to select segments relevant to this decision. They start by typing a search term to locate the section of the discussion they know contains the key content.

Stories exercised:
> As a facilitator, I can read the transcript in a clean non-overlapping view (reading mode) by default.
> As a facilitator, I can search the transcript by text and narrow by sequence range.

Gap **G3**: With 90 minutes of transcript, the search-and-narrow approach helps but a direct navigation affordance (jump to a specific sequence number or approximate timestamp) is not in the current user stories. The facilitator may know "this discussion starts around row 340" and would benefit from a row-jump control — especially on mobile or touch devices where scrolling 400+ rows is impractical.

Candidate story: *As a facilitator, I can jump directly to a specific sequence number in the transcript to orient quickly in a long session.*

Notes: This is an affordance question, not a missing interaction. The existing range-narrowing story partially covers it but a one-step jump control is qualitatively different.

---

**Step 6 — Drag-select relevant rows**

Route: `/meetings/:id/facilitator/transcript`

Once the facilitator finds the relevant section, they drag-select the rows covering the decision discussion and confirm.

Stories exercised:
> As a facilitator, I can drag-select a range of rows with mouse or touch.
> As a facilitator, I can confirm my selection and return to the facilitator workspace — selection is persisted with both reading-row IDs and resolved chunk IDs for auditability.

---

**Step 7 — Generate the initial draft**

Route: `/meetings/:id/facilitator`

Back in the facilitator workspace, the facilitator clicks **Generate draft**. The system sends the selected segments to the LLM with the Technology Selection template's field prompts. Fields begin populating one by one (streamed or polled).

Story exercised:
> As a facilitator, I can generate an initial draft for the active decision context.

---

**Step 8 — Talk through fields on shared display**

Route: `/meetings/:id` (Shared Meeting Display — projected to group)
Route: `/meetings/:id/facilitator` (Facilitator device — running in parallel)

The shared display updates as fields populate. The three participants watch the projected screen. The facilitator talks through each field in turn. Settled fields have a muted background indicating agreement; no `[LOCKED]` label is shown.

Stories exercised:
> As a participant, I can read the current decision's field content in large, high-contrast text.
> As a participant, I can see which fields are settled and which are still in progress — without technical terminology.
> As a participant, I can watch a field populate progressively during draft generation without visual noise.

Notes: This is the core dual-screen setup. The shared display is on the room projector; the facilitator view is on the facilitator's laptop. No action controls appear on the projected screen.

---

**Step 9 — Zoom into the Options field**

Route: `/meetings/:id/facilitator` — field zoom overlay

The group feels the **Options Evaluated** field is incomplete. The facilitator clicks the zoom control on that field to open a focused editing view. This hides all other fields and presents the options content full-width for reading and editing.

Story exercised:
> As a facilitator, I can zoom into a single field to edit it directly or add specific guidance text.

---

**Step 10 — Add external text as field evidence**

Route: `/meetings/:id/facilitator` — field zoom (Options field)

The facilitator has a separate document — a comparison table prepared before the meeting — that was not part of the uploaded transcript. They want to paste this text so the LLM can incorporate it into the options field on the next regeneration. They paste the text into an evidence input area in the field zoom.

Story exercised: **none currently defined**.

Gap **G4**: No current user story covers adding non-transcript text as field evidence. Two existing stories are adjacent but distinct:

- *"As a facilitator, I can add transcript segments"* — segment selection from the uploaded transcript only.
- *"As a facilitator, I can provide inline text guidance for a specific field's next regeneration"* — guidance is an LLM instruction ("focus on cost", "be more concise"), not source evidence.

**Design: supplementary content as a parallel context store**

This is a parallel store to the transcript that holds non-transcript text items and tags them with the same `{scope}:{id}[:{field}]` context tags as transcript chunks. A `supplementary_content` table (or equivalent) stores items with a `source_type: 'manual'` field. The context builder retrieves by tag regardless of source — transcript chunks and supplementary items participate in the same retrieval query.

Tagging granularity matches the existing three levels:

| When added | Auto-tag applied |
|---|---|
| During meeting setup / background prep | `meeting:{id}` |
| In the decision workspace | `decision:{contextId}` |
| In field zoom | `decision:{contextId}:{fieldId}` |

The field zoom UI shows a "Add evidence" area below the field content. The facilitator pastes text, optionally adds a label ("Options comparison table"), and saves. On the next regeneration, this item is retrieved alongside any transcript segments tagged at the same field scope.

Missing story: *As a facilitator, I can paste supplementary text as evidence for a specific field — saved and tagged at the field scope — so the LLM incorporates it on the next regeneration alongside transcript segments.*

Broader stories (meeting-level and context-level entry points):
- *As a facilitator, I can add a supplementary text item at the meeting level as general background material available to all decisions in this meeting.*
- *As a facilitator, I can add a supplementary text item at the decision context level as supporting material for all fields in that context.*

Notes: This requires a new schema table and new API endpoints (`POST /api/supplementary-content`, `GET /api/supplementary-content?context={tag}`, `DELETE /api/supplementary-content/:id`). It should be planned alongside M4.10 or M5.1, since the context builder needs to be extended to query both sources.

---

**Step 11 — Add a relation to a prior decision**

Route: `/meetings/:id/facilitator`

The technology selection references a prior decision about evaluation criteria made in a previous meeting. The facilitator adds a **related** link from the current context to that prior logged decision.

Story exercised:
> As a facilitator, I can add a relation from the current context to another decision or context.

Notes: Depends on M4.10 relation endpoints being available.

---

**Step 12 — Lock the Options field**

Route: `/meetings/:id/facilitator`

The group agrees the options text is now correct and complete. The facilitator clicks the lock toggle on the Options field. The shared display shows its muted background; all other fields remain editable.

Story exercised:
> As a facilitator, I can lock a field when the group agrees on its content.

---

**Step 13 — Regenerate with a context-level focus**

Route: `/meetings/:id/facilitator`

With Options locked, the facilitator wants to regenerate all remaining unlocked fields, but with an emphasis: the discussion surfaced a specific technical constraint that should influence the rationale and implementation notes. The facilitator enters a focus note — "emphasise the operational complexity of the HA setup" — in the regenerate dialog, then triggers a full regeneration.

Stories exercised:
> As a facilitator, I can regenerate all unlocked fields at once.

**G5 — Resolved**: This is standard draft regeneration with guidance. The existing `POST /api/decision-contexts/:id/regenerate` endpoint already accepts an `additionalContext` parameter (see `docs/context-tagging-strategy.md`). This step just needs the regenerate dialog or header action to expose a single optional text input for pass-wide guidance — the same mechanism as per-field guidance but applied at the context level. No new data concept is required.

UI requirement: the **Regenerate all** action opens a small dialog with an optional "Focus for this pass" text input. The value is sent as `additionalContext` in the request body. It is ephemeral — not saved after the pass completes.

---

**Step 14 — Make two manual field edits**

Route: `/meetings/:id/facilitator` — field zoom

After the regeneration, two fields need minor corrections that are faster to type directly than to re-prompt. The facilitator zooms into each field and edits the text inline.

Story exercised:
> As a facilitator, I can zoom into a single field to edit it directly or add specific guidance text.

---

**Step 15 — Finalise — unanimous team vote**

Route: `/meetings/:id/facilitator` — finalise dialog

The team agrees the decision is complete. The facilitator clicks **Finalise**. A dialog prompts for:
- **Decision method**: the facilitator selects *Unanimous vote*
- **Actors**: pre-populated from meeting participants; all three confirmed
- **Logged by**: the facilitator's name

The decision is submitted and becomes an immutable logged record.

Story exercised:
> As a facilitator, I can finalise the decision with decision method, actors, and logged-by details.

Notes: "Unanimous vote" must be in the decision method enum. Check that `docs/plans/iterative-implementation-plan.md` or `docs/OVERVIEW.md` defines the allowed method values.

---

**Step 16 — Export the logged decision**

Route: `/decisions/:id` (Logged Decision View)

The meeting ends. The facilitator navigates to the logged decision and exports it as markdown to include in the team's shared documentation system.

Story exercised:
> As a facilitator, I can export the decision as markdown or JSON.

---

### Gap summary — Flow 1

| ID | Step | Gap description | Status |
|---|---|---|---|
| G1 | 2 | No web UI user story for uploading a transcript to a meeting | Open |
| G2 | 4a | No story for creating a decision context directly without a prior candidate | Open |
| G3 | 5 | No navigation shortcut for jumping to a sequence position in a long transcript | Open |
| G4 | 10 | No story or schema for supplementary (non-transcript) evidence — parallel context store | Open — new schema needed |
| G5 | 13 | ~~Context-level focus for regeneration~~ | **Resolved** — use existing `additionalContext` parameter on `POST /api/decision-contexts/:id/regenerate`; expose as optional text input in the Regenerate dialog |

### Observations — Flow 1

**Dual-screen split holds.** Every control action in the flow happens on the facilitator route; all participant-facing moments use the shared display route. No step required action controls to appear on the projected screen.

**Transcript upload is a prerequisite action with no UI home.** It must live somewhere accessible before the candidate queue is useful. The most natural place is the facilitator view header or an initial meeting setup step. This should be resolved before Phase 2 implementation begins.

**Manual context creation (G2) is the primary entry path for teams with a known agenda.** Many real meetings start with a predetermined list of decisions to document rather than relying solely on AI detection. The candidate-promotion path is secondary in practice. Both paths must be first-class.

**Supplementary content (G4) fits cleanly into the existing tagging model.** It is a parallel context store alongside the transcript — same `{scope}:{id}[:{field}]` tag hierarchy, same retrieval pattern, different `source_type`. The context builder queries both sources by tag. Requires a new schema table and three API endpoints. Should be planned before M5.1 so the context builder is extended correctly from the start.

---

---

## Flow 2 — Co-op committee meeting, multi-agenda, live stream, cross-meeting contexts

### Setting

A 12-member housing co-op committee holds a monthly general meeting. This is a formal meeting with a published standing agenda: procedural items (apologies, minutes, treasurer's report, sub-committee reports) followed by substantive decision items. It is not a one-off workshop.

At the start of the meeting, two things are already in play:

- A **deferred decision** from last month's meeting — a capital works approval that could not be resolved — which has an open, partially-refined decision context.
- **Sub-committee proposals** from the Housing Sub-Committee and the Works Committee, each of which has been refining a decision context in the weeks before this meeting.

The meeting runs with a live streaming transcript (not an uploaded file). During the deliberation, the AI automatically detects several smaller decisions that need to be made before the main topic can be resolved. The committee addresses those first, then returns to the main decision. As they work through each field, transcript content streams in and drives repeated regeneration passes. At one point a field goes off-scope and is rolled back. The scope field itself is updated mid-meeting, and that update surfaces two future decisions that are captured but deferred. The main decision is voted on and logged. Finally, the sub-committee proposals are addressed: one is accepted, the other is deferred with open questions recorded.

### Step-by-step

---

**Step 1 — Create the meeting**

Route: `/` (Meeting List)

The chairperson (acting as facilitator) creates a new meeting: "March General Meeting". They enter the date and add all 12 members as participants.

Story exercised:
> As a facilitator, I can create a new meeting with title, date, and participant list.

---

**Step 2 — Load the deferred decision from last meeting**

Route: `/meetings/:id/facilitator`

The deferred capital works decision has an existing decision context created in February's meeting. The facilitator needs to add it to March's agenda so it appears in the decision workspace during this meeting.

Story exercised: **none currently defined**.

Gap **G6**: No story covers adding a pre-existing decision context from another meeting to the current meeting's agenda. The M4.9 cross-meeting context architecture anticipates this need, but no UI flow is specified. The facilitator needs a way to search for or select an open context and attach it to this meeting's agenda.

Missing story: *As a facilitator, I can add an existing open decision context (from a prior meeting or prepared outside a meeting) to the current meeting's agenda, so it can be deliberated and finalised in this session.*

Notes: This is the most common flow for committees with ongoing work. Contexts must not be duplicated or cloned — the same context object is being resumed. The meeting is the deliberation event; the context is the long-running work item. This distinction is the core of the M4.9 multi-meeting model and must be settled before Phase 2 implementation.

---

**Step 3 — Load sub-committee decision contexts**

Route: `/meetings/:id/facilitator`

The Housing Sub-Committee and the Works Committee have each been working on a decision context in their own sub-meetings. These are now ready for the main committee. The facilitator adds both to the agenda, after the deferred decision.

Story exercised: same as G6 above — adding existing contexts to this meeting's agenda.

Notes: Sub-committee contexts may have a different `createdAt` meeting ID than the current meeting. The agenda ordering should be user-controlled, not date-ordered. Both contexts were refined before today — the committee should be able to see their existing field content from the moment they open the meeting.

---

**Step 4 — Review the decision agenda**

Route: `/meetings/:id/facilitator` — left panel

The facilitator opens the left panel. The `Agenda` tab shows the three decision contexts now associated with this meeting: the deferred capital works decision (Step 2) and the two sub-committee contexts (Step 3), in the order the facilitator set.

Story exercised:
> As a facilitator, I can see the decision agenda — ordered list of decision contexts — and navigate between them.

Scope note (~~G7~~ **closed — out of scope**): The tool tracks the **decision agenda only**. Procedural meeting items (apologies, minutes, treasurer's report, standing orders) are managed outside this tool in the committee's standard meeting software. Meeting agenda management is explicitly out of scope.

---

**Step 5 — Start the live transcript stream**

Route: `/meetings/:id/facilitator`

The meeting begins. The facilitator starts the live transcript: a stenographer's feed (or an audio transcription service) is piped into the system via the streaming API. Rows begin arriving in real time.

Story exercised: **none currently defined**.

Gap **G8**: No web UI story covers initiating or monitoring a live transcript stream. The API has `POST /api/meetings/:id/transcripts/stream` and `GET /api/meetings/:id/streaming/status`, but Screen 3 has no story for starting, pausing, or stopping a live stream — only file upload (G1). These are qualitatively different: file upload is a one-shot action; live streaming is a persistent connection with status and a stop action.

Missing stories:
- *As a facilitator, I can start a live transcript stream for the current meeting, so rows appear in real time as the meeting proceeds.*
- *As a facilitator, I can see the live stream status (active / paused / stopped) and the count of rows received.*
- *As a facilitator, I can stop the live stream when the meeting ends or pause it during a break.*

Notes: The facilitator view header (or a persistent status bar) needs a live-stream indicator. Starting the stream is a low-friction action — it should not require navigating away from the workspace.

---

**Step 6 — Proceed through procedural items; detection begins**

Route: `/meetings/:id/facilitator` — Suggested tab

The committee moves through apologies, minutes confirmation, and the treasurer's report. As the transcript streams in, the AI detection system runs periodically. By the time the meeting reaches its first substantive agenda point, the Suggested tab shows several newly detected candidates: two are genuine — a small procedural clarification about maintenance reporting thresholds, and a request to amend the standing orders — and two are spurious.

Stories exercised:
> As a facilitator, I can see newly suggested candidates separate from the confirmed agenda.
> As a facilitator, I can dismiss a candidate that is not a real decision.

Notes: Detection is now continuous rather than a one-shot post-upload event. The badge count on the Suggested tab updates as new candidates arrive. This is covered architecturally by M6 auto-detection, but the real-time cadence (new rows arrive → detection re-runs → badge updates) is a new interaction pattern not explicitly described in any story.

---

**Step 7 — Address clarifying decisions first**

Route: `/meetings/:id/facilitator`

The two genuine detected candidates are short decisions that need resolving before the capital works approval can proceed. The facilitator promotes both. For each:
1. The candidate is promoted with a minimal template (Standard Decision).
2. A quick draft is generated from the transcript segments already covering that discussion.
3. The field content is reviewed — it's short and accurate.
4. All fields are locked.
5. The decision is finalised as a consensus vote.

Stories exercised:
> As a facilitator, I can review a candidate, edit its title and summary, and choose a template before promoting it.
> As a facilitator, I can promote a candidate to the agenda and set its position.
> As a facilitator, I can generate an initial draft for the active decision context.
> As a facilitator, I can lock a field when the group agrees on its content.
> As a facilitator, I can finalise the decision with decision method, actors, and logged-by details.

Notes: This is the first complete rapid-decision cycle within a larger meeting. The facilitator switches active contexts twice (to each clarifying decision, then back to the deferred decision) — the existing multi-decision context-switching flow handles this.

---

**Step 8 — Switch to the deferred capital works decision context**

Route: `/meetings/:id/facilitator`

With the clarifying decisions logged, the facilitator switches the active context to the deferred capital works decision. The workspace loads the existing field content from February — partial, with some fields locked from prior sessions.

Stories exercised:
> As a facilitator, I can switch between decision contexts within a meeting, each preserving independent draft state.

Notes: The field history shows versions from February's meeting sessions. Locked fields are shown as settled — the committee can see immediately what was agreed previously and what remains open.

---

**Step 9 — First regeneration pass with streaming transcript**

Route: `/meetings/:id/facilitator`

The facilitator triggers a full regeneration of the unlocked fields. The system uses: (a) the transcript segments tagged to this context from February, (b) any new transcript segments from today that have been automatically tagged (the detection system may have tagged relevant segments), and (c) the new transcript rows from the live stream covering the opening discussion of this agenda item.

Story exercised:
> As a facilitator, I can regenerate all unlocked fields at once.

Notes: The regeneration correctly skips the already-locked fields. Fields begin updating on the shared display as the draft completes.

---

**Step 10 — Discuss fields on shared display; new transcript arrives; regenerate again**

Route: `/meetings/:id` (Shared display, projected) + `/meetings/:id/facilitator` (Facilitator)

The committee reads and discusses the generated field content on the shared display. As the discussion proceeds, new transcript rows continue to arrive from the live stream. The facilitator notices a badge on the Regenerate button (or in the header) showing that new rows have arrived since the last generation pass.

Story exercised:
> As a participant, I can read the current decision's field content in large, high-contrast text.
> As a participant, I can see which fields are settled and which are still in progress.

Gap **G9**: No story covers a regeneration recency signal. When the transcript is live-streaming, the facilitator needs a lightweight indicator that new content has arrived since the last generation pass — e.g. "42 new rows since last regeneration" — so they know whether another regeneration pass will be materially different. Without this, the facilitator must mentally track whether to regenerate again.

Missing story: *As a facilitator, I can see how many new transcript rows have arrived since the last regeneration pass, so I know whether regenerating again will produce meaningfully different output.*

The facilitator triggers a second pass. This cycle — discuss, accumulate transcript, regenerate — repeats two or three times for the main deliberation fields.

---

**Step 11 — Roll back a field that went off-scope**

Route: `/meetings/:id/facilitator` — field zoom

After one regeneration pass, the "Implementation approach" field has expanded to include operational details that the committee agreed are out of scope for this decision — they belong to a separate works management decision. The facilitator opens field zoom, views the version history, and restores the version from one generation pass ago.

Story exercised:
> As a facilitator, I can view field version history and restore a prior version (within field zoom).

Notes: This is covered by the existing VersionEntry / restore flow prototyped in `FieldZoom.tsx`. The restored version becomes the new current content. The next regeneration pass will treat this content as the starting point and should not re-introduce the out-of-scope material, because the associated transcript segments covering the out-of-scope detail can be deselected or a guidance note can direct the LLM to stay within scope.

Clarification note: "Rollback" and "restore" are used interchangeably here, but in the prototype the action is restore-from-history (append-only). A rollback conceptually implies undoing the last generation pass; restore requires opening the history panel to select a specific version. The implementation note in M4.7b ("append-only restore behavior") applies.

---

**Step 12 — Update the scope field; identify future decisions**

Route: `/meetings/:id/facilitator` — field zoom (scope field)

As the rollback makes clear, the scope of this decision needs to be explicitly narrowed. The facilitator zooms into the "Scope and exclusions" field and edits it directly, adding a sentence clarifying what is excluded. As they write, two further decisions crystallise: the works management process decision and a procurement policy clarification.

The facilitator needs to capture these quickly without leaving the current context or switching active decision.

Story exercised:
> As a facilitator, I can zoom into a single field to edit it directly or add specific guidance text.

Gap **G10**: No story covers capturing a future decision identified during deliberation without disrupting the current active context. The existing G2 (direct context creation) requires title + summary + template selection and makes the new context the active one. What is needed here is a lightweight "note for later" capture: enter a title and brief note, the item goes into the Suggested queue as a manual candidate for the current meeting, but the facilitator stays in the current context.

Missing story: *As a facilitator, I can quickly flag a future decision (title only, no template required) from within the active deliberation, adding it to the candidate queue without switching away from the current decision context.*

Design note: This could be a small inline form accessible from the Suggested tab or a keyboard shortcut. The captured item appears in the Suggested tab as a manual candidate (similar to G2 but without requiring template selection or becoming active). The facilitator returns to it after the current decision is finalised.

---

**Step 13 — Continue refinement; lock all fields**

Route: `/meetings/:id/facilitator`

The scope field is now correct. The facilitator runs a final regeneration pass with a guidance note: "The scope is now narrowed per the updated scope field — do not expand the implementation approach". After this pass, the committee reviews all fields. Remaining fields are locked one by one as the group agrees.

Stories exercised:
> As a facilitator, I can regenerate all unlocked fields at once.
> As a facilitator, I can lock a field when the group agrees on its content.

Notes: The regeneration uses the updated scope field content as context (it is now locked and appears in the "locked field context" section of the prompt). The focus note is sent as `additionalContext` (G5, resolved).

---

**Step 14 — Vote and log the main decision**

Route: `/meetings/:id/facilitator` — finalise dialog

All fields are locked. The chairperson calls a formal vote. The result is 10 in favour, 1 against, 1 abstention — a majority vote. The facilitator opens the finalise dialog, selects "Majority vote", confirms the actors (all 12 members), and records the vote breakdown in the free-text agreement notes. They log the decision.

Story exercised:
> As a facilitator, I can finalise the decision with decision method, actors, and logged-by details.

Notes: The decision method must include "majority_vote". Vote breakdown detail (10/1/1) is currently in free-text agreement notes rather than structured fields. This is acceptable for MVP but may warrant a structured vote-count field in the future.

---

**Step 15 — Review captured future decisions; defer to next meeting**

Route: `/meetings/:id/facilitator` — Suggested tab

The two future decisions captured in Step 12 are in the Suggested queue. The facilitator promotes both: enters a title, a brief summary, and selects a template for each (Policy Change and Technology Selection respectively). Both are now in the decision agenda.

But there is no time to deliberate these today. The committee acknowledges them as identified and agrees to address them at next month's meeting. The facilitator needs to defer both contexts — removing them from today's active agenda while preserving them for resumption.

Story exercised:
> As a facilitator, I can promote a candidate to the agenda and set its position.

Gap **G11**: No story covers deferring an open decision context. Deferral means: context is fully preserved (all field content, version history, transcript tags, supplementary evidence); it is removed from today's active agenda; no future meeting ID is assigned — the facilitator of a future meeting will use the G6 flow to pull it onto that meeting's agenda.

Missing story: *As a facilitator, I can defer an open decision context — preserving all content and history — so it no longer appears on today's agenda but remains resumable in any future meeting.*

Design note: Deferral sets `status: 'deferred'` on the `decision_context_meetings` record for this meeting (M4.9 join table). The context itself remains `status: 'open'`. No future meeting ID is stored at deferral time.

---

**Step 16 — Sub-committee proposal 1: accepted**

Route: `/meetings/:id/facilitator`

The facilitator switches to the Housing Sub-Committee's decision context. This was prepared in advance (Step 3). The committee reviews the field content on the shared display — the sub-committee's work is thorough. The chairperson asks for any objections; there are none.

Before finalising, the facilitator adds the sub-committee's formal proposal document as supplementary content at the context level. They paste the text into the evidence section (G4 flow, now resolved).

Stories exercised:
> As a facilitator, I can paste supplementary text as evidence for a specific field — saved and tagged at the field scope. *(G4 — resolved, M4.11)*
> As a facilitator, I can lock a field when the group agrees on its content.
> As a facilitator, I can finalise the decision with decision method, actors, and logged-by details.

The decision is accepted by consensus and logged.

---

**Step 17 — Sub-committee proposal 2: deferred with open questions**

Route: `/meetings/:id/facilitator`

The facilitator switches to the Works Committee's decision context. The committee reads the proposal on the shared display. A member raises a question about the financial implications that the sub-committee's report does not address. The committee cannot resolve it today. They agree to defer this proposal.

Before deferring, the facilitator zooms into a field — or into a dedicated "Open questions" or "Outstanding issues" field if the template has one — and records the specific question: "What are the full lifecycle costs including contractor replacement, not just initial installation?"

Story exercised:
> As a facilitator, I can zoom into a single field to edit it directly or add specific guidance text.

Gap **G12**: The ability to record open questions when deferring depends on the template having an appropriate field (e.g. "Outstanding issues", "Open questions", "Concerns"). The current template library (Technology Selection, Budget Approval, Strategy Decision, Standard Decision, Policy Change, Proposal Acceptance) does not include a standardised open-questions field. The Proposal Acceptance template has `stakeholder_concerns` which is adjacent, but `stakeholder_concerns` is a captured field, not a place for unresolved questions about the proposal itself.

Missing template field: *An "outstanding_issues" or "open_questions" field on templates intended for decisions that may be deferred — especially Proposal Acceptance — so that the reason for deferral and the specific unresolved questions are stored in the structured decision record, not lost in meeting notes.*

Missing story: *As a facilitator, I can record the open questions or outstanding issues that caused a deferral, in a structured field, so they are retrievable when the decision is resumed in a future meeting.*

The facilitator then defers this context (G11 flow) — it leaves today's agenda but remains fully preserved. When next month's meeting is set up, the chairperson will pull this context onto that agenda (G6 flow). The recorded open questions are immediately visible when the context is resumed.

---

### Gap summary — Flow 2

| ID | Step | Gap description | Status |
|---|---|---|---|
| G6 | 2, 3 | No story for adding a pre-existing decision context from another meeting to the current agenda | Open |
| G7 | 4 | ~~Procedural meeting agenda alongside the decision agenda~~ | **Out of scope** — meeting agenda management is not in scope for this tool |
| G8 | 5 | No story for initiating, monitoring, or stopping a live transcript stream | Open |
| G9 | 10 | No regeneration recency signal when the transcript is live-streaming | Open |
| G10 | 12 | No lightweight "flag future decision" action that preserves the current active context | Open |
| G11 | 15, 17 | No story for deferring a decision context (remove from today's agenda, preserve fully, no future meeting link) | Open |
| G12 | 17 | No standardised open-questions field on templates intended for deferrable decisions | Open — template library change |

### Observations — Flow 2

**Cross-meeting context is the norm, not the exception.** Every step involving pre-existing sub-committee work (Steps 2, 3, 8, 16, 17) depends on the cross-meeting context model from M4.9. This is not an edge case — for any committee with ongoing work or sub-groups, decisions routinely span multiple meetings. M4.9 planning must be resolved before Phase 2 implementation can support real committee workflows.

**Live streaming changes the regeneration cadence.** In Flow 1, transcript was uploaded once and generation happened in discrete passes against a fixed body of text. In Flow 2, new transcript rows arrive continuously. The regeneration decision ("should I regenerate now?") requires the facilitator to know whether the new content is material. The recency signal (G9) is the minimal affordance needed; without it, the facilitator over-regenerates or misses relevant new content.

**Meeting agenda management is out of scope.** The tool tracks the decision agenda only. Formal meeting procedures, procedural items, and running-order management belong to external tooling. The `Agenda` tab in the facilitator view is a decision agenda, not a meeting agenda.

**Deferral (G11) is distinct from all existing outcomes.** Dismiss = candidate not a real decision. Log = decision made. Delete = remove entirely. None of these is "keep, preserve, remove from today's agenda". Deferral is the most common outcome for complex decisions and sub-committee referrals. The implementation is a `status: 'deferred'` on the `decision_context_meetings` join table (M4.9); no future meeting ID is assigned at deferral time.

**Open questions on deferral (G12) reinforce G11.** If deferral is a first-class outcome, the deferred context needs a structured place to record why. The `outstanding_issues` field (M4.12) is the natural completion — it is what makes the deferred context immediately useful when resumed in a future meeting.

**Supplementary content (G4, M4.11) covers proposal text cleanly.** Steps 16 and 17 both attach formal proposal documents as supplementary evidence at context scope. No new gap arises — the resolved G4 model handles this correctly.

---

## Master gap register

| ID | Flow | Status | Resolution |
|---|---|---|---|
| G1 | 1 | Open | Add to Screen 3 user stories in `docs/web-ui-plan.md`. Determine UI home: facilitator header action or meeting setup step. |
| G2 | 1 | Open | Add to Screen 3 user stories. The `POST /api/meetings/:id/flagged-decisions` + `POST /api/decision-contexts` chain supports it; UI flow (blank-form dialog with template picker) needs specifying. |
| G3 | 1 | Open | Add to Screen 4 user stories as a navigation affordance. A jump-to-row input (sequence number) in the transcript toolbar. |
| G4 | 1 | Open — new schema | Supplementary content table: `source_type: manual`, same `{scope}:{id}[:{field}]` context tags as transcript chunks. Context builder queries both. New API: `POST /api/supplementary-content`, `GET /api/supplementary-content?context={tag}`, `DELETE /api/supplementary-content/:id`. Plan before M5.1. |
| G5 | 1 | **Resolved** | Existing `additionalContext` on `POST /api/decision-contexts/:id/regenerate`. UI: optional text input in Regenerate dialog, ephemeral (one pass only). |
| G6 | 2 | Open | Add cross-meeting context loading to Screen 3 stories. Requires M4.9 `decision_context_meetings` join table. UI: "add existing context to agenda" picker — lists open contexts across meetings; adds without cloning. API: `GET /api/decision-contexts?status=open`, `POST /api/meetings/:id/decision-contexts/:contextId/activate`. |
| G7 | 2 | **Out of scope** | Meeting agenda management (procedural items, running order) is not in scope for this tool. The `Agenda` tab shows the decision agenda only. |
| G8 | 2 | Open | Add live transcript stream stories to Screen 3. Requires `POST /api/meetings/:id/transcripts/stream` and `GET /api/meetings/:id/streaming/status`. UI: header action to start/stop stream; persistent status indicator (active / paused / stopped) + row count. |
| G9 | 2 | Open | Add regeneration recency signal to Screen 3. UI: lightweight row-count indicator adjacent to the Regenerate action showing new transcript rows since the last generation pass. No new API — derivable from existing transcript row state. |
| G10 | 2 | Open | Add lightweight future-decision capture to Screen 3. UI: "Flag for later" — title input only, result goes to Suggested queue as a manual candidate, active context does not change. Distinct from G2 (which requires template selection and becomes active). |
| G11 | 2 | Open | Add deferral to Screen 3 stories and M4.9. Schema: `status: 'deferred'` on `decision_context_meetings`. Context preserved in full; removed from current meeting's active agenda; no future meeting ID assigned. API: `POST /api/meetings/:id/decision-contexts/:contextId/defer`. Resumable via G6 in any future meeting. |
| G12 | 2 | Open — template library | Add `outstanding_issues` field to Proposal Acceptance, Strategy Decision, and Standard Decision templates (M4.12). Story: record open questions in a structured field when deferring so they are immediately available when the context is resumed. |
