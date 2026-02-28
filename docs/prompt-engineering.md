# Prompt Engineering & Refinement Process

This document outlines the process for developing, testing, and refining LLM prompts throughout the project.

## Philosophy

LLM prompts are **code**. They should be:
- Version-controlled
- Testable
- Iteratively refined
- Documented

## Prompt Organization

```
prompts/
├── decision-detection.md       # Detect decisions in transcripts
├── draft-generation.md         # Generate complete decision draft
├── field-regeneration.md       # Regenerate single field
└── experts/
    ├── technical.md            # Technical expert persona
    ├── legal.md                # Legal expert persona
    └── stakeholder.md          # Stakeholder expert persona
```

## Prompt Template Format

Each prompt file follows this structure:

```markdown
# [Prompt Name] v[Version]

## Purpose
[What this prompt does]

## Input Schema
[Expected input structure]

## Output Schema
[Expected output structure - reference Zod schema]

## System Prompt
[The actual system prompt]

## User Prompt Template
[The user prompt with {{placeholders}}]

## Examples
[Example inputs and expected outputs]

## Changelog
### v2 (2026-02-28)
- Improved accuracy for edge case X
- Added constraint Y

### v1 (2026-02-27)
- Initial version
```

## Refinement Workflow

### 1. Initial Development (Phase 3)
- Create prompt based on requirements
- Implement in code with version reference
- Test with mock data

### 2. Real-World Testing
```bash
# Use CLI to test with real data
decision-logger transcript upload test-cases/complex-decision.json
decision-logger decisions flagged

# Review output
decision-logger draft generate
decision-logger draft show
```

### 3. Identify Issues
Document problems:
- False positives (flagged non-decisions)
- False negatives (missed decisions)
- Incorrect field extraction
- Hallucinations
- Format violations

### 4. Refine Prompt
- Update prompt file (increment version)
- Add examples of edge cases
- Clarify constraints
- Test again

### 5. A/B Testing (Optional)
Keep old version, test both:
```typescript
const resultV1 = await llm.generate({ prompt: promptV1, ... });
const resultV2 = await llm.generate({ prompt: promptV2, ... });
// Compare quality
```

## Testing Strategy

### Unit Tests (Mocked)
```typescript
describe('DecisionDetectionService', () => {
  it('should detect consensus decisions', async () => {
    const mock = new MockLLMService();
    mock.setResponse({ decisions: [{ title: 'Approve budget', confidence: 0.9 }] });
    const result = await service.detectDecisions(segments);
    expect(result.decisions).toHaveLength(1);
  });
});
```

### Integration Tests (Real API)
```typescript
describe('DecisionDetectionService (real LLM)', () => {
  it('should detect decision in technical transcript', async () => {
    const segments = loadFixture('technical-decision-complex.txt');
    const result = await service.detectDecisions(segments);
    
    // Assert structure
    expect(result.decisions).toBeDefined();
    expect(result.decisions[0].confidence).toBeGreaterThan(0.7);
    
    // Manual review required for quality
  });
});
```

### Manual Testing (CLI)
```bash
# Create test suite
mkdir test-cases
cp examples/technical-decision-complex.txt test-cases/

# Test each prompt
decision-logger transcript upload test-cases/technical-decision-complex.txt
decision-logger decisions flagged > output/flagged-v1.json

# After refinement
decision-logger decisions flagged > output/flagged-v2.json

# Compare
diff output/flagged-v1.json output/flagged-v2.json
```

## Quality Metrics

Track these for each prompt version:

### Decision Detection
- **Precision**: % of flagged decisions that are real decisions
- **Recall**: % of real decisions that were flagged
- **Confidence calibration**: Are high-confidence flags more accurate?

### Draft Generation
- **Completeness**: % of required fields populated
- **Accuracy**: Manual review score (1-5)
- **Consistency**: Same input → same output?

### Field Regeneration
- **Relevance**: Does regenerated field use field-specific segments?
- **Lock respect**: Are locked fields never changed?
- **Quality improvement**: Is regenerated field better than original?

## Prompt Versioning in Code

```typescript
// packages/core/src/llm/prompts.ts
import decisionDetectionV2 from '../../../prompts/decision-detection.md';

export const PROMPTS = {
  decisionDetection: {
    version: 2,
    system: decisionDetectionV2.system,
    user: decisionDetectionV2.user,
  },
  // ...
};
```

## Common Issues & Solutions

### Issue: LLM returns invalid JSON
**Solution**: Add explicit format constraints and examples to prompt

### Issue: LLM hallucinates field values
**Solution**: Add "ONLY use information from the transcript" constraint

### Issue: Confidence scores are always high
**Solution**: Add calibration examples (low, medium, high confidence scenarios)

### Issue: Field regeneration ignores field-specific segments
**Solution**: Explicitly list segment priorities in prompt

## Continuous Improvement

After each real-world usage:
1. Collect edge cases
2. Add to test suite
3. Refine prompts
4. Increment version
5. Re-test

## Phase-by-Phase Prompt Development

### Phase 3: Initial Prompts
- Decision detection (basic)
- Draft generation (basic)
- Field regeneration (basic)

### Phase 4: Refinement Round 1
- Test with real transcripts
- Fix major issues
- Add edge case handling

### Phase 5: Expert Prompts
- Develop expert personas
- Test expert advice quality
- Refine based on usefulness

### Phase 7: Final Polish
- Optimize for speed (shorter prompts)
- Optimize for cost (fewer tokens)
- Final quality pass

## Documentation

Each prompt refinement should be documented in:
1. Prompt file changelog
2. Git commit message
3. Test case demonstrating the fix

Example commit:
```
refactor(prompts): improve decision detection for implicit decisions

- Added examples of implicit consensus
- Clarified "decision" vs "discussion"
- Increased confidence threshold for edge cases

Fixes: #42 (False positive on general discussion)
Test: test-cases/implicit-consensus.txt
```
