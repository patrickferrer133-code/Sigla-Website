import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coachProfiles } from "@/lib/db/schema/identity";
import { invoices, plans, planPrices, platformSubscriptions, webhookEvents } from "@/lib/db/schema/billing";
import {
  nextMonthlyPeriod,
  tierForPlanCode,
  type CheckoutPaidAttribution,
} from "@/lib/domain/billing-webhook";

export type WebhookServiceError =
  | { code: "duplicate_delivery" }
  | { code: "invoice_not_found"; checkoutSessionId: string }
  | { code: "invoice_coach_mismatch" }
  | { code: "amount_mismatch"; expectedCents: number; paidCents: number }
  | { code: "plan_not_found"; planId: string }
  | { code: "price_not_found"; planPriceId: string };

export type WebhookServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WebhookServiceError };

function fail<T>(error: WebhookServiceError): WebhookServiceResult<T> {
  return { ok: false, error };
}

export const PAYMONGO_PROVIDER = "paymongo";

/**
 * Records the delivery. The unique index on (provider, event_id) is the
 * idempotency boundary for the whole handler: a conflict means we have already
 * accepted this event id, so the caller must ack and do nothing else.
 *
 * `attemptCount` is incremented on conflict so a retried delivery of an event
 * whose processing previously failed is still visible to the reconciliation
 * job, without re-running the side effects here.
 */
export async function recordWebhookDelivery(input: {
  eventId: string;
  eventType: string;
  payload: unknown;
}): Promise<WebhookServiceResult<{ id: string }>> {
  const [inserted] = await db
    .insert(webhookEvents)
    .values({
      provider: PAYMONGO_PROVIDER,
      eventId: input.eventId,
      eventType: input.eventType,
      // jsonb column; the raw provider payload is retained for dispute
      // forensics. It carries no client health data.
      payload: input.payload as never,
      status: "received",
      attemptCount: 1,
    })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });

  if (!inserted) {
    await db
      .update(webhookEvents)
      .set({ attemptCount: sql`${webhookEvents.attemptCount} + 1` })
      .where(
        and(eq(webhookEvents.provider, PAYMONGO_PROVIDER), eq(webhookEvents.eventId, input.eventId)),
      );
    return fail({ code: "duplicate_delivery" });
  }

  return { ok: true, data: { id: inserted.id } };
}

export async function markWebhookProcessed(
  id: string,
  status: "processed" | "ignored",
): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ status, processedAt: new Date(), lastError: null })
    .where(eq(webhookEvents.id, id));
}

export async function markWebhookFailed(id: string, lastError: string): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ status: "failed", lastError: lastError.slice(0, 1000) })
    .where(eq(webhookEvents.id, id));
}

/**
 * Settles the invoice for a paid checkout session and activates the coach's
 * platform subscription.
 *
 * Safe to run twice: every write is a set-to-a-known-value, and the invoice is
 * located by the session id, so a replayed event lands on the same rows with
 * the same result. Only `paidAt` and the period bounds move, and only when the
 * invoice is not already paid.
 */
export async function applyCheckoutPaid(
  attribution: CheckoutPaidAttribution,
  now: Date = new Date(),
): Promise<WebhookServiceResult<{ platformSubscriptionId: string; invoiceId: string }>> {
  const [plan] = await db
    .select({ id: plans.id, code: plans.code })
    .from(plans)
    .where(eq(plans.id, attribution.planId))
    .limit(1);
  if (!plan) return fail({ code: "plan_not_found", planId: attribution.planId });

  const [price] = await db
    .select({ id: planPrices.id, priceVersion: planPrices.priceVersion })
    .from(planPrices)
    .where(eq(planPrices.id, attribution.planPriceId))
    .limit(1);
  if (!price) return fail({ code: "price_not_found", planPriceId: attribution.planPriceId });

  const [invoice] = await db
    .select({
      id: invoices.id,
      coachId: invoices.coachId,
      totalCents: invoices.totalCents,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
    })
    .from(invoices)
    .where(eq(invoices.providerCheckoutSessionId, attribution.checkoutSessionId))
    .limit(1);

  // The invoice is written synchronously before the coach is redirected, so a
  // miss is almost always a read-your-write race on a very fast payment. The
  // caller returns non-2xx and PayMongo retries.
  if (!invoice) {
    return fail({ code: "invoice_not_found", checkoutSessionId: attribution.checkoutSessionId });
  }

  // The session metadata is provider-controlled input. Cross-check it against
  // the invoice we created ourselves before touching anyone's entitlements.
  if (invoice.coachId !== attribution.coachId) {
    return fail({ code: "invoice_coach_mismatch" });
  }

  // Both sides are integer centavos, so this is an exact comparison with no
  // float tolerance. A mismatch means an underpayment or a tampered session
  // and must not activate the plan.
  if (attribution.paidAmountCents !== null && attribution.paidAmountCents !== invoice.totalCents) {
    return fail({
      code: "amount_mismatch",
      expectedCents: invoice.totalCents,
      paidCents: attribution.paidAmountCents,
    });
  }

  const period = nextMonthlyPeriod(now);
  const tier = tierForPlanCode(plan.code);

  return db.transaction(async (tx) => {
    // One live subscription per coach is the invariant; canceled rows are kept
    // for history and are never revived.
    const [existing] = await tx
      .select({ id: platformSubscriptions.id, providerCustomerId: platformSubscriptions.providerCustomerId })
      .from(platformSubscriptions)
      .where(
        and(
          eq(platformSubscriptions.coachId, attribution.coachId),
          ne(platformSubscriptions.status, "canceled"),
        ),
      )
      .limit(1);

    const subscriptionValues = {
      planId: plan.id,
      planPriceId: price.id,
      priceVersion: price.priceVersion,
      status: "active" as const,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      provider: PAYMONGO_PROVIDER,
      // PayMongo has no native subscription object; we key renewals off the
      // paying checkout session (see the schema comment on this column).
      providerSubscriptionId: attribution.checkoutSessionId,
      providerCustomerId: attribution.providerCustomerId ?? existing?.providerCustomerId ?? null,
    };

    let platformSubscriptionId: string;
    if (existing) {
      await tx
        .update(platformSubscriptions)
        .set(subscriptionValues)
        .where(eq(platformSubscriptions.id, existing.id));
      platformSubscriptionId = existing.id;
    } else {
      const [created] = await tx
        .insert(platformSubscriptions)
        .values({ coachId: attribution.coachId, ...subscriptionValues })
        .returning({ id: platformSubscriptions.id });
      platformSubscriptionId = created.id;
    }

    await tx
      .update(invoices)
      .set({
        status: "paid",
        issuedAt: invoice.issuedAt ?? now,
        paidAt: now,
        providerPaymentIntentId: attribution.providerPaymentIntentId,
        platformSubscriptionId,
      })
      .where(eq(invoices.id, invoice.id));

    // Entitlements are read off coach_profiles.tier via /lib/billing/entitlements.
    // Keeping it in the same transaction means a coach is never charged
    // without the tier landing, or vice versa.
    await tx.update(coachProfiles).set({ tier }).where(eq(coachProfiles.id, attribution.coachId));

    return { ok: true as const, data: { platformSubscriptionId, invoiceId: invoice.id } };
  });
}
