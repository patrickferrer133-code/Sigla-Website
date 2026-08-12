-- Closes the anon-key exposure the Supabase linter flags as "RLS Disabled
-- in Public" on every table. No policies are defined yet, so this is a
-- default-deny baseline for the `anon` and `authenticated` PostgREST roles.
-- The app itself is unaffected: it connects via the pooled `postgres` role
-- (DATABASE_URL) and the `service_role` key, both of which carry BYPASSRLS
-- in Supabase-managed Postgres. Granular per-role policies matching
-- docs/03-data-model.md section 11 (coach sees only actively-engaged
-- clients, ended engagements revoke access, etc.) are Phase 2 db-architect
-- work, not a Phase 0 concern — this migration only closes the hole.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coach_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "engagements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intakes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "safety_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "program_weeks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exercise_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exercise_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "set_prescriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "set_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_metrics_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checkins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coach_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "community_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "community_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "community_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sequence_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sequence_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
