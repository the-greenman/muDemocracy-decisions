ALTER TABLE "decision_contexts"
ADD COLUMN "draft_versions" jsonb DEFAULT '[]'::jsonb NOT NULL;
