# Decision Feedback Architecture

**Status**: authoritative
**Owns**: feedback chain model, feedback-to-regeneration contract, feedback source types, MCP feedback tool surface
**Must sync with**: `packages/schema`, `docs/field-regeneration-strategy.md`, `docs/expert-system-architecture.md`, `docs/mcp-architecture-strategy.md`, `docs/plans/iterative-implementation-plan.md`

## Purpose

Structured feedback replaces the former transient `GuidanceSegment` system.

Feedback is a durable, rated, source-attributed record linked to a specific decision context, optionally scoped to a specific field and draft version. The feedback chain is assembled automatically during regeneration and rendered into the LLM prompt.

## Core concepts

### Feedback item

A feedback item captures a human or agent's evaluation of a field value or whole draft:

- **rating** — `approved | needs_work | rejected`
- **source** — `user | expert_agent | peer_user`
- **authorId** — user id or agent name (stable identity for attribution)
- **comment** — free-text assessment
- **textReference** — optional verbatim quote from the field value being annotated (like a Google Docs comment anchor)
- **referenceId / referenceUrl** — optional cross-reference to external artefacts; semantics deliberately open for future use (Jira, Slack, document links, etc.)
- **excludeFromRegeneration** — boolean; when true this item is omitted from the LLM prompt on next regeneration but remains in the historical chain
- **fieldId** — nullable UUID; `null` means whole-draft feedback, non-null means feedback scoped to a specific field
- **draftVersionNumber** — nullable integer; links to a specific snapshot in `decision_contexts.draftVersions`
- **fieldVersionId** — nullable UUID; forward-compatible FK for when the `field_versions` table is introduced (see `docs/plans/field-versioning-schema-proposal.md`); always `null` until then

Feedback does not replace template guidance. Template guidance remains the canonical statement of intent for the active template and its field definitions. Feedback provides contextual steering toward that intent for a specific draft, field, or review cycle.

### Feedback chain

All non-excluded feedback items for a context (or scoped to a specific field) form the **feedback chain**.

During regeneration:

- Template guidance from the active template and field definitions remains part of prompt construction
- `DraftGenerationService` fetches the feedback chain from the database automatically — no inline guidance in the request body
- For field regeneration, field-specific feedback is prioritised, followed by whole-draft feedback (mirrors transcript chunk priority)
- Items with `excludeFromRegeneration = true` are omitted from the assembled chain
- The chain is rendered in the LLM prompt after supplementary content and before the field extraction block

### Sources

- `user` — a human facilitator or meeting participant
- `expert_agent` — an AI agent (connected via the MCP server registry or the core expert system)
- `peer_user` — another user in a review or approval flow

### Relationship to ExpertAdvice

`ExpertAdvice` and `DecisionFeedback` are distinct tables serving different purposes:

| | ExpertAdvice | DecisionFeedback |
|---|---|---|
| Scope | Broad structured analysis | Targeted rating + comment on a specific field or draft |
| Shape | `advice`, `concerns`, `recommendations`, `mcpToolsUsed` | `rating`, `comment`, `textReference` |
| Author | Expert agents (via expert system) | Users, agents, or peers |
| Influence on regeneration | Not directly | Yes — assembled automatically into the LLM prompt |

Expert agents may produce both: an `ExpertAdvice` record for their full analysis and one or more `DecisionFeedback` records for specific field ratings that should guide the next regeneration.

## MCP tool surface

The following MCP tools are exposed from `apps/mcp`:

- **`add_field_feedback`** — create a feedback item (field-scoped or whole-draft)
- **`get_feedback_chain`** — read the non-excluded feedback chain for a context or field
- **`exclude_feedback_item`** — toggle `excludeFromRegeneration` on a specific item

This allows expert agents to submit structured feedback programmatically via the MCP protocol without requiring REST API access. Both REST and MCP surfaces delegate to the same `FeedbackService` (Shared Core pattern).

## Behavioral contract

- Regeneration fetches the persisted feedback chain from the database — no ad-hoc guidance in the request body
- Regeneration preserves template guidance as a distinct prompt layer; feedback augments but does not replace template intent
- Items with `excludeFromRegeneration = true` are silently omitted from the LLM prompt
- Excluded items are never deleted — they remain in the chain and can be re-included by toggling the flag
- Field-specific items (non-null `fieldId`) outrank whole-draft items in field regeneration context assembly
- Feedback is append-only from the user's perspective; deletion is supported but not required for normal workflows

## Prompt rendering

Feedback is rendered between supplementary content and the field extraction block. Field identifiers are UUIDs in storage and APIs; human-readable field names may be derived for prompt labels, but UUID remains the canonical identifier.

```
=== FEEDBACK ON PREVIOUS DRAFT ===
[approved | user | Alice] The decision statement is accurate and concise.
  > "We will migrate to PostgreSQL 16 by Q3." (text reference)

=== FEEDBACK (applies to: options) ===
[needs_work | expert_agent | TechReviewer] Missing the vendor-managed option — Azure Database for PostgreSQL was discussed.
```

Whole-draft feedback (null `fieldId`) goes in the first section. Field-scoped feedback goes in labelled sections per field.

## Persistence

| Layer | Location |
|---|---|
| Canonical Zod schema | `packages/schema/src/index.ts` — `DecisionFeedbackSchema`, `FeedbackRatingSchema`, `FeedbackSourceSchema` |
| Drizzle table | `packages/db/src/schema.ts` — `decisionFeedback` |
| Repository interface | `packages/core/src/interfaces/i-feedback-repository.ts` — `IFeedbackRepository` |
| Repository implementation | `packages/db/src/repositories/feedback-repository.ts` — `DrizzleFeedbackRepository` |
| Service | `packages/core/src/services/feedback-service.ts` — `FeedbackService` |

## REST API surface

| Method | Path | Purpose |
|--------|------|---------|
| `GET`    | `/api/decision-contexts/:id/feedback`                | All feedback for context (all fields) |
| `GET`    | `/api/decision-contexts/:id/feedback/field/:fieldId` | Feedback scoped to one field |
| `POST`   | `/api/decision-contexts/:id/feedback`                | Add a feedback item |
| `PATCH`  | `/api/decision-feedback/:feedbackId/exclude`         | Toggle `excludeFromRegeneration` |
| `DELETE` | `/api/decision-feedback/:feedbackId`                 | Delete a feedback item |

## UI

The `FieldZoom` component renders the feedback chain per field:

- Rating badge (colour-coded: approved=green, needs_work=amber, rejected=red), source label, author, timestamp
- Optional quoted text reference rendered as a styled blockquote
- Per-item toggle to exclude/include from next regeneration (visually muted when excluded)
- "Add feedback" form: rating radio (`approved | needs_work | rejected`), comment textarea, optional quote textarea for `textReference`

## Versioning notes

`fieldVersionId` is stored as a nullable UUID column with no FK constraint at this time. When the `field_versions` table is introduced (see `docs/plans/field-versioning-schema-proposal.md`), an `ALTER TABLE` migration will add the FK constraint. Feedback records created before that migration can be associated retroactively via `draftVersionNumber` linkage.
