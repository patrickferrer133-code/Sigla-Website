import "server-only";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  coachPosts,
  communities,
  communityComments,
  communityMemberships,
  communityPosts,
  reports,
} from "@/lib/db/schema/community";
import { coachProfiles, users } from "@/lib/db/schema/identity";
import { engagements } from "@/lib/db/schema/commerce";
import { detectFlags } from "@/lib/domain/community-safety";
import type { CreateCommentInput, CreatePostInput, CreateReportInput } from "./schemas";

export type CommunityError =
  | { code: "not_found"; resource: string }
  | { code: "not_a_member" }
  | { code: "not_eligible" };
export type CommunityResult<T> = { ok: true; data: T } | { ok: false; error: CommunityError };
function ok<T>(data: T): CommunityResult<T> {
  return { ok: true, data };
}
function fail<T>(error: CommunityError): CommunityResult<T> {
  return { ok: false, error };
}

const ADJECTIVES = ["Steady", "Quiet", "Bold", "Calm", "Sharp", "Bright", "Patient", "Fierce", "Gentle", "Grounded"];
const NOUNS = ["Runner", "Lifter", "Climber", "Walker", "Anchor", "Sparrow", "Otter", "Falcon", "Maple", "River"];

function generateAlias(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${adjective} ${noun} ${suffix}`;
}

export async function listGlobalCommunities() {
  return db.select().from(communities).where(eq(communities.kind, "global_goal"));
}

// A coach-private community is only visible to a client with a current or
// past engagement with that coach (docs/03 join_policy "clients_only").
export async function listCoachCommunitiesForClient(clientId: string) {
  const engagedCoaches = await db.selectDistinct({ coachId: engagements.coachId }).from(engagements).where(eq(engagements.clientId, clientId));
  if (engagedCoaches.length === 0) return [];

  const coachIds = engagedCoaches.map((row) => row.coachId);
  // Lazily provisioned: a coach who onboarded before this feature (or via
  // the seed script) won't have a row yet, so ensure one exists for every
  // coach this client has an engagement with.
  await Promise.all(coachIds.map((id) => getOrCreateCoachCommunity(id)));

  const rows = await db
    .select({ community: communities, coachHandle: coachProfiles.handle })
    .from(communities)
    .innerJoin(coachProfiles, eq(coachProfiles.id, communities.ownerCoachId))
    .where(and(eq(communities.kind, "coach_private"), or(...coachIds.map((id) => eq(communities.ownerCoachId, id)))));
  return rows;
}

export async function getOrCreateCoachCommunity(coachId: string) {
  const [existing] = await db.select().from(communities).where(and(eq(communities.kind, "coach_private"), eq(communities.ownerCoachId, coachId))).limit(1);
  if (existing) return existing;

  const [coach] = await db.select({ handle: coachProfiles.handle }).from(coachProfiles).where(eq(coachProfiles.id, coachId)).limit(1);
  const [created] = await db
    .insert(communities)
    .values({
      kind: "coach_private",
      ownerCoachId: coachId,
      name: `${coach?.handle ?? "Coach"}'s community`,
      joinPolicy: "clients_only",
    })
    .returning();
  return created;
}

export async function clientHasEngagementWithCommunityOwner(clientId: string, communityId: string): Promise<boolean> {
  const [community] = await db.select({ ownerCoachId: communities.ownerCoachId }).from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community?.ownerCoachId) return false;

  const [row] = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(and(eq(engagements.clientId, clientId), eq(engagements.coachId, community.ownerCoachId)))
    .limit(1);
  return Boolean(row);
}

export async function getMembership(communityId: string, userId: string) {
  const [row] = await db
    .select()
    .from(communityMemberships)
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function joinCommunity(userId: string, communityId: string, opts: { hasEngagementWithOwner: boolean }): Promise<CommunityResult<{ displayAlias: string }>> {
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return fail({ code: "not_found", resource: "community" });

  const existing = await getMembership(communityId, userId);
  if (existing) return ok({ displayAlias: existing.displayAlias });

  if (community.joinPolicy === "clients_only" && !opts.hasEngagementWithOwner) {
    return fail({ code: "not_eligible" });
  }

  const displayAlias = generateAlias();
  await db.insert(communityMemberships).values({ communityId, userId, displayAlias });
  return ok({ displayAlias });
}

// Strips author_user_id for anonymous posts before it ever leaves this
// function — CLAUDE.md hard rule 4. The caller receives displayAlias only
// for anonymous posts, never the real identity.
export async function listPostsForCommunity(communityId: string) {
  const rows = await db
    .select({
      id: communityPosts.id,
      bodyMd: communityPosts.bodyMd,
      isAnonymous: communityPosts.isAnonymous,
      createdAt: communityPosts.createdAt,
      authorUserId: communityPosts.authorUserId,
      authorDisplayName: users.displayName,
      authorAlias: communityMemberships.displayAlias,
    })
    .from(communityPosts)
    .innerJoin(users, eq(users.id, communityPosts.authorUserId))
    .leftJoin(
      communityMemberships,
      and(eq(communityMemberships.communityId, communityPosts.communityId), eq(communityMemberships.userId, communityPosts.authorUserId)),
    )
    .where(eq(communityPosts.communityId, communityId))
    .orderBy(desc(communityPosts.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: row.id,
    bodyMd: row.bodyMd,
    createdAt: row.createdAt,
    displayName: row.isAnonymous ? (row.authorAlias ?? "Anonymous") : row.authorDisplayName,
  }));
}

export async function createPost(userId: string, input: CreatePostInput): Promise<CommunityResult<{ postId: string; flagged: boolean }>> {
  const membership = await getMembership(input.communityId, userId);
  if (!membership) return fail({ code: "not_a_member" });

  const [post] = await db
    .insert(communityPosts)
    .values({
      communityId: input.communityId,
      authorUserId: userId,
      bodyMd: input.bodyMd,
      isAnonymous: input.isAnonymous,
    })
    .returning({ id: communityPosts.id });

  const flags = detectFlags(input.bodyMd);
  if (flags.length > 0) {
    // Auto-flag routes to human review; it never deletes or hides the post
    // (docs/06 section 5). Crisis flags are surfaced to the poster
    // separately by the caller, which has the country context this
    // service layer doesn't.
    await db.insert(reports).values({
      targetType: "community_post",
      targetId: post.id,
      reporterUserId: null,
      source: "auto_flag",
      reason: flags.includes("crisis") ? "self_harm_risk" : flags.includes("restriction") ? "restriction_content" : "harassment",
      status: "open",
    });
  }

  return ok({ postId: post.id, flagged: flags.includes("crisis") });
}

export async function listCommentsForPost(postId: string) {
  const rows = await db
    .select({
      id: communityComments.id,
      bodyMd: communityComments.bodyMd,
      createdAt: communityComments.createdAt,
      authorDisplayName: users.displayName,
    })
    .from(communityComments)
    .innerJoin(users, eq(users.id, communityComments.authorUserId))
    .where(eq(communityComments.postId, postId))
    .orderBy(asc(communityComments.createdAt));
  return rows;
}

export async function createComment(userId: string, input: CreateCommentInput): Promise<CommunityResult<{ commentId: string; flagged: boolean }>> {
  const [post] = await db.select({ communityId: communityPosts.communityId }).from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
  if (!post) return fail({ code: "not_found", resource: "post" });

  const membership = await getMembership(post.communityId, userId);
  if (!membership) return fail({ code: "not_a_member" });

  const [comment] = await db
    .insert(communityComments)
    .values({ postId: input.postId, authorUserId: userId, bodyMd: input.bodyMd })
    .returning({ id: communityComments.id });

  const flags = detectFlags(input.bodyMd);
  if (flags.length > 0) {
    await db.insert(reports).values({
      targetType: "community_comment",
      targetId: comment.id,
      reporterUserId: null,
      source: "auto_flag",
      reason: flags.includes("crisis") ? "self_harm_risk" : flags.includes("restriction") ? "restriction_content" : "harassment",
      status: "open",
    });
  }

  return ok({ commentId: comment.id, flagged: flags.includes("crisis") });
}

// reporterUserId is nullable because /reels is a public, unauthenticated
// surface: a visitor with no session must still be able to report content
// (docs/06 section 5 requires a report path on every surface that publishes
// user content). Null here means "no signed-in reporter", never the author.
export async function createReport(reporterUserId: string | null, input: CreateReportInput): Promise<CommunityResult<true>> {
  await db.insert(reports).values({
    targetType: input.targetType,
    targetId: input.targetId,
    reporterUserId,
    source: "user_report",
    reason: input.reason,
    status: "open",
  });
  return ok(true);
}

// reports has no created_at column; its UUIDv7 id sorts chronologically.
// self_harm_risk reports sort first regardless of recency — distress
// escalation gets a human reviewer's eyes before anything else in the
// queue (docs/06 section 5).
export async function listOpenReports() {
  const rows = await db
    .select()
    .from(reports)
    .where(or(eq(reports.status, "open"), eq(reports.status, "reviewing")))
    .orderBy(desc(reports.id));
  return rows.sort((a, b) => Number(b.reason === "self_harm_risk") - Number(a.reason === "self_harm_risk"));
}

// Message reports aren't surfaced here — coach-client chat is private, and
// reporting a message isn't wired up in the chat UI yet. Returns null for
// that case rather than pulling private message content into this view.
export async function getReportedContentBody(
  targetType: "community_post" | "community_comment" | "message" | "coach_post",
  targetId: string,
): Promise<string | null> {
  if (targetType === "coach_post") {
    // Shared posts table: coach- and client-authored posts, including
    // everything on /reels. Title and body are both public and both are what
    // the moderator needs to see. Media is not inlined here; the moderator
    // opens the post itself for that.
    const [row] = await db
      .select({ title: coachPosts.title, bodyMd: coachPosts.bodyMd })
      .from(coachPosts)
      .where(eq(coachPosts.id, targetId))
      .limit(1);
    if (!row) return null;
    return [row.title, row.bodyMd].filter(Boolean).join("\n\n");
  }
  if (targetType === "community_post") {
    const [row] = await db.select({ bodyMd: communityPosts.bodyMd }).from(communityPosts).where(eq(communityPosts.id, targetId)).limit(1);
    return row?.bodyMd ?? null;
  }
  if (targetType === "community_comment") {
    const [row] = await db.select({ bodyMd: communityComments.bodyMd }).from(communityComments).where(eq(communityComments.id, targetId)).limit(1);
    return row?.bodyMd ?? null;
  }
  return null;
}

export async function resolveReport(resolverUserId: string, reportId: string, status: "actioned" | "dismissed"): Promise<CommunityResult<true>> {
  const [existing] = await db.select({ id: reports.id }).from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!existing) return fail({ code: "not_found", resource: "report" });

  await db.update(reports).set({ status, resolvedBy: resolverUserId, resolvedAt: new Date() }).where(eq(reports.id, reportId));
  return ok(true);
}
