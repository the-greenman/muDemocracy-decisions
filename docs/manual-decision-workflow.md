# Manual Decision Creation and Management Workflow

**Status**: authoritative
**Owns**: manual flagged-decision workflow, triage/prioritization behavior, flagged-decision management APIs and CLI
**Must sync with**: `packages/schema`, `docs/PLAN.md`, `docs/iterative-implementation-plan.md`

## Overview

In addition to AI-flagged decisions, users can manually identify and create decisions from transcript segments. This document describes the complete workflow for manual decision creation, refinement, prioritization, and management.

## Use Cases

### 1. Manual Decision Identification
**Scenario:** You're reviewing a past transcript and identify a decision that the AI missed.

```bash
# Upload transcript from past meeting
decision-logger transcript upload --file past-meeting.txt

# Review segments
decision-logger transcript list

# Manually flag a decision
decision-logger decisions flag \
  --title "Which platform should we adopt?" \
  --segments seg-1,seg-2,seg-3 \
  --priority 8 \
  --created-by "Alice"
```

**API:**
```http
POST /api/meetings/{meetingId}/flagged-decisions
{
  "title": "Which platform should we adopt?",
  "contextSummary": "Discussion about platform migration options",
  "segmentIds": ["seg-1", "seg-2", "seg-3"],
  "priority": 8,
  "createdBy": "Alice"
}
```

### 2. Refining AI-Flagged Decisions
**Scenario:** AI flags multiple decisions, but some need refinement before processing.

```bash
# Get AI-flagged decisions
decision-logger decisions flagged

# Output:
# 1. [AI, priority: 0, confidence: 0.85] "Approve budget increase"
# 2. [AI, priority: 0, confidence: 0.72] "Change meeting schedule"
# 3. [AI, priority: 0, confidence: 0.91] "Hire new contractor"

# Refine decision #2 - update title and context
decision-logger decisions update flagged-2 \
  --title "Move weekly meetings to Thursdays" \
  --context "Team prefers Thursday afternoons"

# Update priority for decision #3
decision-logger decisions priority flagged-3 --priority 10
```

**API:**
```http
PATCH /api/flagged-decisions/{flaggedId}
{
  "title": "Move weekly meetings to Thursdays",
  "contextSummary": "Team prefers Thursday afternoons"
}

PATCH /api/flagged-decisions/{flaggedId}/priority
{
  "priority": 10
}
```

### 3. Dismissing False Positives
**Scenario:** AI flags something that isn't actually a decision.

```bash
# Dismiss decision
decision-logger decisions dismiss flagged-2

# Or delete it
decision-logger decisions delete flagged-2
```

**API:**
```http
DELETE /api/flagged-decisions/{flaggedId}
# Sets status to 'dismissed'
```

### 4. Prioritizing Decisions
**Scenario:** Multiple decisions pending, need to prioritize which to process first.

```bash
# Get all pending decisions sorted by priority
decision-logger decisions flagged \
  --status pending \
  --sort-by priority

# Set priorities
decision-logger decisions priority flagged-1 --priority 10  # Most important
decision-logger decisions priority flagged-2 --priority 5   # Medium
decision-logger decisions priority flagged-3 --priority 1   # Low

# Now list again - they'll be sorted
decision-logger decisions flagged --status pending
```

**API:**
```http
GET /api/meetings/{meetingId}/flagged-decisions?status=pending&sortBy=priority

# Returns decisions sorted by priority (highest first)
```

## Complete Workflow

### Step 1: Upload Transcript

```bash
decision-logger transcript upload meeting-123 --file transcript.txt
```

### Step 2: Review Flagged Decisions

```bash
# Get all flagged decisions (AI + manual)
decision-logger decisions flagged

# Filter by source
decision-logger decisions flagged --source ai
decision-logger decisions flagged --source manual

# Sort by different criteria
decision-logger decisions flagged --sort-by priority
decision-logger decisions flagged --sort-by confidence
decision-logger decisions flagged --sort-by createdAt
```

### Step 3: Refine Decisions

**Option A: Update existing flagged decision**
```bash
decision-logger decisions update flagged-1 \
  --title "Updated title" \
  --context "More detailed context" \
  --priority 7
```

**Option B: Manually create new decision**
```bash
decision-logger decisions flag meeting-123 \
  --title "New decision question" \
  --segments seg-10,seg-11,seg-12 \
  --priority 5 \
  --created-by "Bob"
```

**Option C: Dismiss unwanted decisions**
```bash
decision-logger decisions dismiss flagged-2
```

### Step 4: Prioritize

```bash
# Set priorities for all pending decisions
decision-logger decisions priority flagged-1 --priority 10
decision-logger decisions priority flagged-3 --priority 8
decision-logger decisions priority flagged-5 --priority 3

# View prioritized list
decision-logger decisions flagged meeting-123 \
  --status pending \
  --sort-by priority
```

### Step 5: Process Decisions in Priority Order

```bash
# Start with highest priority
decision-logger context set-decision meeting-123 flagged-1

# Generate draft
decision-logger draft generate

# ... work through decision workflow ...

# Move to next priority
decision-logger context set-decision meeting-123 flagged-3
```

## API Endpoints Summary

### Flagged Decision Management

```yaml
# List flagged decisions
GET /api/meetings/{meetingId}/flagged-decisions
  ?status=pending|active|logged|dismissed
  &source=ai|manual
  &sortBy=priority|createdAt|confidence

# Manually create flagged decision
POST /api/meetings/{meetingId}/flagged-decisions
  Body: {title, contextSummary, segmentIds, priority, createdBy}

# Get specific flagged decision
GET /api/flagged-decisions/{flaggedId}

# Update flagged decision details
PATCH /api/flagged-decisions/{flaggedId}
  Body: {title, contextSummary, priority, segmentIds}

# Update priority only
PATCH /api/flagged-decisions/{flaggedId}/priority
  Body: {priority}

# Dismiss decision
DELETE /api/flagged-decisions/{flaggedId}
```

## Database Schema

```sql
CREATE TABLE flagged_decisions (
  id UUID PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  suggested_title TEXT NOT NULL,
  context_summary TEXT,
  confidence INTEGER,  -- 0-100, null for manual
  segment_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, active, logged, dismissed
  source TEXT NOT NULL DEFAULT 'ai',       -- ai, manual
  priority INTEGER DEFAULT 0,              -- Higher = more important
  created_by TEXT,                         -- User who manually created it
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flagged_meeting ON flagged_decisions(meeting_id);
CREATE INDEX idx_flagged_status ON flagged_decisions(status) WHERE status = 'pending';
CREATE INDEX idx_flagged_priority ON flagged_decisions(priority) WHERE status = 'pending';
```

## UI Workflow Example

### Decision Management Screen

```
┌─────────────────────────────────────────────────────────────┐
│ Meeting: Housing Coop Committee - Feb 2026                  │
│ Flagged Decisions (5 pending)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Sort by: Priority ▼] [Filter: All ▼]                      │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🔴 Priority 10 | AI | Confidence: 91%                │   │
│ │ "Approve roof repair budget"                          │   │
│ │ Segments: 15-22 | Created: 2h ago                     │   │
│ │ [Process] [Edit] [Dismiss] [Priority: 10 ▼]         │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🟡 Priority 8 | Manual | Created by: Alice           │   │
│ │ "Which platform should we adopt?"                     │   │
│ │ Segments: 45-52 | Created: 1h ago                     │   │
│ │ [Process] [Edit] [Dismiss] [Priority: 8 ▼]          │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 🟢 Priority 5 | AI | Confidence: 72%                 │   │
│ │ "Change meeting schedule"                             │   │
│ │ Segments: 8-10 | Created: 3h ago                      │   │
│ │ [Process] [Edit] [Dismiss] [Priority: 5 ▼]          │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ [+ Flag New Decision]                                       │
└─────────────────────────────────────────────────────────────┘
```

### Manual Decision Creation Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ Flag New Decision                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Decision Title/Question:                                     │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Which platform should we adopt?                       │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Context Summary (optional):                                  │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Team discussed migration from current platform to     │   │
│ │ either Salesforce or HubSpot. Budget concerns raised. │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Related Transcript Segments:                                 │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [x] Segment 45: "We need to decide on a platform..." │   │
│ │ [x] Segment 46: "Salesforce is expensive but..."     │   │
│ │ [x] Segment 47: "HubSpot has better integration..."  │   │
│ │ [ ] Segment 48: "Let's table this for now..."        │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Priority: [5 ▼]                                             │
│                                                              │
│ Created by: [Alice                    ]                     │
│                                                              │
│ [Cancel] [Flag Decision]                                    │
└─────────────────────────────────────────────────────────────┘
```

## Best Practices

### 1. Use Priorities Effectively
- **10**: Critical decisions that block other work
- **7-9**: Important decisions to process soon
- **4-6**: Standard priority
- **1-3**: Low priority, process when time allows
- **0**: Default for AI-flagged (triage needed)

### 2. Refine AI Flags Before Processing
Review AI-flagged decisions and:
- Update titles to be clearer questions
- Add context summaries
- Adjust segment associations
- Set appropriate priorities

### 3. Dismiss False Positives Quickly
Don't let false positives clutter your decision list. Dismiss them immediately.

### 4. Use Manual Flagging for Past Transcripts
When reviewing historical transcripts, manually flag decisions that need to be formally logged.

### 5. Batch Prioritization
After uploading a transcript and reviewing AI flags:
1. Dismiss obvious false positives
2. Refine unclear decisions
3. Set priorities for all remaining
4. Process in priority order

## CLI Command Reference

```bash
# List flagged decisions
decision-logger decisions flagged <meeting-id> [--status <status>] [--source <source>] [--sort-by <field>]

# Manually flag decision
decision-logger decisions flag <meeting-id> --title <title> --segments <ids> --priority <n> --created-by <name>

# Get decision details
decision-logger decisions show <flagged-id>

# Update decision
decision-logger decisions update <flagged-id> [--title <title>] [--context <text>] [--priority <n>] [--segments <ids>]

# Update priority only
decision-logger decisions priority <flagged-id> --priority <n>

# Dismiss decision
decision-logger decisions dismiss <flagged-id>

# Delete decision
decision-logger decisions delete <flagged-id>
```

## Integration with Decision Workflow

Once decisions are flagged, refined, and prioritized, they flow into the standard decision workflow:

```
1. Flagged Decisions (AI + Manual)
   ↓
2. Refine & Prioritize
   ↓
3. Set Decision Context
   ↓
4. Generate Draft
   ↓
5. Iterative Refinement
   ↓
6. Expert Advice (optional)
   ↓
7. Log Decision (immutable)
   ↓
8. Export
```

The key difference is that manual flagging gives you control over **which** decisions enter the workflow and in **what order** they're processed.

## Example: Complete Session

```bash
# 1. Upload transcript
decision-logger transcript upload meeting-456 --file quarterly-review.txt

# 2. Review AI-flagged decisions
decision-logger decisions flagged meeting-456
# Output shows 8 AI-flagged decisions

# 3. Dismiss false positives
decision-logger decisions dismiss flagged-3  # Not actually a decision
decision-logger decisions dismiss flagged-7  # Already decided

# 4. Manually flag one AI missed
decision-logger decisions flag meeting-456 \
  --title "Should we extend the Q2 deadline?" \
  --segments seg-89,seg-90 \
  --priority 9 \
  --created-by "Carol"

# 5. Refine AI flags
decision-logger decisions update flagged-1 \
  --title "Approve Q2 budget increase to £50k" \
  --priority 10

decision-logger decisions update flagged-2 \
  --title "Hire additional support staff" \
  --priority 7

# 6. Set remaining priorities
decision-logger decisions priority flagged-4 --priority 5
decision-logger decisions priority flagged-5 --priority 3
decision-logger decisions priority flagged-6 --priority 8

# 7. View prioritized list
decision-logger decisions flagged meeting-456 --status pending --sort-by priority
# Output:
# 1. [Priority 10] "Approve Q2 budget increase to £50k"
# 2. [Priority 9]  "Should we extend the Q2 deadline?"
# 3. [Priority 8]  "Hire additional support staff"
# 4. [Priority 7]  "..."
# 5. [Priority 5]  "..."
# 6. [Priority 3]  "..."

# 8. Process in order
decision-logger context set-decision meeting-456 flagged-1
decision-logger draft generate
# ... complete decision workflow ...

decision-logger context set-decision meeting-456 flagged-manual-1
decision-logger draft generate
# ... continue with next priority ...
```

This workflow gives you full control over decision identification, refinement, and processing order while still benefiting from AI assistance.
