---
description: Run the full safety and privacy review against the current working tree
---

Run a complete safety and privacy review.

1. Read `docs/06-safety-privacy-compliance.md` in full.
2. Use the `safety-compliance-reviewer` agent against the current diff, or against the whole codebase if there is no diff.
3. Run `pnpm test:safety` and report the result.
4. Grep for common bypasses: direct API routes that skip the safety flag check, admin overrides on goals or nutrition, serializers that include `author_user_id`, analytics payloads containing weight or calorie fields, public URLs for progress photos, coach queries missing the engagement join.
5. Report a verdict of PASS, PASS WITH REQUIRED FOLLOW-UP, or BLOCK, with file and line references for every issue.

Do not fix anything silently. Report first, then fix only what is clearly safe to fix.
