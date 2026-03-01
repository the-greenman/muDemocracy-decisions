# AI Expert Prompts

This document defines the expert prompt templates used for AI consultation on decision contexts.

> **Implementation note (see iterative-implementation-plan.md M6)**:
> The expert system is introduced in **Milestone 6**. The initial seeded experts are:
> - `technical` — Technical architecture expert (`prompts/experts/technical.md`)
> - `legal` — Legal and compliance expert (`prompts/experts/legal.md`)
> - `stakeholder` — Stakeholder impact expert (`prompts/experts/stakeholder.md`)
> - `decision-detector` — Decision detection expert persona (`prompts/experts/decision-detector.md`)
>
> The richer expert set described in this document (policy-compliance, risk-assessment, precedent-analysis, financial-review) represents future extensions that can be added as custom experts via `expert create`. The prompt structures and MCP tool patterns defined here remain valid for those future experts.

## Expert Types

### 1. Policy Compliance Expert

**Role**: Ensures decisions align with organizational policies and regulations.

**Prompt Template**:
```
You are a policy compliance expert for a housing cooperative. Review this decision draft and provide compliance analysis.

Decision Context:
{decision_context}

Current Draft:
{draft_fields}

Your task:
1. Check alignment with relevant policies (access via MCP policy database)
2. Identify any policy violations or concerns
3. Recommend modifications for compliance
4. Cite specific policy sections

Provide:
- Compliance assessment
- Specific concerns (if any)
- Recommendations for compliance
- Related policies with relevance explanation
```

**MCP Tools Used**:
- `policy_database.search` - Search for relevant policies
- `policy_database.get` - Retrieve specific policy details

---

### 2. Risk Assessment Expert

**Role**: Identifies potential risks and mitigation strategies.

**Prompt Template**:
```
You are a risk assessment expert. Analyze this decision for potential risks.

Decision Context:
{decision_context}

Current Draft:
{draft_fields}

Your task:
1. Identify operational, financial, legal, and reputational risks
2. Assess severity and likelihood of each risk
3. Recommend mitigation strategies
4. Reference similar past decisions and their outcomes (via MCP archive)

Provide:
- Risk analysis by category
- Specific concerns with severity ratings
- Mitigation recommendations
- Related past decisions with outcomes
```

**MCP Tools Used**:
- `decision_archive.search` - Find similar past decisions
- `decision_archive.get_outcomes` - Retrieve decision outcomes

---

### 3. Precedent Analysis Expert

**Role**: Analyzes past decisions for patterns and lessons learned.

**Prompt Template**:
```
You are a precedent analysis expert. Find and analyze similar past decisions.

Decision Context:
{decision_context}

Current Draft:
{draft_fields}

Your task:
1. Search decision archive for similar decisions (via MCP)
2. Analyze outcomes of similar decisions
3. Identify patterns and lessons learned
4. Recommend based on historical data

Provide:
- Similar past decisions with similarity scores
- Outcome analysis
- Lessons learned
- Recommendations based on precedent
```

**MCP Tools Used**:
- `decision_archive.search` - Semantic search for similar decisions
- `decision_archive.get` - Retrieve full decision details
- `decision_archive.get_outcomes` - Get outcome tracking data

---

### 4. Stakeholder Impact Expert

**Role**: Analyzes impact on various stakeholders.

**Prompt Template**:
```
You are a stakeholder impact expert. Analyze how this decision affects different stakeholders.

Decision Context:
{decision_context}

Current Draft:
{draft_fields}

Meeting Participants:
{participants}

Your task:
1. Identify all affected stakeholders
2. Analyze positive and negative impacts per stakeholder group
3. Assess fairness and equity considerations
4. Recommend communication strategies

Provide:
- Stakeholder impact analysis by group
- Equity concerns
- Communication recommendations
- Mitigation for negative impacts
```

**MCP Tools Used**:
- `policy_database.search` - Check stakeholder policies
- `decision_archive.search` - Find similar stakeholder scenarios

---

### 5. Financial Review Expert

**Role**: Reviews financial implications and budget alignment.

**Prompt Template**:
```
You are a financial review expert. Analyze the financial aspects of this decision.

Decision Context:
{decision_context}

Current Draft:
{draft_fields}

Your task:
1. Analyze budget implications
2. Check against financial policies (via MCP)
3. Assess long-term financial impact
4. Compare with similar past expenditures
5. Identify funding sources and constraints

Provide:
- Financial analysis
- Budget compliance concerns
- Long-term cost projections
- Funding recommendations
- Related financial policies
```

**MCP Tools Used**:
- `policy_database.search` - Financial policies and budget limits
- `decision_archive.search` - Similar financial decisions
- `decision_archive.get_budget_tracking` - Historical budget data

---

## MCP Server Configuration

### Policy Database MCP Server

**Purpose**: Provides access to organizational policies, bylaws, and regulations.

**Resources**:
- `policy://bylaws/*` - Cooperative bylaws
- `policy://financial/*` - Financial policies
- `policy://maintenance/*` - Maintenance policies
- `policy://governance/*` - Governance policies

**Tools**:
- `search_policies(query: string, category?: string)` - Semantic search
- `get_policy(id: string)` - Retrieve specific policy
- `list_categories()` - List policy categories

**Configuration** (`.mcp/policy-server.json`):
```json
{
  "name": "policy-database",
  "type": "sqlite",
  "database": "./data/policies.db",
  "embeddings": {
    "model": "all-MiniLM-L6-v2",
    "dimension": 384
  }
}
```

---

### Decision Archive MCP Server

**Purpose**: Provides access to historical decision logs and outcomes.

**Resources**:
- `archive://decisions/*` - All logged decisions
- `archive://outcomes/*` - Decision outcome tracking
- `archive://metrics/*` - Decision metrics and analytics

**Tools**:
- `search_decisions(query: string, date_range?: object)` - Semantic search
- `get_decision(id: string)` - Retrieve full decision
- `get_outcomes(decision_id: string)` - Get outcome data
- `get_similar(decision_id: string, limit?: number)` - Find similar decisions
- `get_budget_tracking(category: string)` - Historical budget data

**Configuration** (`.mcp/archive-server.json`):
```json
{
  "name": "decision-archive",
  "type": "postgresql",
  "connection": {
    "host": "localhost",
    "database": "decision_logger",
    "table": "decision_logs"
  },
  "embeddings": {
    "model": "all-MiniLM-L6-v2",
    "dimension": 384,
    "field": "embedding"
  }
}
```

---

## Expert Advice Workflow

### 1. Request Expert Advice

```bash
decision-logger draft expert-advice policy-compliance
```

### 2. System Flow

```
1. Load decision context and draft fields
2. Select expert prompt template
3. Initialize LLM with MCP access
4. Execute expert prompt
5. LLM queries MCP servers:
   - policy_database.search("budget approval")
   - decision_archive.search("roof repair decisions")
6. LLM generates advice with citations
7. Return structured advice response
```

### 3. Response Format

```json
{
  "expertType": "policy-compliance",
  "advice": "This decision aligns with Financial Policy 3.2...",
  "concerns": [
    "Budget exceeds quarterly limit of £40,000",
    "Requires board approval per Policy 3.2.4"
  ],
  "recommendations": [
    "Split project into two phases",
    "Seek board pre-approval before proceeding"
  ],
  "relatedPolicies": [
    {
      "id": "policy-3.2",
      "title": "Capital Expenditure Policy",
      "relevance": "Defines approval thresholds for major repairs"
    }
  ],
  "relatedDecisions": [
    {
      "id": "dec-2024-08-15",
      "title": "Elevator Upgrade Budget Approval",
      "similarity": 0.87
    }
  ],
  "generatedAt": "2026-02-27T18:45:00Z"
}
```

### 4. Use Advice to Refine Decision

```bash
# Update field based on expert advice
decision-logger draft update-field consequences_negative \
  --value "Budget exceeds quarterly limit. Requires board approval."

# Request another expert opinion
decision-logger draft expert-advice risk-assessment
```

---

## Implementation Notes

### Expert Advice Implementation (Vercel AI SDK)

```typescript
// packages/core/src/llm/expert-service.ts
import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function getExpertAdvice(expert: ExpertTemplate, context: DecisionContext) {
  const { text } = await generateText({
    model: anthropic('claude-3-5-sonnet-latest'),
    system: renderPrompt(expert.promptTemplate, context),
    prompt: "Please analyze the provided decision context and draft fields.",
    tools: await getMCPSystemTools(expert.mcpAccess),
  });
  
  return parseExpertResponse(text);
}
```

### Caching Expert Advice

Expert advice responses should be cached on the decision context:

```typescript
interface DecisionContext {
  // ... existing fields
  expertAdvice?: {
    [expertType: string]: {
      advice: ExpertAdviceResponse;
      requestedAt: Date;
    };
  };
}
```

This allows:
- Reviewing past expert consultations
- Tracking which experts were consulted
- Audit trail of advice received

---

## Future Expert Types

Potential additional experts:

- **Legal Compliance Expert** - Legal requirements and liability
- **Environmental Impact Expert** - Sustainability and environmental concerns
- **Accessibility Expert** - ADA/accessibility compliance
- **Timeline Expert** - Project scheduling and dependencies
- **Vendor Selection Expert** - Procurement best practices
