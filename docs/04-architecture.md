# 04 - Architecture

## 1. Stack decision

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | One codebase for marketing pages, coach app, client app. Server components keep the client bundle small, which matters on Philippine mobile networks |
| Styling | Tailwind CSS plus shadcn/ui | Fast, consistent, easy for agents to generate correctly |
| Database | PostgreSQL (Supabase or Neon) | Relational data with deep hierarchy. Supabase adds auth, storage, and row level security in one |
| ORM | Drizzle | Type-safe, SQL-first, migrations are readable and reviewable |
| Auth | Supabase Auth or Auth.js | Email, Google, and phone OTP. Phone matters in PH |
| API | Next.js server actions plus a thin tRPC or route-handler layer for anything the future mobile app needs | Avoid building a full separate API before there is a second client |
| Validation | Zod, shared between client and server | Single source of truth for shapes |
| File and video storage | Cloudflare R2 or Supabase Storage, private buckets, signed URLs | Progress photos and form videos are sensitive |
| Video transcoding | Cloudflare Stream or Mux, phase 2 only | Do not build this in v1 |
| Background jobs | Inngest or Trigger.dev | Reminders, sequence sends, metric rollups, payment webhooks |
| Email | Resend | Transactional plus sequences |
| Push | Web Push in v1, Expo later | PWA first |
| Payments | PayMongo or Xendit for PH rails (GCash, Maya, cards, bank). Stripe if going global | Verify current availability and marketplace payout support before committing. See section 5 |
| Analytics | PostHog (self-host or cloud) | Product analytics plus feature flags |
| Error tracking | Sentry | |
| Hosting | Vercel | |

Non-negotiables for agents:
- TypeScript strict mode on, no `any` without a written justification comment.
- Every mutation validated with Zod at the server boundary.
- No business logic in React components. It lives in `/lib/domain`.
- Money is always integer cents plus an ISO currency code. Never a float.
- All timestamps stored UTC, rendered in the user timezone.
- Weight and length stored in metric (kg, cm). Convert at the display layer only.

---

## 2. Repository structure

```
/app
  /(marketing)              public landing, pricing, about
  /(auth)                   sign in, sign up, onboarding
  /c/[handle]               public coach page
  /discover                 marketplace search
  /coach                    coach app (dashboard, clients, programs, posts, funnel, settings)
  /client                   client app (today, program, log, checkin, progress, community, coach)
  /admin                    moderation, verification, support
  /api                      webhooks, cron, mobile-facing routes
/components
  /ui                       shadcn primitives
  /features                 feature-scoped composites
/lib
  /db                       drizzle schema, migrations, queries
  /domain                   pure business logic, no I/O
    program.ts              program tree helpers, cloning, versioning
    prescription.ts         load resolution, tempo parsing
    progression.ts          double, linear, percentage, rpe models
    metrics.ts              e1RM, volume load, rolling averages, adherence
    goals.ts                the realism engine
    safety.ts               PARQ evaluation, ED safeguards, calorie floors
    nutrition.ts            BMR, TDEE, macro split
    alerts.ts               at-risk client detection
  /auth  /payments  /storage  /jobs  /email  /analytics
/docs                       this documentation set
/.claude
  /agents                   subagent definitions
  /commands                 slash commands
CLAUDE.md
```

The `/lib/domain` folder must be pure functions with unit tests and no database or network calls. This is the part of the codebase that has to be right, and it is the part that is cheapest to test.

---

## 3. Key subsystems

### 3.1 Program assignment pipeline

```
Intake submitted
  -> safety.evaluateParq()            may emit blocking safety_flags
  -> goals.evaluateRealism()          returns verdict and reframe
  -> program template selected or built
  -> program.cloneForClient()         deep clone, new version lineage, engagement_id set
  -> exercises filtered by:
       equipment_access
       injury contraindications
       session_minutes_max
       days_available
  -> substitutions resolved via substitution_group
  -> program.status = active, starts_on set
```

If any blocking safety flag exists, assignment fails with a typed error and the coach sees a clearance step. Never silently proceed.

### 3.2 Progression resolution

At the start of each week, a job resolves the load for every set prescription with a relative load type:

```
resolveLoad(prescription, clientHistory) -> { kg | pct | rpe_target | 'client_choice' }
```
Inputs: last completed set logs for that exercise, current e1RM estimate, the progression model on the prescription, and whether the previous week hit the top of the rep range. Output is written to a per-week resolved view, never back onto the prescription itself.

### 3.3 Alerting engine

A nightly job scans active engagements and writes `client_alerts` rows:

| Alert | Trigger |
|---|---|
| missed_sessions | prescribed minus completed >= 2 in rolling 7 days |
| gone_quiet | no app open in 7 days |
| checkin_missed | no checkin for the current week_of by day 2 of the new week |
| stalled_progress | weight trend slope flat for 3 weeks against an active fat loss or gain goal |
| pain_reported | any set_log with pain_reported true in last 7 days, severity high |
| overreaching | session_rpe average up while volume load down, 2 weeks running |
| renewal_risk | subscription period ends within 10 days and adherence under 60 percent |

Coach dashboard is an alert queue first and a client list second. That ordering is the product.

### 3.4 Content push

`is_promoted` on `coach_posts` plus `promoted_until` drives:
- boosted rank in `/discover` and the client feed
- inclusion in the weekly digest email
- a category spotlight slot

Rules: promoted content is always visibly labelled, capped at a maximum share of any feed page (suggest 1 in 5), and is never allowed to outrank a safety or moderation notice. Ranking must not be purely pay-to-win or the marketplace loses client trust, which is the only asset it has.

### 3.5 Media handling

- Progress photos: private bucket, key stored in DB, served only via signed URLs with a short TTL, never rendered in any server-side HTML that could be cached, stripped of EXIF including GPS on upload.
- Form review videos: 60 second cap, client-side compression before upload, transcoded rendition kept, original deleted after 30 days.
- Exercise demos: public bucket, CDN cached, this is the one media class that can be public.

---

## 4. Performance considerations for the target market

Philippine mobile connectivity means:
- Server components and streaming, minimal client JavaScript on the client app shell.
- The workout logger must work offline. Log to IndexedDB, sync on reconnect, with conflict resolution favouring the client device (the person in the gym is the source of truth).
- Images through Next.js image optimization with aggressive sizing. No 4MB hero images.
- PWA installable with an offline shell before any thought is given to native apps.

---

## 5. Payments architecture (needs verification before build)

Marketplace payments require three capabilities:
1. Charging the client on a recurring schedule.
2. Splitting the charge into a platform fee and a coach net amount.
3. Paying the coach out to a local account or wallet.

Options to evaluate, with current availability confirmed at build time rather than assumed:
- Xendit: strong PH coverage, supports split payments and disbursements.
- PayMongo: strong PH card and e-wallet coverage, check current marketplace and payout support.
- Stripe Connect: excellent marketplace primitives, availability and payout support for PH-based platforms must be verified.
- Merchant of record providers (Paddle, Lemon Squeezy) simplify tax but complicate coach payouts.

Interim option worth serious consideration for v1: do not hold funds at all. The platform handles discovery, application, and the coaching product, and the coach is billed a subscription for the software. Client payment happens coach to client directly. This removes payment licensing, escrow, chargeback, and payout complexity from v1 entirely and lets the product ship. Add marketplace payments in phase 3 once there is proven supply and demand. This is decision 4 in doc 02, and this document recommends the deferred option.

---

## 6. Environments and quality gates

- Environments: local, preview per pull request, staging with seeded data, production.
- CI must run: typecheck, lint, unit tests on `/lib/domain`, integration tests on critical paths, and a migration dry run.
- No pull request merges with failing safety tests. The safety test suite (doc 06) is a hard gate.
- Seed script must generate a realistic dataset: 10 coaches, 60 clients, 6 months of logs. Agents cannot build good UI against empty tables.
