DO $$ BEGIN
 CREATE TYPE "chunk_strategy" AS ENUM('fixed', 'semantic', 'speaker');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "decision_context_status" AS ENUM('drafting', 'reviewing', 'locked', 'logged');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "decision_method" AS ENUM('consensus', 'vote', 'authority', 'defer', 'reject');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "expert_type" AS ENUM('technical', 'legal', 'stakeholder', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "field_category" AS ENUM('context', 'evaluation', 'outcome', 'metadata');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "field_type" AS ENUM('text', 'textarea', 'select', 'multiselect', 'number', 'date', 'url');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "flagged_decision_status" AS ENUM('pending', 'accepted', 'rejected', 'dismissed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "mcp_server_status" AS ENUM('active', 'inactive', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "mcp_server_type" AS ENUM('stdio', 'http', 'sse');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "meeting_status" AS ENUM('active', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "selection_strategy" AS ENUM('all', 'relevant', 'recent', 'weighted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "tagged_by" AS ENUM('llm', 'rule', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "template_category" AS ENUM('standard', 'technology', 'strategy', 'budget', 'policy', 'proposal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "transcript_format" AS ENUM('json', 'txt', 'vtt', 'srt');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "transcript_source" AS ENUM('upload', 'stream', 'import');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "used_for" AS ENUM('draft', 'regenerate', 'field-specific');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chunk_relevance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_id" uuid NOT NULL,
	"decision_context_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"relevance" real NOT NULL,
	"tagged_by" "tagged_by" NOT NULL,
	"tagged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_context_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_context_id" uuid NOT NULL,
	"chunk_ids" uuid[] NOT NULL,
	"selection_strategy" "selection_strategy" NOT NULL,
	"total_tokens" integer NOT NULL,
	"total_chunks" integer NOT NULL,
	"relevance_scores" jsonb,
	"used_for" "used_for" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"flagged_decision_id" uuid NOT NULL,
	"title" text NOT NULL,
	"template_id" uuid NOT NULL,
	"active_field" uuid,
	"locked_fields" text[] DEFAULT  NOT NULL,
	"draft_data" jsonb,
	"status" "decision_context_status" DEFAULT 'drafting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" "field_category" NOT NULL,
	"extraction_prompt" text NOT NULL,
	"field_type" "field_type" NOT NULL,
	"placeholder" text,
	"validation_rules" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"decision_context_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"fields" jsonb NOT NULL,
	"decision_method" jsonb NOT NULL,
	"source_chunk_ids" uuid[] NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logged_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" "template_category" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expert_advice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_context_id" uuid NOT NULL,
	"expert_id" uuid NOT NULL,
	"expert_name" text NOT NULL,
	"request" text NOT NULL,
	"response" jsonb NOT NULL,
	"mcp_tools_used" text[],
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expert_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "expert_type" NOT NULL,
	"prompt_template" text NOT NULL,
	"mcp_access" text[] DEFAULT  NOT NULL,
	"output_schema" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flagged_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"suggested_title" text NOT NULL,
	"context_summary" text NOT NULL,
	"confidence" real NOT NULL,
	"chunk_ids" uuid[] NOT NULL,
	"suggested_template_id" uuid,
	"template_confidence" real,
	"status" "flagged_decision_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "mcp_server_type" NOT NULL,
	"connection_config" jsonb NOT NULL,
	"capabilities" jsonb,
	"status" "mcp_server_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_servers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"participants" text[] NOT NULL,
	"status" "meeting_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raw_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"source" "transcript_source" NOT NULL,
	"format" "transcript_format" NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "template_field_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"custom_label" text,
	"custom_description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transcript_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"raw_transcript_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"text" text NOT NULL,
	"speaker" text,
	"start_time" text,
	"end_time" text,
	"chunk_strategy" "chunk_strategy" NOT NULL,
	"token_count" integer,
	"word_count" integer,
	"contexts" text[] DEFAULT  NOT NULL,
	"topics" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chunk_relevance_chunk" ON "chunk_relevance" ("chunk_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chunk_relevance_context" ON "chunk_relevance" ("decision_context_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chunk_relevance_field" ON "chunk_relevance" ("field_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_context_windows_context" ON "decision_context_windows" ("decision_context_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_contexts_meeting" ON "decision_contexts" ("meeting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_contexts_flagged" ON "decision_contexts" ("flagged_decision_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_contexts_status" ON "decision_contexts" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_fields_category" ON "decision_fields" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_fields_name" ON "decision_fields" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_logs_meeting" ON "decision_logs" ("meeting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_logs_context" ON "decision_logs" ("decision_context_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_templates_category" ON "decision_templates" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expert_advice_context" ON "expert_advice" ("decision_context_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expert_advice_expert" ON "expert_advice" ("expert_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expert_templates_type" ON "expert_templates" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_flagged_decisions_meeting" ON "flagged_decisions" ("meeting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_flagged_decisions_status" ON "flagged_decisions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_flagged_decisions_priority" ON "flagged_decisions" ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mcp_servers_name" ON "mcp_servers" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mcp_servers_status" ON "mcp_servers" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meetings_status" ON "meetings" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_meetings_date" ON "meetings" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raw_transcripts_meeting" ON "raw_transcripts" ("meeting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_template_assignments_template" ON "template_field_assignments" ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_template_assignments_field" ON "template_field_assignments" ("field_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transcript_chunks_meeting" ON "transcript_chunks" ("meeting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transcript_chunks_raw" ON "transcript_chunks" ("raw_transcript_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chunk_relevance" ADD CONSTRAINT "chunk_relevance_chunk_id_transcript_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "transcript_chunks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_contexts" ADD CONSTRAINT "decision_contexts_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_contexts" ADD CONSTRAINT "decision_contexts_flagged_decision_id_flagged_decisions_id_fk" FOREIGN KEY ("flagged_decision_id") REFERENCES "flagged_decisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_contexts" ADD CONSTRAINT "decision_contexts_template_id_decision_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "decision_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_contexts" ADD CONSTRAINT "decision_contexts_active_field_decision_fields_id_fk" FOREIGN KEY ("active_field") REFERENCES "decision_fields"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_decision_context_id_decision_contexts_id_fk" FOREIGN KEY ("decision_context_id") REFERENCES "decision_contexts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_template_id_decision_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "decision_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_advice" ADD CONSTRAINT "expert_advice_decision_context_id_decision_contexts_id_fk" FOREIGN KEY ("decision_context_id") REFERENCES "decision_contexts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_advice" ADD CONSTRAINT "expert_advice_expert_id_expert_templates_id_fk" FOREIGN KEY ("expert_id") REFERENCES "expert_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flagged_decisions" ADD CONSTRAINT "flagged_decisions_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flagged_decisions" ADD CONSTRAINT "flagged_decisions_suggested_template_id_decision_templates_id_fk" FOREIGN KEY ("suggested_template_id") REFERENCES "decision_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "raw_transcripts" ADD CONSTRAINT "raw_transcripts_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "template_field_assignments" ADD CONSTRAINT "template_field_assignments_template_id_decision_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "decision_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "template_field_assignments" ADD CONSTRAINT "template_field_assignments_field_id_decision_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "decision_fields"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transcript_chunks" ADD CONSTRAINT "transcript_chunks_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transcript_chunks" ADD CONSTRAINT "transcript_chunks_raw_transcript_id_raw_transcripts_id_fk" FOREIGN KEY ("raw_transcript_id") REFERENCES "raw_transcripts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
