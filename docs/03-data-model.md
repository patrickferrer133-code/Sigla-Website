# 03 - Data Model

Target database: PostgreSQL. ORM: Drizzle (preferred) or Prisma. All tables use UUID v7 primary keys, `created_at`, `updated_at`, and soft delete via `deleted_at` where user content is involved.

Naming: snake_case tables and columns, plural table names.

---

## 1. Entity map

```
users
 ├── coach_profiles ──── packages
 │                  └── coach_posts
 ├── client_profiles ─── intakes ─── goals
 │                   └── measurements, checkins
 └── memberships (community)

engagements  (the coach <-> client relationship, the spine of the app)
 ├── programs ── blocks ── program_weeks ── sessions ── exercise_groups ── exercise_instances ── set_prescriptions
 ├── session_logs ── set_logs
 ├── checkins
 ├── messages
 └── subscriptions ── payments ── payouts

exercises (global) + coach_exercises (private)
communities ── channels ── posts ── comments ── reports
leads ── lead_events ── pipeline_stages   (premium funnel)
```

---

## 2. Core identity

```sql
users (
  id uuid pk,
  email citext unique not null,
  phone text,
  display_name text not null,
  avatar_url text,
  role text not null check (role in ('coach','client','admin')),
  locale text default 'en-PH',
  timezone text default 'Asia/Manila',
  onboarding_completed_at timestamptz,
  created_at, updated_at, deleted_at
)

coach_profiles (
  id uuid pk,
  user_id uuid fk -> users unique,
  handle citext unique not null,          -- /c/{handle}
  headline text,
  bio text,
  years_experience int,
  specialties text[],                     -- fat_loss, strength, hypertrophy, prenatal, rehab_adjacent, sport
  languages text[],
  coaching_mode text[],                   -- online, in_person, hybrid
  city text, country text,
  credentials jsonb,                      -- [{name, issuer, issued_at, expires_at, verified, evidence_url}]
  verification_status text,               -- unverified, pending, verified
  intro_video_url text,
  tier text not null default 'free',      -- free, pro, premium
  accepting_clients boolean default true,
  rating_avg numeric(3,2), rating_count int,
  created_at, updated_at
)

client_profiles (
  id uuid pk,
  user_id uuid fk -> users unique,
  date_of_birth date,
  sex_at_birth text,                      -- used only for metabolic formulas, never displayed publicly
  height_cm numeric,
  training_age_months int,
  equipment_access text[],
  privacy_prefs jsonb,                    -- {hide_weight: true, hide_photos: true, anonymous_in_community: true}
  created_at, updated_at
)
```

Note on `sex_at_birth`: it is required by BMR formulas. Store it, never render it on any public surface, never use it for anything other than calculation, and allow "prefer not to say" which falls back to an average-based formula.

---

## 3. Commercial

```sql
packages (
  id uuid pk,
  coach_id uuid fk -> coach_profiles,
  title text not null,
  description text,
  price_cents int not null,
  currency text not null default 'PHP',
  billing_period text not null,           -- one_time, monthly, quarterly, per_12_weeks
  inclusions text[],                      -- what the client gets
  slot_limit int,
  slots_taken int default 0,
  is_published boolean default false,
  sort_order int,
  created_at, updated_at
)

engagements (
  id uuid pk,
  coach_id uuid fk -> coach_profiles,
  client_id uuid fk -> client_profiles,
  package_id uuid fk -> packages,
  status text not null,                   -- applied, accepted, active, paused, ended
  started_at timestamptz, ended_at timestamptz,
  end_reason text,
  created_at, updated_at,
  unique (coach_id, client_id, started_at)
)

subscriptions (
  id uuid pk,
  engagement_id uuid fk -> engagements,
  provider text,                          -- paymongo, xendit, stripe
  provider_subscription_id text,
  status text,                            -- trialing, active, past_due, canceled
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false
)

payments (
  id uuid pk,
  subscription_id uuid fk -> subscriptions,
  amount_cents int, currency text,
  platform_fee_cents int,
  coach_net_cents int,
  status text, provider_payment_id text,
  paid_at timestamptz
)

payouts (
  id uuid pk,
  coach_id uuid fk -> coach_profiles,
  amount_cents int, currency text,
  status text, provider_payout_id text,
  period_start date, period_end date,
  released_at timestamptz
)
```

---

## 4. Intake, goals, safety

```sql
intakes (
  id uuid pk,
  client_id uuid fk -> client_profiles,
  engagement_id uuid fk -> engagements null,   -- null if self-serve
  parq_answers jsonb not null,
  parq_flagged boolean not null default false,
  medical_clearance_status text,               -- not_required, required, uploaded, approved
  medical_clearance_url text,
  injuries jsonb,                              -- [{site, side, onset, pain_now_0_10, aggravating_movements[]}]
  conditions text[],
  medications text[],
  pregnancy_status text,
  days_available int,
  session_minutes_max int,
  sleep_hours numeric,
  stress_level int,
  step_baseline int,
  notes text,
  submitted_at timestamptz
)

goals (
  id uuid pk,
  client_id uuid fk -> client_profiles,
  type text not null,                     -- fat_loss, muscle_gain, strength, endurance, health, habit
  is_primary boolean default false,
  target_metric text,                     -- bodyweight_kg, waist_cm, e1rm_kg, sessions_per_week, steps
  target_value numeric,
  target_date date,
  why_now text,
  success_definition text,
  realism_verdict text,                   -- realistic, stretch, reframed, blocked
  realism_suggested_value numeric,
  realism_suggested_date date,
  status text,                            -- active, achieved, revised, abandoned
  created_at, updated_at
)

safety_flags (
  id uuid pk,
  client_id uuid fk -> client_profiles,
  kind text not null,                     -- parq_cardiac, pain_report, ed_risk, underweight_target, rapid_loss
  severity text not null,                 -- info, warn, block
  payload jsonb,
  resolved_at timestamptz,
  resolved_by uuid fk -> users
)
```

`safety_flags` with severity `block` must prevent program assignment and nutrition targets until resolved. This is enforced at the service layer, not the UI layer.

---

## 5. Exercise library

```sql
exercises (
  id uuid pk,
  name text not null,
  aliases text[],
  primary_muscle text not null,
  secondary_muscles text[],
  movement_pattern text not null,         -- squat, hinge, h_push, h_pull, v_push, v_pull, lunge, carry, rotation, anti_rotation, isolation, conditioning
  equipment text[] not null,
  is_unilateral boolean default false,
  loading_type text not null,             -- external, bodyweight, bw_plus_load, time, distance, calories
  difficulty int,                         -- 1 to 5
  substitution_group text,                -- exercises sharing a group are valid swaps
  progression_of uuid fk -> exercises,
  contraindications text[],               -- lower_back, shoulder, knee, wrist, pregnancy
  video_url text, thumbnail_url text,
  cues text[],
  is_global boolean default true,
  owner_coach_id uuid fk -> coach_profiles null,
  created_at, updated_at
)
```

Coach private exercises use the same table with `is_global = false` and an `owner_coach_id`. Do not build a second table.

---

## 6. Programming

```sql
programs (
  id uuid pk,
  coach_id uuid fk -> coach_profiles,
  engagement_id uuid fk -> engagements null,   -- null means it is a template
  is_template boolean default false,
  title text not null, description text,
  goal_type text,
  weeks_total int,
  version int not null default 1,
  parent_program_id uuid fk -> programs null,  -- version lineage
  status text,                                 -- draft, active, completed, archived
  starts_on date,
  created_at, updated_at
)

blocks (
  id uuid pk, program_id uuid fk -> programs,
  name text, focus text,                       -- accumulation, intensification, realization, deload, base
  order_index int, weeks int
)

program_weeks (
  id uuid pk, block_id uuid fk -> blocks,
  week_number int, is_deload boolean default false, coach_note text
)

sessions (
  id uuid pk, program_week_id uuid fk -> program_weeks,
  name text,                                   -- "Day A - Lower"
  day_index int,                               -- 0 to 6, or null for flexible scheduling
  estimated_minutes int, coach_note text, order_index int
)

exercise_groups (
  id uuid pk, session_id uuid fk -> sessions,
  kind text not null,                          -- straight, superset, circuit, giant, emom, amrap_block
  label text,                                  -- A, B1, B2
  rounds int, rest_seconds int, order_index int
)

exercise_instances (
  id uuid pk, exercise_group_id uuid fk -> exercise_groups,
  exercise_id uuid fk -> exercises,
  order_index int,
  coach_note text,
  substitution_allowed boolean default true
)

set_prescriptions (
  id uuid pk, exercise_instance_id uuid fk -> exercise_instances,
  set_number int not null,
  set_type text default 'working',             -- warmup, working, backoff, drop, cluster, myoreps
  reps_mode text not null,                     -- fixed, range, amrap, time, distance, calories
  reps_min int, reps_max int, duration_seconds int, distance_m int,
  load jsonb not null,                         -- {type: 'kg'|'pct_1rm'|'rpe'|'rir'|'bodyweight'|'band'|'relative', value, reference}
  tempo text,                                  -- '3010'
  rest_seconds int,
  progression jsonb                            -- {model:'double'|'linear'|'pct'|'rpe', increment, unit}
)
```

The `load` column is deliberately jsonb. Do not flatten it into a numeric column, it will break within a week of real coach usage.

---

## 7. Logging

```sql
session_logs (
  id uuid pk,
  session_id uuid fk -> sessions null,         -- null for ad hoc sessions
  client_id uuid fk -> client_profiles,
  engagement_id uuid fk -> engagements null,
  started_at timestamptz, completed_at timestamptz,
  status text,                                 -- in_progress, completed, skipped
  skip_reason text,
  session_rpe int,                             -- 1 to 10, whole-session
  mood int, energy int,
  notes text
)

set_logs (
  id uuid pk,
  session_log_id uuid fk -> session_logs,
  set_prescription_id uuid fk -> set_prescriptions null,
  exercise_id uuid fk -> exercises,
  set_number int,
  reps int, load_kg numeric, duration_seconds int, distance_m int,
  rpe numeric, rir int,
  is_pr boolean default false,
  pain_reported boolean default false,
  pain_site text, pain_score int,
  substituted_from_exercise_id uuid fk -> exercises null,
  logged_at timestamptz
)
```

Derived values (e1RM, volume load, adherence) are computed, not stored raw, except where they are materialized into `client_metrics_daily` for chart performance.

```sql
client_metrics_daily (
  client_id uuid, date date,
  bodyweight_kg numeric,
  bodyweight_trend_kg numeric,               -- 7 day rolling average, this is the number we display
  steps int, sleep_hours numeric,
  sessions_prescribed int, sessions_completed int,
  volume_load_kg numeric,
  primary key (client_id, date)
)
```

---

## 8. Check-ins

```sql
checkins (
  id uuid pk,
  engagement_id uuid fk -> engagements,
  client_id uuid fk -> client_profiles,
  week_of date not null,
  bodyweight_kg numeric,
  measurements jsonb,                        -- {waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm}
  photo_keys text[],                         -- private object storage keys, never public URLs
  adherence_training_pct int,
  adherence_nutrition_pct int,
  avg_steps int, avg_sleep_hours numeric,
  energy int, hunger int, stress int, motivation int, soreness int, mood int,
  went_well text, got_in_the_way text,
  coach_reply text, coach_replied_at timestamptz,
  submitted_at timestamptz,
  unique (engagement_id, week_of)
)
```

Photos are stored as private keys and served through short-lived signed URLs only. Never store a public URL for a progress photo.

---

## 9. Content, community, messaging

```sql
coach_posts (
  id uuid pk, coach_id uuid fk -> coach_profiles,
  kind text,                                 -- case_study, article, program_showcase, video, win
  title text, body_md text, media jsonb,
  tags text[], visibility text,              -- public, clients_only
  is_promoted boolean default false,         -- content push, requires tier
  promoted_until timestamptz,
  published_at timestamptz, created_at, updated_at
)

communities (
  id uuid pk, kind text,                     -- global_goal, coach_private
  owner_coach_id uuid fk -> coach_profiles null,
  name text, description text, goal_tag text,
  join_policy text                           -- open, request, clients_only
)

community_memberships (community_id, user_id, role, display_alias, joined_at)
community_posts (id, community_id, author_user_id, body_md, media, is_anonymous, created_at)
community_comments (id, post_id, author_user_id, body_md, created_at)
reports (id, target_type, target_id, reporter_user_id, reason, status, resolved_by, resolved_at)

messages (
  id uuid pk, engagement_id uuid fk -> engagements,
  sender_user_id uuid fk -> users,
  body text, media jsonb, read_at timestamptz, created_at
)
```

`is_anonymous` plus `display_alias` is what makes the judgement-free promise real in community. A client can post "I have not trained in 3 weeks and I feel like giving up" without their name attached.

---

## 10. Funnel (Premium tier)

```sql
leads (
  id uuid pk, coach_id uuid fk -> coach_profiles,
  source text,                               -- quiz, profile_cta, post, referral, import
  email citext, name text, phone text,
  quiz_answers jsonb, score int,
  stage_id uuid fk -> pipeline_stages,
  owner_user_id uuid fk -> users,
  status text,                               -- new, contacted, qualified, proposal, won, lost
  lost_reason text,
  created_at, updated_at
)

pipeline_stages (id, coach_id, name, order_index, is_won, is_lost)
lead_events (id, lead_id, kind, payload jsonb, occurred_at)   -- viewed_profile, submitted_quiz, booked_call, no_show, sent_proposal
sequences (id, coach_id, name, trigger, is_active)
sequence_steps (id, sequence_id, order_index, delay_hours, channel, template_md)
sequence_enrollments (id, sequence_id, lead_id, current_step, status, next_send_at)
```

---

## 11. Access control notes

If using Supabase or any Postgres with row level security, the policy set is:

- A user reads their own `users` row and their own profile rows.
- A coach reads a client's intake, goals, checkins, logs, and programs only where an `engagements` row exists with status in (accepted, active, paused) linking them.
- When an engagement ends, coach read access to new data stops. Historical access is retained for a defined window then revoked. Define this window in doc 06.
- Progress photos are readable only by the owning client and the currently engaged coach, and never by admins without an audited access record.
- Community posts marked anonymous must not expose `author_user_id` to any non-admin client of the API. Strip it at the serializer, not the query.
