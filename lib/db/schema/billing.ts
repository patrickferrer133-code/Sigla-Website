import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, date } from "drizzle-orm/pg-core";
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
  providerSubscriptionId: text("provider_subscription_id"),
});

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
});

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
