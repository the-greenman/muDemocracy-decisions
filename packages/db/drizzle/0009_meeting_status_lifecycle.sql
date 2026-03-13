ALTER TYPE "meeting_status" RENAME TO "meeting_status_old";
--> statement-breakpoint
CREATE TYPE "meeting_status" AS ENUM('proposed', 'in_session', 'ended');
--> statement-breakpoint
ALTER TABLE "meetings" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "meetings"
ALTER COLUMN "status" TYPE "meeting_status"
USING (
  CASE "status"::text
    WHEN 'active' THEN 'in_session'
    WHEN 'completed' THEN 'ended'
    ELSE "status"::text
  END
)::"meeting_status";
--> statement-breakpoint
ALTER TABLE "meetings" ALTER COLUMN "status" SET DEFAULT 'proposed';
--> statement-breakpoint
DROP TYPE "meeting_status_old";
