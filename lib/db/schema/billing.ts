import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { idColumn } from "./_shared";
import { coachProfiles } from "./identity";

// The Entitlements shape from docs/09-pricing-system.md section 6.1.
// Entitlements are computed in exactly one place (/lib/billing/entitlements.ts)
// and enforced server side. Never check `tier === 'premium'` inline.
export const plans = pgTable("plans", {
  id: idColumn(),
  code: text("code", { enum: ["starter", "pro", "premium"] }).notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  entitlements: jsonb("entitlements")
    .$type<{
      maxActiveClients: number | "unlimited";
      videoFormReview: boolean;
      contentStudio: "none" | "hooks_only" | "standard" | "full";
      funnelSuite: boolean;
      contentPush: "none" | "limited" | "full";
      analytics: "none" | "basic" | "full";
      assistantSeats: number;
      takeRateBps: number;
    }>()
    .notNull(),
});

export const planPrices = pgTable("plan_prices", {
  id: idColumn(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  region: text("region", { enum: ["PH", "INTL"] }).notNull(),
  currency: text("currency").notNull(),
  interval: text("interval", { enum: ["month", "year"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  priceVersion: integer("price_version").notNull().default(1),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
});

// The coach's own subscription to the platform (Starter/Pro/Premium). Distinct
// from `subscriptions` in commerce.ts, which is a client's subscription to a
// coach's package. Never conflate the two.
export const platformSubscriptions = pgTable("platform_subscriptions", {
  id: idColumn(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  planPriceId: uuid("plan_price_id")
    .notNull()
    .references(() => planPrices.id),
  priceVersion: integer("price_version").notNull(),
  status: text("status", {
    enum: ["trialing", "active", "past_due", "read_only", "canceled"],
  }).notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  provider: text("provider"),
  // PayMongo has no native subscription object. This holds our own stable
  // recurring reference (the id we regenerate a checkout session against each
  // period), NOT a provider-issued subscription id. For a Stripe-style
  // provider it would hold the real subscription id.
  providerSubscriptionId: text("provider_subscription_id"),
  // PayMongo customer id, stable across billing periods. Needed so renewal
  // checkout sessions can reuse a saved payment method / customer record
  // instead of re-collecting details every month.
  providerCustomerId: text("provider_customer_id"),
}, (t) => ({
  // Read on effectively every authenticated coach request via the billing
  // summary. One live subscription per coach is the intended invariant, but
  // canceled rows are retained for history, so this is non-unique.
  coachIdIdx: index("platform_subscriptions_coach_id_idx").on(t.coachId),
}));

export const usageCounters = pgTable("usage_counters", {
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  periodStart: date("period_start").notNull(),
  activeClients: integer("active_clients").notNull().default(0),
  videoMinutes: integer("video_minutes").notNull().default(0),
  contentSeeds: integer("content_seeds").notNull().default(0),
  assistantSeats: integer("assistant_seats").notNull().default(0),
});

export const invoices = pgTable("invoices", {
  id: idColumn(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  subtotalCents: integer("subtotal_cents").notNull(),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull(),
  taxRateBps: integer("tax_rate_bps").notNull().default(0),
  taxLabel: text("tax_label"),
  status: text("status", { enum: ["draft", "issued", "paid", "void"] }).notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  providerInvoiceId: text("provider_invoice_id"),
  // PayMongo issues one Checkout Session per billing period, so the session
  // and its payment intent belong on the invoice (the per-period object), not
  // on the subscription. The webhook handler resolves
  // `checkout_session.payment.paid` -> invoice by this column.
  providerCheckoutSessionId: text("provider_checkout_session_id"),
  providerPaymentIntentId: text("provider_payment_intent_id"),
  // The subscription period this invoice bills for. Nullable: one-off invoices
  // (e.g. manual/admin adjustments) have no subscription.
  platformSubscriptionId: uuid("platform_subscription_id").references(
    () => platformSubscriptions.id,
    { onDelete: "set null" },
  ),
}, (t) => ({
  coachIdIdx: index("invoices_coach_id_idx").on(t.coachId),
  // Webhook lookup path: session id -> invoice. Unique so a replayed or
  // duplicated session can never fan out to two invoices.
  checkoutSessionIdx: uniqueIndex("invoices_provider_checkout_session_id_idx")
    .on(t.providerCheckoutSessionId)
    .where(sql`${t.providerCheckoutSessionId} IS NOT NULL`),
}));

// Provider webhook receipts, for idempotency. PayMongo does not guarantee
// exactly-once delivery and will retry on non-2xx, so the handler must insert
// here first (ON CONFLICT DO NOTHING) and treat a conflict as "already seen,
// ack and return". `payload` is retained for replay and dispute forensics.
//
// Not a user-content table, so no soft delete: rows are pruned by a retention
// job, not by `deleted_at`. RLS is enabled with no policies, meaning only the
// service role reaches it. No coach or client ever reads this table.
export const webhookEvents = pgTable("webhook_events", {
  id: idColumn(),
  provider: text("provider").notNull(),
  // Provider-assigned event id, e.g. PayMongo `evt_...`.
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  // Null until the handler has fully committed its side effects. A row with
  // received_at set and processed_at null is an in-flight or crashed delivery
  // and is what the reconciliation job looks for.
  processedAt: timestamp("processed_at", { withTimezone: true }),
  status: text("status", {
    enum: ["received", "processed", "failed", "ignored"],
  })
    .notNull()
    .default("received"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
}, (t) => ({
  // Scoped by provider, not a bare unique on event_id: a future provider's id
  // space could collide with PayMongo's. This index also serves the dedupe
  // lookup on every single webhook request.
  providerEventIdIdx: uniqueIndex("webhook_events_provider_event_id_idx").on(
    t.provider,
    t.eventId,
  ),
  // Reconciliation job: find stuck deliveries.
  unprocessedIdx: index("webhook_events_unprocessed_idx")
    .on(t.provider, t.receivedAt)
    .where(sql`${t.processedAt} IS NULL`),
}));

export const coupons = pgTable("coupons", {
  id: idColumn(),
  code: text("code").notNull().unique(),
  kind: text("kind", { enum: ["percentage", "fixed"] }).notNull(),
  value: integer("value").notNull(),
  appliesToPlanIds: uuid("applies_to_plan_ids").array(),
  maxRedemptions: integer("max_redemptions"),
  redeemedCount: integer("redeemed_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});
