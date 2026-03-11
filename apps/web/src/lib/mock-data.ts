// ── Mock data for prototype pages ────────────────────────────────

export type FieldStatus = "idle" | "generating" | "locked" | "editing";
export type AgendaItemStatus = "pending" | "active" | "drafted" | "logged" | "deferred";
export type CandidateStatus = "new" | "dismissed";
export type TagCategory = "topic" | "team" | "project";
export type RelationType = "supersedes" | "superseded_by" | "related" | "blocks" | "blocked_by";
export type DecisionMethod =
  | "consensus"
  | "unanimous_vote"
  | "majority_vote"
  | "executive"
  | "delegated";

export interface Tag {
  id: string;
  name: string;
  category: TagCategory;
}

export interface Relation {
  id: string;
  targetTitle: string;
  targetId: string;
  relationType: RelationType;
}

export interface Field {
  id: string;
  label: string;
  value: string;
  status: FieldStatus;
  required: boolean;
  instructions?: string; // human-readable guidance on what belongs in this field
  guidance?: string; // ephemeral per-field regen instruction
  versions?: FieldVersion[];
}

export interface FieldVersion {
  version: number;
  value: string;
  savedAt: string;
}

export interface SupplementaryItem {
  id: string;
  label: string;
  body: string;
  scope: "meeting" | "context" | "field";
  fieldId?: string;
  createdAt: string;
}

export interface DecisionContext {
  id: string;
  title: string;
  summary: string;
  templateName: string;
  fields: Field[];
  tags: Tag[];
  relations: Relation[];
  status: AgendaItemStatus;
}

export interface Candidate {
  id: string;
  title: string;
  summary: string;
  status: CandidateStatus;
  detectedAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  status: "active" | "closed";
  participants: string[];
  draftedCount: number;
  loggedCount: number;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  fieldCount: number;
}

export interface TemplateFieldDefinition {
  key: string;
  label: string;
  required: boolean;
}

export interface OpenContextSummary {
  id: string;
  title: string;
  templateName: string;
  status: "open" | "deferred";
  sourceMeetingTitle: string;
  sourceMeetingDate: string; // YYYY-MM-DD
  sourceMeetingTags: string[];
}

// ── Templates ────────────────────────────────────────────────────

export const TEMPLATES: Template[] = [
  {
    id: "tpl-1",
    name: "Technology Selection",
    category: "technology",
    description: "Choosing tools, frameworks, or platforms",
    fieldCount: 11,
  },
  {
    id: "tpl-2",
    name: "Standard Decision",
    category: "standard",
    description: "General-purpose decision documentation",
    fieldCount: 10,
  },
  {
    id: "tpl-3",
    name: "Budget Approval",
    category: "budget",
    description: "Financial decisions with cost breakdown and ROI",
    fieldCount: 10,
  },
  {
    id: "tpl-4",
    name: "Strategy Decision",
    category: "strategy",
    description: "Direction-setting and priority decisions",
    fieldCount: 9,
  },
  {
    id: "tpl-5",
    name: "Policy Change",
    category: "policy",
    description: "Governance and compliance decisions",
    fieldCount: 8,
  },
  {
    id: "tpl-6",
    name: "Proposal Acceptance",
    category: "proposal",
    description: "Yes/no decisions on submitted proposals",
    fieldCount: 7,
  },
];

// Mirrors the expected API payload for template-field discovery.
const TEMPLATE_FIELD_DEFINITIONS: Record<string, TemplateFieldDefinition[]> = {
  "Technology Selection": [
    { key: "problem_statement", label: "Problem Statement", required: true },
    { key: "requirements", label: "Requirements", required: true },
    { key: "options_evaluated", label: "Options Evaluated", required: true },
    { key: "selected_option", label: "Selected Option", required: true },
    { key: "rationale", label: "Rationale", required: true },
    { key: "implementation_notes", label: "Implementation Notes", required: false },
  ],
  "Standard Decision": [
    { key: "problem_statement", label: "Problem Statement", required: true },
    { key: "context", label: "Context", required: false },
    { key: "options_evaluated", label: "Options Evaluated", required: true },
    { key: "selected_option", label: "Selected Option", required: true },
    { key: "rationale", label: "Rationale", required: true },
    { key: "implementation_notes", label: "Implementation Notes", required: false },
    { key: "outstanding_issues", label: "Outstanding Issues / Open Questions", required: false },
  ],
  "Budget Approval": [
    { key: "problem_statement", label: "Problem Statement", required: true },
    { key: "budget_scope", label: "Budget Scope", required: true },
    { key: "cost_breakdown", label: "Cost Breakdown", required: true },
    { key: "funding_source", label: "Funding Source", required: true },
    { key: "selected_option", label: "Selected Option", required: true },
    { key: "rationale", label: "Rationale", required: true },
    { key: "implementation_notes", label: "Implementation Notes", required: false },
  ],
  "Strategy Decision": [
    { key: "problem_statement", label: "Problem Statement", required: true },
    { key: "strategic_goal", label: "Strategic Goal", required: true },
    { key: "options_evaluated", label: "Options Evaluated", required: true },
    { key: "selected_direction", label: "Selected Direction", required: true },
    { key: "rationale", label: "Rationale", required: true },
    { key: "implementation_notes", label: "Implementation Notes", required: false },
    { key: "outstanding_issues", label: "Outstanding Issues / Open Questions", required: false },
  ],
  "Policy Change": [
    { key: "current_policy", label: "Current Policy", required: true },
    { key: "problem_statement", label: "Problem Statement", required: true },
    { key: "proposed_change", label: "Proposed Change", required: true },
    { key: "affected_groups", label: "Affected Groups", required: true },
    { key: "rationale", label: "Rationale", required: true },
    { key: "implementation_notes", label: "Implementation Notes", required: false },
  ],
  "Proposal Acceptance": [
    { key: "proposal_summary", label: "Proposal Summary", required: true },
    { key: "evaluation_criteria", label: "Evaluation Criteria", required: true },
    { key: "options_evaluated", label: "Options Evaluated", required: true },
    { key: "selected_option", label: "Selected Option", required: true },
    { key: "rationale", label: "Rationale", required: true },
    { key: "implementation_notes", label: "Implementation Notes", required: false },
    { key: "outstanding_issues", label: "Outstanding Issues / Open Questions", required: false },
  ],
};

export const OUTSTANDING_ISSUES_FIELD: Field = {
  id: "f-outstanding-issues",
  label: "Outstanding Issues / Open Questions",
  value: "",
  status: "idle",
  required: false,
  guidance: "",
};

export const DECISION_METHODS: { value: DecisionMethod; label: string }[] = [
  { value: "unanimous_vote", label: "Unanimous vote" },
  { value: "consensus", label: "Consensus" },
  { value: "majority_vote", label: "Majority vote" },
  { value: "executive", label: "Executive decision" },
  { value: "delegated", label: "Delegated authority" },
];

// ── Sample meetings ──────────────────────────────────────────────

export const MEETINGS: Meeting[] = [
  {
    id: "mtg-1",
    title: "Q4 Architecture Review",
    date: "2026-03-08",
    status: "active",
    participants: ["Alice Chen", "Bob Marsh", "Priya Nair"],
    draftedCount: 2,
    loggedCount: 1,
  },
  {
    id: "mtg-2",
    title: "Budget Planning Session",
    date: "2026-03-05",
    status: "closed",
    participants: ["Alice Chen", "Finance Team"],
    draftedCount: 0,
    loggedCount: 3,
  },
];

// ── Sample decision context (active) ────────────────────────────

export const ACTIVE_CONTEXT: DecisionContext = {
  id: "ctx-1",
  title: "API Gateway Technology Selection",
  summary:
    "Choose an API gateway solution to replace the current ad-hoc routing layer for the platform microservices.",
  templateName: "Technology Selection",
  status: "active",
  tags: [
    { id: "t1", name: "platform", category: "topic" },
    { id: "t2", name: "engineering", category: "team" },
    { id: "t3", name: "Q4-Infra", category: "project" },
  ],
  relations: [
    {
      id: "r1",
      targetTitle: "Microservices Migration Plan",
      targetId: "ctx-99",
      relationType: "related",
    },
  ],
  fields: [
    {
      id: "f1",
      label: "Problem Statement",
      value:
        "Our current ad-hoc routing configuration has become unmaintainable as the number of microservices has grown from 4 to 23. Deployment of new services requires manual nginx config changes and carries risk of outages.",
      status: "locked",
      required: true,
      versions: [
        {
          version: 1,
          value: "The current nginx config is messy and hard to maintain.",
          savedAt: "14:10",
        },
        {
          version: 2,
          value: "Our nginx routing layer has grown unwieldy with 23 microservices.",
          savedAt: "14:18",
        },
      ],
    },
    {
      id: "f2",
      label: "Requirements",
      value:
        "Must support: path-based routing, auth delegation, rate limiting, TLS termination. Nice-to-have: WebSocket support, plugin ecosystem, observability integrations.",
      status: "locked",
      required: true,
    },
    {
      id: "f3",
      label: "Options Evaluated",
      value: "Kong, Traefik, AWS API Gateway, custom nginx-operator",
      status: "idle",
      required: true,
      guidance: "",
    },
    {
      id: "f4",
      label: "Selected Option",
      value: "",
      status: "idle",
      required: true,
    },
    {
      id: "f5",
      label: "Rationale",
      value: "",
      status: "idle",
      required: true,
    },
    {
      id: "f6",
      label: "Implementation Notes",
      value: "",
      status: "idle",
      required: false,
    },
  ],
};

// ── Supplementary content (mock) ─────────────────────────────────

export const SUPPLEMENTARY_ITEMS: SupplementaryItem[] = [
  {
    id: "sc-1",
    label: "Options comparison table",
    body: "Kong: plugin ecosystem ★★★★★, K8s integration ★★★, cost $$\nTraefik: plugin ecosystem ★★★, K8s integration ★★★★★, cost $\nAWS GW: plugin ecosystem ★★, K8s integration ★★★, cost $$$\n\nTeam has operational experience with Traefik from staging.",
    scope: "field",
    fieldId: "f3",
    createdAt: "14:45",
  },
];

// ── Agenda items for meeting ─────────────────────────────────────

export const AGENDA_ITEMS: Array<{ id: string; title: string; status: AgendaItemStatus }> = [
  { id: "ctx-0", title: "Logging Infrastructure Upgrade", status: "logged" },
  { id: "ctx-1", title: "API Gateway Technology Selection", status: "active" },
  { id: "ctx-2", title: "Service Mesh Adoption Decision", status: "drafted" },
  { id: "ctx-3", title: "On-call Rotation Policy Change", status: "pending" },
];

export const OPEN_CONTEXTS: OpenContextSummary[] = [
  {
    id: "ctx-55",
    title: "Data Retention Policy Alignment",
    templateName: "Policy Change",
    status: "open",
    sourceMeetingTitle: "Compliance Review — Feb 2026",
    sourceMeetingDate: "2026-02-18",
    sourceMeetingTags: ["compliance", "policy", "retention"],
  },
  {
    id: "ctx-56",
    title: "Shared Authentication Flow Decision",
    templateName: "Technology Selection",
    status: "open",
    sourceMeetingTitle: "Platform Sync — Jan 2026",
    sourceMeetingDate: "2026-01-29",
    sourceMeetingTags: ["platform", "identity", "auth"],
  },
  {
    id: "ctx-57",
    title: "Vendor Procurement Criteria",
    templateName: "Standard Decision",
    status: "deferred",
    sourceMeetingTitle: "Finance Committee — Feb 2026",
    sourceMeetingDate: "2026-02-24",
    sourceMeetingTags: ["finance", "procurement", "vendor"],
  },
  {
    id: "ctx-58",
    title: "Community Partner Intake Process",
    templateName: "Standard Decision",
    status: "open",
    sourceMeetingTitle: "Founding Team Working Session",
    sourceMeetingDate: "2026-03-03",
    sourceMeetingTags: ["community", "partners", "intake"],
  },
  {
    id: "ctx-59",
    title: "Volunteer Safeguarding Escalation Path",
    templateName: "Policy Change",
    status: "open",
    sourceMeetingTitle: "Operations Circle Weekly",
    sourceMeetingDate: "2026-03-05",
    sourceMeetingTags: ["safeguarding", "operations", "volunteers"],
  },
];

// ── Candidates ───────────────────────────────────────────────────

export const CANDIDATES: Candidate[] = [
  {
    id: "cand-1",
    title: "Defer Kubernetes Upgrade to Q1 2027",
    summary:
      'Team expressed concern about timeline. Sam said "let\'s not take that on right now" — implicit decision to defer.',
    status: "new",
    detectedAt: "14:32",
  },
  {
    id: "cand-2",
    title: "Reject Proposal: Monorepo Migration",
    summary:
      'Alice raised the monorepo topic; consensus was "not worth the disruption for this quarter." Implicit rejection.',
    status: "new",
    detectedAt: "15:07",
  },
];

// ── Logged decisions (for relation search) ───────────────────────

export const LOGGED_DECISIONS = [
  { id: "dec-10", title: "Adopt Kubernetes for Container Orchestration", loggedAt: "2026-01-15" },
  { id: "dec-11", title: "Microservices Migration Plan", loggedAt: "2026-02-03" },
  { id: "dec-12", title: "Observability Stack: Datadog vs Grafana", loggedAt: "2026-02-20" },
  { id: "dec-13", title: "Internal Developer Platform Roadmap", loggedAt: "2026-01-28" },
];

export function getTemplateFieldDefinitions(templateName: string): TemplateFieldDefinition[] {
  return (
    TEMPLATE_FIELD_DEFINITIONS[templateName] ??
    TEMPLATE_FIELD_DEFINITIONS["Standard Decision"] ??
    []
  );
}

export function getMockFieldsForTemplate(templateName: string): Field[] {
  const definitions = getTemplateFieldDefinitions(templateName);
  return definitions.map((field, index) => {
    if (field.label === OUTSTANDING_ISSUES_FIELD.label) {
      return {
        ...OUTSTANDING_ISSUES_FIELD,
        required: field.required,
        status: "idle" as const,
        value: "",
        guidance: "",
      };
    }

    return {
      id: `${templateName.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
      label: field.label,
      value: "",
      status: "idle" as const,
      required: field.required,
      guidance: "",
    };
  });
}
