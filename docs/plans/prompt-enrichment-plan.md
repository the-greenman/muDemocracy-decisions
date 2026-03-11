# Plan: Rich Template & Field Guidance + Current-Draft Context in Regeneration

**Status**: approved — implementation in progress (2026-03-11)
**Related docs**: `docs/field-library-architecture.md`, `docs/field-regeneration-strategy.md`, `docs/plans/field-and-template-definition-distribution-proposal.md`

---

## Context

Decision templates and fields currently have minimal metadata making it into LLM prompts. Templates only store a short `description`; fields have an `extraction_prompt` but no human-readable instructions for users. When a decision or field is regenerated, the template's intent isn't communicated to the LLM, and field regeneration doesn't include the current draft state (other locked field values).

**Architecture alignment**: `field-library-architecture.md` and the distribution proposal are explicit:
- Field extraction prompts belong on field definitions, NOT duplicated in templates
- Templates own **"template-level workflow framing"** — the sanctioned basis for a template `promptTemplate`
- Templates must NOT override field-level prompt meaning or extraction behavior

---

## What Changes

### 1. Schema — three new columns

**`decision_fields`**: add `instructions TEXT` (nullable)
- Human-readable guidance for the user explaining what belongs in this field and why it matters
- Distinct from `extractionPrompt` (LLM instruction) and `placeholder` (short UI hint)

**`decision_templates`**: add `promptTemplate TEXT` (nullable)
- Template-level **workflow framing** for the LLM: what decision type this is, what to focus on across the whole extraction, what patterns to watch for
- Must NOT restate or override individual field extraction prompts

**`decision_contexts`**: add `suggestedTags TEXT[]` (nullable)
- Array of subject tags returned by the LLM alongside field values (e.g. `["security", "architecture", "compliance"]`)
- Populated during draft generation; used for search and categorisation

### 2. File-based template and field definition management

**New file**: `packages/db/src/seed-data/decision-fields.ts`
- Authoritative home for all field definitions (moved out of `seed.ts`)
- Includes: `name`, `description`, `extractionPrompt`, `instructions`, `placeholder`, `fieldType`, `category`

**Updated**: `packages/db/src/seed-data/decision-templates.ts`
- Add `promptTemplate` to each template
- Improve `description` where needed

**Updated**: `packages/db/scripts/seed.ts`
- Import from seed-data files instead of inline definitions
- Becomes thin orchestration only

### 3. Template `promptTemplate` content (workflow framing, not field overrides)

| Template | Framing intent |
|---|---|
| Standard Decision | General-purpose: extract a clear decision, options considered, and rationale. Note that implicit decisions (decisions NOT to act) are as valid as explicit choices. |
| Technology Selection | Technical evaluation: comparative analysis of alternatives against criteria. Emphasise what trade-offs drove selection. Flag provisional vs confirmed choices. |
| Strategy Decision | Direction-setting: current state vs chosen direction. Capture what was explicitly deprioritised, not just what was selected. |
| Budget Decision | Financial justification: emphasis on stated amounts, ROI reasoning, and alternatives ruled out. Flag provisional vs committed budget decisions. |
| Policy Decision | Governance change: what rule or practice is changing, why, and who is affected. Capture compliance reasoning where mentioned. |
| Proposal Acceptance | Accept/reject framing: who proposed, whether concerns were addressed, and whether acceptance is conditional or unconditional. |

### 4. Field `instructions` content (user-facing guidance)

| Field | Instructions |
|---|---|
| decision_statement | One clear sentence in active voice stating what was decided. Focus on the decision itself, not the problem or process. |
| context | Background a reader 6 months later would need to understand why this decision arose. Include constraints, history, or triggering events. |
| options | Each alternative the group seriously considered, including "do nothing." Brief characterisation of each, not just names. |
| criteria | The standards used to judge options — not the options themselves. |
| analysis | How options fared against criteria. Include trade-offs, disagreements, and what was weighted most heavily. |
| outcome | The chosen option and the primary reason it was selected over alternatives. If provisional, say so explicitly. |
| risks | Known risks acknowledged at decision time, any agreed mitigations, and risks that remain open. |
| timeline | Key milestones, deadlines, and sequencing agreed. Include dependencies where mentioned. |
| stakeholders | Who is affected, who owns implementation, and who must be kept informed. Note if key stakeholders were absent. |
| resources | People, budget, tools, or external dependencies required. Note confirmed vs still-to-be-secured. |
| outstanding_issues | Unresolved questions or open dependencies the group could not answer in this session. Follow-up items, not objections. |

### 5. Improved `extractionPrompt` per field

Current prompts are very thin. Rewrite each to be specific and actionable:

| Field | Improved extraction prompt |
|---|---|
| decision_statement | Extract a single sentence stating what decision is being made. Use active voice. Focus on the decision outcome, not the discussion process. If the decision is implicit (e.g. a decision to defer, reject, or not act), state that explicitly. |
| context | Summarise the background and situation that led to this decision. Include relevant constraints, prior events, and triggering circumstances. |
| options | List all alternatives discussed, including "do nothing" if mentioned. Provide a brief characterisation of each option, not just its name. |
| criteria | List the criteria or standards used to evaluate the options. These are the factors the group cared about, not the options themselves. |
| analysis | Describe how the options were compared against the criteria. Include trade-offs discussed, disagreements, and which factors were weighted most heavily. |
| outcome | Extract the chosen option and the primary reason it was selected. If the decision is provisional or conditional, capture those conditions explicitly. |
| risks | List the risks identified during discussion. For each risk, note any mitigation agreed upon and whether the risk remains open or unresolved. |
| timeline | Extract key milestones, deadlines, and sequencing mentioned. Note any dependencies between steps where stated. |
| stakeholders | Identify who is affected by this decision, who will own its implementation, and who must be kept informed. Note if key stakeholders were absent from the discussion. |
| resources | Extract the people, budget, tools, or external dependencies required to execute this decision. Note which are confirmed versus still to be secured. |
| outstanding_issues | Summarise unresolved questions, open dependencies, or concerns the group could not answer in this session. These are follow-up items, not objections to the decision. |

### 6. Prompt builder changes

**File**: `packages/core/src/llm/prompt-builder.ts`

**6a. Include `extractionPrompt` in serialized `template_fields` segment**

`addTemplateFields()` currently passes only `{ id, displayName, description }` — the default path never sends `extractionPrompt` to the LLM. Update `PromptSegment` `template_fields` variant to include `extractionPrompt`. Serialize as:
```
Field: <name>
Description: <description>
Extraction guidance: <extractionPrompt>
```

**6b. Inject template `promptTemplate` into system context**

`buildDraftPrompt()` accepts optional `templatePrompt: string | null`. When provided, append to system segment as "Decision type context: <promptTemplate>".

**6c. Add current draft to `buildFieldRegenerationPrompt()`**

Add `currentDraftText: string | null`. Insert as supplementary labeled `"Current decision draft (reference only — other fields already locked or filled)"` before the field definition.

**6d. Fix `buildDraftPromptFromTemplate()` — include current draft**

This path omits `currentDraftText`. Accept and include it.

### 7. LLM draft generation — add `suggestedTags` to output

- `i-llm-service.ts`: add `suggestedTags: string[]` to the draft generation result type
- `vercel-ai-llm-service.ts`: add `suggestedTags: z.array(z.string())` to the structured output schema; return it
- Prompt: ask the LLM for 3–7 short subject tags characterising the decision
- `draft-generation-service.ts`: save `suggestedTags` to `decision_contexts.suggestedTags`

### 8. Draft generation service wiring

- Fetch template row to get `promptTemplate`; pass to prompt builders
- In `regenerateField()`: build `currentDraftText` from existing draft; pass to `buildFieldRegenerationPrompt()`
- Add `findTemplateById(id)` to template repository interface if absent

---

## Execution Order

0. ✅ Write this plan to `docs/plans/prompt-enrichment-plan.md`
1. Update `docs/field-library-architecture.md`
2. Schema changes → `pnpm db:generate` → `pnpm db:migrate`
3. Create `decision-fields.ts`; update `decision-templates.ts`; slim `seed.ts`
4. `pnpm db:seed`
5. Failing prompt-builder tests → implement 6a–6d → pass
6. Update LLM services for `suggestedTags`
7. Failing service tests → implement wiring → pass
8. `pnpm build && pnpm type-check && pnpm test`

---

## Critical Files

| File | Change |
|---|---|
| `docs/field-library-architecture.md` | Reflect current fields, new columns, seed-data file locations |
| `packages/db/src/schema.ts` | Add `instructions`, `promptTemplate`, `suggestedTags` columns |
| `packages/db/src/seed-data/decision-fields.ts` | New: authoritative field definitions |
| `packages/db/src/seed-data/decision-templates.ts` | Add `promptTemplate`; improve descriptions |
| `packages/db/scripts/seed.ts` | Import from seed-data files; remove inline definitions |
| `packages/core/src/llm/prompt-builder.ts` | Changes 6a–6d |
| `packages/core/src/llm/i-llm-service.ts` | Add `suggestedTags` to result type |
| `packages/core/src/llm/vercel-ai-llm-service.ts` | Add `suggestedTags` to structured output |
| `packages/core/src/services/draft-generation-service.ts` | Template prompt + current draft + save suggestedTags |
| `packages/core/src/interfaces/i-decision-template-repository.ts` | Add `findById` if absent |
| `packages/schema/src/index.ts` | `DecisionContext`, `DecisionTemplate`, `DecisionField` gain new columns |
| `packages/db/drizzle/` | Generated migration |

---

## Verification

- `pnpm db:migrate` runs cleanly
- `pnpm db:seed` populates all new columns
- Prompt-builder unit tests prove all four construction changes
- Service unit tests prove template framing, `currentDraftText`, and `suggestedTags` flow through
- Manual: inspect `llm_interactions` prompt text after `generate-draft` — template framing + per-field extraction guidance visible
- Manual: inspect `llm_interactions` prompt text after field `regenerate` — other field values appear as supplementary context
- Manual: `DecisionContext.suggestedTags` populated after generation
