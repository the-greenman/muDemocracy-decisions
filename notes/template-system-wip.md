# Template System WIP

**Status**: WIP
**Purpose**: Explore an extensible template model built on top of the existing field-library architecture
**Placement**: Intentionally kept outside `docs/` because this is exploratory planning, not authoritative product documentation
**Related**: `docs/field-library-architecture.md`, `docs/PLAN.md`, `docs/iterative-implementation-plan.md` (see M9.1)

## Why This Exists

The current field-library architecture already gives us reusable fields and reusable templates. What is still missing is a clear model for how templates should evolve during a real decision discussion.

In practice, most decisions should start from a single standard template. We should not force users to switch to a completely different template every time new context appears. Instead, the system should support layering additional structure onto the standard template as the conversation becomes clearer.

This document outlines a direction where:

- A standard decision template is the default starting point
- Additional template layers can be applied as extensions or overlays
- The active working template can become more specific over time without losing continuity
- Fields remain portable because they come from a shared field library with stable UUIDs
- Templates, fields, and prompts can be exported/imported and shared as community packages

## Core Direction

### 1. Standard Template First

Every new decision context should begin with a standard base template that captures the common decision shape:

- what is being decided
- why it matters
- what options were considered
- what tradeoffs or consequences exist
- what the current recommendation or outcome is

This base template should remain the default for most decisions.

### 2. Extend Instead of Replace

When new information changes the type or seriousness of the decision, we should usually add to the template rather than swap it out.

Examples:

- A routine technical choice starts with the standard template, then gains a `technical-evaluation` overlay
- A decision becomes clearly non-reversible, so a `non-reversible-decision` overlay adds stronger risk, rollback, and approval fields
- A decision gains budget implications, so a `financial-impact` overlay adds cost and ROI fields

The user experience should feel like progressive refinement:

1. Start with the standard template
2. Detect or choose additional overlays as needed
3. Merge in new fields and prompts
4. Continue refining the same decision context

The system should preserve continuity of the draft rather than forcing the user into a new template identity each time.

### 3. Overlays Add Constraints, Not Just Fields

An overlay is more than a bag of extra fields. It can also refine how the draft should be generated.

An overlay may:

- add new fields
- mark previously optional fields as required
- tighten validation rules
- override field labels/descriptions for the current template composition
- add prompt guidance or extraction constraints for a specific decision mode

This lets a decision move from "generic discussion" to "higher-rigor documentation" without rebuilding the template from scratch.

## Proposed Model

### Field Definitions

Fields remain the atomic unit. They should continue to live in the field library and should have stable UUIDs.

Key rules:

- Each field has a stable UUID identity
- Each field has a namespace-scoped programmatic key (`namespace + name + version`)
- A field's extraction prompt belongs with the field definition
- Templates and overlays reference fields by UUID, never by display label

This matches the M9.1 direction: field identity is stable, portable, and safe to import across environments.

### Base Templates

A base template is a curated starting point, usually the standard decision template.

A base template should define:

- metadata (id, name, version, category)
- default field assignments
- ordering
- required/optional defaults
- any baseline prompt framing for draft generation

For most workflows, there should be one primary base template that the system starts with automatically.

### Template Overlays

A template overlay is a composable definition that modifies a base template (or another resolved composition).

An overlay should be able to:

- append field assignments
- insert fields at specific positions
- upgrade existing fields from optional to required
- override labels/descriptions for the resolved composition
- contribute prompt fragments or guidance blocks

An overlay should not duplicate the full template. It should describe only the delta.

### Resolved Template Composition

At runtime, the active template should be the resolved result of:

`base template + ordered overlays`

The system should compute a resolved template view that the draft generation, UI, and export layers use.

This resolved view should include:

- the final ordered field list
- effective required flags
- effective labels/descriptions
- effective prompt instructions
- provenance for each field (base template vs overlay)

That provenance matters because it explains why a field exists and supports clean export/import.

## Example Flow

### Progressive Refinement

1. A decision context is created with the standard template
2. The draft is generated with the base fields
3. The user or LLM notices this is a non-reversible decision
4. The system suggests a `non-reversible-decision` overlay
5. The overlay adds fields such as:
   - reversibility_assessment
   - rollback_plan
   - long_term_consequences
   - approval_requirements
6. The draft is regenerated only for newly added or currently unlocked fields
7. The same decision context continues, now with a more rigorous structure

This keeps the workflow additive and reduces disruption.

### Why This Fits the Product

The product is already designed around iterative refinement, field locking, and re-generation. Overlays fit that model naturally:

- new fields can enter the draft later
- locked fields remain protected
- only unresolved fields need regeneration
- the discussion can mature without forcing the user to restart

## Scenario Analysis

The core question is not just "can templates compose?" but "what actually happens as the active template changes over time?"

The system needs explicit behavior for adding overlays, handling overlaps, resolving conflicts, and possibly removing overlays after work has already begun.

### Scenario 1: Add A Compatible Overlay

This is the ideal case.

Example:

- Base template: `standard-decision`
- Existing fields: decision statement, context, options, rationale
- New overlay: `financial-impact`
- New fields added: `estimated_cost`, `roi_analysis`, `budget_owner`

Expected behavior:

- the overlay is accepted without conflict
- new fields are added to the resolved composition
- existing field values remain unchanged
- only the new fields are empty and eligible for generation
- if the user requests regeneration, only unlocked and newly relevant fields are regenerated

This is the additive path the system should optimize for.

### Scenario 2: Add An Overlay That Tightens Existing Requirements

This is still a valid composition, but it changes the rigor level.

Example:

- Base template includes `decision_rationale` as optional
- New overlay marks `decision_rationale` as required
- New overlay also adds `approval_requirements`

Expected behavior:

- the existing field remains the same field by UUID
- the effective required status changes in the resolved composition
- validation now blocks finalization if that field is empty
- existing populated content is preserved

This means overlays need to support "strengthening" an assignment, not only adding new ones.

### Scenario 3: Add An Overlay That Reuses Existing Fields With Different Presentation

This is mostly a presentation or prompt change.

Example:

- Base template uses `risk_assessment`
- New overlay reuses `risk_assessment`
- Overlay changes the label to `Irreversible Risk Review`
- Overlay adds tighter extraction guidance for long-term impact

Expected behavior:

- field identity stays the same
- the resolved label/description changes for this decision context
- the prompt builder uses the effective overlay-adjusted guidance
- historical field values stay attached to the same field ID

This is useful because it avoids field duplication while still allowing context-specific framing.

### Scenario 4: Add An Overlay That Introduces Semantic Conflict

This is where the model becomes non-trivial.

Example:

- Overlay A says `rollback_plan` is required
- Overlay B assumes the decision is reversible and adds a lighter `fallback_notes` field instead
- Overlay A upgrades `risk_assessment` prompt toward irreversible consequences
- Overlay B upgrades the same field toward short-term operational risk only

Expected behavior:

- the system should detect that multiple overlays touch the same field or same rule surface
- the conflict should be classed, not silently merged
- the user should be shown the exact source of the conflict
- the system should either resolve using a deterministic rule or require explicit user choice

Silent merges are dangerous here because they create hidden prompt and validation behavior.

### Scenario 5: Remove An Overlay Before The User Has Worked In Its Fields

This is the simplest removal case.

Example:

- `financial-impact` overlay was added
- its fields are still empty and unlocked
- the user decides it was unnecessary

Expected behavior:

- the overlay can be removed safely
- fields introduced only by that overlay disappear from the active composition
- no field data needs preservation because nothing was entered

This should be fully reversible and low-risk.

### Scenario 6: Remove An Overlay After Fields Have Been Populated

This is the hard removal case.

Example:

- `non-reversible-decision` overlay was added
- `rollback_plan` and `approval_requirements` now contain content
- one or more of those fields may be locked

Expected behavior is not obvious. There are at least three possible policies:

- block removal until dependent fields are cleared or unlocked
- allow removal but archive the hidden field data
- allow removal and keep the data in the decision context even if the fields are no longer active

This decision affects auditability, UI clarity, and data retention semantics.

### Scenario 7: Switch Base Template Instead Of Layering

Sometimes layering may be the wrong abstraction.

Example:

- a decision begins as `standard-decision`
- later it turns out to be a specialized procurement workflow with substantially different structure

Possible behavior:

- treat this as a true base-template migration
- preserve shared fields by matching on field UUID
- mark no-longer-present fields as deprecated, archived, or detached

This suggests the product may need to support both:

- additive overlay composition for normal evolution
- full template migration for rarer, structural shifts

## Conflict Types

Not all conflicts are equal. The system should identify what kind of conflict occurred so it can apply the right policy.

### Assignment Conflicts

These happen when multiple overlays touch the same field assignment.

Examples:

- both overlays set different insertion positions
- both overlays set different `required` values
- both overlays set different custom labels

These are local conflicts and can usually be resolved with deterministic precedence if we want to permit that.

### Prompt Conflicts

These happen when multiple overlays change how a field should be generated.

Examples:

- one overlay wants terse output, another wants a structured list
- one overlay adds "focus on financial exposure", another adds "focus on operational simplicity"

Prompt conflicts are more dangerous because naive concatenation can degrade model behavior.

### Validation Conflicts

These happen when overlays change the conditions required for saving or finalizing.

Examples:

- one overlay makes a field required
- another overlay adds a validation pattern that contradicts existing content
- one overlay assumes a numeric field while another assumes free text

Validation conflicts need explicit resolution because they affect user success paths.

### Semantic Conflicts

These happen when the overlays encode incompatible world assumptions.

Examples:

- one overlay assumes reversible experimentation
- another assumes irreversible governance approval

These conflicts should usually block auto-merge and require user intervention.

## Conflict Resolution Options

There are several viable models. The right choice depends on whether we want simplicity, flexibility, or explicitness.

### Option A: Strict No-Conflict Composition

Rule:

- overlays may only add new fields or strengthen existing requirements
- if two overlays touch the same assignment surface, composition is rejected

Pros:

- easiest to reason about
- fewer hidden behaviors
- safer for early implementation

Cons:

- less expressive
- many useful overlay combinations become impossible

This is the safest initial model.

### Option B: Deterministic Precedence

Rule:

- overlays are ordered
- later overlays win on conflicting assignment metadata
- prompt fragments are merged according to explicit precedence rules

Pros:

- flexible
- easy to implement operationally once ordering exists

Cons:

- conflicts can become hard to understand
- users may not realize why a field behaves differently

If we choose this, provenance and explainability become mandatory.

### Option C: Explicit User Resolution

Rule:

- the system detects conflicts
- the user must choose which overlay wins for each conflicting surface
- the choice becomes part of the resolved composition state

Pros:

- most explicit
- can support complex compositions safely

Cons:

- more UX complexity
- harder to automate

This is powerful, but probably too heavy as a first implementation.

### Option D: Overlay Families / Mutually Exclusive Modes

Rule:

- overlays declare compatibility groups
- overlays in the same mutually exclusive family cannot both be active

Example:

- `reversible-decision` and `non-reversible-decision` are in the same family

Pros:

- prevents predictable semantic conflicts early
- simpler than full user-mediated conflict resolution

Cons:

- still requires family modeling and compatibility metadata

This is a practical middle ground.

## Removing Templates Or Overlays

Removal needs to be designed as carefully as addition because it can affect active draft data.

### Removal States

We should distinguish between:

- removing an overlay from the registry (definition-level deletion)
- removing an overlay from a decision context (instance-level deactivation)
- removing a base template from future selection

These are not the same operation and should not share the same semantics.

### Decision-Context Removal Policies

At least three policies are plausible.

#### Policy 1: Hard Remove

- fields introduced solely by the removed overlay leave the active composition
- associated draft data is deleted

This is simple, but risky and likely too destructive for real usage.

#### Policy 2: Soft Remove With Archived Data

- fields leave the active composition
- their prior values remain stored as archived/inactive field data
- exports and validation ignore them unless the overlay is re-applied

This preserves work while keeping the active template clean.

#### Policy 3: Deactivate Overlay But Preserve Visible Data

- the overlay becomes inactive
- fields remain visible if they have content
- empty fields may disappear

This avoids data loss, but makes the active template harder to reason about because now visibility is data-dependent.

Policy 2 looks like the cleanest default if removal after editing is allowed.

### Registry-Level Deletion

If a template or overlay definition is already used by decision contexts, hard deletion is probably the wrong behavior.

Safer options:

- prevent deletion once referenced
- allow only archival/deprecation
- allow deletion only for custom local definitions not yet referenced

This mirrors how we should treat versioned fields: references should remain stable for auditability.

## What Must Exist To Make This Work

The overlay concept is only viable if the surrounding platform can support it cleanly.

### 1. Stable Registry Identity

We need:

- stable UUIDs for fields, base templates, and overlays
- explicit versioning rules
- namespace-aware uniqueness
- import/export semantics that preserve identity

Without this, composition across environments will drift.

### 2. A Formal Resolution Engine

We need a single place that resolves:

- base template
- active overlays
- assignment operations
- effective prompt instructions
- effective validation rules
- field provenance

This should be a first-class service, not duplicated across CLI, API, and export logic.

### 3. Decision-Context Composition State

A decision context likely needs explicit composition metadata such as:

- base template ID and version
- active overlay IDs and versions
- activation order
- conflict decisions (if any)
- resolved snapshot hash or version

Without stored composition state, behavior will be hard to reproduce later.

### 4. Draft Data Lifecycle Rules

We need clear semantics for:

- new fields entering a live draft
- removed fields leaving the active composition
- archived field values
- locked fields when their source overlay is deactivated

This is essential for predictable user behavior.

### 5. Prompt Provenance

Because overlays may change prompt behavior, LLM observability must capture:

- which overlays were active
- which prompt fragments came from each source
- what the resolved field instructions were at generation time

Otherwise debugging and auditability will degrade.

### 6. UX Affordances

Users need enough visibility to understand what changed.

Minimum requirements:

- show active overlays
- show why an overlay was suggested
- show which fields were added or changed by an overlay
- warn before removal if data would be hidden or archived
- explain conflicts in domain terms, not internal implementation terms

## Implementation Paths

There are multiple plausible ways to implement this. They trade off speed, complexity, and long-term flexibility.

### Path 1: Minimal And Safe

Model:

- keep base templates as they are
- add overlays that can only append fields and strengthen `required`
- disallow overlapping edits to existing assignment metadata
- disallow overlay removal after any overlay-owned field is populated

Benefits:

- lowest implementation risk
- easiest to test
- aligns with current system behavior

Limitations:

- conservative
- less expressive than the long-term vision

This is the best path if we want to validate the concept quickly.

### Path 2: Additive Composition With Soft Removal

Model:

- overlays may add fields and adjust presentation metadata
- conflicts are limited to a small allowed set
- populated overlay fields can be archived if the overlay is removed

Benefits:

- supports real iterative workflows better
- avoids data loss

Limitations:

- requires archived field semantics
- requires stronger resolved-template state management

This is a strong candidate for a first serious version.

### Path 3: Full Rule-Based Composition

Model:

- overlays can add, modify, and potentially deactivate fields
- a resolution engine applies ordered operations
- conflicts are resolved through precedence or explicit user choice

Benefits:

- most flexible
- supports complex domain packs and community sharing

Limitations:

- significantly harder to reason about
- more UX and validation complexity

This is likely a later-stage architecture, not the first milestone.

### Path 4: Hybrid Of Overlays And Template Migration

Model:

- overlays handle additive refinement
- explicit template migration handles major structural changes
- both systems share field UUID matching and portability rules

Benefits:

- matches real-world decision evolution better
- avoids forcing overlays to solve every problem

Limitations:

- introduces two template-change mechanisms
- requires clear UX distinction between "extend" and "migrate"

This may be the most accurate model of reality even if it is not the simplest.

## Additive Templates Vs Template Migration

We should explicitly compare these approaches before committing to overlays as the main abstraction.

The key question is: are we actually solving "incremental refinement" or are we trying to model "moving a decision into a better-fitting structure"?

Those are related, but not identical.

### Option 1: Additive Templates / Overlays

This means:

- start from a base template
- progressively layer additional template behavior onto it
- keep one continuously evolving resolved template

#### Pros

- fits the product's iterative refinement model
- preserves continuity in a natural way
- adding a few fields late in the process is efficient
- works well when the decision really is "the same shape, but with more rigor"
- avoids forcing the user to choose a perfect template up front

#### Cons

- composition rules can become complex quickly
- conflict handling is not optional once overlays can touch existing fields
- prompt behavior becomes harder to reason about
- removal semantics are difficult once data exists
- auditing the "real active template" requires a resolution engine and provenance tracking
- UX can become confusing if users do not understand what changed and why

Additive composition is strongest when overlays are narrow, additive, and rarely conflicting.

It becomes expensive when overlays need to rewrite semantics rather than simply extend them.

### Option 2: Template Migration

This means:

- a decision context has one active template at a time
- when the shape of the decision changes, the context migrates to a new template
- shared fields are preserved by matching field UUIDs

The system then treats template changes as controlled transitions, not composition.

#### Pros

- conceptually simpler than full overlay composition
- easier to explain: "you changed templates"
- no need to resolve overlapping template operations at runtime
- fewer prompt-merging problems
- easier to validate and test because there is one active template definition
- clearer export and audit behavior

#### Cons

- can feel heavier than additive refinement
- users may perceive "switching templates" as disruptive
- requires explicit handling for fields that are no longer present
- can still be tricky if users want to revert to an earlier template

Template migration is stronger when the destination template is materially different, not just a slight extension.

### Option 3: Template Migration With Inactive Field Retention

This is the alternative that may give us most of the benefit with less complexity.

Model:

- a decision context still has one active template at a time
- when the user migrates to a new template, the active field set changes
- fields that do not exist in the destination template are not deleted
- those fields become inactive, hidden, or disabled
- if the user migrates back later, those fields can reappear with their prior values

This effectively treats template change as "switch visible field set" rather than "rewrite all stored data."

#### Pros

- avoids destructive data loss
- supports reversibility without requiring overlay composition
- simpler mental model than multi-overlay resolution
- makes template switching safer for experimentation
- preserves user effort even if a template turns out to be the wrong fit
- likely easier to implement than advanced conflict-capable overlays

#### Cons

- requires separating active fields from stored-but-inactive fields
- `draftData` semantics become more complex unless we explicitly model active vs inactive field values
- exports and validation must ignore inactive fields consistently
- UI must clearly show that some data exists but is outside the active template

This may be the best "middle path" if additive composition starts to look too clever for the real problem.

## A More Conservative Alternative

If additive templates become too complex, a simpler strategy may be preferable:

- keep a strong library of reusable fields
- keep templates as explicit curated field sets
- support reliable template migration between those sets
- preserve non-active field data by hiding/disabling it rather than deleting it

Under this model, the main engineering investment shifts from composition logic to migration safety.

### What This Alternative Requires

Even without overlays, we still need a few important capabilities.

#### Stable Field Identity

- fields must have stable UUIDs
- migration should preserve shared field values by matching on field UUID

Without stable field identity, migration becomes lossy or heuristic.

#### Explicit Active vs Inactive Field State

We need a clear model for:

- active fields: part of the current template
- inactive fields: stored on the context but not part of the current template

That state separation is what makes reversible template switching safe.

#### Migration Rules

We need deterministic behavior for:

- fields present in both old and new templates: preserve values
- fields only in the old template: mark inactive
- fields only in the new template: initialize empty
- locked fields missing from the new template: either keep lock metadata with the inactive field or normalize it during migration

This is much simpler than general overlay conflict resolution, but it still needs to be explicit.

#### Export And Validation Boundaries

We need all downstream systems to use the active template only.

That means:

- validation checks only active required fields
- markdown export renders only active fields by default
- inactive fields are excluded unless explicitly requested for debugging or audit

#### Reversibility Rules

If users switch back to a previous template:

- previously inactive fields should reactivate with their prior values
- the system should not regenerate or overwrite them automatically unless the user asks

This gives us safe experimentation without data loss.

## Decision Framing

The design decision is not just "which is more powerful?" It is "which gives the best user outcome for the least system complexity?"

At the moment, the tradeoff looks like this:

- additive overlays are more elegant for gradual refinement, but complexity rises fast once conflicts and removals are real
- template migration is more explicit and less magical, but can feel heavier
- template migration with inactive field retention may capture most of the practical value while avoiding the hardest composition problems

## Recommended Working Direction

For planning purposes, the current best working direction looks like:

1. Implement stable registry identity and import/export first
2. Treat field UUID preservation as the foundation for any future template-change behavior
3. Prototype template migration with inactive field retention before committing to advanced overlays
4. Only add additive overlays if we still need lighter-weight refinement after migration works well
5. If overlays are added, keep v1 strictly additive and conflict-averse

That path tests the simpler, safer mechanism first and avoids paying for composition complexity unless the product clearly needs it.

## Portability And Community Sharing

Templates should be portable because they are definitions, not one-off local records.

### Stable Identifiers

To make sharing safe:

- fields need stable UUIDs
- templates need stable UUIDs
- overlays also need stable UUIDs
- versions must be explicit

If two environments import the same package, they should resolve to the same definitions by UUID.

### Package Format

A sharable package should be able to include:

- field definitions
- field prompts and prompt metadata
- base template definitions
- overlay definitions
- template-field assignments
- overlay operations/deltas
- package metadata (name, version, author, source, compatibility)

This extends the M9.1 "template package" idea so it supports composable overlays, not only flat templates.

### Import/Export Expectations

Export should:

- include all dependent field definitions for the selected template or overlay set
- preserve UUIDs and versions
- include prompt content so the behavior is portable
- preserve template customization such as labels and descriptions

Import should:

- upsert by UUID
- validate dependency closure (required fields and referenced base templates exist or are included)
- reject incompatible definitions clearly
- allow side-by-side versioned upgrades

### Community Use

A community should be able to publish and share:

- new field packs
- domain overlays (for example: architecture review, procurement, policy, compliance)
- improved prompts for existing fields
- opinionated template bundles for specific industries or teams

The field library becomes a reusable ecosystem rather than a purely local seed set.

## Implementation Implications

This is a design direction, not an implementation commitment yet, but it implies several likely changes.

### Data Model

We will likely need explicit overlay definitions rather than treating every variation as a full template record.

Possible additions:

- `template_overlays`
- `template_overlay_field_operations`
- optional resolved-template snapshotting on `decision_contexts`

We should avoid baking full template copies into each composed variant unless we need snapshotting for audit or performance.

### Draft Generation

Prompt construction will need to resolve the active composition first, then build the field list and any overlay-specific guidance.

Important behavior:

- only newly introduced or unlocked fields should be sent for regeneration
- overlay-specific constraints should be visible in stored prompt segments
- the resolved composition should remain auditable in LLM interaction logs

### UI / CLI

The product should distinguish:

- base template
- currently applied overlays
- resulting active field set

Users should be able to:

- inspect what overlays are active
- see which fields came from which overlay
- add or remove overlays deliberately
- accept LLM-suggested overlays during iterative refinement

## Open Questions

- Should overlays be removable after fields have been populated, or only before fields are locked?
- Do we allow overlay-to-overlay dependencies, or only overlay-on-base?
- Should overlays be able to remove fields, or only add/strengthen existing requirements?
- How should version conflicts be handled if a package imports a newer field definition than the local registry?
- Do we snapshot the fully resolved template into the decision log for audit immutability, or reconstruct it from versioned definitions?
- When an overlay changes prompt behavior for an existing field, is that modeled as assignment metadata or as a new field version?
- Should the first version support only overlay addition, with no overlay removal at all?
- Should template migration and overlay composition be separate features from the start?
- Do we need archived field-value storage distinct from active `draftData` before we permit removal?
- Should overlay compatibility be enforced through explicit families/tags rather than conflict detection alone?

## Recommended Near-Term Scope

Before implementing this, we should first define the model clearly enough to avoid rework.

Suggested sequence:

1. Keep the current field-library and template model as the shipping baseline
2. Introduce stable registry UUIDs and import/export first (M9.1 core)
3. Add a formal overlay definition model after portable definitions exist
4. Update draft generation and export to resolve composed templates
5. Add overlay suggestion logic once the composition model is stable

That sequencing keeps the initial portability work compatible with the later extensibility goal.
