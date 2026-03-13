/**
 * Decision Logger Database Schema - Phase 0
 *
 * This is the canonical source of truth for the database schema.
 * - Type-safe with TypeScript
 * - Generated from Zod schemas (SSOT)
 * - Generates migrations automatically
 * - Testable and validatable
 * - Version controlled
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
  integer,
  jsonb,
  boolean,
  real,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================================
// MEETINGS
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export const meetingStatusEnum = pgEnum("meeting_status", ["proposed", "in_session", "ended"]);
export const transcriptSourceEnum = pgEnum("transcript_source", ["upload", "stream", "import"]);
export const transcriptFormatEnum = pgEnum("transcript_format", ["json", "txt", "vtt", "srt"]);
export const chunkStrategyEnum = pgEnum("chunk_strategy", [
  "fixed",
  "semantic",
  "speaker",
  "streaming",
]);
export const selectionStrategyEnum = pgEnum("selection_strategy", [
  "all",
  "relevant",
  "recent",
  "weighted",
]);
export const usedForEnum = pgEnum("used_for", ["draft", "regenerate", "field-specific"]);
export const flaggedDecisionStatusEnum = pgEnum("flagged_decision_status", [
  "pending",
  "accepted",
  "rejected",
  "dismissed",
]);
export const decisionContextStatusEnum = pgEnum("decision_context_status", [
  "drafting",
  "reviewing",
  "locked",
  "logged",
]);
export const decisionMethodEnum = pgEnum("decision_method", [
  "consensus",
  "vote",
  "authority",
  "defer",
  "reject",
]);
export const fieldCategoryEnum = pgEnum("field_category", [
  "context",
  "evaluation",
  "outcome",
  "metadata",
]);
export const fieldTypeEnum = pgEnum("field_type", [
  "text",
  "textarea",
  "select",
  "multiselect",
  "number",
  "date",
  "url",
]);
export const templateCategoryEnum = pgEnum("template_category", [
  "standard",
  "technology",
  "strategy",
  "budget",
  "policy",
  "proposal",
]);
export const expertTypeEnum = pgEnum("expert_type", [
  "technical",
  "legal",
  "stakeholder",
  "custom",
]);
export const mcpServerTypeEnum = pgEnum("mcp_server_type", ["stdio", "http", "sse"]);
export const mcpServerStatusEnum = pgEnum("mcp_server_status", ["active", "inactive", "error"]);
export const taggedByEnum = pgEnum("tagged_by", ["llm", "rule", "manual"]);
export const feedbackRatingEnum = pgEnum("feedback_rating", [
  "approved",
  "needs_work",
  "rejected",
]);
export const feedbackSourceEnum = pgEnum("feedback_source", ["user", "expert_agent", "peer_user"]);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    participants: text("participants").array().notNull(),
    status: meetingStatusEnum("status").default("proposed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_meetings_status").on(table.status),
    dateIdx: index("idx_meetings_date").on(table.date),
  }),
);

// ============================================================================
// TYPE INFERENCE
// ============================================================================

export type MeetingSelect = typeof meetings.$inferSelect;
export type MeetingInsert = typeof meetings.$inferInsert;

// ============================================================================
// TRANSCRIPTS
// ============================================================================

export const rawTranscripts = pgTable(
  "raw_transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id),
    source: transcriptSourceEnum("source").notNull(),
    format: transcriptFormatEnum("format").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    uploadedBy: text("uploaded_by"),
  },
  (table) => ({
    meetingIdx: index("idx_raw_transcripts_meeting").on(table.meetingId),
  }),
);

export type RawTranscriptSelect = typeof rawTranscripts.$inferSelect;
export type RawTranscriptInsert = typeof rawTranscripts.$inferInsert;

// ============================================================================
// TRANSCRIPT CHUNKS
// ============================================================================

export const transcriptChunks = pgTable(
  "transcript_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id),
    rawTranscriptId: uuid("raw_transcript_id")
      .notNull()
      .references(() => rawTranscripts.id),
    sequenceNumber: integer("sequence_number").notNull(),
    text: text("text").notNull(),
    speaker: text("speaker"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    chunkStrategy: chunkStrategyEnum("chunk_strategy").notNull(),
    tokenCount: integer("token_count"),
    wordCount: integer("word_count"),
    contexts: text("contexts").array().notNull(),
    topics: text("topics").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    meetingIdx: index("idx_transcript_chunks_meeting").on(table.meetingId),
    rawTranscriptIdx: index("idx_transcript_chunks_raw").on(table.rawTranscriptId),
  }),
);

export type TranscriptChunkSelect = typeof transcriptChunks.$inferSelect;
export type TranscriptChunkInsert = typeof transcriptChunks.$inferInsert;

// ============================================================================
// SUPPLEMENTARY CONTENT
// ============================================================================

export const supplementaryContent = pgTable(
  "supplementary_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id),
    label: text("label"),
    body: text("body").notNull(),
    sourceType: text("source_type").notNull().default("manual"),
    contexts: text("contexts").array().notNull().default(sql`'{}'::text[]`),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    meetingIdx: index("idx_supcontent_meeting").on(table.meetingId),
    contextsIdx: index("idx_supcontent_contexts").on(table.contexts),
  }),
);

export type SupplementaryContentSelect = typeof supplementaryContent.$inferSelect;
export type SupplementaryContentInsert = typeof supplementaryContent.$inferInsert;

// ============================================================================
// CHUNK RELEVANCE
// ============================================================================

export const chunkRelevance = pgTable(
  "chunk_relevance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => transcriptChunks.id),
    decisionContextId: uuid("decision_context_id").notNull(),
    fieldId: uuid("field_id").notNull(),
    relevance: real("relevance").notNull(),
    taggedBy: taggedByEnum("tagged_by").notNull(),
    taggedAt: timestamp("tagged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    chunkIdx: index("idx_chunk_relevance_chunk").on(table.chunkId),
    contextIdx: index("idx_chunk_relevance_context").on(table.decisionContextId),
    fieldIdx: index("idx_chunk_relevance_field").on(table.fieldId),
  }),
);

export type ChunkRelevanceSelect = typeof chunkRelevance.$inferSelect;
export type ChunkRelevanceInsert = typeof chunkRelevance.$inferInsert;

// ============================================================================
// DECISION CONTEXT WINDOWS
// ============================================================================

export const decisionContextWindows = pgTable(
  "decision_context_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionContextId: uuid("decision_context_id").notNull(),
    chunkIds: uuid("chunk_ids").array().notNull(),
    selectionStrategy: selectionStrategyEnum("selection_strategy").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    totalChunks: integer("total_chunks").notNull(),
    relevanceScores: jsonb("relevance_scores"),
    usedFor: usedForEnum("used_for").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    contextIdx: index("idx_context_windows_context").on(table.decisionContextId),
  }),
);

export type DecisionContextWindowSelect = typeof decisionContextWindows.$inferSelect;
export type DecisionContextWindowInsert = typeof decisionContextWindows.$inferInsert;

// ============================================================================
// DECISION FIELDS
// ============================================================================

export const decisionFields = pgTable(
  "decision_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    namespace: text("namespace").notNull().default("core"),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: fieldCategoryEnum("category").notNull(),
    extractionPrompt: text("extraction_prompt").notNull(),
    instructions: text("instructions"),
    fieldType: fieldTypeEnum("field_type").notNull(),
    placeholder: text("placeholder"),
    validationRules: jsonb("validation_rules"),
    version: integer("version").notNull().default(1),
    isCustom: boolean("is_custom").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    namespaceIdx: index("idx_decision_fields_namespace").on(table.namespace),
    categoryIdx: index("idx_decision_fields_category").on(table.category),
    nameIdx: index("idx_decision_fields_name").on(table.name),
    namespaceNameVersionUq: uniqueIndex("uq_decision_fields_namespace_name_version").on(
      table.namespace,
      table.name,
      table.version,
    ),
  }),
);

export type DecisionFieldSelect = typeof decisionFields.$inferSelect;
export type DecisionFieldInsert = typeof decisionFields.$inferInsert;

// ============================================================================
// DECISION TEMPLATES
// ============================================================================

export const decisionTemplates = pgTable(
  "decision_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    namespace: text("namespace").notNull().default("core"),
    name: text("name").notNull(),
    description: text("description").notNull(),
    promptTemplate: text("prompt_template"),
    category: templateCategoryEnum("category").notNull(),
    version: integer("version").notNull().default(1),
    isDefault: boolean("is_default").notNull().default(false),
    isCustom: boolean("is_custom").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    namespaceIdx: index("idx_decision_templates_namespace").on(table.namespace),
    categoryIdx: index("idx_decision_templates_category").on(table.category),
    namespaceNameVersionUq: uniqueIndex("uq_decision_templates_namespace_name_version").on(
      table.namespace,
      table.name,
      table.version,
    ),
  }),
);

export type DecisionTemplateSelect = typeof decisionTemplates.$inferSelect;
export type DecisionTemplateInsert = typeof decisionTemplates.$inferInsert;

// ============================================================================
// TEMPLATE FIELD ASSIGNMENTS
// ============================================================================

export const templateFieldAssignments = pgTable(
  "template_field_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => decisionTemplates.id),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => decisionFields.id),
    order: integer("order").notNull(),
    required: boolean("required").notNull().default(true),
  },
  (table) => ({
    templateIdx: index("idx_template_assignments_template").on(table.templateId),
    fieldIdx: index("idx_template_assignments_field").on(table.fieldId),
  }),
);

export type TemplateFieldAssignmentSelect = typeof templateFieldAssignments.$inferSelect;
export type TemplateFieldAssignmentInsert = typeof templateFieldAssignments.$inferInsert;

// ============================================================================
// FLAGGED DECISIONS
// ============================================================================

export const flaggedDecisions = pgTable(
  "flagged_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id),
    suggestedTitle: text("suggested_title").notNull(),
    contextSummary: text("context_summary").notNull(),
    confidence: real("confidence").notNull(),
    chunkIds: uuid("chunk_ids").array().notNull(),
    suggestedTemplateId: uuid("suggested_template_id").references(() => decisionTemplates.id),
    templateConfidence: real("template_confidence"),
    status: flaggedDecisionStatusEnum("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    meetingIdx: index("idx_flagged_decisions_meeting").on(table.meetingId),
    statusIdx: index("idx_flagged_decisions_status").on(table.status),
    priorityIdx: index("idx_flagged_decisions_priority").on(table.priority),
  }),
);

export type FlaggedDecisionSelect = typeof flaggedDecisions.$inferSelect;
export type FlaggedDecisionInsert = typeof flaggedDecisions.$inferInsert;

// ============================================================================
// DECISION CONTEXTS
// ============================================================================

export const decisionContexts = pgTable(
  "decision_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id),
    flaggedDecisionId: uuid("flagged_decision_id")
      .notNull()
      .references(() => flaggedDecisions.id),
    title: text("title").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => decisionTemplates.id),
    activeField: uuid("active_field").references(() => decisionFields.id),
    lockedFields: uuid("locked_fields").array().notNull().default(sql`'{}'::uuid[]`),
    draftData: jsonb("draft_data"),
    draftVersions: jsonb("draft_versions")
      .notNull()
      .default([])
      .$type<Array<{ version: number; draftData: Record<string, unknown>; savedAt: string }>>(),
    suggestedTags: text("suggested_tags").array(),
    status: decisionContextStatusEnum("status").notNull().default("drafting"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    meetingIdx: index("idx_decision_contexts_meeting").on(table.meetingId),
    flaggedIdx: index("idx_decision_contexts_flagged").on(table.flaggedDecisionId),
    statusIdx: index("idx_decision_contexts_status").on(table.status),
  }),
);

export type DecisionContextSelect = typeof decisionContexts.$inferSelect;
export type DecisionContextInsert = typeof decisionContexts.$inferInsert;

// ============================================================================
// DECISION FEEDBACK
// ============================================================================

export const decisionFeedback = pgTable(
  "decision_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionContextId: uuid("decision_context_id")
      .notNull()
      .references(() => decisionContexts.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id").references(() => decisionFields.id),
    draftVersionNumber: integer("draft_version_number"),
    fieldVersionId: uuid("field_version_id"),
    rating: feedbackRatingEnum("rating").notNull(),
    source: feedbackSourceEnum("source").notNull(),
    authorId: text("author_id").notNull(),
    comment: text("comment").notNull(),
    textReference: text("text_reference"),
    referenceId: text("reference_id"),
    referenceUrl: text("reference_url"),
    excludeFromRegeneration: boolean("exclude_from_regeneration").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    decisionContextIdx: index("idx_decision_feedback_context").on(table.decisionContextId),
    fieldIdx: index("idx_decision_feedback_field").on(table.fieldId),
    contextFieldIdx: index("idx_decision_feedback_context_field").on(
      table.decisionContextId,
      table.fieldId,
    ),
  }),
);

export type DecisionFeedbackSelect = typeof decisionFeedback.$inferSelect;
export type DecisionFeedbackInsert = typeof decisionFeedback.$inferInsert;

// ============================================================================
// DECISION LOGS
// ============================================================================

export const decisionLogs = pgTable(
  "decision_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id),
    decisionContextId: uuid("decision_context_id")
      .notNull()
      .references(() => decisionContexts.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => decisionTemplates.id),
    templateVersion: integer("template_version").notNull(),
    fields: jsonb("fields").notNull(),
    decisionMethod: jsonb("decision_method").notNull(),
    sourceChunkIds: uuid("source_chunk_ids").array().notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
    loggedBy: text("logged_by").notNull(),
  },
  (table) => ({
    meetingIdx: index("idx_decision_logs_meeting").on(table.meetingId),
    contextIdx: index("idx_decision_logs_context").on(table.decisionContextId),
  }),
);

export type DecisionLogSelect = typeof decisionLogs.$inferSelect;
export type DecisionLogInsert = typeof decisionLogs.$inferInsert;

// ============================================================================
// EXPERT TEMPLATES
// ============================================================================

export const expertTemplates = pgTable(
  "expert_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: expertTypeEnum("type").notNull(),
    promptTemplate: text("prompt_template").notNull(),
    mcpAccess: text("mcp_access").array().notNull(),
    outputSchema: jsonb("output_schema"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeIdx: index("idx_expert_templates_type").on(table.type),
  }),
);

export type ExpertTemplateSelect = typeof expertTemplates.$inferSelect;
export type ExpertTemplateInsert = typeof expertTemplates.$inferInsert;

// ============================================================================
// MCP SERVERS
// ============================================================================

export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    type: mcpServerTypeEnum("type").notNull(),
    connectionConfig: jsonb("connection_config").notNull(),
    capabilities: jsonb("capabilities"),
    status: mcpServerStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index("idx_mcp_servers_name").on(table.name),
    statusIdx: index("idx_mcp_servers_status").on(table.status),
  }),
);

export type MCPServerSelect = typeof mcpServers.$inferSelect;
export type MCPServerInsert = typeof mcpServers.$inferInsert;

// ============================================================================
// EXPERT ADVICE
// ============================================================================

export const expertAdvice = pgTable(
  "expert_advice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionContextId: uuid("decision_context_id")
      .notNull()
      .references(() => decisionContexts.id),
    expertId: uuid("expert_id")
      .notNull()
      .references(() => expertTemplates.id),
    expertName: text("expert_name").notNull(),
    request: text("request").notNull(),
    response: jsonb("response").notNull(),
    mcpToolsUsed: text("mcp_tools_used").array(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    contextIdx: index("idx_expert_advice_context").on(table.decisionContextId),
    expertIdx: index("idx_expert_advice_expert").on(table.expertId),
  }),
);

export type ExpertAdviceSelect = typeof expertAdvice.$inferSelect;
export type ExpertAdviceInsert = typeof expertAdvice.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

// TODO: Add relations in later phases
// export const meetingsRelations = relations(meetings, () => ({
//   // Will add relations in later phases
// }));

// ============================================================================
// EXPORTS
// ============================================================================

// ============================================================================
// LLM INTERACTIONS
// ============================================================================

export const llmInteractionOperationEnum = pgEnum("llm_interaction_operation", [
  "generate_draft",
  "regenerate_field",
]);

export const llmInteractions = pgTable(
  "llm_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decisionContextId: uuid("decision_context_id").notNull(),
    fieldId: uuid("field_id"), // null = full draft generation
    operation: llmInteractionOperationEnum("operation").notNull(),
    promptSegments: jsonb("prompt_segments").notNull().$type<object[]>(),
    promptText: text("prompt_text").notNull(),
    responseText: text("response_text").notNull(),
    parsedResult: jsonb("parsed_result").$type<Record<string, unknown>>(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    tokenCount: jsonb("token_count").$type<{ input: number; output: number }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    decisionContextIdx: index("llm_interactions_decision_context_idx").on(table.decisionContextId),
    fieldIdx: index("llm_interactions_field_idx").on(table.fieldId),
  }),
);

export const schema = {
  meetings,
  rawTranscripts,
  transcriptChunks,
  chunkRelevance,
  decisionContextWindows,
  decisionFields,
  decisionTemplates,
  templateFieldAssignments,
  flaggedDecisions,
  decisionContexts,
  decisionFeedback,
  decisionLogs,
  expertTemplates,
  mcpServers,
  expertAdvice,
  llmInteractions,
};
