ALTER TABLE "flagged_decisions" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "flagged_decisions" ALTER COLUMN "updated_at" SET NOT NULL;