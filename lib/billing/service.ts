import "server-only";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coachProfiles, users } from "@/lib/db/schema/identity";
import { engagements } from "@/lib/db/schema/commerce";
import { plans, planPrices } from "@/lib/db/schema/billing";
import { getEntitlementsForTier, canAcceptAnotherClient, type CoachTier } from "./entitlements";

export async function countActiveClients(coachId: string): Promise<number> {
  const rows = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(and(eq(engagements.coachId, coachId), or(eq(engagements.status, "active"), eq(engagements.status, "paused"))));
  return rows.length;
}

export async function getCoachTier(coachId: string): Promise<CoachTier> {
  const [row] = await db.select({ tier: coachProfiles.tier }).from(coachProfiles).where(eq(coachProfiles.id, coachId)).limit(1);
  return (row?.tier as CoachTier) ?? "free";
}

export async function getBillingSummaryForCoach(coachId: string) {
  const [tier, activeClients] = await Promise.all([getCoachTier(coachId), countActiveClients(coachId)]);
  return { tier, entitlements: getEntitlementsForTier(tier), activeClients };
}

// The one server-side gate for accepting a new client onto a coach's roster
// (docs/09 section 4: "gate on revenue features, never on coaching quality
// or safety" — this is the one coaching-adjacent gate that IS a revenue
// feature, since it's literally the paid tier's client-count ceiling).
export async function assertCanAcceptNewClient(coachId: string): Promise<{ allowed: boolean; tier: CoachTier; activeClients: number }> {
  const tier = await getCoachTier(coachId);
  const activeClients = await countActiveClients(coachId);
  return { allowed: canAcceptAnotherClient(tier, activeClients), tier, activeClients };
}

// Manual/off-platform for now, matching the client-payments decision (docs/02
// section 9): a coach pays via bank transfer or GCash outside the platform,
// and an admin applies the tier change here once payment is confirmed. No
// self-serve billing exists until a payment provider is wired up.
export async function setCoachTier(coachId: string, tier: CoachTier): Promise<void> {
  await db.update(coachProfiles).set({ tier }).where(eq(coachProfiles.id, coachId));
}

// Current PH monthly list price per plan code, for the billing page. Amounts
// stay integer centavos all the way to the formatter.
export async function getPhMonthlyPlanPrices(): Promise<
  Record<string, { amountCents: number; currency: string }>
> {
  const now = new Date();
  const rows = await db
    .select({
      code: plans.code,
      amountCents: planPrices.amountCents,
      currency: planPrices.currency,
      priceVersion: planPrices.priceVersion,
    })
    .from(planPrices)
    .innerJoin(plans, eq(plans.id, planPrices.planId))
    .where(
      and(
        eq(planPrices.region, "PH"),
        eq(planPrices.interval, "month"),
        eq(plans.isActive, true),
        or(isNull(planPrices.effectiveFrom), lte(planPrices.effectiveFrom, now))!,
        or(isNull(planPrices.effectiveTo), gt(planPrices.effectiveTo, now))!,
      ),
    )
    .orderBy(planPrices.priceVersion);

  const byCode: Record<string, { amountCents: number; currency: string }> = {};
  for (const row of rows) {
    // Ordered ascending by version, so the last write wins: the newest price.
    byCode[row.code] = { amountCents: row.amountCents, currency: row.currency };
  }
  return byCode;
}

export async function listCoachesWithTierInfo() {
  const rows = await db
    .select({
      coachId: coachProfiles.id,
      handle: coachProfiles.handle,
      tier: coachProfiles.tier,
      displayName: users.displayName,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .orderBy(coachProfiles.handle);

  const withCounts = await Promise.all(
    rows.map(async (row) => ({ ...row, activeClients: await countActiveClients(row.coachId) })),
  );
  return withCounts;
}
