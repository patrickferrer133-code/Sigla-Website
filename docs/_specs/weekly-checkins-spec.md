# Feature: Weekly client check-ins, coach reply, and trend charts

Phase 1 slice, per `docs/07-roadmap.md`. Status: spec, not yet built.
Depends on: exercise library, program builder, workout logger (all shipped).
**Gate: this feature is inside `docs/06` scope (health data, bodyweight). It does not ship without a `safety-compliance-reviewer` pass.**

## Problem

Online coaching runs on a weekly ritual: the client reports how the week actually went, the coach reads it and adjusts. Today in Sigla there is no surface for it at all. The `checkins` table exists and the seed writes ~85% weekly submission rates into it, but nothing reads or writes it in the app.

Off-platform, the solo coach does this through Messenger threads plus a spreadsheet: the client types numbers into chat, the coach scrolls back three weeks to remember what the numbers were, and there is no trend line anywhere. `docs/08` section 4 puts a number on it — twelve check-ins should take twenty minutes, not ninety.

For the client, the failure mode is worse than inefficiency. Reading raw weekly weight off a chat thread is exactly the anxiety-producing pattern `docs/06` section 3 exists to prevent. A 0.8kg jump from water retention reads as failure, and the client quits in the weeks 3 to 6 cliff (`docs/08` section 2).

## Personas affected

| Persona | How they experience this |
|---|---|
| Coach A, Solo Operator | Primary beneficiary. Replaces the spreadsheet-plus-Messenger check-in loop. Needs it fast on a laptop at midday, and readable on a phone between clients |
| Coach B, Growing Brand | Same, at 25 to 60 clients. Will feel the absence of the triage queue and saved replies immediately — those are the next slice, not this one |
| Client A, Intimidated Beginner | Most safety-sensitive user. Must be able to complete a check-in without ever seeing a weight number, and without any field feeling mandatory or judgemental |
| Client B, Stalled Intermediate | Primary consumer of the trend charts. e1RM and adherence trends are what tell them whether the stall is real or a data artefact |

## Scope

### In scope

- Client weekly check-in form: **up to 7 daily bodyweight entries for the week** (all optional), optional measurements (waist/hip/chest/arm/thigh), self-reported adherence (training %, nutrition %), avg steps, avg sleep hours, six subjective 1-5 scores, two free-text fields
- One check-in per engagement per `week_of`, enforced by the existing unique constraint
- Client check-in history list, read-only, with each week's coach reply inline
- Coach view of one client's check-in history, and a reply on a specific check-in (`coach_reply`, `coach_replied_at`)
- Coach "awaiting reply" list — the minimum needed to find check-ins that need a response
- Trend charts on both sides: rolling 7-day weight trend, e1RM per key lift, adherence (actual session completion, with self-reported adherence as a second series)
- Weight privacy enforcement on every surface listed above
- Writing daily bodyweights into `client_metrics_daily` and recomputing `bodyweight_trend_kg` (see Data changes — this is the one real gap found)

### Out of scope, explicitly

Do not build these as part of this feature. Each is called out because it is adjacent enough to be built by accident.

- **Progress photo upload or display.** `photo_keys` stays untouched and unwritten. Needs a private bucket, short-lived signed URLs, and EXIF stripping. Separate feature, separate safety review (CLAUDE.md rule 3)
- **Nutrition or calorie targets.** `adherence_nutrition_pct` is a client's own self-report of how well they stuck to whatever they are doing. It is not a target, is not derived from one, and must not be presented next to one. The calorie floor feature is separate
- **Push or email notifications** about a submitted check-in or a coach reply. In-app only. Notification batching is Phase 3
- **The eating-disorder-risk screening flow.** That is intake-time (`docs/06` section 3), not check-in-time. This feature *reads* an existing unresolved `ed_risk` safety flag to suppress displays; it never runs the screen
- **The full check-in triage queue** with next/previous navigation, keyboard shortcuts, and saved reply snippets (`docs/08` section 4). See Sequencing below
- **Bulk operations**, program auto-adjustment from check-in data, and the weeks 3 to 6 churn alert wiring
- **Analytics instrumentation.** There is none in this codebase yet. Do not add any here (see Analytics)
- **A standalone daily weigh-in surface.** Daily weights are collected, but only through the weekly check-in form's 7-day grid. No separate daily-logging screen, no reminder to weigh in, in this slice

### Why daily weights are collected, when the ritual is weekly

Amended after `fitness-domain-expert` review. This is a safety correction, not a preference.

`rollingAverage()` in `lib/domain/metrics.ts` is **index-based**: it averages the last N *array elements*, not the last N *days*. With weight arriving once per week, every 7-element window contains exactly one value, so the "7-day trend" would be arithmetically identical to the raw weekly number. The feature would pass a naive reading of `docs/06` §3 while functionally showing the client a single day's weight — the precise harm the rule exists to prevent.

Two fixes were available. **This spec takes option (a): collect up to 7 daily weights per week.** It matches `docs/01` §10 ("daily weigh-ins averaged weekly"), it is what coaches already ask clients to do, and it keeps the 7-day window honest and responsive.

Option (b), a 28-day window over weekly points, was rejected: 4 points is a real average, but a 28-day window lags roughly two weeks, and on a 12-week engagement that means the trend only becomes informative around the same time the weeks 3 to 6 churn cliff has already done its damage (`docs/08` §2).

**Never carry forward or interpolate a missing day.** A skipped weigh-in is absent data, not a repeat of yesterday. Fabricating it would flatten real variance and understate a real trend.

### Sequencing, pushing back on scope

Three slices, in order. This spec is slice 1 only.

1. **This spec.** Form, history, reply, trends. Makes the weekly ritual possible.
2. **Triage queue.** Queue with next/previous, unreplied-first ordering, saved reply snippets with personalization tokens, reply-and-advance. Makes it *fast*, which is what `docs/08` says decides whether a coach keeps the tool.
3. **Check-in-driven alerting.** `checkin_missed` and `weeks_3_to_6_churn_risk` wired into the coach dashboard from real data. `lib/domain/alerts.ts` already has the pure detectors, unwired.

Build the reply as a server action with no UI coupling so slice 2 reuses it unchanged.

## User stories and acceptance criteria

### Story 1 — Client submits this week's check-in

As the Intimidated Beginner, I want to report my week in one short form, so that my coach can adjust my plan without me having to explain it in chat.

- **Given** I am a signed-in client with an engagement in status `accepted`, `active`, or `paused`
- **When** I open `/client/check-in`
- **Then** I see a form for the current `week_of`, where `week_of` is the Monday of the current week in my own timezone (`users.timezone`, default `Asia/Manila`)
- **And** the weight section is a 7-slot grid, one per day Monday to Sunday of `week_of`, each independently optional and each labelled with its date
- **And** every field is optional except that at least one field must be non-empty to submit
- **And** no field is marked "required", and no copy implies a missed field or a skipped weigh-in day is a failure
- **And** future days within the current week are disabled rather than hidden, so the grid does not reflow as the week progresses

- **Given** I have filled in some fields
- **When** I submit
- **Then** a `checkins` row is written with `engagement_id`, `client_id`, `week_of`, and `submitted_at = now()`
- **And** `checkins.bodyweight_kg` stores the mean of whatever daily weights I entered, rounded to 2dp, or null if I entered none — the per-day values live in `client_metrics_daily`, so no schema change is needed
- **And** I am shown a confirmation that does not restate my bodyweight back to me
- **And** I am redirected to `/client/check-in/history`

- **Given** I already submitted a check-in for the current `week_of`
- **When** I open `/client/check-in`
- **Then** I see my submitted answers in an editable form, not a blank one, and the primary action reads "Update"
- **And** submitting updates the existing row rather than erroring on the unique constraint

- **Given** my coach has already replied to this week's check-in (`coach_replied_at` is not null)
- **When** I open `/client/check-in`
- **Then** the form is read-only, with the coach's reply shown above it
- **And** the copy explains that the week is closed and points me at chat for anything further

- **Given** I have no engagement, or my only engagement has status `applied` or `ended`
- **When** I open `/client/check-in`
- **Then** I see the empty state: a plain-language explanation that weekly check-ins start when I have a coach, plus a link to `/discover`
- **And** no form is rendered, and a direct call to the submit action returns `engagement_inactive`

- **Given** a submission fails on the network (mid-range Android, mobile data)
- **When** the action returns an error
- **Then** my entered values stay in the form, an inline error explains the failure in plain language, and the submit button is re-enabled

### Story 2 — Weight is not shown to a client who has not opted in

As the Intimidated Beginner, I want the app to not put my weight in front of me, so that one bad number does not end my week.

- **Given** `client_profiles.privacy_prefs.hideWeight` is `true` (the default for every new client)
- **When** I load `/client`, `/client/progress`, `/client/check-in/history`, or any server action serving them
- **Then** the response body contains no bodyweight value and no bodyweight trend value, for any week
- **And** the progress view leads with sessions completed, e1RM trend, steps, sleep, and streak, per `docs/06` section 3
- **And** a single quiet control offers "Show my weight trend", which sets `hideWeight` to `false`

- **Given** `hideWeight` is `true`
- **When** I open the check-in form
- **Then** the 7-day weight grid is still present (entering is not displaying), with no previous week's values prefilled, no running mean shown as I type, and no comparison to any prior week

- **Given** I set `hideWeight` to `false`
- **When** I load the progress view
- **Then** the headline weight figure is `client_metrics_daily.bodyweight_trend_kg` for the latest date that has a non-null trend value, labelled in the UI as "7-day trend"
- **And** any raw daily value appears only as secondary chart dots, never as the headline, and never as a week-over-week delta computed from raw values — deltas come from the trend series only

- **Given** the trailing 7 days contain fewer than **3** distinct days with a weight
- **When** the trend is computed for that date
- **Then** `bodyweight_trend_kg` is null for that date, no headline figure is shown, and the copy reads that a trend needs at least 3 weigh-ins in a week
- **And** the raw dots for those days may still be shown, clearly secondary, so the client is not told their entry vanished
- **And** the system never carries forward or interpolates a missing day to reach the threshold

- **Given** I have an unresolved `safety_flags` row with `kind = 'ed_risk'`
- **When** I load any surface in this feature, on either side, whatever `hideWeight` says
- **Then** no bodyweight, bodyweight trend, or measurement value is present in the response
- **And** the 7-day weight grid and the measurement inputs are absent from the check-in form
- **And** a submission that nonetheless carries those fields has them dropped server-side and stored as null, without failing the rest of the check-in
- **And** the client sees the support-resources copy from the intake flow, not a bare blank space

> Reuse `serializeClientDashboardMetrics` and `shouldSuppressWeightAndCalorieDisplay` from `lib/access/policies.ts` and `lib/domain/safety.ts`. Suppression happens in the serializer, before the value reaches the component. Do not filter in the component.

### Story 3 — Client reads their history and their coach's replies

As the Stalled Intermediate, I want to see past check-ins and what my coach said, so that I can tell whether anything actually changed.

- **Given** I have submitted at least one check-in
- **When** I open `/client/check-in/history`
- **Then** I see my check-ins newest first, 12 per page, each showing `week_of`, subjective scores, adherence, steps, sleep, my free text, and the coach reply if there is one
- **And** weight and measurements appear only under the Story 2 rules

- **Given** I have submitted none
- **Then** I see an empty state naming what a check-in is and a button to start this week's

- **Given** my engagement ended
- **Then** my own history stays fully readable to me — the coach access window in Story 6 restricts the coach, never the client's access to their own data

### Story 4 — Coach reviews a client's check-ins and replies

As the Solo Operator, I want to read a check-in and reply on it, so that the conversation lives next to the data instead of in a chat scroll.

- **Given** I am a coach with an engagement in status `accepted`, `active`, or `paused` with this client
- **When** I open `/coach/clients/{clientId}/checkins`
- **Then** I see that client's check-ins newest first, each fully expanded on desktop and collapsed-with-summary on mobile
- **And** each check-in shows self-reported training adherence alongside actual session completion for that week, because the gap between them is the coaching signal

- **When** I write a reply and save
- **Then** `coach_reply` is set and `coach_replied_at` is set to the save time
- **And** the check-in leaves my awaiting-reply list
- **And** the client sees the reply on their next load of the history page, with no notification sent (out of scope)

- **Given** I have already replied
- **When** I edit the reply and save
- **Then** the text is replaced and `coach_replied_at` moves to the new save time
- **And** no reply history is kept in this slice

- **Given** the reply body is empty or whitespace
- **Then** the action returns a `validation` error and `coach_replied_at` is not set

- **Given** this client has submitted no check-ins
- **Then** I see an empty state that says so and offers a one-tap message action, not a blank table

- **Given** I open `/coach/checkins`
- **Then** I see every check-in across my active engagements with `coach_reply is null`, oldest `week_of` first, with client name and `week_of`
- **And** the empty state reads as done, not as broken: "Nothing waiting. You are caught up."

### Story 5 — Trend charts

As either side, I want three trends, so that a single week's number never drives a decision.

- **Given** a client with at least two weeks of data
- **When** the trend view loads on `/client/progress` or `/coach/clients/{clientId}/checkins`
- **Then** I get up to three charts over a selectable 8/12/26-week window, default 12, built to the rules below

**Chart 1 — Weight trend.** `client_metrics_daily.bodyweight_trend_kg` as the primary line, raw daily values as secondary dots. Rendered only when Story 2 permits. Dates with a null trend (fewer than 3 weigh-ins in the trailing 7 days) are **gaps in the line, not zeros and not bridged segments** — a bridged line across a 3-week gap asserts a trajectory nobody measured.

**Chart 2 — e1RM per key lift.** Weekly best `estimatedOneRepMaxEpley(loadKg, reps)`. Four filters, all mandatory:

- **Set type**: only `set_prescriptions.set_type in ('working','backoff')`. Drop sets, myoreps, and cluster sets are performed pre-fatigued or fragmented and inflate a single-set e1RM well above true capacity
- **Rep cap**: only sets with `reps <= 10` feed the calculation. Epley is linear and drifts badly past ~10 reps; a 20-rep set produces a fictional 1RM. Sets above the cap are excluded, not clamped
- **Loadable exercises only**: exclude any set whose `exercises.loading_type` is not `external` or `bw_plus_load`. For bodyweight, time, distance, and calorie exercises `load_kg` is null, and `estimatedOneRepMaxEpley` returns 0 for a null or zero load — plotting that draws a false floor point at zero and reads as catastrophic strength loss
- **Deload marking**: points falling in a `program_weeks.is_deload = true` week are flagged in the series and rendered visually distinct (hollow marker plus a legend note). A planned deload dip must not read as regression to a client or trigger a coach's stall reaction

**Chart 2 lift selection.** Not "top 4 by set count" — that elects curls and lateral raises over the lifts that actually indicate progress. Select by `exercises.movement_pattern`, **one exercise per pattern**, in priority order `squat`, `hinge`, `h_push`, `h_pull`, falling back to `v_pull` then `v_push` when one of the four is absent from this client's logged history. Within a pattern, pick the exercise with the most qualifying working sets in the window. This tracks `docs/01` §8's "3 to 5 key lifts" framing. An exercise needs **>= 2 distinct weeks** of qualifying data before it is charted at all.

**Chart 3 — Adherence.** Two series, visibly distinct:

- **Actual**: `sessionCompletionRate(completed, prescribed)` per week, where **`prescribed` comes from program structure, not from logs**: count `sessions` under the `program_weeks` row mapping to that calendar week, via `programs.starts_on` plus `program_weeks.week_number`. A session the client never opened has **no `session_logs` row at all**, so deriving prescribed from logs silently undercounts and inflates adherence toward 100% for exactly the disengaged client the coach most needs to see. `completed` comes from `session_logs` with `status = 'completed'` in that week
- **Self-reported**: `checkins.adherence_training_pct`, labelled as self-reported. The gap between the two series is the coaching signal

- **Given** a week where `prescribed` is 0 (no active program, engagement not started, or a gap between programs)
- **Then** the actual-adherence series emits **no point for that week** — null, a gap in the line
- **And** it must not emit 0%. `sessionCompletionRate(0, 0)` returns `0`, so the caller checks `prescribed === 0` *before* calling it. Charting a fabricated 0% tells a coach a client failed a week in which nothing was ever asked of them

- **Given** a client with fewer than two data points for a given chart
- **Then** that chart is replaced by a short "not enough data yet, come back after week 2" panel — never an axis with one dot, and never an empty SVG

- **Given** a client with weight data but `hideWeight = true`, or an unresolved `ed_risk` flag
- **Then** chart 1 is absent from the response payload entirely, not rendered blank or greyed
- **And** charts 2 and 3 render normally, because they are the non-weight progress the dashboard is supposed to lead with

- **Given** the page is loading
- **Then** each chart shows a skeleton at its final height, so the layout does not jump on a slow connection

- **Given** I am on a phone
- **Then** charts are full-bleed, one per vertical scroll, touch-scrubbable, with no hover-only affordance and no horizontal-scroll-inside-vertical-scroll trap
- **And** the check-in form is single-column with numeric inputs using `inputMode="decimal"`, the six 1-5 scores as tap targets of at least 44px, and free-text fields that do not trigger a layout jump when the keyboard opens

### Story 6 — Permission denied, on every path

- **Given** I am a client and I request another client's check-in, history, or trends, by id, through any action or route
- **Then** the result is `not_found`, not `forbidden` — existence is not confirmed to a stranger

- **Given** I am a coach with no engagement with this client, or an engagement in status `applied`
- **When** I request their check-ins by client id
- **Then** the result is `not_found` and nothing about that client is rendered or logged

- **Given** my engagement with this client is `ended`
- **When** I request their check-ins
- **Then** I get only check-ins whose `submitted_at` is at or before `engagements.ended_at`, and only while within the historical access window
- **And** check-ins submitted after the engagement ended are never returned, per CLAUDE.md rule 5
- **And** the reply action returns `engagement_inactive` regardless of the window
- **And** this is enforced by `coachCanAccessClientData` in `lib/access/policies.ts`, which already exists

- **Given** I am an admin
- **Then** I get no check-in read surface in this slice. Admin access to health data needs an audited access record (`docs/03` section 11) and is not built here

- **Given** I am signed out
- **Then** every route redirects to `/sign-in?next=...` via the existing `requireRole`

## Data changes

**No new tables. No new columns.** `checkins` in `lib/db/schema/checkins.ts` already matches `docs/03` section 8 exactly, including `unique(engagement_id, week_of)`.

One real gap found, and it is a pipeline gap rather than a schema one:

> **Nothing writes `client_metrics_daily.bodyweight_kg` or `bodyweight_trend_kg` outside the seed script.** The weight trend chart reads that table, so without this the chart is frozen at seed data forever and a client's own check-in never moves their trend line.

Required service behaviour, for `backend-engineer`:

**Write, keyed on `week_of`.** Each daily weight belongs to date `week_of + dayIndex`, `dayIndex` 0 to 6. Upsert `client_metrics_daily` on the composite primary key `(client_id, date)` with `onConflictDoUpdate`.

Do **not** key any of this on the check-in's submission date. That was wrong in the first draft of this spec: editing a Monday check-in on the following Thursday would write a second, orphaned row against the edit date. Keying on `week_of` is deterministic and idempotent across any number of edits.

- On create or update, write the entered days, and **null `bodyweight_kg` for days inside `week_of .. week_of + 6` that were cleared** in the edit, so removing a mistyped weight actually removes it
- Never touch rows outside that 7-day span

**Recompute, over a date-indexed array.** `rollingAverage()` is index-based. It must therefore be handed a **dense, date-indexed array with `null` for every day that has no weight** — never a compacted array of the rows that happen to exist. Passing raw query results, where absent days are simply missing, silently averages across arbitrary time spans.

- Build the dense array from `week_of - 6` through `week_of + 12` (the edited week, plus the 6 prior days each of its days depends on, plus the 6 following days whose windows include it)
- One `null` entry per calendar day with no weight. No carry-forward, no interpolation
- Compute via a new pure helper in `lib/domain/checkins.ts`, `weightTrendSeries(denseValues, { windowDays: 7, minObservations: 3 })`, built on `rollingAverage`: it returns `null` for any date whose trailing 7-day window holds fewer than 3 non-null values, and the mean otherwise. The `minObservations` guard is what makes the Story 2 claim true; without it a single weigh-in still produces a "trend"
- Persist the result to `bodyweight_trend_kg` for every date in the recomputed span, including writing `null` where the guard fails

**Do not write, and why:**

- **`avg_steps` / `avg_sleep_hours`** — weekly self-reported averages. Spreading them across seven daily rows fabricates daily data that was never collected
- **`sessions_prescribed` / `sessions_completed`** — not derivable from a check-in. Per Story 5 chart 3, prescribed comes from program structure and completed from `session_logs`, both computed at read time in this slice

**Second gap, blocking chart 2's set-type filter.** `logSet` in `lib/logging/service.ts` inserts `set_logs` **without `set_prescription_id`**, even though the column exists and the logger already has the prescription in hand on the page. Every existing row therefore has a null link, and the `set_type in ('working','backoff')` filter has nothing to join to — it would be silently inert, and the chart would quietly include drop sets and myoreps.

Fix it in this slice: persist `set_prescription_id` on insert. Then, for the e1RM query, include a set when its prescription's `set_type` qualifies, and **exclude** sets with a null link, since those are unclassifiable. Historical rows (seed data and anything logged before the fix) have null links and will drop out of the chart — acceptable, and better than plotting sets whose type is unknown. Flag to `qa-test-engineer`: this needs a regression test asserting the column is written.

Indexes for `db-architect` to confirm (none touch existing rows; all are additive):

- `checkins (client_id, week_of desc)` — the client history page. Not covered by the existing unique index, which leads on `engagement_id`
- Partial index `checkins (engagement_id) where coach_reply is null` — the awaiting-reply list
- `client_metrics_daily (client_id, date)` — already the primary key, no action, noted so the recompute span query is not re-indexed
- `session_logs (client_id, completed_at)` — the completed half of the adherence series
- `sessions (program_week_id)` and `program_weeks (block_id, week_number)` — the prescribed half. Confirm these exist from the program builder work before adding
- `set_logs (exercise_id, logged_at)` joined via `session_logs.client_id` — the e1RM series. Confirm against the existing logger queries before adding

RLS: `checkins` and `client_metrics_daily` have RLS enabled with no policies (migration `0003`), which is default-deny for the `anon` and `authenticated` roles. The app connects as `postgres` and bypasses it. Authorization for this feature is therefore enforced entirely in the service layer, as with the logger. Real policies remain Phase 2 db-architect work; note it, do not do it here.

## API surface

Structure mirrors the existing `lib/logging` and `lib/programs` split. Zod schemas shared with the client form. Typed discriminated errors, never thrown strings.

```
lib/domain/checkins.ts        pure: weekOfFor(date, tz), isCheckinEditable(),
                              denseDateSeries(from, to, points),
                              weightTrendSeries(dense, {windowDays, minObservations}),
                              selectKeyLifts(loggedSets), buildE1rmSeries(),
                              buildAdherenceSeries(prescribed, completed),
                              summarizeCheckin()
                              + unit tests in the same commit
lib/checkins/schemas.ts       zod
lib/checkins/service.ts       I/O + authorization
app/client/check-in/          form, history
app/client/progress/          trends
app/coach/checkins/           awaiting-reply list
app/coach/clients/[clientId]/checkins/   history, reply, trends
```

```ts
export type CheckinError =
  | { code: "unauthorized" }
  | { code: "forbidden" }
  | { code: "not_found"; resource: string }
  | { code: "engagement_inactive" }
  | { code: "checkin_locked" }          // coach already replied
  | { code: "validation"; field: string; message: string };
```

Server actions:

| Action | Input | Output | Errors |
|---|---|---|---|
| `submitCheckinAction` | `weekOf`, `dailyWeightsKg` (7-slot array of `number \| null`), measurements?, adherence pcts?, avgSteps?, avgSleepHours?, six 1-5 scores?, wentWell?, gotInTheWay? | `{ checkinId }` | unauthorized, engagement_inactive, checkin_locked, validation |
| `replyToCheckinAction` | `checkinId`, `body` | `{ repliedAt }` | unauthorized, not_found, engagement_inactive, validation |

Reads are server components calling the service directly: `getCurrentWeekCheckin`, `getClientCheckinHistory`, `getCoachClientCheckins`, `getAwaitingReplyCheckins`, `getTrendSeries`. Every one checks authorization itself, reads included.

### Validation bounds

Reject out of range with a neutral message. Never editorialize about the value — "that looks outside the range we can record" is fine, anything resembling a comment on the number is not.

| Field | Bound | Note |
|---|---|---|
| `dailyWeightsKg[i]` | 25–350 kg, 1dp | Exactly 7 slots, index 0 = Monday. Nulls allowed and expected |
| `waistCm` | 40–200 | Per-field bounds, not one shared range |
| `hipCm` | 50–200 | |
| `chestCm` | 50–200 | |
| `armCm` | 15–80 | |
| `thighCm` | 25–120 | |
| `adherenceTrainingPct`, `adherenceNutritionPct` | integer 0–100 | |
| `avgSteps` | integer 0–50000 | |
| `avgSleepHours` | 2–14, 0.5 step | |
| six subjective scores | integer 1–5 | |
| `wentWell`, `gotInTheWay` | max 2000 chars, trimmed | |
| `weekOf` | a Monday, within the last 8 weeks or the current week | |

The per-field measurement bounds are a data-integrity fix, not pedantry. A single shared 20–200cm range accepts a waist typed in **inches** — "32" is a plausible-looking number that silently enters the series as 32cm and corrupts every downstream waist trend. A 40cm floor on waist catches it at the boundary. Same reasoning for the arm and thigh ceilings.

`avgSteps` at 100000 and `avgSleepHours` at 0–24 were junk-permissive: a 24-hour sleep average and a 100k daily step average are typos, and a typo that validates is worse than one that does not, because it becomes a chart point.

## Safety and privacy review

**Yes. This touches health data and weight. `safety-compliance-reviewer` is a required gate before merge.**

Rules that apply:

| Rule | Where |
|---|---|
| `docs/06` §3 — weight hidden on the client dashboard by default, client opts in | Story 2 |
| `docs/06` §3 — where weight is shown, the primary figure is always the rolling trend | Story 2, Story 5 chart 1 |
| `docs/06` §3 — a positive ED screen suppresses all weight and calorie displays | Story 2, Story 5 |
| `docs/06` §3 — progress photos never required, never auto-shared | Photos entirely out of scope; `photo_keys` untouched |
| `docs/06` §9 test 5 — dashboard default response contains no weight when not opted in | Must extend to `/client/progress` and check-in history responses |
| `docs/06` §9 test 10 — ended engagement revokes coach access to new client data | Story 6 |
| CLAUDE.md rule 5 — coach access ends when the engagement ends | Story 6 |
| CLAUDE.md rule 6 — no health data in analytics | Analytics section |

New safety tests to add to the `pnpm test:safety` suite:

1. Check-in history and progress responses contain no bodyweight or trend value when `hideWeight` is true, asserted on the serialized payload, not the DOM
2. Same, when an unresolved `ed_risk` flag exists, even with `hideWeight` false
3. A submit action carrying `bodyweightKg` for an `ed_risk`-flagged client stores null and still persists the rest
4. A coach on an `ended` engagement receives no check-in with `submitted_at > ended_at`, via direct service call
5. Where weight is present, the headline figure is sourced from `bodyweight_trend_kg`, never `bodyweight_kg`
6. A week containing fewer than 3 weigh-ins yields a null trend and no headline figure — the regression test for the index-vs-date bug, which would otherwise ship as a raw weight labelled "trend" and pass every other test in this list

These are additions to the doc 06 section 9 suite. If one fails, stop and report — do not modify it.

## Analytics

**Emit nothing.** There is no `/lib/analytics/events.ts` catalogue in this codebase yet, and no PostHog wiring. Do not create either as part of this feature.

When the catalogue is built, the only events this feature should ever contribute are `checkin_submitted` and `checkin_replied`, carrying ids and timestamps only. Bodyweight, measurements, trend values, calorie figures, and photo keys are never event properties, per CLAUDE.md rule 6 and `docs/06` §7. Subjective 1-5 scores are self-reported health data — treat them the same way.

## Open questions

Load-bearing ones first. These need an answer rather than an assumption.

1. **Historical coach access window.** `docs/03` §11 says "define this window in doc 06". Doc 06 does not define it. `coachCanAccessClientData` takes `historicalAccessWindowDays` as a parameter, so the code is ready and the number is missing. **Proposed: 90 days**, as a single named constant. Needs Patrick plus the safety reviewer.
2. **Does an `ed_risk` flag suppress weight on the *coach's* view too?** Doc 06 §3 says the screen "suppresses all weight and calorie displays for that client, notifies the coach with guidance to refer out". Ambiguous as to whose display. **This spec takes the conservative reading: suppressed on both sides**, with refer-out guidance shown to the coach in place of the numbers. Safety reviewer to confirm before build.
3. **Does `hideWeight` also hide waist and other measurements?** The pref is named for weight. `docs/08` §2 explicitly lists waist as progress that moves before the mirror does, which argues for showing it. **This spec shows measurements under `hideWeight`, and suppresses them only under `ed_risk`.** Safety reviewer to confirm.
4. **A client with two active engagements** (two coaches) has one `checkins` row per engagement per week, which means two forms. **Assumed: out of the realistic v1 path**; the form targets the most recently started active engagement. Confirm this cannot happen, or spec a picker.
5. **Draft persistence.** Assumed none: the row is created on submit. A half-filled form lost to a dropped connection is recoverable only from client-side state. Acceptable for a form done at home; revisit if it is done in the gym.
6. **Reply edit history.** Assumed none kept, and `coach_replied_at` moves on edit. If a coach reply is ever going to be evidence in a dispute, that assumption is wrong and needs an audit trail.
7. **The `minObservations: 3` threshold for a weight trend** is a judgement call, not a sourced figure. Three weigh-ins in seven days is enough to damp normal day-to-day water and gut-content swing without demanding daily compliance from a beginner. `fitness-domain-expert` and `safety-compliance-reviewer` should both sign off on the number, since it directly governs whether a client is shown a trend or nothing.
8. **Historical `set_logs` rows have no `set_prescription_id`**, so they drop out of the e1RM chart once the set-type filter lands (see Data changes). For a client mid-engagement this means their strength chart shortens on deploy. Assumed acceptable. A backfill is possible but would be guesswork about which prescription each historical set belonged to, and guessing here re-introduces exactly the drop-set contamination the filter exists to remove.

Nothing here depends on an unresolved decision in `docs/02` §9 — all six were confirmed on 2026-08-11 (PH-only, off-platform payments, both coaching modes, optional verification badge, both community structures, coach-to-coach deferred). None of them bear on this feature.
