# API State Visibility Analysis

## Current State Coverage

### ✅ Well Covered

**Meetings**:
- `GET /api/meetings` - List all meetings
- `GET /api/meetings/:id` - Get single meeting
- Meeting status visible

**Transcripts**:
- `GET /api/meetings/:id/segments` - Get segments (with context filter)
- Segment contexts visible

**Decision Contexts (Active Drafts)**:
- `GET /api/decision-contexts/:id` - Get single context
- Draft data, locked fields, status visible

**Decision Logs (Finalized)**:
- `GET /api/meetings/:id/decisions` - List decisions for meeting
- `GET /api/decisions/:id` - Get single decision log

**Field Library & Templates**:
- `GET /api/fields` - List all fields (with category filter)
- `GET /api/fields/:id` - Get field definition
- `GET /api/templates` - List all templates
- `GET /api/templates/:id` - Get template with field assignments

**Flagged Decisions**:
- `GET /api/meetings/:id/flagged-decisions` - List flagged decisions

### ❌ Missing Endpoints

#### 1. **Global Context State** (Critical for UI)
**Missing**: `GET /api/context` or `GET /api/state`

**Problem**: 
- CLI tracks "active meeting" globally
- CLI tracks "active decision context" globally
- CLI tracks "active field" globally
- Web UI has no way to query this state

**Needed**:
```typescript
GET /api/context
Response: {
  activeMeetingId?: string,
  activeDecisionContextId?: string,
  activeFieldId?: string,
  meeting?: Meeting,           // Populated if active
  decisionContext?: DecisionContext,  // Populated if active
  field?: DecisionField        // Populated if active
}
```

**Use case**: 
- Web UI shows "Currently working on: Meeting X → Decision Y → Field Z"
- Advanced CLI can sync state across sessions

---

#### 2. **Decision Context List** (Missing)
**Missing**: `GET /api/meetings/:id/decision-contexts`

**Problem**:
- Can get flagged decisions (pending)
- Can get decision logs (finalized)
- **Cannot get decision contexts (drafting)**

**Needed**:
```typescript
GET /api/meetings/:id/decision-contexts
Query: {status?: 'drafting' | 'ready' | 'logged'}
Response: {
  contexts: DecisionContext[]
}
```

**Use case**:
- Web UI shows "Decisions in progress" list
- User can resume work on any draft
- Show which decisions have locked fields

---

#### 3. **Decision Context by Flagged Decision** (Missing)
**Missing**: `GET /api/flagged-decisions/:id/context`

**Problem**:
- User flags a decision
- User starts working on it (creates DecisionContext)
- No way to find the DecisionContext from the FlaggedDecision

**Needed**:
```typescript
GET /api/flagged-decisions/:id/context
Response: DecisionContext | null
```

**Use case**:
- Web UI shows "Work on this decision" button
- If context exists, resume; if not, create new

---

#### 4. **Meeting Summary/Stats** (Nice to have)
**Missing**: `GET /api/meetings/:id/summary`

**Problem**:
- No aggregated view of meeting state
- UI must make multiple requests to show overview

**Needed**:
```typescript
GET /api/meetings/:id/summary
Response: {
  meeting: Meeting,
  stats: {
    segmentCount: number,
    flaggedDecisionCount: number,
    draftDecisionCount: number,
    loggedDecisionCount: number,
    participantCount: number
  },
  recentActivity: Array<{
    type: 'segment_added' | 'decision_flagged' | 'decision_logged',
    timestamp: Date,
    description: string
  }>
}
```

**Use case**:
- Dashboard shows meeting overview
- "5 decisions flagged, 2 in progress, 1 logged"

---

#### 5. **Decision Context History** (Nice to have)
**Missing**: `GET /api/decision-contexts/:id/history`

**Problem**:
- No audit trail of draft changes
- Can't see when fields were locked/unlocked
- Can't see regeneration history

**Needed**:
```typescript
GET /api/decision-contexts/:id/history
Response: {
  events: Array<{
    type: 'draft_generated' | 'field_regenerated' | 'field_locked' | 'field_unlocked',
    timestamp: Date,
    fieldId?: string,
    actor?: string,
    metadata?: Record<string, unknown>
  }>
}
```

**Use case**:
- Web UI shows "Field 'options' regenerated 3 times"
- Audit trail for decision process

---

#### 6. **Search/Filter Endpoints** (Nice to have)
**Missing**: Global search across meetings and decisions

**Needed**:
```typescript
GET /api/search
Query: {
  q: string,                    // Search query
  type?: 'meetings' | 'decisions' | 'segments',
  dateFrom?: string,
  dateTo?: string
}
Response: {
  meetings: Meeting[],
  decisions: DecisionLog[],
  segments: TranscriptSegment[]
}
```

**Use case**:
- Web UI search bar
- "Find all decisions about PostgreSQL"

---

#### 7. **Batch Operations** (Nice to have)
**Missing**: Batch dismiss/accept flagged decisions

**Needed**:
```typescript
POST /api/flagged-decisions/batch-dismiss
Body: {flaggedDecisionIds: string[]}
Response: {dismissed: number}

POST /api/flagged-decisions/batch-accept
Body: {
  flaggedDecisionIds: string[],
  templateId?: string  // Apply same template to all
}
Response: {contexts: DecisionContext[]}
```

**Use case**:
- Web UI: "Dismiss all low-confidence decisions"
- Bulk operations for efficiency

---

## Priority Ranking

### P0 (Critical for Web UI)
1. **Global context state** - `GET /api/context`
2. **Decision context list** - `GET /api/meetings/:id/decision-contexts`
3. **Context by flagged decision** - `GET /api/flagged-decisions/:id/context`

### P1 (Important for UX)
4. **Meeting summary** - `GET /api/meetings/:id/summary`

### P2 (Nice to have)
5. **Decision context history** - `GET /api/decision-contexts/:id/history`
6. **Search** - `GET /api/search`
7. **Batch operations** - `POST /api/flagged-decisions/batch-*`

---

## Recommended Additions

### Minimal Set (P0 only)

Add these 3 endpoints to make web UI viable:

```typescript
// 1. Global context
GET /api/context
Response: {
  activeMeetingId?: string,
  activeDecisionContextId?: string,
  activeFieldId?: string,
  meeting?: Meeting,
  decisionContext?: DecisionContext,
  field?: DecisionField
}

POST /api/context/meeting
Body: {meetingId: string}
Response: {activeMeetingId: string}

DELETE /api/context/meeting
Response: {cleared: true}

// 2. Decision context list
GET /api/meetings/:id/decision-contexts
Query: {status?: 'drafting' | 'ready' | 'logged'}
Response: {contexts: DecisionContext[]}

// 3. Context by flagged decision
GET /api/flagged-decisions/:id/context
Response: DecisionContext | null
```

### Full Set (P0 + P1)

Add meeting summary endpoint:

```typescript
GET /api/meetings/:id/summary
Response: {
  meeting: Meeting,
  stats: {
    segmentCount: number,
    flaggedDecisionCount: number,
    draftDecisionCount: number,
    loggedDecisionCount: number
  }
}
```

---

## Web UI State Management Example

With the recommended endpoints, a web UI can:

```typescript
// On app load
const context = await fetch('/api/context').then(r => r.json());

if (context.activeMeetingId) {
  // Resume previous session
  const summary = await fetch(`/api/meetings/${context.activeMeetingId}/summary`).then(r => r.json());
  
  // Show dashboard
  console.log(`Meeting: ${summary.meeting.title}`);
  console.log(`Flagged: ${summary.stats.flaggedDecisionCount}`);
  console.log(`In Progress: ${summary.stats.draftDecisionCount}`);
  console.log(`Logged: ${summary.stats.loggedDecisionCount}`);
  
  if (context.activeDecisionContextId) {
    // User was working on a decision
    const draft = context.decisionContext;
    console.log(`Resume work on: ${draft.title}`);
    
    if (context.activeFieldId) {
      console.log(`Focused on field: ${context.field.name}`);
    }
  }
} else {
  // New session - show meeting list
  const meetings = await fetch('/api/meetings').then(r => r.json());
  // ...
}
```

---

## CLI State Persistence

Currently, CLI tracks state in memory. With these endpoints, CLI can:

1. **Persist state server-side**:
   ```bash
   decision-logger context set-meeting mtg_123
   # Calls: POST /api/context/meeting {meetingId: "mtg_123"}
   ```

2. **Resume across sessions**:
   ```bash
   decision-logger context show
   # Calls: GET /api/context
   # Output: Active meeting: Housing Coop (mtg_123)
   #         Active decision: Approve roof repair (ctx_456)
   ```

3. **Sync state across devices**:
   - User starts work on laptop
   - Continues on desktop
   - State is preserved server-side

---

## Implementation Notes

### Global Context Storage

**Option 1: Session-based** (per user session)
- Store in session/cookie
- Each user has their own context
- Requires authentication

**Option 2: Single global context** (simpler for MVP)
- One global context for the system
- Stored in database or in-memory
- No auth required
- Good for single-user or team use

**Recommendation**: Start with Option 2 (single global context) for MVP, add session-based later.

### Database Schema for Global Context

```sql
CREATE TABLE global_context (
  id INTEGER PRIMARY KEY DEFAULT 1, -- Singleton
  active_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  active_decision_context_id UUID REFERENCES decision_contexts(id) ON DELETE SET NULL,
  active_field_id TEXT REFERENCES decision_fields(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1) -- Ensure only one row
);

-- Initialize with null values
INSERT INTO global_context (id) VALUES (1);
```

---

## Summary

**Current state**: API has good coverage for CRUD operations but **lacks state visibility**.

**Critical gaps**:
1. No global context endpoint (can't see what user is working on)
2. No decision context list (can't see drafts in progress)
3. No link from flagged decision to context (can't resume work)

**Recommendation**: Add 3 P0 endpoints to make web UI viable:
- `GET /api/context` (global state)
- `GET /api/meetings/:id/decision-contexts` (list drafts)
- `GET /api/flagged-decisions/:id/context` (resume work)

With these additions, a web UI can provide full visibility into system state and allow users to resume work seamlessly.
