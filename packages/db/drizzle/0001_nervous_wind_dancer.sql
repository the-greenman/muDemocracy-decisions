DO $$ BEGIN
 ALTER TYPE "chunk_strategy" ADD VALUE 'streaming';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "flagged_decisions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;