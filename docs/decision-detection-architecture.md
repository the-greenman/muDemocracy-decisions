# Decision Detection Architecture

## Core Challenge

Decision detection is the **most critical** LLM task in the system. It must catch:

1. **Explicit decisions**: "We decided to use PostgreSQL"
2. **Implicit decisions**: "I want alignment" → decision to delay
3. **Negative decisions**: "I don't like these options" → decision to reject current options
4. **Non-action decisions**: "Let's wait and see" → decision to defer
5. **Consensus by silence**: No objections raised → implicit approval
6. **Redirections**: "Let's focus on X instead" → decision to deprioritize Y

**The hardest cases are decisions NOT to act** - these are often the most important to document.

## Prompt Management

### Storage Location

The decision detection prompt is **NOT** stored in the field library. It's a special system prompt stored separately:

```
prompts/
├── decision-detection.md           # System prompt for decision detection
└── templates/
    ├── standard-decision.json
    └── ...
```

**Why separate?**
- Decision detection is a **meta-operation** (finds decisions, doesn't extract fields)
- It needs to classify decision types and suggest templates
- It's versioned independently from field extraction prompts
- It's loaded once per transcript upload, not per field

### Prompt Structure

```markdown
# Decision Detection System Prompt v3

## Your Task

Analyze this meeting transcript and identify **all decisions**, including:
- Explicit decisions ("We decided...")
- Implicit decisions (choosing to delay, redirect, or not act)
- Negative decisions (rejecting options)
- Consensus by silence (no objections = approval)

**Critical**: A decision to NOT act is still a decision. Document it.

## Decision Patterns

### Explicit Decisions
- "We decided to..."
- "Let's go with..."
- "Approved"
- "The committee votes to..."

### Implicit Decisions (CRITICAL TO CATCH)

#### Decision to Delay/Defer
**Indicators**: "I want alignment", "Let's wait", "Not ready yet", "Need more information"
**What it means**: Decision to NOT proceed now
**Example**:
  Input: "I think we need more alignment before moving forward"
  Output: Decision to defer action pending stakeholder alignment

#### Decision to Reject
**Indicators**: "I don't like these options", "None of these work", "We need better alternatives"
**What it means**: Decision to reject current options and seek new ones
**Example**:
  Input: "These options don't address the core problem"
  Output: Decision to reject proposed options and revisit problem definition

#### Decision to Redirect
**Indicators**: "Let's focus on X instead", "Y is more important", "We should prioritize Z"
**What it means**: Decision to deprioritize current topic in favor of another
**Example**:
  Input: "I think we should focus on the user experience first, not the tech stack"
  Output: Decision to prioritize UX over technical decisions

#### Decision by Silence/Consensus
**Indicators**: Proposal made, no objections raised, discussion moves on
**What it means**: Implicit approval
**Example**:
  Input: 
    [12] Alice: "I propose we use the standard template for all decisions"
    [13] Bob: "Sounds good"
    [14] Carol: "When should we start?"
  Output: Decision to adopt standard template (consensus by lack of objection)

#### Decision to Continue Current Path
**Indicators**: "Let's keep doing what we're doing", "No changes needed", "Status quo works"
**What it means**: Explicit decision to maintain current state
**Example**:
  Input: "I think our current process is working fine, no need to change"
  Output: Decision to maintain current process

### Boundary Cases (NOT Decisions)

**Discussion without resolution**:
- "What do you think about X?" (question, not decision)
- "I'm concerned about Y" (concern, not decision)
- "We should consider Z" (suggestion, not decision)

**Future possibilities**:
- "Maybe we could..." (speculation, not commitment)
- "It would be nice if..." (wish, not decision)

**Information sharing**:
- "The budget is $50k" (fact, not decision)
- "The deadline is Friday" (constraint, not decision)

## Decision Classification

For each decision, determine the most appropriate template:

### Technology Selection
**Indicators**: Choosing tools, frameworks, platforms, vendors, technical approaches
**Examples**: "Use PostgreSQL", "Switch to React", "Deploy on AWS"

### Strategy Decision
**Indicators**: Direction-setting, priorities, long-term planning, focus areas
**Examples**: "Focus on mobile-first", "Prioritize growth over profitability", "Target enterprise customers"

### Budget Approval
**Indicators**: Financial decisions, spending authorization, budget allocation
**Examples**: "Approve $50k for marketing", "Allocate budget to hiring"

### Policy Change
**Indicators**: Rules, procedures, governance, compliance changes
**Examples**: "Update remote work policy", "Require code reviews"

### Proposal Acceptance
**Indicators**: Yes/no on submitted proposals, voting on recommendations
**Examples**: "Approve Alice's proposal", "Reject the vendor's offer"

### Standard Decision (fallback)
**Use when**: Decision doesn't clearly fit other categories

## Output Format

For each decision, provide:

```typescript
{
  suggestedTitle: string;        // Brief title (5-10 words)
  contextSummary: string;        // 1-2 sentence summary
  confidence: number;            // 0-1: how confident this is a decision
  segmentIds: string[];          // Which segments discuss this
  suggestedTemplateId: string;   // One of: standard-decision, technology-selection, etc.
  templateConfidence: number;    // 0-1: how confident in template choice
}
```

## Confidence Scoring

### Decision Confidence (is this a decision?)
- **0.9-1.0**: Explicit decision with clear outcome ("We decided to use X")
- **0.7-0.9**: Implicit decision with strong indicators ("I want alignment" = defer)
- **0.5-0.7**: Weak decision or consensus by silence
- **0.3-0.5**: Borderline (might be discussion, not decision)
- **0.0-0.3**: Probably not a decision (filter these out)

### Template Confidence (which template fits?)
- **0.9-1.0**: Perfect fit (technology decision → technology-selection)
- **0.7-0.9**: Good fit with minor ambiguity
- **0.5-0.7**: Moderate fit, could be multiple templates
- **0.3-0.5**: Weak fit, default to standard-decision
- **0.0-0.3**: No clear fit, use standard-decision

## Examples

### Example 1: Implicit Decision to Defer
**Input**:
```
[15] Alice: "I think we need more alignment before committing to this approach"
[16] Bob: "Yeah, let's revisit this next week"
[17] Carol: "Agreed, I need to talk to the stakeholders first"
```

**Output**:
```json
{
  "suggestedTitle": "Defer architecture decision pending stakeholder alignment",
  "contextSummary": "Team decided to postpone architecture decision until stakeholders are consulted and alignment is achieved.",
  "confidence": 0.85,
  "segmentIds": ["15", "16", "17"],
  "suggestedTemplateId": "standard-decision",
  "templateConfidence": 0.75
}
```

### Example 2: Implicit Decision to Reject Options
**Input**:
```
[22] Alice: "I don't think any of these options address the core problem"
[23] Bob: "You're right, we need to go back to the drawing board"
[24] Carol: "Let's reframe the problem first"
```

**Output**:
```json
{
  "suggestedTitle": "Reject proposed options and reframe problem",
  "contextSummary": "Team decided that current options are inadequate and chose to revisit problem definition before evaluating solutions.",
  "confidence": 0.88,
  "segmentIds": ["22", "23", "24"],
  "suggestedTemplateId": "standard-decision",
  "templateConfidence": 0.70
}
```

### Example 3: Decision to Redirect Focus
**Input**:
```
[30] Alice: "Before we pick a database, shouldn't we finalize the data model?"
[31] Bob: "Good point, let's focus on that first"
[32] Carol: "Agreed, database choice depends on the model"
```

**Output**:
```json
{
  "suggestedTitle": "Prioritize data model design over database selection",
  "contextSummary": "Team decided to defer database selection and focus on finalizing the data model first, as database choice depends on model requirements.",
  "confidence": 0.82,
  "segmentIds": ["30", "31", "32"],
  "suggestedTemplateId": "strategy-decision",
  "templateConfidence": 0.65
}
```

### Example 4: Explicit Technology Decision
**Input**:
```
[45] Alice: "After evaluating PostgreSQL and MongoDB, I recommend PostgreSQL"
[46] Bob: "The ACID guarantees are important for us"
[47] Carol: "Agreed, let's go with PostgreSQL"
```

**Output**:
```json
{
  "suggestedTitle": "Select PostgreSQL as primary database",
  "contextSummary": "Team decided to use PostgreSQL over MongoDB, prioritizing ACID guarantees and relational data integrity.",
  "confidence": 0.95,
  "segmentIds": ["45", "46", "47"],
  "suggestedTemplateId": "technology-selection",
  "templateConfidence": 0.98
}
```

### Example 5: NOT a Decision (Discussion Only)
**Input**:
```
[50] Alice: "What do you think about using microservices?"
[51] Bob: "I'm concerned about the operational complexity"
[52] Carol: "We should consider it, but I'm not sure we're ready"
```

**Output**:
```json
[]
```
**Reason**: This is discussion and concern-raising, not a decision. No resolution or commitment.

## Edge Cases

### Multiple Decisions in One Discussion
If a single discussion contains multiple distinct decisions, flag each separately:

**Input**:
```
[60] Alice: "Let's use PostgreSQL for the database"
[61] Bob: "Agreed"
[62] Alice: "And we'll deploy on AWS"
[63] Carol: "Sounds good"
```

**Output**: TWO decisions
1. "Select PostgreSQL as database" (technology-selection)
2. "Deploy on AWS" (technology-selection)

### Decision Reversal
If a decision is made and then reversed in the same meeting, flag BOTH:

**Input**:
```
[70] Alice: "Let's go with option A"
[71] Bob: "Wait, I just realized option B is better because..."
[72] Carol: "You're right, let's do B instead"
```

**Output**: TWO decisions
1. "Select option A" (confidence: 0.6, reversed)
2. "Select option B" (confidence: 0.9, final)

### Conditional Decisions
If a decision is contingent on something, still flag it:

**Input**:
```
[80] Alice: "If the budget is approved, we'll hire two engineers"
[81] Bob: "Agreed, that's the plan"
```

**Output**:
```json
{
  "suggestedTitle": "Hire two engineers if budget approved",
  "contextSummary": "Team decided to hire two engineers, contingent on budget approval.",
  "confidence": 0.75,
  "segmentIds": ["80", "81"],
  "suggestedTemplateId": "standard-decision",
  "templateConfidence": 0.60
}
```

## Prompt Refinement Process

### Version History

**v1 (Initial)**: Basic decision detection, missed implicit decisions
**v2 (Refinement)**: Added implicit decision patterns, improved confidence scoring
**v3 (Current)**: Enhanced negative decision detection, added "decision not to act" emphasis

### Testing Strategy

1. **Create test corpus** of transcripts with known decisions
2. **Run detection** and compare to ground truth
3. **Calculate metrics**:
   - Precision: % of flagged items that are real decisions
   - Recall: % of real decisions that were flagged
   - F1 score: Harmonic mean of precision and recall
4. **Identify failure patterns**
5. **Refine prompt** with new examples
6. **Re-test** and compare metrics

### Test Cases (Minimum Set)

```
test-cases/
├── explicit-decisions.json          # Clear, unambiguous decisions
├── implicit-defer.json              # "I want alignment" patterns
├── implicit-reject.json             # "I don't like these options" patterns
├── implicit-redirect.json           # "Let's focus on X instead" patterns
├── consensus-by-silence.json        # No objections = approval
├── discussion-not-decision.json     # Should NOT be flagged
├── multiple-decisions.json          # Multiple decisions in one discussion
└── decision-reversal.json           # Decision made then changed
```

## Implementation

### Service Layer

```typescript
// packages/core/src/services/decision-detection.service.ts
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { FlaggedDecisionsSchema } from '@repo/schema';
import decisionDetectionPrompt from '../../../prompts/decision-detection.md';

export class DecisionDetectionService {
  async detectDecisions(
    meetingId: string,
    segments: TranscriptSegment[]
  ): Promise<FlaggedDecision[]> {
    // Load current version of decision detection prompt
    const prompt = await this.loadPrompt('decision-detection', 'v3');
    
    const { object } = await generateObject({
      model: anthropic('claude-3-5-sonnet-latest'),
      schema: FlaggedDecisionsSchema,
      system: prompt.system,
      prompt: this.buildTranscriptPrompt(segments)
    });
    
    // Filter low-confidence decisions (< 0.5)
    const decisions = object.decisions.filter(d => d.confidence >= 0.5);
    
    // Persist to database
    return await this.flaggedDecisionRepo.createMany(
      decisions.map(d => ({
        ...d,
        meetingId,
        status: 'pending'
      }))
    );
  }
  
  private buildTranscriptPrompt(segments: TranscriptSegment[]): string {
    return `
Transcript:
${segments.map(s => `[${s.sequenceNumber}] ${s.speaker}: ${s.text}`).join('\n')}

Analyze this transcript and identify ALL decisions, including implicit decisions, decisions not to act, and decisions to defer or reject.
    `.trim();
  }
  
  private async loadPrompt(name: string, version: string) {
    // Load from file or database
    // For now, hardcoded in code
    return {
      system: decisionDetectionPrompt.system,
      version: 3
    };
  }
}
```

### CLI Workflow

```bash
# Upload transcript
decision-logger transcript upload meeting-transcript.json

# LLM automatically detects decisions
# Output:
# Analyzing transcript for decisions...
# Found 3 decisions:
#   1. [0.89] Defer architecture decision pending alignment (segments 15-17)
#   2. [0.85] Reject current options and reframe problem (segments 22-24)
#   3. [0.95] Select PostgreSQL as database (segments 45-47)

# Review flagged decisions
decision-logger decisions flagged
# 1. [0.89] Defer architecture decision pending alignment
#    Template: Standard Decision (confidence: 0.75)
#    Segments: 15-17
# 2. [0.85] Reject current options and reframe problem
#    Template: Standard Decision (confidence: 0.70)
#    Segments: 22-24
# 3. [0.95] Select PostgreSQL as database
#    Template: Technology Selection (confidence: 0.98)
#    Segments: 45-47

# User can dismiss false positives
decision-logger decision dismiss flag_1

# Or start working on a decision
decision-logger context set-decision flag_2
decision-logger draft generate
```

### Prompt Refinement Workflow

```bash
# Test current prompt version
pnpm test:llm -- --grep="decision detection"

# Results:
# Precision: 0.82 (18/22 flagged items were real decisions)
# Recall: 0.75 (18/24 real decisions were flagged)
# F1: 0.78

# Identify failures
# - Missed: "Let's table this for now" (implicit defer)
# - Missed: "I'm not comfortable with any of these" (implicit reject)
# - False positive: "We could consider X" (speculation, not decision)

# Update prompt (add examples)
vim prompts/decision-detection.md
# Increment version to v4
# Add "table this" pattern to implicit defer section
# Add "not comfortable with" pattern to implicit reject section
# Add "we could consider" to NOT decision examples

# Re-test
pnpm test:llm -- --grep="decision detection"

# Results:
# Precision: 0.88 (21/24 flagged items were real decisions)
# Recall: 0.84 (21/25 real decisions were flagged)
# F1: 0.86 (improved!)

# Commit
git add prompts/decision-detection.md
git commit -m "refactor(prompts): improve implicit decision detection (v3→v4)

- Added 'table this' pattern for defer decisions
- Added 'not comfortable' pattern for reject decisions  
- Clarified speculation vs decision boundary
- F1 score: 0.78 → 0.86"
```

## Key Insights

1. **Decisions not to act are decisions** - Document them explicitly
2. **Implicit decisions are harder to detect** - Require more examples and patterns
3. **Confidence scoring is critical** - Filter out low-confidence false positives
4. **Template suggestion is secondary** - User can always override
5. **Prompt versioning is essential** - Track improvements over time
6. **Test-driven refinement** - Use real transcripts to measure quality
7. **Edge cases matter** - Decision reversals, conditional decisions, multiple decisions

## Success Metrics

**Target metrics** (after prompt refinement):
- **Precision**: >0.85 (few false positives)
- **Recall**: >0.80 (catch most real decisions)
- **F1 Score**: >0.82 (balanced performance)

**User satisfaction**:
- Users dismiss <20% of flagged decisions (low false positive rate)
- Users manually flag <10% of missed decisions (high recall)
