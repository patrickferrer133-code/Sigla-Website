import "server-only";
import { and, desc, eq, isNull, or, gt, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { plans, planPrices, invoices } from "@/lib/db/schema/billing";
import { isUpgradeFrom, tierForPlanCode, type PlanCode } from "@/lib/domain/billing-webhook";
import { createCheckoutSession } from "./paymongo";
import { getCoachTier } from "./service";

// Orchestration for "coach starts paying Sigla for a plan". Sigla's own
// subscription revenue only. Nothing here touches client-to-coach money.

export type CheckoutError =
  | { code: "plan_not_found"; planCode: PlanCode }
  | { code: "price_not_found"; planCode: PlanCode }
  | { code: "not_an_upgrade"; currentTier: string }
  | { code: "provider_unavailable"; detail: string };

export type CheckoutResult<T> = { ok: true; data: T } | { ok: false; error: CheckoutError };

function fail<T>(error: CheckoutError): CheckoutResult<T> {
  return { ok: false, error };
}

interface StartCheckoutInput {
  coachId: string;
  planCode: Exclude<PlanCode, "starter">;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Resolves the coach's PH monthly price for a plan, opens a PayMongo hosted
 * Checkout Session, and records a draft invoice keyed to that session.
 *
 * Ordering matters: the provider call happens FIRST, and the invoice row is
 * only written once we have a session id. Writing the invoice first would
 * leave an orphaned draft with a null session id (and therefore no way for the
 * webhook to find it) every time the PayMongo call failed.
 */
export async function startPlatformCheckout(
  input: StartCheckoutInput,
): Promise<CheckoutResult<{ checkoutUrl: string; invoiceId: string }>> {
  // Authorization to act as this coach is the caller's job; this function is
  // never reachable without a coach-scoped `coachId` resolved server side.
  const currentTier = await getCoachTier(input.coachId);
  const targetTier = tierForPlanCode(input.planCode);
  if (!isUpgradeFrom(currentTier, targetTier)) {
    return fail({ code: "not_an_upgrade", currentTier });
  }

  const [plan] = await db
    .select({ id: plans.id, name: plans.name })
    .from(plans)
    .where(and(eq(plans.code, input.planCode), eq(plans.isActive, true)))
    .limit(1);
  if (!plan) return fail({ code: "plan_not_found", planCode: input.planCode });

  const now = new Date();
  const [price] = await db
    .select({
      id: planPrices.id,
      currency: planPrices.currency,
      amountCents: planPrices.amountCents,
      priceVersion: planPrices.priceVersion,
    })
    .from(planPrices)
    .where(
      and(
        eq(planPrices.planId, plan.id),
        eq(planPrices.region, "PH"),
        eq(planPrices.interval, "month"),
        or(isNull(planPrices.effectiveFrom), lte(planPrices.effectiveFrom, now))!,
        or(isNull(planPrices.effectiveTo), gt(planPrices.effectiveTo, now))!,
      ),
    )
    .orderBy(desc(planPrices.priceVersion))
    .limit(1);
  if (!price) return fail({ code: "price_not_found", planCode: input.planCode });

  const session = await createCheckoutSession({
    coachId: input.coachId,
    planId: plan.id,
    planPriceId: price.id,
    // Integer centavos straight from the priced column. No float, no *100.
    amountCents: price.amountCents,
    currency: price.currency,
    planName: `Sigla ${plan.name}`,
    description: `Sigla ${plan.name} plan, 1 month`,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });

  if (!session.ok) {
    const detail =
      session.error.code === "api_error"
        ? `${session.error.status}: ${session.error.detail}`
        : session.error.detail;
    return fail({ code: "provider_unavailable", detail });
  }

  // Draft until the webhook confirms payment. Tax is zero-rated here: Sigla's
  // own VAT treatment on platform fees is a separate, unresolved question and
  // is deliberately not guessed at in code.
  const [invoice] = await db
    .insert(invoices)
    .values({
      coachId: input.coachId,
      subtotalCents: price.amountCents,
      taxCents: 0,
      totalCents: price.amountCents,
      currency: price.currency,
      taxRateBps: 0,
      status: "draft",
      providerCheckoutSessionId: session.data.checkoutSessionId,
    })
    .returning({ id: invoices.id });

  return { ok: true, data: { checkoutUrl: session.data.checkoutUrl, invoiceId: invoice.id } };
}
