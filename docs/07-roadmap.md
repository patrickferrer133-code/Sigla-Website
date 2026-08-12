# 07 - Build Roadmap

Sequenced so that something usable exists early and each phase is independently valuable.

---

## Phase 0: Foundations (week 1 to 2)

- Repo, Next.js, TypeScript strict, Tailwind, shadcn/ui, lint and format config
- Database provisioned, Drizzle configured, first migration
- Auth with email plus Google plus phone OTP
- Role-based routing shells for coach, client, admin
- CI: typecheck, lint, unit test, migration dry run
- Seed script producing 10 coaches, 60 clients, 6 months of realistic logs
- `/lib/domain` scaffolded with metrics, progression, goals, safety modules and their test files

Exit criteria: a seeded local environment where you can sign in as a coach or a client and see empty but routed shells.

## Phase 1: The coaching core (week 3 to 7)

This is the product. Everything else is packaging.

- Exercise library, seeded with 300 to 500 exercises with correct tags, plus demo video slots
- Program builder: program, block, week, session, group, instance, prescription, with drag ordering and copy or paste of weeks and sessions
- Program templates and assign-to-client with deep clone and versioning
- Client workout view and logger, with rest timer, previous performance display, and offline support
- Automatic e1RM, volume load, and adherence computation
- Weekly check-in form and coach reply
- Trend charts: rolling weight trend, e1RM per key lift, adherence
- Coach and client chat
- Coach dashboard as an alert queue

Exit criteria: a real coach can run a real client for four weeks entirely inside the app and prefer it to their spreadsheet. Test this with actual coaches before moving on.

## Phase 2: The marketplace (week 8 to 11)

- Coach profile completion, handle, credentials, specialties, intro video
- Packages with pricing, currency, inclusions, slot caps, waitlist
- Public coach page with SEO, structured data, and share cards
- `/discover` search with filters and ranking
- Coach posts and the client feed
- Client application flow into an engagement
- Reviews, gated so only clients with a completed engagement of a minimum length can review
- Intake with PAR-Q+, safety flags, and the goal realism engine, fully tested

Exit criteria: a cold visitor can find a coach, apply, be accepted, complete intake, and start a program without anyone touching a database.

## Phase 3: Community and retention (week 12 to 14)

- Global goal-based communities and per-coach private communities
- Anonymous posting, threads, comments, reactions
- Reporting, moderation queue, auto-flagging, moderator roles, audit log
- Milestones and celebration moments, streaks with grace days
- Weekly digest email
- Notification system, in-app plus email plus web push

Exit criteria: community daily active usage that is not driven by staff posting.

## Phase 4: Coach monetization and funnel (week 15 to 18)

- Coach tiers, upgrade and downgrade, entitlements enforced server side
- Content push: featured placement, digest inclusion, spotlight rotation, with integrity caps
- Quiz builder and public quiz pages
- Lead capture, pipeline kanban, lead events
- Sequences with consent handling and unsubscribe
- Coach analytics: funnel conversion, retention, churn, LTV
- Payments for coach subscriptions

Exit criteria: coaches upgrading to Premium without being asked, and being able to point to leads generated as the reason.

## Phase 5: Marketplace payments (only if decision 4 says yes)

- Provider integration, split payments, coach onboarding and KYC, payouts
- Invoices, receipts, refunds, disputes, tax handling
- Reconciliation and finance reporting

This phase is heavy. Doc 04 recommends deferring it until supply and demand are proven.

## Phase 6: Depth

- Video form review with transcoding and a review queue
- Nutrition module with habit-based coaching first, food database later
- Native mobile via Expo, sharing the domain layer
- Wearable and step integrations
- Team and assistant coach seats
- White label for larger coaching brands

---

## Sequencing principles

1. Build the coaching core before the marketplace. A marketplace pointing at a weak product just distributes disappointment faster.
2. Recruit the founding coach cohort during phase 1, not after phase 2. They are your design partners and your launch supply.
3. Safety features ship with the feature they protect, never after. The realism engine ships with goal setting. The calorie floor ships with nutrition. No exceptions.
4. Do not build native apps until the PWA is measurably constrained by something native would fix.
5. Every phase ends with real users, not a demo.

---

## Amendments from doc 08 (coach pain point research)

These override the phase contents above where they conflict.

- Phase 1 additions: the First Six Weeks client experience, the weeks 3 to 6 churn alert (highest priority in the coach queue), check-in triage as a queue, saved reply snippets, notification batching, bulk progression apply, and keyboard-first program editing. These are core, not later polish. The midday admin window is when a coach decides whether the tool is worth keeping.
- Phase 2 addition: package creation defaults to commitment lengths with projected recurring revenue shown as the coach adjusts term and price.
- Phase 3 additions: client education layer tied to program phases, cue delivery in the logger, and the myth response library.
- Phase 4 splits into two pillars, funnel suite and Content Studio. If only one can ship first, ship the Content Studio. Content is upstream of the funnel, and a coach with nothing to say has nothing to put into a funnel.
- New product metric tracked from Phase 1 onward: coach admin minutes per client per week. If the platform cannot beat a spreadsheet plus Messenger on that number, nothing else in this roadmap matters.
