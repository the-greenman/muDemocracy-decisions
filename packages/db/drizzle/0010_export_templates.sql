CREATE TABLE IF NOT EXISTS "export_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deliberation_template_id" uuid NOT NULL,
	"namespace" text DEFAULT 'core' NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"lineage" jsonb,
	"provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_template_field_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"export_template_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"title" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_export_templates_deliberation_template" ON "export_templates" ("deliberation_template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_export_templates_namespace" ON "export_templates" ("namespace");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_export_templates_is_default" ON "export_templates" ("is_default");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_export_templates_namespace_name_version" ON "export_templates" ("namespace","name","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_export_template_assignments_template" ON "export_template_field_assignments" ("export_template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_export_template_assignments_field" ON "export_template_field_assignments" ("field_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_templates" ADD CONSTRAINT "export_templates_deliberation_template_id_decision_templates_id_fk" FOREIGN KEY ("deliberation_template_id") REFERENCES "decision_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_template_field_assignments" ADD CONSTRAINT "export_template_field_assignments_export_template_id_export_templates_id_fk" FOREIGN KEY ("export_template_id") REFERENCES "export_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "export_template_field_assignments" ADD CONSTRAINT "export_template_field_assignments_field_id_decision_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "decision_fields"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
