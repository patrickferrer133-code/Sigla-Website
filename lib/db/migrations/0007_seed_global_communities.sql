-- Global goal-based communities (docs/07 phase 3). Idempotent: only inserts
-- rows that don't already exist by name, so re-running this migration (or a
-- future reseed) is safe.
INSERT INTO "communities" ("id", "kind", "owner_coach_id", "name", "description", "goal_tag", "join_policy")
SELECT gen_random_uuid(), 'global_goal', NULL, v.name, v.description, v.goal_tag, 'open'
FROM (VALUES
  ('Fat Loss', 'For anyone working toward a leaner, healthier body — wins, setbacks, and everything between.', 'fat_loss'),
  ('Muscle Gain', 'Building strength and size, one honest week at a time.', 'muscle_gain'),
  ('Strength', 'PRs, plateaus, and the grind of getting stronger.', 'strength'),
  ('General Health', 'Not chasing a number — just trying to feel better and move more.', 'health'),
  ('Building a Habit', 'Consistency over intensity. Showing up is the whole game.', 'habit')
) AS v(name, description, goal_tag)
WHERE NOT EXISTS (
  SELECT 1 FROM "communities" WHERE "communities"."name" = v.name AND "communities"."kind" = 'global_goal'
);
