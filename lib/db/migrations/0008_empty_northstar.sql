ALTER TABLE "reports" ALTER COLUMN "reporter_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "source" text DEFAULT 'user_report' NOT NULL;