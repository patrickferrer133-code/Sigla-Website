import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coachProfiles, clientProfiles, users } from "@/lib/db/schema/identity";
import { packages, engagements, reviews } from "@/lib/db/schema/commerce";
import { isEligibleForReview } from "@/lib/domain/reviews";
import type { DiscoverFilters, ApplyToPackageInput, SavePackageInput, SubmitReviewInput } from "./schemas";

export type MarketplaceError =
  | { code: "not_found"; resource: string }
  | { code: "already_engaged" }
  | { code: "not_accepting_clients" }
  | { code: "not_eligible" }
  | { code: "already_reviewed" };
export type MarketplaceResult<T> = { ok: true; data: T } | { ok: false; error: MarketplaceError };
function ok<T>(data: T): MarketplaceResult<T> {
  return { ok: true, data };
}
function fail<T>(error: MarketplaceError): MarketplaceResult<T> {
  return { ok: false, error };
}

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
      acceptingClients: coachProfiles.acceptingClients,
      ratingAvg: coachProfiles.ratingAvg,
      ratingCount: coachProfiles.ratingCount,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(coachProfiles)
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(eq(coachProfiles.handle, handle))
    .limit(1);
  if (!coach) return null;

  const [coachPackages, coachReviews] = await Promise.all([
    db
      .select()
      .from(packages)
      .where(and(eq(packages.coachId, coach.id), eq(packages.isPublished, true)))
      .orderBy(packages.sortOrder),
    listReviewsForCoach(coach.id),
  ]);

  return { coach, packages: coachPackages, reviews: coachReviews };
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
    .select({ id: engagements.id, status: engagements.status })
    .from(engagements)
    .where(and(eq(engagements.id, engagementId), eq(engagements.coachId, coachId)))
    .limit(1);
  if (!engagement) return fail({ code: "not_found", resource: "engagement" });
  if (engagement.status !== "applied") return fail({ code: "not_found", resource: "engagement" });

  if (decision === "accept") {
    await db
      .update(engagements)
      .set({ status: "active", startedAt: new Date() })
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

export async function listClientEngagementsForReview(clientId: string) {
  const rows = await db
    .select({
      engagementId: engagements.id,
      status: engagements.status,
      startedAt: engagements.startedAt,
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
