ALTER TABLE "communities" ADD COLUMN "owner_client_id" uuid;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "owner_role" text DEFAULT 'coach' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "cover_photo_url" text;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_owner_client_id_client_profiles_id_fk" FOREIGN KEY ("owner_client_id") REFERENCES "public"."client_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Exactly one owner, matching owner_role — same shape as
-- coach_posts_author_consistency_check (0015). global_goal communities are
-- platform-owned and carved out: they have no owner profile at all.
ALTER TABLE "communities" ADD CONSTRAINT "communities_owner_consistency_check"
  CHECK (
    (kind = 'global_goal' AND owner_coach_id IS NULL AND owner_client_id IS NULL) OR
    (kind <> 'global_goal' AND owner_role = 'coach' AND owner_coach_id IS NOT NULL AND owner_client_id IS NULL) OR
    (kind <> 'global_goal' AND owner_role = 'client' AND owner_client_id IS NOT NULL AND owner_coach_id IS NULL)
  );--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communities_owner_coach_id_idx" ON "communities" USING btree ("owner_coach_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communities_owner_client_id_idx" ON "communities" USING btree ("owner_client_id");