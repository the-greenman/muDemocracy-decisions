ALTER TABLE "decision_contexts" ADD COLUMN "suggested_tags" text[];--> statement-breakpoint
ALTER TABLE "decision_fields" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "decision_templates" ADD COLUMN "prompt_template" text;