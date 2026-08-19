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
import { clientProfiles, coachProfiles, users } from "@/lib/db/schema/identity";
import { engagements } from "@/lib/db/schema/commerce";
import { detectFlags } from "@/lib/domain/community-safety";
import {
  canManageCommunity,
  communityMediaPathPrefix,
  isActiveMember,
  resolveJoinOutcome,
  type CommunityOwnerView,
  type OwnerRole,
} from "@/lib/domain/community-ownership";
import { deletePostMediaObject, uploadPostMedia, type PostMedia } from "@/lib/content/service";
import type { CreateCommentInput, CreateCommunityInput, CreatePostInput, CreateReportInput } from "./schemas";

export type CommunityError =
  | { code: "not_found"; resource: string }
  | { code: "not_a_member" }
  | { code: "not_eligible" }
  | { code: "forbidden" }
  | { code: "unsupported_file_type" }
  | { code: "file_too_large"; maxMb: number }
  | { code: "upload_failed" };
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

/**
 * Membership that grants read/write access. A `pending` row (a join request
 * awaiting the owner) is deliberately NOT an active membership, so every
 * caller that gates on this stays correct without knowing about the request
 * flow.
 */
export async function getActiveMembership(communityId: string, userId: string) {
  const row = await getMembership(communityId, userId);
  return row && isActiveMember(row.role) ? row : null;
}

export async function joinCommunity(
  userId: string,
  communityId: string,
  opts: { hasEngagementWithOwner: boolean },
): Promise<CommunityResult<{ displayAlias: string; pending: boolean }>> {
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return fail({ code: "not_found", resource: "community" });

  const existing = await getMembership(communityId, userId);
  if (existing) return ok({ displayAlias: existing.displayAlias, pending: existing.role === "pending" });

  const outcome = resolveJoinOutcome(community.joinPolicy, opts);
  if (outcome.outcome === "not_eligible") return fail({ code: "not_eligible" });

  const displayAlias = generateAlias();
  await db.insert(communityMemberships).values({ communityId, userId, displayAlias, role: outcome.role });
  return ok({ displayAlias, pending: outcome.outcome === "requested" });
}

// --- Ownership -------------------------------------------------------------

/**
 * Creates a user-owned community. Either role can own one: a coach owner is
 * stored on owner_coach_id, a client owner on owner_client_id, with owner_role
 * as the discriminator (mirrors coach_posts).
 *
 * The creator is seeded as a member with role `owner`. `coach_moderator` was
 * not reused because a client owner is not a coach moderator, and `trusted`
 * does not carry management rights.
 */
export async function createCommunity(
  userId: string,
  ownerProfileId: string,
  ownerRole: OwnerRole,
  input: CreateCommunityInput,
): Promise<CommunityResult<{ communityId: string }>> {
  const [created] = await db
    .insert(communities)
    .values({
      kind: "user_created",
      ownerRole,
      ownerCoachId: ownerRole === "coach" ? ownerProfileId : null,
      ownerClientId: ownerRole === "client" ? ownerProfileId : null,
      name: input.name,
      description: input.description ?? null,
      joinPolicy: input.joinPolicy,
    })
    .returning({ id: communities.id });

  await db.insert(communityMemberships).values({
    communityId: created.id,
    userId,
    displayAlias: generateAlias(),
    role: "owner",
  });

  return ok({ communityId: created.id });
}

/** Every user-created community, for the browse/discover list. */
export async function listUserCreatedCommunities() {
  return db.select().from(communities).where(eq(communities.kind, "user_created")).orderBy(desc(communities.createdAt));
}

export async function getCommunity(communityId: string) {
  const [row] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  return row ?? null;
}

/**
 * The community plus a display-safe view of its owner. A coach owner carries
 * a handle so the page can link to /c/{handle}; a client owner's handle is
 * always null because clients have no public profile page. Returns a null
 * owner for platform-owned (global_goal) communities.
 */
export async function getCommunityWithOwner(
  communityId: string,
): Promise<{ community: typeof communities.$inferSelect; owner: CommunityOwnerView | null } | null> {
  const community = await getCommunity(communityId);
  if (!community) return null;

  if (community.ownerCoachId) {
    const [row] = await db
      .select({ handle: coachProfiles.handle, displayName: users.displayName })
      .from(coachProfiles)
      .innerJoin(users, eq(users.id, coachProfiles.userId))
      .where(eq(coachProfiles.id, community.ownerCoachId))
      .limit(1);
    return {
      community,
      owner: row ? { role: "coach", displayName: row.displayName, handle: row.handle } : null,
    };
  }

  if (community.ownerClientId) {
    const [row] = await db
      .select({ displayName: users.displayName })
      .from(clientProfiles)
      .innerJoin(users, eq(users.id, clientProfiles.userId))
      .where(eq(clientProfiles.id, community.ownerClientId))
      .limit(1);
    return {
      community,
      // handle is unconditionally null: there is no /c/ route for a client.
      owner: row ? { role: "client", displayName: row.displayName, handle: null } : null,
    };
  }

  return { community, owner: null };
}

/** Communities owned by a given profile, for the owner's own list page. */
export async function listCommunitiesOwnedBy(ownerProfileId: string, ownerRole: OwnerRole) {
  return db
    .select()
    .from(communities)
    .where(
      and(
        eq(communities.kind, "user_created"),
        ownerRole === "coach" ? eq(communities.ownerCoachId, ownerProfileId) : eq(communities.ownerClientId, ownerProfileId),
      ),
    )
    .orderBy(desc(communities.createdAt));
}

// --- Join requests ---------------------------------------------------------

/**
 * Pending join requests, owner-only. These users are not anonymous — a join
 * request is not a post — so the real display name is what the owner needs.
 */
export async function listPendingRequests(communityId: string, actingUserId: string): Promise<CommunityResult<{ userId: string; displayName: string }[]>> {
  const membership = await getMembership(communityId, actingUserId);
  if (!canManageCommunity(membership?.role)) return fail({ code: "forbidden" });

  const rows = await db
    .select({ userId: communityMemberships.userId, displayName: users.displayName })
    .from(communityMemberships)
    .innerJoin(users, eq(users.id, communityMemberships.userId))
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.role, "pending")));
  return ok(rows);
}

export async function resolveJoinRequest(
  communityId: string,
  actingUserId: string,
  targetUserId: string,
  decision: "approve" | "decline",
): Promise<CommunityResult<true>> {
  const membership = await getMembership(communityId, actingUserId);
  if (!canManageCommunity(membership?.role)) return fail({ code: "forbidden" });

  const where = and(
    eq(communityMemberships.communityId, communityId),
    eq(communityMemberships.userId, targetUserId),
    eq(communityMemberships.role, "pending"),
  );

  if (decision === "approve") {
    await db.update(communityMemberships).set({ role: "member" }).where(where);
  } else {
    await db.delete(communityMemberships).where(where);
  }
  return ok(true);
}

// --- Media -----------------------------------------------------------------

/**
 * Community post media. Delegates to the shared uploadPostMedia so the EXIF /
 * GPS strip (lib/content/media.ts), the 8MB image / 100MB video limits, and
 * the accepted mime list are the exact same proven code path — nothing is
 * reimplemented here.
 *
 * The only difference is the storage prefix: it is derived from the COMMUNITY,
 * never the uploader, because the bucket is public and an author-derived path
 * in the URL would identify the author of an anonymous post (hard rule 4).
 */
export async function uploadCommunityPostMedia(communityId: string, file: File): Promise<CommunityResult<PostMedia>> {
  const result = await uploadPostMedia(communityMediaPathPrefix(communityId), file);
  return result.ok ? ok(result.data) : fail(result.error);
}

/** Owner-only. Images only, and metadata-stripped by the shared upload path. */
export async function updateCommunityCoverPhoto(
  communityId: string,
  actingUserId: string,
  file: File,
): Promise<CommunityResult<{ url: string }>> {
  const membership = await getMembership(communityId, actingUserId);
  if (!canManageCommunity(membership?.role)) return fail({ code: "forbidden" });

  const uploaded = await uploadPostMedia(`${communityMediaPathPrefix(communityId)}/cover`, file, { imagesOnly: true });
  if (!uploaded.ok) return fail(uploaded.error);

  await db.update(communities).set({ coverPhotoUrl: uploaded.data.url }).where(eq(communities.id, communityId));
  return ok({ url: uploaded.data.url });
}

// Strips author_user_id for anonymous posts before it ever leaves this
// function — CLAUDE.md hard rule 4. The caller receives displayAlias only
// for anonymous posts, never the real identity.
export async function listPostsForCommunity(communityId: string) {
  const rows = await db
    .select({
      id: communityPosts.id,
      bodyMd: communityPosts.bodyMd,
      media: communityPosts.media,
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

  // The projection is explicit and authorUserId is dropped here, not merely
  // left unread — hard rule 4. `media` is safe to pass through: its URL is
  // keyed by community id, never by the author (communityMediaPathPrefix).
  return rows.map((row) => ({
    id: row.id,
    bodyMd: row.bodyMd,
    media: row.media,
    createdAt: row.createdAt,
    displayName: row.isAnonymous ? (row.authorAlias ?? "Anonymous") : row.authorDisplayName,
  }));
}

/**
 * Creates a community post, optionally with media.
 *
 * The raw File is taken here rather than a pre-uploaded PostMedia so the
 * membership check provably runs BEFORE anything reaches storage. The
 * post-media bucket is public, and an object uploaded before authorization
 * attaches to no post row: it is invisible to listPostsForCommunity, to the
 * report button, to the moderation queue, and to every delete path, leaving a
 * permanently public, wholly unmoderated object that a `pending` member or a
 * complete non-member could create for any community id (docs/06 section 5).
 * Keeping the upload behind this check, in one place, makes that ordering
 * impossible to get wrong at a call site.
 */
export async function createPost(
  userId: string,
  input: CreatePostInput,
  file: File | null = null,
): Promise<CommunityResult<{ postId: string; flagged: boolean }>> {
  const membership = await getActiveMembership(input.communityId, userId);
  if (!membership) return fail({ code: "not_a_member" });

  let media: PostMedia | null = null;
  if (file) {
    const uploaded = await uploadCommunityPostMedia(input.communityId, file);
    if (!uploaded.ok) return fail(uploaded.error);
    media = uploaded.data;
  }

  const [post] = await db
    .insert(communityPosts)
    .values({
      communityId: input.communityId,
      authorUserId: userId,
      bodyMd: input.bodyMd,
      media,
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

  const membership = await getActiveMembership(post.communityId, userId);
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

export type ReportedContent = { body: string | null; media: PostMedia | null };

// Message reports aren't surfaced here — coach-client chat is private, and
// reporting a message isn't wired up in the chat UI yet. Returns a null body
// for that case rather than pulling private message content into this view.
//
// `media` is returned alongside the body because a reported photo or video
// post cannot be judged from its caption alone: a moderator deciding whether
// to take content down has to see the content (docs/06 section 5). The URL is
// keyed by community id, never by the author, so surfacing it to an admin
// carries no author signal for an anonymous post (hard rule 4).
export async function getReportedContentBody(
  targetType: "community_post" | "community_comment" | "message" | "coach_post",
  targetId: string,
): Promise<ReportedContent> {
  if (targetType === "coach_post") {
    // Shared posts table: coach- and client-authored posts, including
    // everything on /reels. Title and body are both public and both are what
    // the moderator needs to see.
    const [row] = await db
      .select({ title: coachPosts.title, bodyMd: coachPosts.bodyMd, media: coachPosts.media })
      .from(coachPosts)
      .where(eq(coachPosts.id, targetId))
      .limit(1);
    if (!row) return { body: null, media: null };
    return { body: [row.title, row.bodyMd].filter(Boolean).join("\n\n"), media: row.media ?? null };
  }
  if (targetType === "community_post") {
    const [row] = await db
      .select({ bodyMd: communityPosts.bodyMd, media: communityPosts.media })
      .from(communityPosts)
      .where(eq(communityPosts.id, targetId))
      .limit(1);
    return { body: row?.bodyMd ?? null, media: row?.media ?? null };
  }
  if (targetType === "community_comment") {
    // Comments are text-only (no media column on community_comments).
    const [row] = await db.select({ bodyMd: communityComments.bodyMd }).from(communityComments).where(eq(communityComments.id, targetId)).limit(1);
    return { body: row?.bodyMd ?? null, media: null };
  }
  return { body: null, media: null };
}

/**
 * Admin takedown for a reported community post. Deletes the storage object
 * before the row via the shared deletePostMediaObject — the post-media bucket
 * is public, so dropping only the row leaves the photo or video served forever
 * at a URL that may already have been shared (docs/06 section 7, erasure).
 *
 * Comments are deleted first to satisfy the community_comments -> posts foreign
 * key. Authorization is the caller's job (requireRole("admin")).
 */
export async function deleteCommunityPost(postId: string): Promise<CommunityResult<true>> {
  const [existing] = await db
    .select({ id: communityPosts.id, media: communityPosts.media })
    .from(communityPosts)
    .where(eq(communityPosts.id, postId))
    .limit(1);
  if (!existing) return fail({ code: "not_found", resource: "post" });

  await deletePostMediaObject(existing.media);
  await db.delete(communityComments).where(eq(communityComments.postId, postId));
  await db.delete(communityPosts).where(eq(communityPosts.id, postId));
  return ok(true);
}

/**
 * Admin takedown for a reported comment. community_comments has no media
 * column, so this is a row delete with no storage cleanup to do.
 */
export async function deleteCommunityComment(commentId: string): Promise<CommunityResult<true>> {
  const [existing] = await db.select({ id: communityComments.id }).from(communityComments).where(eq(communityComments.id, commentId)).limit(1);
  if (!existing) return fail({ code: "not_found", resource: "comment" });

  await db.delete(communityComments).where(eq(communityComments.id, commentId));
  return ok(true);
}

export async function resolveReport(resolverUserId: string, reportId: string, status: "actioned" | "dismissed"): Promise<CommunityResult<true>> {
  const [existing] = await db.select({ id: reports.id }).from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!existing) return fail({ code: "not_found", resource: "report" });

  await db.update(reports).set({ status, resolvedBy: resolverUserId, resolvedAt: new Date() }).where(eq(reports.id, reportId));
  return ok(true);
}
