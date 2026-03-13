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
  instructions?: string;
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

export interface OpenContextSummary {
  id: string;
  title: string;
  templateName: string;
  status: "open" | "deferred";
  sourceMeetingTitle: string;
  sourceMeetingDate: string;
  sourceMeetingTags: string[];
}
