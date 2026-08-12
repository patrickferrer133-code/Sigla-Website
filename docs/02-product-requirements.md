# 02 - Product Requirements

## 1. Vision

A two-sided marketplace where gym coaches build their business and clients get coached without feeling judged.

Coaches get: a public page, distribution, pricing they control, a program builder, and funnel tooling that turns strangers into paying clients.
Clients get: a coach who actually knows them, a plan built for their real life, goals that are achievable, and peers who are going through the same thing.

## 2. The cold start problem, and the answer

Every two-sided marketplace dies on day one because neither side shows up. Resolve it in this order:

1. Supply first. Recruit 20 to 40 real coaches manually. Give them the coach tool for free, forever, for the founding cohort. They bring their existing clients onto the platform. Now the platform has real usage and real content from day one.
2. Content second. Those coaches posting what they have built (case studies, plans, transformations, teaching content) is the SEO and social surface that pulls in cold clients.
3. Demand third. Cold clients arrive through content, use the free client side, and convert into paid coaching.

This means the client-side product must be genuinely useful to someone with no coach. That is the acquisition engine, not a consolation prize.

## 3. Personas

### Coach Persona A: "The Solo Operator"
Runs coaching off Google Sheets, Messenger, and GCash. 8 to 15 clients. Spends more time on admin than coaching. Cannot scale because every client is manual. Wants: fewer tools, faster program building, and more clients.

### Coach Persona B: "The Growing Brand"
25 to 60 clients, has a following, may have junior coaches. Already pays for a coaching tool. Wants: funnel and CRM, retention analytics, team accounts, and distribution. This persona pays for premium.

### Client Persona A: "The Intimidated Beginner"
Has never had a structured program. Afraid of gyms, afraid of looking stupid, has started and quit multiple times. Wants: to be told exactly what to do, in plain language, without being shamed. This is the persona the judgement-free positioning is built for.

### Client Persona B: "The Stalled Intermediate"
Trains consistently, progress has flattened. Wants: a real plan, structure, accountability, and someone to tell them what to change.

## 4. Goals mapped to features

### Coach goals

| Stated goal | Feature |
|---|---|
| Post their price in their bio | Packages and pricing block on coach profile, with currency, billing period, what is included, and slots remaining |
| Personal pages | Public coach page at `/c/{handle}` with bio, credentials, specialties, packages, posts, results, reviews, and a book or apply CTA |
| Post about what they have built | Coach posts: case studies, programs, articles, videos. Feeds the marketplace and the client discovery surface |
| Custom plan per client based on needs and goals | Program builder plus intake-driven plan generation. Templates, then per-client overrides, with versioning |
| Client funneling (premium) | Lead capture quiz, application forms, CRM pipeline, automated follow-up sequences, booking links, conversion analytics |
| Content pushed when subscribed | Distribution boost: featured placement in marketplace and feed, push and email inclusion, category spotlight, priority in search ranking. Must be labelled as promoted |

Added from the pain point research in doc 08. These are not secondary, they are the reasons a coach actually switches tools:

| Researched pain | Feature |
|---|---|
| Cannot script or produce social content, which is now the main acquisition channel | Coach Content Studio: hook library, short-form script templates, content calendar with four pillars, consent-gated content seeds generated from real client milestones, repurposing, and an editor handoff pack |
| Split shift leaves only a midday window for admin | Three-window coach app: phone triage on the floor, batch operations at midday, digest notifications off hours. Check-in review as a queue, bulk progression apply, template push with diff preview, keyboard-first program editing |
| Absorbs the emotional load of client adherence | Saved reply snippets, message templates, check-in triage that surfaces only what needs a human, quiet hours, stated response windows, and no read receipts or typing indicators anywhere in coach chat |
| Repeats the same explanations and fights internet misinformation | Cue library surfaced one cue at a time in the logger, client education layer tied to program phases, and a one-tap myth response library |
| Sells volatile pay-as-you-go sessions | Package creation defaults to commitment lengths, with projected recurring revenue shown as the coach adjusts term and price |

### Client goals

| Stated goal | Feature |
|---|---|
| Judgement-free environment | Weight hidden by default, non-weight progress leads the dashboard, no before-and-after culture on the main feed, anonymous community handles, strict moderation policy, no public leaderboards by body metrics |
| Stick to their goals | Streaks with grace days, minimum viable behaviours, reminders, coach nudges, weekly check-ins, milestone celebrations |
| Realistic goals | Goal realism engine (section 5). Rejects or reframes goals that are physiologically implausible or unsafe |
| Customized plan | Intake to program pipeline, equipment and injury aware exercise substitution, schedule aware session count |
| Community to discuss what works | Groups by goal and stage, threaded discussion, coach AMA, win posts, moderated |

## 5. The goal realism engine (differentiator, build it properly)

When a client sets a goal, the system evaluates plausibility and responds with a reframe, never a rejection that feels like a scolding.

Rules to encode:
- Fat loss: sustainable rate is roughly 0.5 to 1.0 percent of bodyweight per week. Anything faster gets reframed to a realistic date.
- Muscle gain: roughly 0.25 to 0.5 percent of bodyweight per month for novices, less for trained lifters, and slower for most women. A goal of 10kg of muscle in 8 weeks gets a gentle reframe with a real timeline.
- Strength: novices can add substantial numbers quickly, intermediates cannot. Scale expectations to training age.
- Any goal weight that would put the client into a clinically underweight range is not accepted, and the flow pivots to non-weight goals. No exceptions, no override.
- Any target rate requiring an extreme caloric deficit is capped.

Output format is always: "Here is what is achievable by {date}. Here is what {their target} would actually take, and why we do not recommend it." Then it offers a process goal instead of an outcome goal, because process goals are what clients can actually control.

## 6. Monetization

### Coach tiers

| | Free | Pro | Premium |
|---|---|---|---|
| Public profile and pricing in bio | Yes | Yes | Yes |
| Active clients | up to 3 | up to 25 | unlimited |
| Program builder and templates | Basic | Full | Full |
| Client check-ins and chat | Yes | Yes | Yes |
| Video form review | No | Yes | Yes |
| Coach posts | Yes | Yes | Yes |
| Content push and featured placement | No | Limited | Yes |
| Saved replies, check-in triage queue, batch operations | Yes | Yes | Yes |
| Client education and myth response library | Basic | Full | Full |
| Coach Content Studio: hooks, scripts, calendar, content seeds | No | Limited | Yes |
| Editor handoff pack export | No | No | Yes |
| Client funneling: quiz, CRM, sequences | No | No | Yes |
| Retention and churn analytics | No | Basic | Full |
| Team or assistant coach seats | No | No | Yes |
| Platform take rate on client payments | Highest | Middle | Lowest or zero |

Rationale: gate on revenue-generating features (funnel, distribution, analytics), not on core coaching quality. Never gate safety features.

### Client side
Clients pay coaches. Platform takes a percentage, reduced as the coach's tier rises. Optional client-side "Community Plus" later; do not build it in v1.

### Pricing note for the Philippine market
Coach tier pricing must be set in PHP with local purchasing power in mind. A USD-denominated SaaS price will kill local supply. Consider a take-rate-only model for the free tier so a coach can start at zero cost.

## 7. MVP scope

In scope for v1:
- Auth, roles (coach, client, admin)
- Coach onboarding, profile, handle, packages with pricing, credentials
- Coach public page and marketplace search with filters (goal, specialty, price, language, location, online or in person)
- Client intake: PAR-Q+, goals with the realism engine, logistics, baseline
- Exercise library (global, seeded, video-backed) plus coach private exercises
- Program builder: program, block, week, session, exercise group, set prescription
- Program templates and assign-to-client with per-client overrides
- Client workout view and logger (sets, reps, load, RPE, notes, rest timer)
- Weekly check-in form plus trend charts (rolling average weight, e1RM, adherence)
- Coach dashboard with client alert list
- Chat between coach and client
- Coach posts and a client-facing feed
- Community groups with moderation tooling
- Payments: client subscribes to a coach package, platform take rate, coach payout
- Notifications: push, email, in-app

Out of scope for v1 (explicitly):
- Native mobile apps (build responsive PWA first)
- Video form review (Pro tier, phase 2)
- Full funnel and CRM suite (Premium tier, phase 2)
- Nutrition macro tracking with a food database (phase 3, expensive and licensing-heavy)
- Wearable integrations
- Live video calls (link out to Zoom or Google Meet in v1)
- Team and assistant coach seats

## 8. Sample acceptance criteria

Format for all stories: Given / When / Then. Examples the agents should follow.

Story: Coach publishes a package with pricing.
- Given I am a verified coach with a complete profile
- When I create a package with a title, price, currency, billing period, inclusions, and client slot cap
- Then it appears on my public page, is filterable by price in marketplace search, and shows remaining slots
- And if slots reach zero the CTA changes to a waitlist join

Story: Client sets an unrealistic fat loss goal.
- Given I am a client in intake with a recorded bodyweight
- When I set a target weight and target date implying more than 1.0 percent bodyweight loss per week
- Then the system shows an achievable date for that target and an achievable target for that date
- And it offers to convert the outcome goal into a process goal
- And it never uses shaming language, and never displays a calorie target below the safety floor

Story: Coach sees an at-risk client.
- Given I coach 20 clients
- When a client misses 2 or more prescribed sessions in a rolling 7 days, or has not opened the app in 7 days, or reports pain on any logged exercise
- Then that client appears at the top of my dashboard with the reason and a one-tap message action

## 9. Open decisions (Patrick to confirm)

1. Geography for v1: Philippines only, or global from day one? This drives payment rails, currency, and moderation load.
2. In-person coaching: does the marketplace include gym-floor personal trainers, or online coaching only?
3. Coach verification: do we verify certifications manually, and do we require them at all? Recommendation is optional badge, not a gate.
4. Do clients pay the coach through the platform in v1, or does v1 just do introductions and the coach bills off-platform? This is the single biggest scope decision in the project.
5. Community structure: one global community, or per-coach communities, or both? Recommendation is both, with global groups by goal and private groups per coach.
6. Do we allow coach-to-coach features (mentorship, white label) later?
