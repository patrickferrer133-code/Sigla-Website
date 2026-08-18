ALTER TABLE "coach_posts" ALTER COLUMN "coach_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_posts" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "coach_posts" ADD COLUMN "author_role" text DEFAULT 'coach' NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_posts" ADD CONSTRAINT "coach_posts_client_id_client_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_posts_coach_id_idx" ON "coach_posts" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_posts_client_id_idx" ON "coach_posts" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "coach_posts" ADD COLUMN "guidelines_acked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coach_posts" ADD COLUMN "guidelines_ack_version" text;--> statement-breakpoint
ALTER TABLE "coach_posts" ADD CONSTRAINT "coach_posts_author_consistency_check"
  CHECK (
    (author_role = 'coach' AND coach_id IS NOT NULL AND client_id IS NULL) OR
    (author_role = 'client' AND client_id IS NOT NULL AND coach_id IS NULL)
  );