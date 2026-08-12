# 06 - Safety, Privacy, and Compliance

This document is a hard gate. Features described here are not optional, not tier-gated, and not removable by a coach setting. Every rule here needs an automated test, and those tests block merges.

The reason is simple: the client-side promise is a judgement-free environment. That promise is worthless if the software lets a coach or an algorithm push someone into unsafe territory.

---

## 1. Pre-exercise health screening

- Every client completes a PAR-Q+ style screen before any program can be assigned.
- Positive answers on cardiac symptoms, chest pain at rest or on exertion, loss of consciousness or dizziness, uncontrolled blood pressure, or a doctor's instruction to only exercise under medical supervision create a `safety_flags` row with severity `block`.
- A blocking flag prevents program assignment and prevents any nutrition target from being generated, until a medical clearance is uploaded and marked approved.
- The client-facing copy for this is supportive, never alarming: it explains that a quick check with a doctor makes the plan safer and better, and offers non-blocking things they can do meanwhile.
- Re-screen every 12 months, and on any newly reported condition.

## 2. Pain and injury handling

- The workout logger has a pain report control on every exercise. It is one tap.
- Any pain report creates a flag visible to the coach within their next dashboard load.
- Pain reported at 7 or above, or pain reported on the same exercise three sessions running, escalates: the exercise is auto-substituted or removed pending coach review, and the client sees a message recommending they consult a qualified health professional.
- The platform never diagnoses, never names a suspected injury, and never suggests treatment. It substitutes, it flags, and it refers out.
- Injuries recorded at intake filter the exercise library through `contraindications` automatically. A coach can override, but the override is logged.

## 3. Disordered eating safeguards

Fitness platforms are a known vector for harm here. These rules are absolute.

- Goal weights that fall in a clinically underweight range are not accepted. The flow does not argue, negotiate, or offer a workaround. It pivots to performance, strength, health, and habit goals and explains that this is how the platform works.
- Calorie targets are never rendered below a floor derived from the client's own calculated basal metabolic rate. If a coach's inputs produce a lower number, the system clamps it, tells the coach why, and does not show the client the unclamped figure.
- Rate-of-loss goals faster than the safe band defined in doc 02 are reframed, never accepted as entered.
- Weight is hidden on the client dashboard by default. The client opts in to see it. The default view leads with sessions completed, strength trend, steps, sleep, and habit streaks.
- Where weight is shown, the primary figure is always the rolling trend, never a single day's number.
- Progress photos are never required, never auto-shared, never used in any feed, and never comparable side by side by anyone other than the client.
- No public leaderboard is ever ranked by bodyweight, body fat, or appearance. Leaderboards, if built at all, rank consistency.
- Screening: intake includes validated-style screening questions for eating disorder risk. A positive screen creates a flag, suppresses all weight and calorie displays for that client, notifies the coach with guidance to refer out, and surfaces support resources to the client.
- Any client-facing surface touching this topic offers a route to professional support rather than platform-side advice.
- Community rules explicitly prohibit posting calorie numbers as competition, goal weights, restriction techniques, or purging content. This is enforced by moderation, keyword flagging, and reporting.

## 4. Scope of practice

- Coaches are fitness professionals, not medical or mental health providers. The product must reflect that everywhere.
- Coaches may not use the platform to diagnose, treat, or offer medical nutrition therapy. Terms of service state it, the coach onboarding acknowledges it, and the nutrition module carries the disclaimer inline, not buried.
- Any client with a flagged medical condition requires clearance before nutrition targets are generated.
- Credential display: certifications are shown with issuer and status. If we verify, the badge says verified. If we do not, we do not imply we did.
- Provide a clear "refer out" workflow: a coach can mark a client as referred to a physician, dietitian, or physiotherapist, with the reason logged.

## 5. Community moderation, and what judgement-free actually means in code

Policy, published and enforced:
- No body shaming, in either direction. No comments on another person's appearance, weight, or food unless they explicitly asked.
- No unsolicited advice on someone's body or diet.
- No before-and-after images in general community spaces. They belong on coach pages with explicit client consent, or in opt-in spaces.
- No promotion of restriction, purging, extreme protocols, or unproven supplements.
- No medical advice from non-professionals.
- No selling or poaching in client spaces.

Product mechanisms:
- Anonymous posting with a stable alias per community. Someone must be able to say they are struggling without their name attached.
- Report button on every post and comment, with a reason list, and a visible outcome to the reporter.
- Auto-flagging on a maintained keyword and pattern list for restriction, self-harm, and harassment language, routed to human review, not auto-deleted.
- Trusted member and coach moderator roles, with an audit log of every moderation action.
- A moderation service level target: high severity reports actioned within a defined window, published in the community guidelines.
- Distress escalation path: if a post indicates a person may be at risk of harming themselves, the flow surfaces crisis support resources appropriate to the user's country and routes the report to a human reviewer immediately. It never auto-deletes such a post and never leaves it unanswered.

## 6. Minors

- Minimum age for an account: set it, enforce it at signup, and state it in terms. 18 is the simplest defensible line for a coaching marketplace.
- If under-18 clients are permitted later, the requirements change materially: verified guardian consent, no body composition goals, no calorie targets, no progress photos, restricted community access, and no direct unsupervised coach messaging. Do not half-build this. Either exclude minors properly in v1, or build the full protective set.
- Age-gate the signup and store the attestation.

## 7. Data privacy

Philippine Data Privacy Act of 2012 (RA 10173) is the primary regime, plus GDPR if any EU residents are served.

- Health information, injury history, medications, and progress photos are sensitive personal information. Treat them at the highest tier of protection.
- Lawful basis: consent, collected explicitly, granularly, and separately for coaching data, marketing, and any research or aggregate use.
- Data minimization: do not collect a field unless a named feature uses it. Audit the intake form against this quarterly.
- Retention: define and enforce. Suggested defaults, to be confirmed with counsel: coaching records retained for the engagement plus a defined period, progress photos deleted on request immediately and otherwise on account deletion, marketing contacts purged after a defined period of inactivity.
- Coach access ends when the engagement ends. Historical read access for a short defined window, then revoked. Coaches may export their own notes but not the client's photos or health screen.
- Client rights: access, correction, erasure, objection, and data portability. Build a real self-serve export and delete, not an email address.
- Encryption in transit and at rest. Private buckets, signed URLs with short TTLs, EXIF stripped on image upload including GPS.
- Breach response plan documented, with the notification obligations and timelines under RA 10173 noted.
- Appoint a data protection officer and register with the National Privacy Commission if thresholds apply. Confirm current requirements with a Philippine lawyer before launch. This document is not legal advice.
- Third-party processors (hosting, payments, email, analytics) each need a data processing agreement on file.

## 8. Legal documents required before launch

- Terms of Service, separately for coaches and clients.
- Privacy Policy and a cookie notice.
- Assumption of risk and liability waiver, presented at intake, versioned, with the accepted version recorded per user.
- Coach agreement covering scope of practice, conduct, content rights, take rate, and payout terms.
- Community guidelines, publicly linked.
- Medical disclaimer, shown on any surface presenting a program or nutrition target.

Have all of these reviewed by a Philippine lawyer. Everything here is a starting point for that conversation, not a substitute for it.

## 9. The safety test suite

These run in CI and block merges:

1. Program cannot be assigned while a blocking safety flag is unresolved.
2. Nutrition target generation refuses when a medical clearance is required and not approved.
3. Calorie target output is never below the computed floor, across a wide fuzzed input range.
4. Goal creation rejects target weights in the clinically underweight range, including via direct API call, not just through the UI.
5. Client dashboard default response contains no weight value when the client has not opted in.
6. Anonymous community posts never include `author_user_id` in any API response for a non-admin caller.
7. Progress photo endpoints reject unsigned requests and requests from a coach without an active engagement.
8. Sequence sending refuses without a stored consent record, and honors a global unsubscribe.
9. Promoted content ratio in any feed page does not exceed the configured cap.
10. Ended engagement revokes coach access to new client data.

Any agent working on this codebase must treat a failure in this suite as a stop condition, not something to work around.
