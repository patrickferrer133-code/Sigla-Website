-- Additive indexes for the weekly check-ins feature (docs/_specs/weekly-checkins-spec.md).
-- None touch existing rows or existing query plans for other features.

-- Client's own history page: newest-first by client, not covered by the
-- existing unique index which leads on engagement_id.
CREATE INDEX IF NOT EXISTS "checkins_client_id_week_of_idx" ON "checkins" ("client_id", "week_of" DESC);

-- Coach's awaiting-reply list.
CREATE INDEX IF NOT EXISTS "checkins_awaiting_reply_idx" ON "checkins" ("engagement_id") WHERE "coach_reply" IS NULL;

-- Adherence series: completed sessions per client.
CREATE INDEX IF NOT EXISTS "session_logs_client_id_completed_at_idx" ON "session_logs" ("client_id", "completed_at");

-- Adherence series: prescribed sessions via program structure.
CREATE INDEX IF NOT EXISTS "sessions_program_week_id_idx" ON "sessions" ("program_week_id");
CREATE INDEX IF NOT EXISTS "program_weeks_block_id_week_number_idx" ON "program_weeks" ("block_id", "week_number");

-- e1RM series: qualifying set lookups by exercise and recency.
CREATE INDEX IF NOT EXISTS "set_logs_exercise_id_logged_at_idx" ON "set_logs" ("exercise_id", "logged_at");
