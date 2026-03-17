CREATE TABLE IF NOT EXISTS "stream_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"type" text NOT NULL,
	"text" text,
	"speaker" text,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"stream_source" text,
	"data" jsonb NOT NULL,
	"flushed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transcript_chunks" ADD COLUMN "stream_source" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stream_events_meeting_idx" ON "stream_events" ("meeting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stream_events_flushed_idx" ON "stream_events" ("flushed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stream_events_meeting_flushed_idx" ON "stream_events" ("meeting_id","flushed");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stream_events" ADD CONSTRAINT "stream_events_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
