DO $$ BEGIN
 CREATE TYPE "llm_interaction_operation" AS ENUM('generate_draft', 'regenerate_field');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "llm_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_context_id" uuid NOT NULL,
	"field_id" uuid,
	"operation" "llm_interaction_operation" NOT NULL,
	"prompt_segments" jsonb NOT NULL,
	"prompt_text" text NOT NULL,
	"response_text" text NOT NULL,
	"parsed_result" jsonb,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"token_count" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decision_contexts" ALTER COLUMN "locked_fields" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "expert_templates" ALTER COLUMN "mcp_access" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "transcript_chunks" ALTER COLUMN "contexts" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "decision_contexts" ADD COLUMN IF NOT EXISTS "draft_versions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_fields" ADD COLUMN IF NOT EXISTS "namespace" text DEFAULT 'core' NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_templates" ADD COLUMN IF NOT EXISTS "namespace" text DEFAULT 'core' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_interactions_decision_context_idx" ON "llm_interactions" ("decision_context_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_interactions_field_idx" ON "llm_interactions" ("field_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_fields_namespace" ON "decision_fields" ("namespace");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_decision_fields_namespace_name_version" ON "decision_fields" ("namespace","name","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_decision_templates_namespace" ON "decision_templates" ("namespace");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_decision_templates_namespace_name_version" ON "decision_templates" ("namespace","name","version");--> statement-breakpoint
ALTER TABLE "flagged_decisions" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "template_field_assignments" DROP COLUMN IF EXISTS "custom_label";--> statement-breakpoint
ALTER TABLE "template_field_assignments" DROP COLUMN IF EXISTS "custom_description";