# Field Regeneration Strategy

**Status**: authoritative
**Owns**: field regeneration behavior, prompt-source rules, field-specific weighting and regeneration flow
**Must sync with**: `packages/schema`, `docs/field-library-architecture.md`, `docs/PLAN.md`, `docs/iterative-implementation-plan.md`

## Architecture Decision: Field-Specific Prompts

When regenerating a single field, we use **field-specific prompts** rather than a shared prompt with focus instructions.

## Rationale

### 1. Token Efficiency
**Shared Prompt Approach** (rejected):
```typescript
// Generates ALL fields, discards most
const draft = await generateDraft(contextId); // 500 tokens output
return draft.fields[fieldId]; // Use 50 tokens, waste 450
```

**Field-Specific Approach** (chosen):
```typescript
// Generates ONLY the needed field
const value = await regenerateField(contextId, fieldId); // 50 tokens output
return value; // Use all 50 tokens
```

**Cost savings**: ~80% fewer output tokens per regeneration.

### 2. Prompt Clarity
Different fields require different extraction strategies:

```markdown
# prompts/fields/decision_statement.md
Extract a single, clear statement of the decision being made.
Format: One sentence, active voice.
Example: "Approve £45,000 budget for roof replacement"

# prompts/fields/options.md
Extract all available options discussed.
Format: Numbered list with brief description.
Include trade-offs if mentioned.

# prompts/fields/assumptions.md
Extract underlying assumptions.
Focus on unstated premises and preconditions.
Ignore explicit facts.
```

### 3. Segment Weighting
Field-specific regeneration uses prioritized segments:

```typescript
async function regenerateField(contextId: string, fieldId: string) {
  // 1. Field-specific segments (highest priority)
  const fieldSegments = await getSegmentsByContext(`decision:${contextId}:${fieldId}`);
  
  // 2. Decision-wide segments (medium priority)
  const decisionSegments = await getSegmentsByContext(`decision:${contextId}`);
  
  // 3. Meeting-wide segments (lowest priority)
  const meetingSegments = await getSegmentsByContext(`meeting:${meetingId}`);
  
  // Weight by recency and specificity
  const weightedSegments = [
    ...fieldSegments.map(s => ({ ...s, weight: 3 })),
    ...decisionSegments.map(s => ({ ...s, weight: 2 })),
    ...meetingSegments.map(s => ({ ...s, weight: 1 }))
  ].sort((a, b) => b.weight - a.weight || b.sequenceNumber - a.sequenceNumber);
  
  // Generate using field-specific prompt
  return await llm.generateField(fieldId, weightedSegments);
}
```

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
```typescript
{
  id: "options",
  name: "Options",
  extractionPrompt: {
    system: "List all options discussed. Include brief description of each.",
    examples: [...],
    constraints: ["Format as numbered list", "Include pros/cons if mentioned"]
  }
}
```

## Implementation

### Service Layer
```typescript
// packages/core/src/services/draft-generation.service.ts
export class DraftGenerationService {
  async generateDraft(contextId: string): Promise<Record<string, string>> {
    // Use draft-generation.md prompt
    // Generates ALL fields at once (initial draft only)
    const context = await this.contextRepo.findById(contextId);
    const segments = await this.getRelevantSegments(contextId);
    
    const { object } = await generateObject({
      model: anthropic('claude-3-5-sonnet-latest'),
      schema: DecisionDraftSchema,
      system: PROMPTS.draftGeneration.system,
      prompt: PROMPTS.draftGeneration.user({ segments, template })
    });
    
    return object.fields;
  }
  
  async regenerateField(
    contextId: string, 
    fieldId: string
  ): Promise<string> {
    // Use field-specific prompt from prompts/fields/{fieldId}.md
    const context = await this.contextRepo.findById(contextId);
    const segments = await this.getWeightedSegments(contextId, fieldId);
    const template = await this.templateRepo.findById(context.templateId);
    const field = template.fields.find(f => f.id === fieldId);
    
    const { object } = await generateObject({
      model: anthropic('claude-3-5-sonnet-latest'),
      schema: z.object({ value: z.string() }),
      system: PROMPTS.fields[fieldId].system,
      prompt: PROMPTS.fields[fieldId].user({ 
        segments, 
        field,
        currentValue: context.draftData[fieldId] 
      })
    });
    
    return object.value;
  }
  
  async regenerateDraft(contextId: string): Promise<Record<string, string>> {
    // Regenerate ONLY unlocked fields
    const context = await this.contextRepo.findById(contextId);
    const template = await this.templateRepo.findById(context.templateId);
    
    const newDraft = { ...context.draftData };
    
    for (const field of template.fields) {
      // Skip locked fields
      if (context.lockedFields[field.id]) {
        continue;
      }
      
      // Regenerate unlocked field
      newDraft[field.id] = await this.regenerateField(contextId, field.id);
    }
    
    return newDraft;
  }
}
```

### Field Prompt Loading
```typescript
// packages/core/src/services/draft-generation.service.ts
export class DraftGenerationService {
  constructor(
    private readonly fieldRepo: IDecisionFieldRepository,
    // ...
  ) {}
  
  async regenerateField(contextId: string, fieldId: string): Promise<string> {
    // Load field definition from database (includes prompt)
    const field = await this.fieldRepo.findById(fieldId);
    
    // Field contains its own extraction prompt
    const { object } = await generateObject({
      model: anthropic('claude-3-5-sonnet-latest'),
      schema: z.object({ value: z.string() }),
      system: field.extractionPrompt.system,
      prompt: this.buildPrompt(field, segments)
    });
    
    return object.value;
  }
}
```

Prompts are **data**, not code. They live in the database and can be updated without code changes.

## Testing Strategy

### Unit Tests (Mocked)
```typescript
describe('DraftGenerationService', () => {
  it('should regenerate only unlocked fields', async () => {
    const context = {
      draftData: { 
        decision_statement: 'Old statement',
        options: 'Old options' 
      },
      lockedFields: { 
        decision_statement: { value: 'Old statement', lockedAt: new Date() } 
      }
    };
    
    const mock = new MockLLMService();
    mock.setFieldResponse('options', 'New options');
    
    const result = await service.regenerateDraft(contextId);
    
    expect(result.decision_statement).toBe('Old statement'); // Unchanged
    expect(result.options).toBe('New options'); // Regenerated
  });
});
```

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
   cat prompts/fields/options.md
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
   git add prompts/fields/options.md
   git commit -m "refactor(prompts): improve options field extraction"
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
