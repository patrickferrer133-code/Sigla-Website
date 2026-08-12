# 09 - Pricing System

Two things live in this document, because neither works without the other:

1. The pricing model. What the platform charges, in which currency, and why.
2. The pricing subsystem. Plans, entitlements, metering, proration, dunning, and the coach-facing package pricing builder.

All figures verified against public sources in August 2026. Pricing moves. Re-verify before launch.

---

## 1. What competitors actually charge

Sources: Trainerize published pricing and independent 2026 breakdowns (coachway.io, quickcoach.fit, pt-suite.com, assistantcoach.fit, checkthat.ai), Capterra, G2.

Trainerize, the category leader, prices on a client-count ladder: free for 1 client, roughly USD 9 per month for 2, then a Pro slider running from roughly USD 22 to 23 at 5 clients up to roughly USD 225 to 245 at 200 clients, with Studio Plus around USD 248 per location. Annual billing saves roughly 10 to 20 percent.

The headline is not the real number. Payments integration, the branded app, and advanced nutrition are separate paid add-ons. Independent breakdowns put the realistic all-in cost for a solo coach with 10 to 50 clients at roughly USD 100 to 200 per month. At 50 clients the Pro tier alone is listed around USD 120 to 137 before add-ons.

The rest of the field follows the same shape. Everfit layers meal plans, automation, and payments as separate monthly modules. FitBudd includes 20 clients then charges per additional client. PT Distinction caps at 25 then charges per extra. TrueCoach added a transaction fee on payments in January 2026. QuickCoach is the notable exception with a flat model: free to 20 clients, then a flat fee for unlimited.

Two consistent complaints in reviews: the price jumps between client tiers, and billing friction including difficulty cancelling.

### What this tells us

The category has three exploitable weaknesses:

1. Per-client ladders punish growth. A coach is charged more precisely when they are working harder, and the jump between tiers is a visible, resented event.
2. Add-on stacking makes the advertised price a lie. Every coach discovers the real number after they have already migrated their clients in.
3. Cancellation friction is a trust problem the whole category shares.

## 2. The Philippine market reality

Public 2026 guidance for online coaching rates in the Philippines: roughly PHP 2,000 to 4,000 per month for templated or semi-personalized coaching, PHP 4,000 to 8,000 for fully customized programming with weekly check-ins (described as the most common range), and PHP 8,000 and above for high-touch premium. For reference, average personal trainer earnings in the Philippines sit around PHP 357,000 annually.

Run the math that decides this product's pricing:

| Coach | Monthly revenue | Trainerize realistic cost | Cost as share of revenue |
|---|---|---|---|
| PH coach, 10 clients at PHP 5,000 | PHP 50,000 | roughly USD 100, about PHP 5,700 | roughly 11 percent |
| PH coach, 25 clients at PHP 6,000 | PHP 150,000 | roughly USD 150, about PHP 8,600 | roughly 6 percent |
| US coach, 25 clients at USD 250 | USD 6,250 | roughly USD 150 | roughly 2 percent |

A USD-denominated per-client ladder costs a Philippine coach three to five times more, as a share of revenue, than it costs an American coach for the identical product. That is the gap. It is not a small optimization, it is the reason the local market is underserved.

Verify the peso-dollar rate at build time rather than trusting a rate quoted here.

## 3. Pricing principles

These constrain every decision below.

1. Flat, not per-client. The price does not rise as the coach grows. Growth should feel rewarded, not taxed.
2. No add-on stacking. The tier price is the price. Nutrition, payments, and analytics are included in whatever tier they belong to, never bolted on.
3. Priced in local currency, at local purchasing power. PHP for Philippine coaches, USD for international. Not a converted USD figure with a peso sign in front of it.
4. Free tier a coach can actually run a small business on. Three active clients, full coaching features. This is the supply acquisition engine described in doc 02, and it only works if the free tier is genuinely usable.
5. Gate on revenue features, never on coaching quality or safety. Funnel, Content Studio, distribution, and analytics are paid. Programming, check-ins, logging, chat, and every safety feature in doc 06 are free forever.
6. Cancellation is one click, self-serve, no retention gauntlet. The category's worst behaviour becomes our most quotable difference.
7. Never lock a coach out of existing client relationships. See section 6 on downgrades. Clients are not leverage.

## 4. The recommended model

### Coach tiers, Philippine pricing

| | Starter | Pro | Premium |
|---|---|---|---|
| Monthly | PHP 0 | PHP 990 | PHP 2,490 |
| Annual (two months free) | PHP 0 | PHP 9,900 | PHP 24,900 |
| Active clients | 3 | 25 | Unlimited |
| Program builder, templates, logger | Full | Full | Full |
| Check-ins, chat, alerts, safety features | Full | Full | Full |
| Public profile, packages, marketplace listing | Yes | Yes | Yes |
| Saved replies, triage queue, batch operations | Yes | Yes | Yes |
| Video form review | No | Yes | Yes |
| Content Studio | Hook library only | Scripts, calendar, seeds | Full, plus editor handoff pack |
| Funnel suite: quiz, CRM, sequences | No | No | Yes |
| Content push and featured placement | No | Limited | Full |
| Retention and churn analytics | No | Basic | Full |
| Assistant coach seats | No | No | 3 included |

### International pricing

| | Starter | Pro | Premium |
|---|---|---|---|
| Monthly | USD 0 | USD 29 | USD 79 |

Positioning check: Premium at USD 79 flat with unlimited clients and no add-ons sits below the realistic USD 100 to 200 that a 50-client coach pays on the category leader, and it does not climb as they grow. That is a clean, defensible headline.

Sanity check on the PH side: a Pro coach with 10 clients at PHP 5,000 pays about 2 percent of revenue. A Premium coach with 25 clients at PHP 6,000 pays about 1.7 percent. Both land inside the 1 to 3 percent band the category considers healthy, which the USD ladder does not achieve for this market.

### Regional pricing integrity

Tier the price by the coach's payout country and payment method country, not by IP address. IP tiering is trivially defeated by a VPN and it punishes travelling coaches. Publish the regional bands openly rather than hiding them, and accept some leakage as the cost of a policy people trust.

### Take rate

Only relevant if the platform processes client payments. Doc 04 recommends deferring that to phase 5. If and when it ships:

| Tier | Take rate on client payments |
|---|---|
| Starter | 12 percent |
| Pro | 7 percent |
| Premium | 3 percent |

The take rate falls as the subscription rises, which makes upgrading obviously rational for any coach with volume, and keeps the free tier monetized without a subscription. Never charge both a high take rate and a high subscription. Pick which side of the meter the coach is on.

## 5. The coach-facing pricing builder

This is the feature behind "coaches can post their price in their bio". It is more than a number field.

- Package builder: title, price, currency, billing period, inclusions, slot cap, commitment length.
- Commitment default. Package creation defaults to 12 weeks, because doc 08 established that commitment packages are what separates elite coaches from volatile pay-as-you-go earners. Single sessions remain possible but are not the first option offered.
- Live revenue projection. As the coach adjusts price, term, and slot count, show projected monthly recurring revenue, projected revenue at full slots, and what one additional client is worth. Most coaches have never seen this number.
- Benchmark band. Show anonymized, aggregated price ranges for coaches in the same specialty, experience band, and market, presented as context rather than a recommendation. This requires enough coaches on the platform to be non-identifying, so gate it behind a minimum sample size.
- Scarcity handled honestly. Slot caps are real and enforced. When slots hit zero the CTA becomes a waitlist. Never display fake scarcity, and never let a coach set a countdown that resets.
- Price change protection for clients. An existing client's price is locked for the duration of their commitment term. A coach raising prices affects new clients only. Enforce this in code, not in the terms.

## 6. Subsystem design

### 6.1 Plans and entitlements

Entitlements are computed in exactly one place and enforced server side. Never check `tier === 'premium'` inline in a route handler. That pattern scatters and rots.

```ts
// /lib/billing/entitlements.ts
type Entitlements = {
  maxActiveClients: number | 'unlimited'
  videoFormReview: boolean
  contentStudio: 'none' | 'hooks_only' | 'standard' | 'full'
  funnelSuite: boolean
  contentPush: 'none' | 'limited' | 'full'
  analytics: 'none' | 'basic' | 'full'
  assistantSeats: number
  takeRateBps: number
}

getEntitlements(coachId): Promise<Entitlements>
assertEntitled(coachId, capability): throws EntitlementError
```

Every gated action calls `assertEntitled`. The UI reads the same object to decide what to show, so the two can never disagree.

### 6.2 Metering

Counters maintained incrementally, reconciled nightly:
- active client count (engagements in status accepted, active, or paused)
- video review minutes stored
- content seeds generated this period
- assistant seats occupied

Metering must be cheap to read, because it is checked on nearly every write.

### 6.3 Limits, and what happens at the edge

This is the part most platforms get ethically wrong.

- Hitting a client cap blocks accepting new clients. It never suspends, hides, or degrades an existing engagement.
- Downgrading from Pro to Starter with 12 active clients does not cut nine clients loose. Existing engagements are grandfathered until they end naturally. The coach cannot accept new clients until they are under the cap.
- Failed payment moves the account to read-only after a grace period: the coach can still message clients, clients can still train and log, and nothing is deleted. Only new-client acceptance and paid feature use are suspended.
- Data is never deleted for non-payment. Retain per the retention policy in doc 06 and let the coach export at any time.

The reasoning is simple: a client's coaching relationship is not collateral for their coach's software bill.

### 6.4 Billing mechanics

- Upgrades take effect immediately with prorated charge. Downgrades take effect at period end, no proration credit.
- Annual plans: two months free, refundable pro rata within 30 days.
- Trial: 30 days of Premium, no card required. Card-required trials suppress signup, and supply acquisition matters more than trial-to-paid conversion at this stage.
- Grandfathering: store `price_version` on the subscription. A price rise never applies to an existing subscriber until they change tiers. Announce changes at least 30 days ahead.
- Dunning: retry on a defined schedule, notify on each failure, grace period before read-only, clear one-click update-card path.
- Cancellation: self-serve, immediate confirmation, access until period end, no retention interstitial beyond a single optional reason field.
- Coupons and referral credit: percentage or fixed, first-period or recurring, redemption cap, expiry.
- Idempotency keys on every provider webhook. Assume every webhook arrives twice.
- Tax: Philippine VAT applies to digital services. Confirm current registration thresholds and invoicing requirements with a Philippine accountant before launch, and check destination-country rules for international coaches. Build invoice generation with a tax line from day one, since retrofitting it is painful.

### 6.5 Data model additions

```sql
plans (
  id uuid pk, code text unique,               -- starter, pro, premium
  name text, is_active boolean,
  entitlements jsonb not null                 -- the Entitlements shape above
)

plan_prices (
  id uuid pk, plan_id uuid fk -> plans,
  region text not null,                       -- PH, INTL
  currency text not null,
  interval text not null,                     -- month, year
  amount_cents int not null,
  price_version int not null,
  effective_from timestamptz, effective_to timestamptz
)

platform_subscriptions (
  id uuid pk, coach_id uuid fk -> coach_profiles,
  plan_id uuid fk -> plans,
  plan_price_id uuid fk -> plan_prices,
  price_version int not null,
  status text,                                -- trialing, active, past_due, read_only, canceled
  trial_ends_at timestamptz,
  current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  provider text, provider_subscription_id text
)

usage_counters (
  coach_id uuid, period_start date,
  active_clients int, video_minutes int, content_seeds int, assistant_seats int,
  primary key (coach_id, period_start)
)

invoices (
  id uuid pk, coach_id uuid, subtotal_cents int, tax_cents int, total_cents int,
  currency text, tax_rate_bps int, tax_label text,
  status text, issued_at timestamptz, paid_at timestamptz, provider_invoice_id text
)

coupons (id, code, kind, value, applies_to_plan_ids, max_redemptions, redeemed_count, expires_at)
```

Money is always integer cents plus an ISO currency code. Never store a converted value. Never store a float.

### 6.6 Events to instrument

`plan_viewed`, `trial_started`, `trial_converted`, `trial_expired`, `subscription_created`, `upgraded`, `downgraded`, `limit_hit` (with which limit), `payment_failed`, `entered_read_only`, `recovered`, `canceled` (with reason), `reactivated`.

`limit_hit` is the most commercially valuable event in the system. It marks the exact moment a coach felt the ceiling, and it is the only honest upgrade prompt: shown at the moment of need, never as a nag.

## 7. Anti-patterns, explicitly rejected

- Per-client price ladders.
- Add-ons for anything a working coach obviously needs.
- Transaction fee surprises layered on top of a subscription.
- Cancellation flows with retention interstitials, phone calls, or email-only cancellation.
- Any upgrade prompt that appears when the coach has not hit a limit.
- Feature gates on safety features. Never, at any price, under any commercial pressure.
- Gating the client experience. Clients never pay the platform in this model, and a client's experience must not degrade because their coach is on a lower tier. The client did not choose the tier.

## 8. Open decisions

1. Do the free tier's three clients include past engagements or only active ones? Recommendation: active only.
2. Is the Content Studio inside Premium, a separate paid tier, or the entry point to a done-for-you production service? Doc 08 section 8 raised this. It materially changes what Premium is worth.
3. Regional bands beyond PH and INTL. Adding SEA at a middle price point widens the market but complicates the story. Recommendation: two bands until there is demand evidence for a third.
4. Whether the platform ever charges clients directly. Current recommendation across all docs: no. Clients pay coaches. The platform's customer is the coach.
5. Launch pricing versus steady-state pricing. Founding coach cohort should get a permanent discount or a permanent tier, and that promise must be honoured through `price_version` forever, not quietly retired.
