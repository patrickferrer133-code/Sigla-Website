import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coachProfiles, clientProfiles, users } from "@/lib/db/schema/identity";
import { packages, engagements, reviews } from "@/lib/db/schema/commerce";
import { isEligibleForReview } from "@/lib/domain/reviews";
import { assertCanAcceptNewClient } from "@/lib/billing/service";
import type { DiscoverFilters, ApplyToPackageInput, SavePackageInput, SubmitReviewInput, SaveCoachProfileInput } from "./schemas";

export type MarketplaceError =
  | { code: "not_found"; resource: string }
  | { code: "already_engaged" }
  | { code: "not_accepting_clients" }
  | { code: "not_eligible" }
  | { code: "already_reviewed" }
  | { code: "handle_taken" }
  | { code: "client_limit_reached" };
export type MarketplaceResult<T> = { ok: true; data: T } | { ok: false; error: MarketplaceError };
function ok<T>(data: T): MarketplaceResult<T> {
  return { ok: true, data };
}
function fail<T>(error: MarketplaceError): MarketplaceResult<T> {
  return { ok: false, error };
}

// Kept in sync with app/page.tsx's FOUNDING_COACH_THRESHOLD — the badge is a
// real fact about signup order (first N coaches ever), not a marketing number.
const FOUNDING_COACH_THRESHOLD = 25;

// Only fields safe for an anonymous public visitor. Never select sex_at_birth,
// email, or anything from client_profiles here — this function has no access to it.
export async function searchCoaches(filters: DiscoverFilters) {
  const conditions = [eq(coachProfiles.acceptingClients, true)];
  if (filters.city) conditions.push(ilike(coachProfiles.city, `%${filters.city}%`));
  if (filters.mode) conditions.push(sql`${filters.mode} = any(${coachProfiles.coachingMode})`);
  if (filters.specialty) conditions.push(sql`${filters.specialty} = any(${coachProfiles.specialties})`);
  if (filters.q) {
    conditions.push(
      or(ilike(coachProfiles.headline, `%${filters.q}%`), ilike(coachProfiles.handle, `%${filters.q}%`))!,
    );
  }

  return db
    .select({
      handle: coachProfiles.handle,
      headline: coachProfiles.headline,
      specialties: coachProfiles.specialties,
      coachingMode: coachProfiles.coachingMode,
      city: coachProfiles.city,
      country: coachProfiles.country,
      verificationStatus: coachProfiles.verificationStatus,
      ratingAvg: coachProfiles.ratingAvg,
      ratingCount: coachProfiles.ratingCount,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(and(...conditions))
    .orderBy(desc(coachProfiles.ratingAvg))
    .limit(30);
}

export async function getCoachPublicProfile(handle: string) {
  const [coach] = await db
    .select({
      id: coachProfiles.id,
      handle: coachProfiles.handle,
      headline: coachProfiles.headline,
      bio: coachProfiles.bio,
      yearsExperience: coachProfiles.yearsExperience,
      specialties: coachProfiles.specialties,
      languages: coachProfiles.languages,
      coachingMode: coachProfiles.coachingMode,
      city: coachProfiles.city,
      country: coachProfiles.country,
      credentials: coachProfiles.credentials,
      verificationStatus: coachProfiles.verificationStatus,
      introVideoUrl: coachProfiles.introVideoUrl,
      coverPhotoUrl: coachProfiles.coverPhotoUrl,
      acceptingClients: coachProfiles.acceptingClients,
      ratingAvg: coachProfiles.ratingAvg,
      ratingCount: coachProfiles.ratingCount,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      createdAt: coachProfiles.createdAt,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(eq(coachProfiles.handle, handle))
    .limit(1);
  if (!coach) return null;

  // Founding-coach status is a real fact about signup order, not a marketing
  // number — the badge is only true for coaches who actually joined within
  // the platform's first FOUNDING_COACH_THRESHOLD signups.
  const [{ signupRank }] = await db
    .select({ signupRank: sql<number>`count(*)::int` })
    .from(coachProfiles)
    .where(sql`${coachProfiles.createdAt} <= ${coach.createdAt.toISOString()}`);
  const isFoundingCoach = signupRank <= FOUNDING_COACH_THRESHOLD;

  const [coachPackages, coachReviews] = await Promise.all([
    db
      .select()
      .from(packages)
      .where(and(eq(packages.coachId, coach.id), eq(packages.isPublished, true)))
      .orderBy(packages.sortOrder),
    listReviewsForCoach(coach.id),
  ]);

  return { coach: { ...coach, isFoundingCoach }, packages: coachPackages, reviews: coachReviews };
}

export async function applyToPackage(clientId: string, input: ApplyToPackageInput): Promise<MarketplaceResult<{ engagementId: string }>> {
  const [pkg] = await db
    .select({ id: packages.id, coachId: packages.coachId })
    .from(packages)
    .where(and(eq(packages.id, input.packageId), eq(packages.isPublished, true)))
    .limit(1);
  if (!pkg) return fail({ code: "not_found", resource: "package" });

  const [coach] = await db
    .select({ acceptingClients: coachProfiles.acceptingClients })
    .from(coachProfiles)
    .where(eq(coachProfiles.id, pkg.coachId))
    .limit(1);
  if (!coach) return fail({ code: "not_found", resource: "coach" });
  if (!coach.acceptingClients) return fail({ code: "not_accepting_clients" });

  const [existing] = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(
      and(
        eq(engagements.coachId, pkg.coachId),
        eq(engagements.clientId, clientId),
        or(eq(engagements.status, "applied"), eq(engagements.status, "accepted"), eq(engagements.status, "active"), eq(engagements.status, "paused")),
      ),
    )
    .limit(1);
  if (existing) return fail({ code: "already_engaged" });

  const [engagement] = await db
    .insert(engagements)
    .values({ coachId: pkg.coachId, clientId, packageId: pkg.id, status: "applied" })
    .returning({ id: engagements.id });

  return ok({ engagementId: engagement.id });
}

export async function listApplicationsForCoach(coachId: string) {
  return db
    .select({
      engagementId: engagements.id,
      clientId: engagements.clientId,
      packageTitle: packages.title,
      createdAt: engagements.createdAt,
      clientDisplayName: users.displayName,
    })
    .from(engagements)
    .innerJoin(clientProfiles, eq(clientProfiles.id, engagements.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .leftJoin(packages, eq(packages.id, engagements.packageId))
    .where(and(eq(engagements.coachId, coachId), eq(engagements.status, "applied")))
    .orderBy(desc(engagements.createdAt));
}

export async function respondToApplication(
  coachId: string,
  engagementId: string,
  decision: "accept" | "decline",
): Promise<MarketplaceResult<true>> {
  const [engagement] = await db
    .select({ id: engagements.id, status: engagements.status, packageId: engagements.packageId })
    .from(engagements)
    .where(and(eq(engagements.id, engagementId), eq(engagements.coachId, coachId)))
    .limit(1);
  if (!engagement) return fail({ code: "not_found", resource: "engagement" });
  if (engagement.status !== "applied") return fail({ code: "not_found", resource: "engagement" });

  if (decision === "accept") {
    const check = await assertCanAcceptNewClient(coachId);
    if (!check.allowed) return fail({ code: "client_limit_reached" });

    let trialEndsAt: Date | null = null;
    if (engagement.packageId) {
      const [pkg] = await db.select({ trialDays: packages.trialDays }).from(packages).where(eq(packages.id, engagement.packageId)).limit(1);
      if (pkg?.trialDays) trialEndsAt = new Date(Date.now() + pkg.trialDays * 24 * 60 * 60 * 1000);
    }

    await db
      .update(engagements)
      .set({ status: "active", startedAt: new Date(), trialEndsAt })
      .where(eq(engagements.id, engagementId));
  } else {
    await db
      .update(engagements)
      .set({ status: "ended", endedAt: new Date(), endReason: "declined_application" })
      .where(eq(engagements.id, engagementId));
  }
  return ok(true);
}

export async function listPackagesForOwner(coachId: string) {
  return db.select().from(packages).where(eq(packages.coachId, coachId)).orderBy(packages.sortOrder, packages.createdAt);
}

export async function createPackage(coachId: string, input: SavePackageInput): Promise<MarketplaceResult<{ packageId: string }>> {
  const [pkg] = await db
    .insert(packages)
    .values({
      coachId,
      title: input.title,
      description: input.description,
      priceCents: input.priceCents,
      currency: input.currency,
      billingPeriod: input.billingPeriod,
      inclusions: input.inclusions,
      slotLimit: input.slotLimit,
      trialDays: input.trialDays,
    })
    .returning({ id: packages.id });
  return ok({ packageId: pkg.id });
}

export async function updatePackage(coachId: string, packageId: string, input: SavePackageInput): Promise<MarketplaceResult<true>> {
  const [existing] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(and(eq(packages.id, packageId), eq(packages.coachId, coachId)))
    .limit(1);
  if (!existing) return fail({ code: "not_found", resource: "package" });

  await db
    .update(packages)
    .set({
      title: input.title,
      description: input.description,
      priceCents: input.priceCents,
      currency: input.currency,
      billingPeriod: input.billingPeriod,
      inclusions: input.inclusions,
      slotLimit: input.slotLimit,
      trialDays: input.trialDays,
    })
    .where(eq(packages.id, packageId));
  return ok(true);
}

export async function setPackagePublished(coachId: string, packageId: string, isPublished: boolean): Promise<MarketplaceResult<true>> {
  const [existing] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(and(eq(packages.id, packageId), eq(packages.coachId, coachId)))
    .limit(1);
  if (!existing) return fail({ code: "not_found", resource: "package" });

  await db.update(packages).set({ isPublished }).where(eq(packages.id, packageId));
  return ok(true);
}

export async function getCoachProfileForOwner(coachId: string) {
  const [row] = await db.select().from(coachProfiles).where(eq(coachProfiles.id, coachId)).limit(1);
  return row ?? null;
}

export async function updateCoachProfile(coachId: string, input: SaveCoachProfileInput): Promise<MarketplaceResult<true>> {
  const [handleOwner] = await db
    .select({ id: coachProfiles.id })
    .from(coachProfiles)
    .where(eq(coachProfiles.handle, input.handle))
    .limit(1);
  if (handleOwner && handleOwner.id !== coachId) return fail({ code: "handle_taken" });

  await db
    .update(coachProfiles)
    .set({
      handle: input.handle,
      headline: input.headline,
      bio: input.bio,
      yearsExperience: input.yearsExperience,
      specialties: input.specialties,
      languages: input.languages,
      coachingMode: input.coachingMode,
      city: input.city,
      country: input.country,
      acceptingClients: input.acceptingClients,
    })
    .where(eq(coachProfiles.id, coachId));
  return ok(true);
}

export async function listClientEngagementsForReview(clientId: string) {
  const rows = await db
    .select({
      engagementId: engagements.id,
      status: engagements.status,
      startedAt: engagements.startedAt,
      trialEndsAt: engagements.trialEndsAt,
      coachHandle: coachProfiles.handle,
      coachDisplayName: users.displayName,
      hasReviewed: sql<boolean>`${reviews.id} is not null`,
    })
    .from(engagements)
    .innerJoin(coachProfiles, eq(coachProfiles.id, engagements.coachId))
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .leftJoin(reviews, eq(reviews.engagementId, engagements.id))
    .where(eq(engagements.clientId, clientId))
    .orderBy(desc(engagements.createdAt));

  return rows.map((row) => ({
    ...row,
    isEligible: !row.hasReviewed && isEligibleForReview({ status: row.status, startedAt: row.startedAt }),
  }));
}

export async function submitReview(clientId: string, input: SubmitReviewInput): Promise<MarketplaceResult<true>> {
  const [engagement] = await db
    .select({ id: engagements.id, coachId: engagements.coachId, status: engagements.status, startedAt: engagements.startedAt })
    .from(engagements)
    .where(and(eq(engagements.id, input.engagementId), eq(engagements.clientId, clientId)))
    .limit(1);
  if (!engagement) return fail({ code: "not_found", resource: "engagement" });
  if (!isEligibleForReview({ status: engagement.status, startedAt: engagement.startedAt })) {
    return fail({ code: "not_eligible" });
  }

  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.engagementId, input.engagementId))
    .limit(1);
  if (existing) return fail({ code: "already_reviewed" });

  await db.insert(reviews).values({
    engagementId: input.engagementId,
    coachId: engagement.coachId,
    clientId,
    rating: input.rating,
    body: input.body,
  });

  const [agg] = await db
    .select({ avg: sql<string>`avg(${reviews.rating})`, count: sql<number>`count(*)` })
    .from(reviews)
    .where(eq(reviews.coachId, engagement.coachId));
  await db
    .update(coachProfiles)
    .set({ ratingAvg: agg.avg, ratingCount: Number(agg.count) })
    .where(eq(coachProfiles.id, engagement.coachId));

  return ok(true);
}

export async function listReviewsForCoach(coachId: string) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      createdAt: reviews.createdAt,
      clientDisplayName: users.displayName,
    })
    .from(reviews)
    .innerJoin(clientProfiles, eq(clientProfiles.id, reviews.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(eq(reviews.coachId, coachId))
    .orderBy(desc(reviews.createdAt));
}
