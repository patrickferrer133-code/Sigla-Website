CREATE TABLE "coach_team_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_coach_id" uuid NOT NULL,
	"member_user_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_team_members" ADD CONSTRAINT "coach_team_members_owner_coach_id_coach_profiles_id_fk" FOREIGN KEY ("owner_coach_id") REFERENCES "public"."coach_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_team_members" ADD CONSTRAINT "coach_team_members_member_user_id_users_id_fk" FOREIGN KEY ("member_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;