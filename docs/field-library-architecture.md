# Field Library Architecture

**Status**: authoritative
**Owns**: field-library schema, template composition model, field-level extraction prompt structure
**Must sync with**: `packages/schema`, `docs/OVERVIEW.md`, `docs/plans/iterative-implementation-plan.md`

## Core Concept

**Fields are the atomic units of decision documentation.**

- **Field Library**: A collection of reusable decision fields, each with its own definition and prompt
- **Decision Template**: A curated collection of fields for a specific decision type
- **Field Reuse**: Same field can appear in multiple templates

## Architecture

### 1. Canonical schema ownership

The canonical structural definitions for field-library entities live in `packages/schema/src/index.ts`.

Use those source-of-truth schema symbols when you need the exact shape of:

- `DecisionFieldSchema`
- `DecisionTemplateSchema`
- template field-assignment shapes

This document owns the semantics of the field library, not the full structural definitions.

### 2. Semantic model

#### Decision fields

A decision field is an atomic reusable definition that carries:

- **stable identity** — UUID, permanent across versions
- **semantic intent** — what this field is for
- **`description`** — brief user-facing explanation of the field
- **`instructions`** — fuller user-facing guidance explaining what belongs in the field, how to complete it, and why it matters. Distinct from `extractionPrompt` (LLM instruction) and `placeholder` (short UI hint).
- **`extractionPrompt`** — the LLM extraction instruction. Owned by the field definition, never duplicated in templates. This is the prompt the LLM receives when extracting this field from a transcript.
- **`placeholder`** — short UI hint shown in the form input
- **field-type and validation hints** — `fieldType` enum, `validationRules` JSONB
- **versioned metadata** — `version` integer, `namespace`, `isCustom`

Important architectural rules:

- field identity is definition-level and stable
- field `name` is a programmatic key, not a user-facing label
- field prompts (`extractionPrompt`) belong to the field definition, not the template
- templates reuse fields rather than duplicating them
- improving an `extractionPrompt` improves all templates that use that field

#### Decision templates

A template is a curated composition of reusable fields for a specific decision category.

A template carries:

- **stable identity** — UUID, permanent across versions
- **`name`** — human-readable template name
- **`description`** — substantive explanation of when to use this template and what it is designed to document
- **`promptTemplate`** — template-level **workflow framing** for the LLM. Sets the decision category context (e.g. "This is a Technology Selection decision — focus on comparative analysis of alternatives") without overriding individual field extraction semantics. This is appended to the system context when generating a draft for a decision using this template.
- **`category`** — enum: `standard`, `technology`, `strategy`, `budget`, `policy`, `proposal`
- **versioned metadata** — `version`, `namespace`, `isDefault`, `isCustom`

Important architectural rules:

- templates reference fields by `fieldId`
- templates are versioned configuration artifacts
- template assignments control order and requiredness
- **`promptTemplate` provides wider framing only** — it must not restate, override, or duplicate individual field extraction prompts
- templates do not own field history; they control active presentation
- decision contexts bind to a specific template version at creation time

#### Template field assignments

A template field assignment configures template composition:

- field reference (`fieldId`)
- display order (`order`)
- required flag (`required`)
- optional grouping or layout metadata that does not redefine field semantics

#### Runtime boundary

When a `DecisionContext` is created, it resolves and binds one specific template version plus the field-definition set referenced by that template.

From that point onward, the context manages working state (field values, locks, visibility) but does not edit field-library records or template-definition structure.

### 3. Seed-data files (authoritative editable sources)

Field and template definitions are stored in the database and seeded from versioned TypeScript files:

- **Field definitions**: `packages/db/src/seed-data/decision-fields.ts` — authoritative source for all field content including `extractionPrompt`, `instructions`, `description`, and `placeholder`. Edit this file to iterate on prompts.
- **Template definitions**: `packages/db/src/seed-data/decision-templates.ts` — authoritative source for all template content including `promptTemplate` and field assignments. Edit this file to adjust template framing.
- **Seed script**: `packages/db/scripts/seed.ts` — thin orchestration that imports from the above files and upserts to the database.

After editing these files, run `pnpm db:seed` to apply changes.

### 4. Field Library (Implemented)

The following 11 fields are seeded in the current implementation. All are `fieldType: textarea` unless noted.

---

**`decision_statement`** — category: `outcome`
- **Description**: A clear, concise statement of the decision being made
- **Instructions**: One clear sentence in active voice stating what was decided. Focus on the decision itself, not the problem or process.
- **Extraction prompt**: Extract a single sentence stating what decision is being made. Use active voice. Focus on the decision outcome, not the discussion process. If the decision is implicit (e.g. a decision to defer, reject, or not act), state that explicitly.
- **Placeholder**: What decision are we making?
- **Used in**: All templates

---

**`context`** — category: `context`
- **Description**: The background and circumstances that led to this decision
- **Instructions**: Background a reader 6 months later would need to understand why this decision arose. Include constraints, history, or triggering events.
- **Extraction prompt**: Summarise the background and situation that led to this decision. Include relevant constraints, prior events, and triggering circumstances.
- **Placeholder**: What context is needed to understand this decision?
- **Used in**: All templates

---

**`options`** — category: `evaluation`
- **Description**: The alternatives or options that were considered
- **Instructions**: Each alternative the group seriously considered, including "do nothing." Brief characterisation of each, not just names.
- **Extraction prompt**: List all alternatives discussed, including "do nothing" if mentioned. Provide a brief characterisation of each option, not just its name.
- **Placeholder**: What other options were considered?
- **Used in**: All templates

---

**`criteria`** — category: `evaluation`
- **Description**: The criteria or standards used to evaluate the options
- **Instructions**: The standards used to judge options — not the options themselves.
- **Extraction prompt**: List the criteria or standards used to evaluate the options. These are the factors the group cared about, not the options themselves.
- **Placeholder**: What criteria matter for this decision?
- **Used in**: Technology Selection, Strategy, Budget, Policy, Proposal templates

---

**`analysis`** — category: `evaluation`
- **Description**: How the options were compared and what trade-offs were identified
- **Instructions**: How options fared against criteria. Include trade-offs, disagreements, and what was weighted most heavily.
- **Extraction prompt**: Describe how the options were compared against the criteria. Include trade-offs discussed, disagreements, and which factors were weighted most heavily.
- **Placeholder**: What analysis supports the decision?
- **Used in**: Technology Selection, Strategy, Budget, Policy, Proposal templates

---

**`outcome`** — category: `outcome`
- **Description**: The final decision and the primary rationale for choosing it
- **Instructions**: The chosen option and the primary reason it was selected over alternatives. If provisional, say so explicitly.
- **Extraction prompt**: Extract the chosen option and the primary reason it was selected. If the decision is provisional or conditional, capture those conditions explicitly.
- **Placeholder**: What did we decide and why?
- **Used in**: All templates

---

**`risks`** — category: `evaluation`
- **Description**: Risks identified and any agreed mitigations
- **Instructions**: Known risks acknowledged at decision time, any agreed mitigations, and risks that remain open.
- **Extraction prompt**: List the risks identified during discussion. For each risk, note any mitigation agreed upon and whether the risk remains open or unresolved.
- **Placeholder**: What risks were identified?
- **Used in**: Technology Selection, Strategy, Policy templates

---

**`timeline`** — category: `metadata`
- **Description**: Key milestones, deadlines, and sequencing
- **Instructions**: Key milestones, deadlines, and sequencing agreed. Include dependencies where mentioned.
- **Extraction prompt**: Extract key milestones, deadlines, and sequencing mentioned. Note any dependencies between steps where stated.
- **Placeholder**: What is the timeline for implementation?
- **Used in**: Proposal Acceptance template

---

**`stakeholders`** — category: `metadata`
- **Description**: Who is affected by and involved in this decision
- **Instructions**: Who is affected, who owns implementation, and who must be kept informed. Note if key stakeholders were absent.
- **Extraction prompt**: Identify who is affected by this decision, who will own its implementation, and who must be kept informed. Note if key stakeholders were absent from the discussion.
- **Placeholder**: Who is impacted?
- **Used in**: Strategy, Policy templates

---

**`resources`** — category: `metadata`
- **Description**: People, budget, tools, or dependencies required to execute
- **Instructions**: People, budget, tools, or external dependencies required. Note confirmed vs still-to-be-secured.
- **Extraction prompt**: Extract the people, budget, tools, or external dependencies required to execute this decision. Note which are confirmed versus still to be secured.
- **Placeholder**: What resources are required?
- **Used in**: Budget, Proposal Acceptance templates

---

**`outstanding_issues`** — category: `evaluation`
- **Description**: Unresolved questions or open dependencies from the discussion
- **Instructions**: Unresolved questions or open dependencies the group could not answer in this session. Follow-up items, not objections.
- **Extraction prompt**: Summarise unresolved questions, open dependencies, or concerns the group could not answer in this session. These are follow-up items, not objections to the decision.
- **Placeholder**: What remains unresolved before this decision can proceed?
- **Used in**: Standard, Strategy, Proposal Acceptance templates

---

### 5. Template Definitions (Implemented)

Templates are defined in `packages/db/src/seed-data/decision-templates.ts`.

#### Standard Decision (default)
- **Description**: A general-purpose template for decisions that don't fit a more specific category. Captures the decision, the options considered, and the rationale.
- **Prompt template**: You are extracting a general decision record. Focus on identifying the clear decision made (or not made — implicit decisions to defer or not act are valid), the alternatives that were considered, and the reasoning behind the chosen path.
- **Fields**: decision_statement (req), context (req), options (req), criteria (opt), outcome (req), outstanding_issues (opt)

#### Technology Selection
- **Description**: For choosing between technical tools, frameworks, platforms, or architectures. Emphasises comparative evaluation and trade-off analysis.
- **Prompt template**: You are extracting a technology selection decision. Emphasise the comparative analysis of alternatives against stated criteria. Capture what trade-offs drove the final selection and whether the choice is confirmed or provisional.
- **Fields**: decision_statement (req), context (req), options (req), criteria (req), analysis (req), risks (req), outcome (req)

#### Strategy Decision
- **Description**: For high-level strategic and business direction decisions. Captures current state, chosen direction, and what was explicitly deprioritised.
- **Prompt template**: You are extracting a strategic direction decision. Focus on the current state being moved away from, the chosen direction, and what was explicitly deprioritised or ruled out. Alignment rationale is as important as the decision itself.
- **Fields**: decision_statement (req), context (req), options (req), criteria (req), analysis (req), risks (req), stakeholders (req), outcome (req), outstanding_issues (opt)

#### Budget Decision
- **Description**: For financial and budget-related decisions. Emphasises stated amounts, ROI reasoning, and alternatives considered.
- **Prompt template**: You are extracting a financial or budget decision. Emphasise any stated amounts, ROI reasoning, and alternatives that were ruled out. Flag whether this is a provisional or confirmed budget commitment.
- **Fields**: decision_statement (req), context (req), options (req), criteria (req), analysis (req), resources (req), outcome (req)

#### Policy Decision
- **Description**: For creating or modifying policies, procedures, and governance rules. Captures what is changing and who is affected.
- **Prompt template**: You are extracting a policy or governance decision. Focus on what rule or practice is changing, why the change is being made, who is affected, and any compliance or regulatory reasoning mentioned.
- **Fields**: decision_statement (req), context (req), options (req), criteria (req), analysis (req), stakeholders (req), risks (req), outcome (req)

#### Proposal Acceptance
- **Description**: For evaluating and deciding whether to accept proposals, recommendations, or suggestions. Captures who proposed, concerns addressed, and acceptance conditions.
- **Prompt template**: You are extracting a proposal acceptance or rejection decision. Focus on who submitted the proposal, how stakeholder concerns were addressed (or not), and whether the acceptance is unconditional or has conditions attached.
- **Fields**: decision_statement (req), context (req), options (req), criteria (req), analysis (req), resources (opt), timeline (opt), outcome (req), outstanding_issues (opt)

---

### 6. LLM output: `suggestedTags`

Draft generation also returns `suggestedTags: string[]` — a set of 3–7 short subject tags characterising the decision (e.g. `["security", "file-transfer", "architecture", "compliance"]`). These are:

- returned alongside field values from the LLM structured output
- stored on `decision_contexts.suggestedTags` (TEXT[] column)
- used for search and categorisation in the UI

The generation prompt asks the LLM: "Also return suggestedTags: 3–7 short lowercase subject tags that characterise this decision, suitable for search and categorisation."

---

### 7. Prompt Organization

```
packages/db/src/seed-data/
├── decision-fields.ts      # Authoritative field definitions + extraction prompts
└── decision-templates.ts   # Authoritative template definitions + promptTemplates
```

Field extraction prompts should not be maintained as separate per-field prompt files.

Instead:

- the canonical prompt guidance lives on the field definition itself (`extractionPrompt` column)
- templates select fields, but do not duplicate their extraction prompts
- prompt refinement should update `decision-fields.ts` and re-seed rather than a parallel prompt-file tree
- template framing lives in `promptTemplate` on the template definition

### 8. Benefits

✅ **Field Reuse**: `decision_statement` defined once, used in all templates
✅ **Consistent Extraction**: Same field always uses same `extractionPrompt`
✅ **Easy Refinement**: Improve `options` prompt in `decision-fields.ts` → improves all templates using it
✅ **Template Flexibility**: Mix and match fields for new decision types
✅ **Template Framing**: `promptTemplate` gives the LLM decision-category context without overriding field semantics
✅ **User Guidance**: `instructions` per field tells users what to put there
✅ **Subject Tags**: `suggestedTags` from LLM enables search and categorisation
✅ **Prompt Versioning**: Each field has its own `version` history; seed files are version-controlled

### 9. Implementation

> **Implementation Note**: The `DraftGenerationService` and its methods, including `regenerateField`, are defined in `docs/plans/iterative-implementation-plan.md`. That document is the authoritative source for the implementation, which uses a layered architecture with a dedicated `ILLMService` and `PromptBuilder`.

> **Prompt enrichment changes**: See `docs/plans/prompt-enrichment-plan.md` for the schema, seed data, prompt builder, and service changes that introduced `instructions`, `promptTemplate`, `suggestedTags`, and the wiring of current-draft context into field regeneration.

### 10. Persistence ownership

The canonical structural definitions for field-library persistence belong in:

- `packages/schema/src/index.ts`
- `packages/db`

The field-library persistence model supports:

- durable field definitions with stable identity and versioning
- durable template definitions with stable identity and versioning
- many-to-many template field assignments
- template-local ordering and requiredness
- template-level `promptTemplate` (workflow framing, not field semantic overrides)
- field-level `instructions` (user-facing guidance)
- prompt/configuration data attached to fields rather than duplicated across templates
