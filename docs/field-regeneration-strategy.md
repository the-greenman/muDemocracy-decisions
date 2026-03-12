# Field Regeneration Strategy

**Status**: authoritative
**Owns**: field regeneration behavior, prompt-source rules, field-specific weighting and regeneration flow
**Must sync with**: `packages/schema`, `docs/field-library-architecture.md`, `docs/decision-feedback-architecture.md`, `docs/OVERVIEW.md`, `docs/plans/iterative-implementation-plan.md`

## Architecture Decision: Field-Specific Prompts

When regenerating a single field, we use **field-specific prompts** rather than a shared prompt with focus instructions.

## Rationale

### 1. Token Efficiency
**Shared Prompt Approach** (rejected):
- generate the full draft
- discard most of the returned content
- pay unnecessary token cost

**Field-Specific Approach** (chosen):
- generate only the requested field
- use field-specific prompt guidance
- return only the value needed for that field

**Cost savings**: ~80% fewer output tokens per regeneration.

### 2. Prompt Clarity
Different fields require different extraction strategies:

Canonical prompt structure belongs to the field-library definitions in `packages/schema` and the persisted field records, not to this document.

This document only owns the rule that regeneration must use field-specific extraction guidance, for example:

- `decision_statement` emphasizes a clear single decision statement
- `options` emphasizes enumerating alternatives and tradeoffs
- `assumptions` emphasizes unstated premises and preconditions

### 3. Segment Weighting
Field-specific regeneration uses prioritized segments:

- field-tagged transcript evidence has highest priority
- decision-context evidence has medium priority
- meeting-wide evidence has lower priority
- recency and specificity should both influence ordering

See:

- `docs/context-tagging-strategy.md`
- `docs/transcript-context-management.md`
- `docs/plans/iterative-implementation-plan.md` (`M4.1`, `M4.2`)

## Prompt Organization

Field prompts are stored in the **field library** (database), not as separate files:

```
prompts/
├── decision-detection.md       # Detect decisions + suggest template
└── templates/
    ├── standard-decision.json      # Template definitions (field references)
    ├── technology-selection.json
    ├── budget-approval.json
    └── ...
```

Each `DecisionField` in the database contains its own `extractionPrompt`:

For the exact field structure, use the canonical field schema in `packages/schema/src/index.ts` and the field-library semantics in `docs/field-library-architecture.md`.

## Implementation

### Service Layer
The canonical implementation lives in core services, not in this document.

Use these sources for exact implementation details:

- `packages/core/src/services/draft-generation-service.ts`
- `docs/plans/iterative-implementation-plan.md`

This document owns the behavioral contract:

- initial draft generation may generate multiple fields together
- field regeneration must use field-specific prompt guidance
- full regenerate must process unlocked fields only
- locked fields must remain unchanged
- field-specific transcript evidence should outrank broader decision/meeting evidence
- regeneration uses the **persisted feedback chain** — no ad-hoc guidance in the request body (see below)
- field identity is UUID-based across schema, persistence, APIs, and prompt assembly; symbolic field names may appear in rendered prompt text, but not as identifiers

### Field Prompt Loading

Field prompt loading should follow these rules:

- load the canonical field definition from the field library
- use the field's own extraction guidance
- preserve template-level guidance as the statement of template intent, with field extraction guidance refining that intent per field
- avoid template-local prompt duplication
- keep prompts as data rather than hardcoded service logic

Prompts are **data**, not code. They live in the database and can be updated without code changes.

## Feedback Chain

The former `GuidanceSegment[]` mechanism (transient, per-request, not persisted) has been replaced by the **structured feedback chain**.

Feedback does not replace template guidance.

Template guidance expresses the canonical intent behind the active template and its fields.
Feedback expresses contextual steering toward that intent for the current decision context, draft version, or field instance.

Key behavioral rules:

- `DraftGenerationService` assembles prompts from multiple prompt sources: transcript evidence, supplementary content, template guidance, feedback chain, and field extraction instructions
- `DraftGenerationService` fetches the feedback chain from the database automatically before building any prompt
- No `guidance` parameter exists on any regeneration endpoint or service method
- Template guidance remains present during both full-draft generation and field regeneration
- The feedback chain is rendered into the LLM prompt after supplementary content and before the field extraction block
- Field-specific feedback (non-null `fieldId`) is placed before whole-draft feedback in field regeneration, following the same priority model as transcript chunk weighting
- Items with `excludeFromRegeneration = true` are omitted from the prompt but preserved in the chain

See `docs/decision-feedback-architecture.md` for the complete feedback model, persistence layer, API surface, and MCP tool definitions.

## Testing Strategy

### Unit Tests (Mocked)

Core test coverage should prove at least:

- locked fields are not regenerated
- field-specific evidence outranks broader context evidence
- field assignment is validated against the active template
- failed persistence does not silently succeed
- full regenerate processes each unlocked target independently

### Manual Testing (CLI)
```bash
# Test field-specific regeneration
decision-logger context set-decision flag_1
decision-logger draft generate
decision-logger draft show

# Lock one field
decision-logger draft lock-field decision_statement

# Add field-specific content
decision-logger context set-field options
decision-logger transcript add --speaker Alice --text "We have three options: A, B, and C"

# Regenerate - should only change options
decision-logger draft regenerate
decision-logger draft show
# Verify: decision_statement unchanged, options updated
```

## Prompt Refinement Workflow

When a specific field generates poor results:

1. **Identify the problem field**
   ```bash
   decision-logger draft show
   # Notice "options" field is incomplete
   ```

2. **Review the prompt**
   ```bash
   inspect the field-library definition for the field prompt
   ```

3. **Refine the prompt**
   - Add examples
   - Clarify constraints
   - Increment version

4. **Test with CLI**
   ```bash
   decision-logger draft unlock-field options
   decision-logger draft regenerate
   decision-logger draft show
   # Better results?
   ```

5. **Commit**
   ```bash
   git add packages/schema docs/field-library-architecture.md
   git commit -m "refactor(field-library): improve options extraction guidance"
   ```

## Benefits Summary

✅ **80% token savings** on field regeneration  
✅ **Clear, focused prompts** per field  
✅ **Easy to refine** individual fields  
✅ **Precise validation** (single field schema)  
✅ **Better segment weighting** (field-specific context)  
✅ **Simpler debugging** (one prompt = one field)  

## Alternative Considered: Shared Prompt

**Why rejected**:
- Wastes tokens generating fields you discard
- Confusing instruction: "generate all but focus on one"
- Hard to give field-specific guidance
- Difficult to debug which instruction failed
- No cost benefit (same input tokens, more output tokens)
