ALTER TABLE "flagged_decisions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
