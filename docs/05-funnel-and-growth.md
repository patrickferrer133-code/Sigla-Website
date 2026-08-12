# 05 - Coach Funnel, Content Push, and Growth

This document covers the Premium tier features and the platform growth loop.

---

## 1. The coach funnel, stage by stage

| Stage | Client state | Coach tool | Metric |
|---|---|---|---|
| Attract | Does not know the coach | Coach posts, marketplace listing, content push, SEO on `/c/{handle}` | Profile views, post reach |
| Capture | Interested, not committed | Lead magnet quiz, free plan preview, waitlist, newsletter | Lead capture rate |
| Qualify | Considering | Application form, quiz scoring, auto-disqualification of poor fits | Qualified lead rate |
| Convert | Deciding | Booking link, proposal with package, trial or first-week offer | Booked call rate, close rate |
| Deliver | Paying | Program, check-ins, chat | Adherence, satisfaction |
| Retain | Renewing | Milestones, community, renewal offers, results recap | Churn, LTV |
| Refer | Advocating | Referral link with a reward, testimonial capture | Referral rate |

The quiz is the highest leverage single object. It does four jobs at once: it captures a lead, it qualifies fit, it gives the client immediate value (a result and a recommendation), and it pre-fills the intake so onboarding is faster later.

## 2. Quiz builder specification

Coach configures:
- Questions: single choice, multi choice, scale, number, free text.
- Scoring: each answer carries a weight. Total score maps to an outcome bucket.
- Outcomes: each bucket has a result page with a headline, an explanation, and a CTA (book a call, apply, view package, join waitlist).
- Disqualifiers: an answer can hard-route a lead to a "not a fit right now" outcome with a graceful referral or resource. Coaches value this as much as they value conversions.
- Field mapping: quiz answers map onto intake fields so nothing is asked twice.

Public route: `/c/{handle}/quiz/{slug}`. Must be fast, mobile first, one question per screen, with a visible progress bar.

## 3. Pipeline and CRM

A simple kanban over `pipeline_stages`. Default stages: New, Contacted, Call Booked, Proposal Sent, Won, Lost. Coach can rename and reorder.

Each lead card shows: name, source, quiz score, days in stage, last touch, next scheduled action. Aging leads (over 5 days in a stage) get flagged. Lost reasons are a controlled list so the coach can actually learn from them: price, timing, went with someone else, ghosted, not ready, not a fit.

## 4. Sequences

Trigger types: quiz completed, lead created, stage changed, no reply after N days, call no-show, engagement ended.

Each step: delay, channel (email in v1, in-app later, SMS only if there is explicit consent), and a markdown template with merge fields.

Hard rules to enforce in code:
- Explicit opt-in captured and stored with timestamp and source before any sequence sends.
- One-click unsubscribe in every message, honored globally per contact, not per sequence.
- Rate cap per contact per week.
- Sending is blocked entirely for a contact who has converted, unless enrolled in a client sequence.
- No sequence may be sent to a lead who was disqualified for a health reason.

The Philippines Data Privacy Act and most other regimes require consent for direct marketing. Build consent as a first-class object, not a checkbox in a form.

## 5. Content push mechanics

What a subscribing coach receives:
- Featured placement: a slot in `/discover` and in the client feed for a defined window.
- Digest inclusion: their best-performing post included in the weekly client digest email for matching goal tags.
- Category spotlight: top of the results for one specialty tag, rotated fairly among premium coaches rather than sold to the highest bidder.
- Push notification eligibility for clients who opted into that goal topic.

Integrity rules, these protect the marketplace and are not negotiable:
- Every promoted item is labelled.
- Ratio cap of promoted to organic in any feed page.
- Promotion boosts rank, it never fabricates rating, review, or results claims.
- A coach with an open moderation case is ineligible for promotion.
- Results claims in promoted content require the coach to attest the client consented, and the client must have consented in-app.

## 6. Platform growth loop

```
Coaches post what they built
   -> content ranks and gets shared
      -> cold clients arrive and use the free client tools
         -> free clients see coaches who match their goal
            -> some convert to paid coaching
               -> coaches get results and post about them
                  -> loop
```

Supporting loops:
- Community loop: clients answer each other, community threads rank in search, new clients arrive.
- Referral loop: happy clients refer, referrer and referee both get value.
- Coach referral loop: coaches invite other coaches, both get tier credit.

## 7. Metric definitions (single source of truth)

- Profile view: a unique session viewing `/c/{handle}`, deduped per 24 hours.
- Lead: a contact record with an email or phone captured for a specific coach.
- Qualified lead: a lead above the coach's scoring threshold and without a disqualifier.
- Close rate: won divided by qualified leads, over the cohort month the lead was created, not the month it closed.
- Activation (client): completed intake plus logged at least one session within 7 days.
- Activation (coach): published profile with at least one package plus at least one active client.
- Adherence: sessions completed divided by sessions prescribed, rolling 28 days.
- Retention: engagements still active at day 30, 60, 90 from start.
- Churn: engagements ended in a month divided by active at the start of the month.
- LTV: average monthly revenue per engagement divided by monthly churn rate.

Instrument these as PostHog events from day one, with a single typed event catalogue in `/lib/analytics/events.ts`. Do not let agents invent ad hoc event names.
