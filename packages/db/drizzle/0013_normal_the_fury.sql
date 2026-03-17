CREATE TABLE IF NOT EXISTS "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"active_meeting_id" uuid,
	"active_decision_id" uuid,
	"active_decision_context_id" uuid,
	"active_field" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connections" ADD CONSTRAINT "connections_active_meeting_id_meetings_id_fk" FOREIGN KEY ("active_meeting_id") REFERENCES "meetings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connections" ADD CONSTRAINT "connections_active_decision_id_flagged_decisions_id_fk" FOREIGN KEY ("active_decision_id") REFERENCES "flagged_decisions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connections" ADD CONSTRAINT "connections_active_decision_context_id_decision_contexts_id_fk" FOREIGN KEY ("active_decision_context_id") REFERENCES "decision_contexts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
