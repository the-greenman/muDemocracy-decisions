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
├── draft-generation.md         # Generate complete decision draft (M1)
└── experts/                    # Expert persona prompts (M6)
    ├── technical.md            # Technical architecture expert
    ├── legal.md                # Legal and compliance expert
    ├── stakeholder.md          # Stakeholder impact expert
    └── decision-detector.md    # Decision detection expert persona
```

> **Note**: `field-regeneration.md` is **not** a file in this directory. Per `docs/field-regeneration-strategy.md`, field-specific extraction prompts live in the **field library database** (`decision_fields.extraction_prompt`), not as files. Each `DecisionField` record contains its own prompt — they are data, not code, and can be updated via `pnpm db:seed` or the API without code changes.
>
> `decision-detection.md` is also removed — in M6 the detection prompt is the `decision-detector` expert persona (`prompts/experts/decision-detector.md`), not a standalone file.

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

### 1. Initial Development (M1 for draft generation, M6 for expert + detection prompts)
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

## Milestone-by-Milestone Prompt Development

### M1: Initial Prompts
- `prompts/draft-generation.md` — Generate decision draft from transcript (v1)

### M2–M4: Refinement Round 1
- Test with real transcripts
- Fix major issues
- Add edge case handling for guidance segments and field locking

### M6: Expert + Detection Prompts
- `prompts/experts/technical.md` — Technical architecture expert
- `prompts/experts/legal.md` — Legal and compliance expert
- `prompts/experts/stakeholder.md` — Stakeholder impact expert
- `prompts/experts/decision-detector.md` — Decision detection expert persona (v1)
- Measure F1 on test corpus; target Precision > 0.80, Recall > 0.75, F1 > 0.77

### M7–M8: Final Polish
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
