ALTER TABLE "engagements" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "trial_days" integer;