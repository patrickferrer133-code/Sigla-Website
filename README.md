# Gym Coaching Marketplace

The coaching platform where clients are not judged and coaches do not have to find clients alone.

## What is in this repository right now

Documentation and Claude Code agent definitions. No application code yet. Read the docs, resolve the open decisions, then start Phase 0.

```
docs/
  01-domain-knowledge.md          how gym coaching actually works, the reference doc
  02-product-requirements.md      vision, personas, features, tiers, MVP scope, open decisions
  03-data-model.md                full PostgreSQL schema
  04-architecture.md              stack, repo structure, subsystems, payments analysis
  05-funnel-and-growth.md         premium funnel, content push, growth loops, metric definitions
  06-safety-privacy-compliance.md the hard gate, non-negotiable rules
  07-roadmap.md                   phased build plan
  08-coach-pain-points.md         researched coach pain points and what they change
.claude/
  agents/                         ten specialist subagents
  commands/                       slash commands
CLAUDE.md                         project instructions for Claude Code
```

## How to start building

1. Read `docs/02-product-requirements.md` section 9 and answer the six open decisions. Decision 4 (whether the platform holds client funds in v1) changes the scope of the entire project.
2. Open this folder in Claude Code.
3. Run `/build-feature` for the first Phase 0 item, or just say what you want and let the agents route.

## The one-paragraph version

Coaches run their coaching business inside the app: they build programs, their clients log workouts, they check in weekly, and the dashboard tells them which clients are about to drop off. Because the coaching product is good, coaches bring their existing clients, which gives the marketplace real supply and real content on day one. That content brings in cold clients, who use the free client tools, find a coach who matches their goal, and convert. Coaches pay for distribution, funnel tooling, and retention analytics, because those map to revenue. Clients stay because the environment does not make them feel bad about their bodies, which is not a marketing line here, it is a set of enforced product constraints in `docs/06`.
