import {
  boolean,
  date,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { idColumn, timestamps } from "./_shared";
import { coachProfiles, clientProfiles } from "./identity";

export const packages = pgTable("packages", {
  id: idColumn(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  title: text("title").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("PHP"),
  billingPeriod: text("billing_period", {
    enum: ["one_time", "monthly", "quarterly", "per_12_weeks"],
  }).notNull(),
  inclusions: text("inclusions").array(),
  // Off-platform, same as the price itself (docs/02 section 9 decision 4:
  // coaches bill clients directly). This is just the offer a coach
  // advertises — Sigla never charges, holds, or tracks trial billing.
  trialDays: integer("trial_days"),
  slotLimit: integer("slot_limit"),
  slotsTaken: integer("slots_taken").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const engagements = pgTable(
  "engagements",
  {
    id: idColumn(),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => coachProfiles.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clientProfiles.id),
    packageId: uuid("package_id").references(() => packages.id),
    status: text("status", {
      enum: ["applied", "accepted", "active", "paused", "ended"],
    }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endReason: text("end_reason"),
    // Snapshot of the package's trialDays at accept time, informational only
    // — the coach still bills off-platform, this just shows both sides when
    // the advertised free period is up.
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [unique().on(table.coachId, table.clientId, table.startedAt)],
);

// Gated to clients whose engagement has run for the minimum eligible length
// (docs/07 phase 2: "reviews, gated so only clients with a completed
// engagement of a minimum length can review") — enforced in
// lib/marketplace/service.ts, not here.
export const reviews = pgTable(
  "reviews",
  {
    id: idColumn(),
    engagementId: uuid("engagement_id")
      .notNull()
      .unique()
      .references(() => engagements.id),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => coachProfiles.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clientProfiles.id),
    rating: smallint("rating").notNull(),
    body: text("body"),
    ...timestamps,
  },
);

export const subscriptions = pgTable("subscriptions", {
  id: idColumn(),
  engagementId: uuid("engagement_id")
    .notNull()
    .references(() => engagements.id),
  provider: text("provider"),
  providerSubscriptionId: text("provider_subscription_id"),
  status: text("status", {
    enum: ["trialing", "active", "past_due", "canceled"],
  }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
});

export const payments = pgTable("payments", {
  id: idColumn(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  amountCents: integer("amount_cents"),
  currency: text("currency"),
  platformFeeCents: integer("platform_fee_cents"),
  coachNetCents: integer("coach_net_cents"),
  status: text("status"),
  providerPaymentId: text("provider_payment_id"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const payouts = pgTable("payouts", {
  id: idColumn(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  amountCents: integer("amount_cents"),
  currency: text("currency"),
  status: text("status"),
  providerPayoutId: text("provider_payout_id"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
});
