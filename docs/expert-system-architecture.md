# Expert System Architecture - Hybrid Approach

**Status**: authoritative
**Owns**: expert-system scope, expert data model, MCP integration detail, expert/MCP API and CLI surface
**Must sync with**: `packages/schema`, `docs/PLAN.md`, `docs/iterative-implementation-plan.md`

> **Implementation Note (see iterative-implementation-plan.md M5-M7)**:
> The expert system is implemented in stages.
> - **M5**: API endpoints for experts and MCP servers are created as stubs.
> - **M6**: The first expert, the "Decision Detector," is implemented.
> - **M7+**: The full custom expert and MCP framework is built out.
> This document describes the final architecture. Refer to the iterative plan for the specific implementation sequence.

## Overview

The system supports two types of experts:

1. **Core Experts** - Baked into the application, always available
2. **Custom Experts** - User-defined, stored in database, fully configurable

## MCP Integration with Configurable Experts

### MCP Server Registry

Each MCP server is registered with capabilities:

```typescript
interface MCPServer {
  name: string;
  type: 'policy-database' | 'decision-archive' | 'custom';
  connection: {
    url?: string;
    database?: string;
    // ... connection details
  };
  capabilities: {
    resources: string[];  // e.g., ['policy://*', 'archive://*']
    tools: MCPTool[];
  };
  status: 'active' | 'inactive';
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}
```

### Expert MCP Access Configuration

Experts specify which MCP servers they need:

```typescript
// packages/schema/src/expert.ts
interface ExpertTemplate {
  id: string;
  name: string;
  type: 'core' | 'custom';
  promptTemplate: string;
  
  // MCP Configuration
  mcpAccess: {
    servers: string[];           // ['policy-database', 'decision-archive']
    allowedTools?: string[];     // Optional: restrict to specific tools
    allowedResources?: string[]; // Optional: restrict to specific resources
  };
  
  // Output schema (Zod or JSON Schema)
  outputSchema?: Record<string, any>;
  
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
}
```

### How MCP Works with Custom Experts (Vercel AI SDK)

#### 1. Expert Execution with Tools

Using the Vercel AI SDK `generateObject` or `generateText` with dynamic tools:

```typescript
// packages/core/src/services/expert.service.ts
import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

async function executeExpert(
  expertId: string,
  decisionContext: DecisionContext
) {
  const expert = await getExpertTemplate(expertId);
  const mcpClients = await getMCPClients(expert.mcpAccess.servers);
  
  // Convert MCP tools to Vercel AI SDK tools
  const tools = mcpClients.flatMap(client => 
    client.getTools().map(mcpTool => tool({
      description: mcpTool.description,
      parameters: mcpTool.inputSchema,
      execute: async (args) => client.executeTool(mcpTool.name, args)
    }))
  );

  const { text } = await generateText({
    model: anthropic('claude-3-5-sonnet-latest'),
    system: buildSystemPrompt(expert.promptTemplate, decisionContext),
    prompt: `Analyze this decision context and provide expert advice.`,
    tools: Object.fromEntries(tools.map(t => [t.name, t]))
  });
  
  return text;
}
```

#### 3. MCP Tool Discovery

Custom experts can discover available tools:

```typescript
GET /api/mcp/servers
  Returns: List of registered MCP servers

GET /api/mcp/servers/{name}/tools
  Returns: Available tools for that server

GET /api/mcp/servers/{name}/resources
  Returns: Available resources for that server
```

This allows users to:
- See what MCP capabilities are available
- Configure custom experts to use specific tools
- Test MCP access before creating experts

## Database Schema

```sql
-- Expert Templates
CREATE TABLE expert_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('core', 'custom')),
  prompt_template TEXT NOT NULL,
  
  -- MCP Configuration (JSONB)
  mcp_access JSONB NOT NULL DEFAULT '{"servers": [], "allowedTools": null, "allowedResources": null}',
  
  -- Output schema (Zod Schema stored as JSONB)
  output_schema JSONB,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  created_by TEXT
);

-- MCP Server Registry
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  connection_config JSONB NOT NULL,
  capabilities JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Expert Advice History (for caching and audit)
CREATE TABLE expert_advice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_context_id UUID NOT NULL REFERENCES decision_contexts(id),
  expert_id UUID NOT NULL REFERENCES expert_templates(id),
  expert_name TEXT NOT NULL,
  request JSONB NOT NULL,
  response JSONB NOT NULL,
  mcp_tools_used TEXT[],
  requested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_advice_context ON expert_advice_history(decision_context_id);
CREATE INDEX idx_advice_expert ON expert_advice_history(expert_id);
```

## Core Experts (Baked In)

Core experts are defined in code and automatically seeded on first run:

```typescript
// src/core/experts/core-experts.ts
export const CORE_EXPERTS: ExpertTemplate[] = [
  {
    id: 'policy-compliance',
    name: 'policy-compliance',
    displayName: 'Policy Compliance Expert',
    type: 'core',
    description: 'Ensures decisions align with organizational policies',
    promptTemplate: `You are a policy compliance expert...
{decision_context}
{draft_fields}

Check alignment with policies via MCP tools.`,
    mcpAccess: {
      servers: ['policy-database'],
      allowedTools: ['search_policies', 'get_policy'],
    },
    outputSchema: z.object({
      advice: z.string(),
      concerns: z.array(z.string()),
      recommendations: z.array(z.string()),
      relatedPolicies: z.array(z.any())
    }),
    isActive: true,
    createdAt: new Date(),
  },
  // ... other core experts
];
```

## Custom Expert Creation

### API Endpoints

```typescript
// List all experts (core + custom)
GET /api/experts
Response: {
  experts: ExpertTemplate[]
}

// Get expert details
GET /api/experts/{id}
Response: ExpertTemplate

// Create custom expert
POST /api/experts
Body: {
  name: string,
  displayName: string,
  description: string,
  promptTemplate: string,
  mcpAccess: {
    servers: string[],
    allowedTools?: string[],
    allowedResources?: string[]
  },
  outputSchema?: z.ZodSchema<any>
}
Response: ExpertTemplate

// Update custom expert (core experts cannot be updated)
PATCH /api/experts/{id}
Body: Partial<ExpertTemplate>
Response: ExpertTemplate

// Delete custom expert (core experts cannot be deleted)
DELETE /api/experts/{id}
Response: {deleted: true}

// Test expert prompt
POST /api/experts/{id}/test
Body: {
  decisionContextId: string,
  focusArea?: string
}
Response: ExpertAdviceResponse
```

## MCP Configuration for Custom Experts

### Scenario 1: Custom Expert with Existing MCP Servers

User creates a "Legal Compliance Expert" using existing policy database:

```bash
decision-logger expert create legal-compliance \
  --display-name "Legal Compliance Expert" \
  --description "Reviews legal requirements and liability" \
  --mcp-servers "policy-database" \
  --mcp-tools "search_policies,get_policy" \
  --prompt-file ./prompts/legal-expert.txt
```

The system:
1. Validates MCP servers exist
2. Validates tools are available on those servers
3. Stores expert configuration
4. Expert can now use those MCP tools

### Scenario 2: Custom Expert with New MCP Server

User wants to create "Vendor Selection Expert" with access to vendor database:

**Step 1: Register new MCP server**
```bash
decision-logger mcp register vendor-database \
  --type postgresql \
  --connection "postgresql://localhost/vendors" \
  --tools-config ./mcp/vendor-tools.json
```

**Step 2: Create expert using new server**
```bash
decision-logger expert create vendor-selection \
  --display-name "Vendor Selection Expert" \
  --mcp-servers "vendor-database,decision-archive" \
  --prompt-file ./prompts/vendor-expert.txt
```

### Scenario 3: Restricting MCP Access

User creates expert with limited access:

```typescript
POST /api/experts
{
  "name": "budget-reviewer",
  "displayName": "Budget Reviewer",
  "promptTemplate": "...",
  "mcpAccess": {
    "servers": ["policy-database", "decision-archive"],
    "allowedTools": [
      "search_policies",      // Can search policies
      "get_budget_tracking"   // Can get budget data
    ],
    "allowedResources": [
      "policy://financial/*", // Only financial policies
      "archive://decisions/*" // All decisions
    ]
  }
}
```

This expert can:
- ✅ Search policies (but only financial ones via resource filter)
- ✅ Get budget tracking data
- ❌ Cannot get full policy details (get_policy not allowed)
- ❌ Cannot access non-financial policies

## Prompt Template Variables

Custom experts can use these variables in prompts:

```
{decision_context}      - Decision title and summary
{draft_fields}          - Current field values
{meeting_title}         - Meeting title
{meeting_date}          - Meeting date
{meeting_participants}  - List of participants
{template_name}         - Template being used
{focus_area}            - Optional focus area from request
{source_segments}       - Relevant transcript segments
```

Example custom prompt:

```
You are a {focus_area} expert for housing cooperatives.

Meeting: {meeting_title} on {meeting_date}
Participants: {meeting_participants}

Decision being considered:
{decision_context}

Current draft:
{draft_fields}

Your task:
1. Analyze this decision from a {focus_area} perspective
2. Use MCP tools to access relevant historical data
3. Provide specific, actionable recommendations

Focus particularly on: {focus_area}
```

## MCP Server Management

### Registering MCP Servers

```typescript
POST /api/mcp/servers
Body: {
  name: string,
  type: 'postgresql' | 'sqlite' | 'http' | 'custom',
  connectionConfig: {
    // Type-specific connection details
  },
  capabilities: {
    resources: string[],
    tools: MCPTool[]
  }
}
```

### MCP Server Types

**1. PostgreSQL MCP Server**
```json
{
  "name": "decision-archive",
  "type": "postgresql",
  "connectionConfig": {
    "host": "localhost",
    "database": "decision_logger",
    "table": "decision_logs"
  },
  "capabilities": {
    "resources": ["archive://decisions/*"],
    "tools": [
      {
        "name": "search_decisions",
        "description": "Semantic search for decisions",
        "inputSchema": {...}
      }
    ]
  }
}
```

**2. SQLite MCP Server**
```json
{
  "name": "policy-database",
  "type": "sqlite",
  "connectionConfig": {
    "database": "./data/policies.db"
  },
  "capabilities": {
    "resources": ["policy://*"],
    "tools": [...]
  }
}
```

**3. HTTP MCP Server** (for external APIs)
```json
{
  "name": "vendor-api",
  "type": "http",
  "connectionConfig": {
    "baseUrl": "https://api.vendors.example.com",
    "auth": {
      "type": "bearer",
      "tokenEnv": "VENDOR_API_TOKEN"
    }
  },
  "capabilities": {
    "resources": ["vendor://*"],
    "tools": [
      {
        "name": "search_vendors",
        "description": "Search vendor database",
        "inputSchema": {...}
      }
    ]
  }
}
```

## Security & Permissions

### MCP Access Control

```typescript
interface MCPAccessControl {
  // Which experts can use this server
  allowedExperts?: string[]; // null = all experts
  
  // Rate limiting
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  
  // Resource restrictions
  resourcePatterns?: string[]; // glob patterns
  
  // Tool restrictions
  allowedTools?: string[];
}
```

### Expert Permissions

```typescript
interface ExpertPermissions {
  // Who can create/modify this expert
  createdBy: string;
  
  // Who can use this expert
  allowedUsers?: string[]; // null = all users
  
  // Visibility
  isPublic: boolean; // false = only creator can see/use
}
```

## CLI Commands

```bash
# Expert management
decision-logger expert list
decision-logger expert show <expert-id>
decision-logger expert create <name> --prompt-file <file> --mcp-servers <servers>
decision-logger expert update <expert-id> --prompt-file <file>
decision-logger expert delete <expert-id>
decision-logger expert test <expert-id> --decision-context <id>

# MCP server management
decision-logger mcp list
decision-logger mcp show <server-name>
decision-logger mcp register <name> --type <type> --config <file>
decision-logger mcp test <server-name>
decision-logger mcp tools <server-name>
decision-logger mcp resources <server-name>

# Request expert advice (uses hybrid system)
decision-logger draft expert-advice <expert-name> [--focus <area>]
```


## Benefits of Hybrid Approach

✅ **Core experts always available** - Reliable, tested, maintained  
✅ **Extensible** - Users can create domain-specific experts  
✅ **Flexible MCP access** - Custom experts can use any registered MCP server  
✅ **Secure** - Fine-grained control over MCP access per expert  
✅ **Auditable** - Track which MCP tools each expert uses  
✅ **Testable** - Test custom experts before deploying  
✅ **Shareable** - Export/import custom expert configurations  

## Example: Creating a Custom Expert

```bash
# 1. Check available MCP servers
$ decision-logger mcp list
policy-database (active) - Organizational policies
decision-archive (active) - Historical decisions
vendor-api (active) - Vendor database

# 2. Check available tools
$ decision-logger mcp tools vendor-api
- search_vendors(query, category)
- get_vendor(id)
- get_vendor_ratings(id)

# 3. Create custom expert
$ decision-logger expert create procurement-advisor \
  --display-name "Procurement Advisor" \
  --description "Advises on vendor selection and procurement" \
  --mcp-servers "vendor-api,decision-archive,policy-database" \
  --mcp-tools "search_vendors,get_vendor_ratings,search_decisions,search_policies" \
  --prompt-file ./prompts/procurement.txt

# 4. Test it
$ decision-logger draft expert-advice procurement-advisor \
  --focus "contractor selection"

# 5. Use in workflow
$ decision-logger draft expert-advice procurement-advisor
Expert advice: Based on past decisions and vendor ratings...
Recommendations:
- Request quotes from vendors with rating > 4.5
- Review Policy 4.3 for procurement thresholds
- Similar decision (2024-06-12) chose Vendor A with good results
```
