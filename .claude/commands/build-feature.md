---
description: Take a feature from idea to reviewed implementation using the full agent chain
argument-hint: [feature description]
---

Build this feature: $ARGUMENTS

Follow this sequence and do not skip steps:

1. Read `docs/02-product-requirements.md` and any other doc the feature touches.
2. Use the `product-spec-writer` agent to produce a full spec with acceptance criteria, including unhappy paths, empty states, and permission-denied states.
3. If the feature touches training, programming, metrics, or nutrition, use the `fitness-domain-expert` agent to validate the spec before any code.
4. If the feature touches health data, weight, calories, photos, community, minors, or marketing consent, note which rules in `docs/06-safety-privacy-compliance.md` apply.
5. Use `db-architect` for any schema change.
6. Use `backend-engineer` for domain logic and server actions.
7. Use `frontend-engineer` for UI.
8. Use `qa-test-engineer` for tests at every layer, including the safety suite if relevant.
9. If step 4 flagged anything, use `safety-compliance-reviewer`. Its verdict is binding.
10. Use `code-reviewer` before finishing.

Report at the end: what was built, what was deliberately left out, what tests were added, and any open questions that need Patrick to decide.
