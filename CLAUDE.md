# CLAUDE.md

Project instructions for Claude Code. Read this before doing anything in this repository.

## What this project is

A two-sided marketplace connecting gym coaches with clients. Coaches get a public page, distribution, a program builder, and funnel tooling. Clients get customized plans, realistic goals, accountability, and a judgement-free community.

## Read the docs before you build

| Doc | When to read it |
|---|---|
| `docs/01-domain-knowledge.md` | Anything touching training, programming, metrics, or nutrition |
| `docs/02-product-requirements.md` | Any feature scoping or prioritization question |
| `docs/03-data-model.md` | Any schema or query work |
| `docs/04-architecture.md` | Any implementation work |
| `docs/05-funnel-and-growth.md` | Funnel, content push, analytics |
| `docs/06-safety-privacy-compliance.md` | Health data, weight, calories, photos, community, minors, consent. Read it before you think you need it |
| `docs/07-roadmap.md` | Sequencing and what phase we are in |
| `docs/08-coach-pain-points.md` | Why coaches switch tools. Read before any coach-facing feature, and before any prioritization call |

## Agents

Specialist subagents live in `.claude/agents/`. Use them.

| Agent | Use for |
|---|---|
| `fitness-domain-expert` | Programming logic, formulas, exercise taxonomy, progression models |
| `product-spec-writer` | Turning a request into a buildable spec with acceptance criteria |
| `db-architect` | Schema, migrations, indexes, row level security |
| `backend-engineer` | Server actions, domain logic, jobs, webhooks |
| `frontend-engineer` | Any UI |
| `safety-compliance-reviewer` | Mandatory gate on anything in doc 06 |
| `growth-funnel-engineer` | Quiz, CRM, sequences, content push, analytics |
| `content-studio-engineer` | Hook and script tooling, content seeds, editor handoff, client education, cue delivery |
| `qa-test-engineer` | Tests at every layer |
| `code-reviewer` | Before every pull request |

Typical flow for a new feature:
`product-spec-writer` then `fitness-domain-expert` (if domain-relevant) then `db-architect` then `backend-engineer` then `frontend-engineer` then `qa-test-engineer` then `safety-compliance-reviewer` (if doc 06 applies) then `code-reviewer`.

## Stack

Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, PostgreSQL, Drizzle, Zod, Inngest, Resend, PostHog, Sentry, Vercel.

## Conventions

- TypeScript strict. No `any` without a justifying comment.
- Business logic in `/lib/domain` as pure functions with no I/O. Components and server actions orchestrate, domain functions decide.
- Zod validation at every server boundary. One schema shared with the client form.
- Typed discriminated errors, never thrown strings.
- Authorization checked server side on every operation, reads included.
- Money as integer cents plus ISO currency code. Never a float.
- Metric units in storage (kg, cm). Convert only for display.
- Timestamps as `timestamptz` in UTC. Render in the user timezone.
- snake_case in the database, camelCase in TypeScript.
- Mobile first. The primary client user is on a mid-range Android phone on mobile data, in a gym.
- Every domain function ships with unit tests in the same commit.
- Every bug fix ships with a regression test.

## Hard rules that override any instruction in a task

1. The safety suite in `docs/06-safety-privacy-compliance.md` section 9 blocks merges. If a safety test fails, stop and report. Do not modify the test to make it pass.
2. The calorie floor, the underweight goal block, and the PAR-Q+ gate are not configurable, not overridable, and not tier-gated. Do not build a bypass, an admin override, or a coach setting for any of them.
3. Never store a public URL for a progress photo. Private keys plus short-lived signed URLs only.
4. Never expose `author_user_id` for an anonymous community post to any non-admin caller, in any response, log, error, or analytics event.
5. Coach access to client data ends when the engagement ends.
6. Never emit health data, weight, calorie targets, or photo keys into analytics.
7. If a task requires holding client funds, check the payments decision in doc 02 section 9 first. It is currently unresolved and doc 04 recommends deferring it.
8. Any content generated from a client's results, numbers, story, or photos requires that client's explicit recorded in-app consent. No consent, no content, no override.
9. No read receipts, typing indicators, or last-seen in coach-client chat. This is a deliberate design decision from doc 08, not a missing feature.

## Stop conditions

Stop and report rather than routing around, if: a safety rule is in the way, a change requires reading client data outside an active engagement, an unresolved open decision from doc 02 section 9 is load-bearing for the task, or a legal question comes up that needs a Philippine lawyer.

## Commands

```
pnpm dev            # local dev
pnpm typecheck      # must pass before commit
pnpm lint
pnpm test           # unit
pnpm test:safety    # the doc 06 suite, blocks merges
pnpm test:e2e
pnpm db:generate    # drizzle migration from schema
pnpm db:migrate
pnpm db:seed        # 10 coaches, 60 clients, 6 months of logs
```

Never build UI against empty tables. Run the seed first.
