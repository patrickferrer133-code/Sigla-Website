import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coachPosts, reports } from "@/lib/db/schema/community";
import { clientProfiles, coachProfiles, users } from "@/lib/db/schema/identity";
import { engagements } from "@/lib/db/schema/commerce";
import { detectFlags } from "@/lib/domain/community-safety";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_EXTENSION, stripImageMetadata, type ImageMime } from "./media";
import type { SaveClientPostInput, SavePostInput } from "./schemas";

export type ContentError =
  | { code: "not_found"; resource: string }
  | { code: "file_too_large"; maxMb: number }
  | { code: "unsupported_file_type" }
  | { code: "upload_failed" };
export type ContentResult<T> = { ok: true; data: T } | { ok: false; error: ContentError };
function ok<T>(data: T): ContentResult<T> {
  return { ok: true, data };
}
function fail<T>(error: ContentError): ContentResult<T> {
  return { ok: false, error };
}

const IMAGE_TYPES = new Set<string>(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 100;
const POST_MEDIA_BUCKET = "post-media";

// docs/06 section 8: acceptance of a user-facing policy is recorded with the
// version that was accepted, not just a boolean. Bump this string whenever
// the wording in the client post form changes.
export const CLIENT_POST_GUIDELINES_VERSION = "v1";

export type PostMedia = { type: "image" | "video"; url: string };

// Public bucket (post-media): self-authored social content, not a progress
// photo — CLAUDE.md rule 3 (private keys + signed URLs only) applies to
// progress photos in the check-in/tracking sense, which are stored on a
// separate private path and never routed through here. `ownerId` is the
// coach profile id or the client profile id depending on the author; it is
// only a storage path prefix, never an authorization boundary.
export async function uploadPostMedia(ownerId: string, file: File): Promise<ContentResult<PostMedia>> {
  const isImage = IMAGE_TYPES.has(file.type);
  const isVideo = VIDEO_TYPES.has(file.type);
  if (!isImage && !isVideo) return fail({ code: "unsupported_file_type" });

  const maxMb = isImage ? MAX_IMAGE_MB : MAX_VIDEO_MB;
  if (file.size > maxMb * 1024 * 1024) return fail({ code: "file_too_large", maxMb });

  const supabase = createAdminClient();

  // Images never reach the bucket as the bytes the device produced: they are
  // re-encoded with all metadata dropped first (docs/06 section 7, EXIF
  // including GPS). Videos are still uploaded as-is — a known residual risk
  // recorded in lib/content/media.ts, not something this path can fix
  // without a transcode step.
  let body: Uint8Array | File = file;
  let ext = file.name.split(".").pop() ?? "mp4";

  if (isImage) {
    const mime = file.type as ImageMime;
    const stripped = await stripImageMetadata(new Uint8Array(await file.arrayBuffer()), mime);
    if (!stripped) return fail({ code: "unsupported_file_type" });
    body = stripped;
    ext = IMAGE_EXTENSION[mime];
  }

  const path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(POST_MEDIA_BUCKET).upload(path, body, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return fail({ code: "upload_failed" });

  const { data: publicUrl } = supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(path);
  return ok({ type: isImage ? "image" : "video", url: publicUrl.publicUrl });
}

/**
 * The object key inside the post-media bucket for a stored public URL, or
 * null if the URL did not come from that bucket (an older row, or media
 * hosted elsewhere).
 */
export function postMediaStoragePath(url: string): string | null {
  const marker = `/${POST_MEDIA_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split("?")[0];
  return path.length > 0 ? decodeURIComponent(path) : null;
}

/**
 * Deletes the underlying storage object for a post. Called on every delete
 * path — owner delete and admin takedown — because the bucket is public:
 * removing only the database row leaves the media served forever at a URL
 * that has already been shared (docs/06 section 7, erasure).
 */
export async function deletePostMediaObject(media: PostMedia | null): Promise<void> {
  if (!media) return;
  const path = postMediaStoragePath(media.url);
  if (!path) return;
  const supabase = createAdminClient();
  await supabase.storage.from(POST_MEDIA_BUCKET).remove([path]);
}

// Freeform coach-authored text and media only — no automatic pull-in of a
// client's numbers, photos, or story. That is the consent-gated
// content-seed system (docs/08, Content Studio), a separate and later
// feature. Nothing here needs client consent because nothing here is
// generated from client data.
export async function createPost(coachId: string, input: SavePostInput, media: PostMedia | null): Promise<ContentResult<{ postId: string }>> {
  const [post] = await db
    .insert(coachPosts)
    .values({
      coachId,
      authorRole: "coach",
      kind: input.kind,
      title: input.title,
      bodyMd: input.bodyMd,
      media,
      tags: input.tags,
      visibility: input.visibility,
      publishedAt: new Date(),
    })
    .returning({ id: coachPosts.id });
  return ok({ postId: post.id });
}

export async function deletePost(coachId: string, postId: string): Promise<ContentResult<true>> {
  const [existing] = await db
    .select({ id: coachPosts.id })
    .from(coachPosts)
    .where(and(eq(coachPosts.id, postId), eq(coachPosts.coachId, coachId)))
    .limit(1);
  if (!existing) return fail({ code: "not_found", resource: "post" });

  await db.delete(coachPosts).where(eq(coachPosts.id, postId));
  return ok(true);
}

// Client-authored personal posts. Same table, author_role = 'client'.
// Nothing here is derived from the client's tracked data (weights, photos,
// calorie targets) — it is freeform self-authored content, so CLAUDE.md
// rule 8's consent gate on client-derived content does not apply. Rule 3's
// progress-photo rule is untouched: this never reads the check-in photo
// bucket.
export async function createClientPost(
  clientId: string,
  input: SaveClientPostInput,
  media: PostMedia | null,
): Promise<ContentResult<{ postId: string; flagged: boolean }>> {
  const [post] = await db
    .insert(coachPosts)
    .values({
      clientId,
      authorRole: "client",
      kind: input.kind,
      title: input.title,
      bodyMd: input.bodyMd,
      media,
      tags: input.tags,
      visibility: input.visibility,
      publishedAt: new Date(),
      // The client ticked the guidelines box (enforced by the Zod literal in
      // saveClientPostSchema); record when and against which version.
      guidelinesAckedAt: new Date(),
      guidelinesAckVersion: CLIENT_POST_GUIDELINES_VERSION,
    })
    .returning({ id: coachPosts.id });

  // Same moderation pipeline as community posts (lib/community/service.ts):
  // keyword auto-flag routes to human review and never deletes or hides the
  // post (docs/06 section 5). Title and body are both user-authored and both
  // publicly visible, so both are scanned.
  const flags = detectFlags([input.title, input.bodyMd].filter(Boolean).join("\n"));
  if (flags.length > 0) {
    await db.insert(reports).values({
      targetType: "coach_post",
      targetId: post.id,
      reporterUserId: null,
      source: "auto_flag",
      reason: flags.includes("crisis") ? "self_harm_risk" : flags.includes("restriction") ? "restriction_content" : "harassment",
      status: "open",
    });
  }

  // Crisis resources are surfaced to the poster by the caller, which has the
  // country context this service layer does not.
  return ok({ postId: post.id, flagged: flags.includes("crisis") });
}

export async function listPostsForClientOwner(clientId: string) {
  return db
    .select()
    .from(coachPosts)
    .where(and(eq(coachPosts.clientId, clientId), eq(coachPosts.authorRole, "client")))
    .orderBy(desc(coachPosts.publishedAt));
}

export async function deleteClientPost(clientId: string, postId: string): Promise<ContentResult<true>> {
  const [existing] = await db
    .select({ id: coachPosts.id, media: coachPosts.media })
    .from(coachPosts)
    .where(and(eq(coachPosts.id, postId), eq(coachPosts.clientId, clientId), eq(coachPosts.authorRole, "client")))
    .limit(1);
  if (!existing) return fail({ code: "not_found", resource: "post" });

  await deletePostMediaObject(existing.media);
  await db.delete(coachPosts).where(eq(coachPosts.id, postId));
  return ok(true);
}

/**
 * Admin takedown from the moderation queue. Author-agnostic: a coach post
 * and a client post live in the same table and get the same treatment.
 * Authorization is the caller's job (requireRole("admin")).
 */
export async function takeDownPost(postId: string): Promise<ContentResult<true>> {
  const [existing] = await db
    .select({ id: coachPosts.id, media: coachPosts.media })
    .from(coachPosts)
    .where(eq(coachPosts.id, postId))
    .limit(1);
  if (!existing) return fail({ code: "not_found", resource: "post" });

  await deletePostMediaObject(existing.media);
  await db.delete(coachPosts).where(eq(coachPosts.id, postId));
  return ok(true);
}

export async function listPostsForCoachOwner(coachId: string) {
  return db
    .select()
    .from(coachPosts)
    .where(and(eq(coachPosts.coachId, coachId), eq(coachPosts.authorRole, "coach")))
    .orderBy(desc(coachPosts.publishedAt));
}

// Scoped to coachId + author_role='coach': a client-authored post can never
// surface on a coach's public page.
export async function listPublicPostsForCoach(coachId: string) {
  return db
    .select()
    .from(coachPosts)
    .where(and(eq(coachPosts.coachId, coachId), eq(coachPosts.authorRole, "coach"), eq(coachPosts.visibility, "public")))
    .orderBy(desc(coachPosts.publishedAt));
}

// The client feed: public posts from any coach, plus clients_only posts from
// coaches the client has (or has had) an engagement with.
export async function listFeedForClient(clientId: string) {
  const engagedCoaches = await db
    .selectDistinct({ coachId: engagements.coachId })
    .from(engagements)
    .where(eq(engagements.clientId, clientId));
  const engagedCoachIds = engagedCoaches.map((row) => row.coachId);

  return db
    .select({
      id: coachPosts.id,
      kind: coachPosts.kind,
      title: coachPosts.title,
      bodyMd: coachPosts.bodyMd,
      media: coachPosts.media,
      tags: coachPosts.tags,
      publishedAt: coachPosts.publishedAt,
      coachHandle: coachProfiles.handle,
      coachDisplayName: users.displayName,
    })
    .from(coachPosts)
    .innerJoin(coachProfiles, eq(coachProfiles.id, coachPosts.coachId))
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    // Coach-authored only. This feed is "updates from my coach", not a
    // general social wall, so client-authored posts are deliberately excluded.
    .where(
      and(
        eq(coachPosts.authorRole, "coach"),
        engagedCoachIds.length > 0
          ? or(eq(coachPosts.visibility, "public"), and(eq(coachPosts.visibility, "clients_only"), inArray(coachPosts.coachId, engagedCoachIds)))
          : eq(coachPosts.visibility, "public"),
      ),
    )
    .orderBy(desc(coachPosts.publishedAt))
    .limit(50);
}

// Public, unauthenticated-friendly: a scrollable feed of every public post
// that has a video attached — the "reels" marketing surface. Only public
// posts, never clients_only, since this is meant to be browsed by anyone.
// Author-agnostic: a reel may be coach- or client-authored. authorHandle is
// null for clients because a client has no public profile route to link to.
export type VideoReel = {
  id: string;
  title: string | null;
  bodyMd: string | null;
  media: PostMedia | null;
  publishedAt: Date | null;
  authorRole: "coach" | "client";
  authorHandle: string | null;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
};

export async function listVideoReelsFeed(): Promise<VideoReel[]> {
  const isPublicVideo = and(eq(coachPosts.visibility, "public"), sql`${coachPosts.media}->>'type' = 'video'`);

  const coachReels = await db
    .select({
      id: coachPosts.id,
      title: coachPosts.title,
      bodyMd: coachPosts.bodyMd,
      media: coachPosts.media,
      publishedAt: coachPosts.publishedAt,
      authorHandle: coachProfiles.handle,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(coachPosts)
    .innerJoin(coachProfiles, eq(coachProfiles.id, coachPosts.coachId))
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(and(isPublicVideo, eq(coachPosts.authorRole, "coach")))
    .orderBy(desc(coachPosts.publishedAt))
    .limit(50);

  const clientReels = await db
    .select({
      id: coachPosts.id,
      title: coachPosts.title,
      bodyMd: coachPosts.bodyMd,
      media: coachPosts.media,
      publishedAt: coachPosts.publishedAt,
      authorDisplayName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(coachPosts)
    .innerJoin(clientProfiles, eq(clientProfiles.id, coachPosts.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(and(isPublicVideo, eq(coachPosts.authorRole, "client")))
    .orderBy(desc(coachPosts.publishedAt))
    .limit(50);

  const merged: VideoReel[] = [
    ...coachReels.map((row) => ({ ...row, authorRole: "coach" as const })),
    ...clientReels.map((row) => ({ ...row, authorRole: "client" as const, authorHandle: null })),
  ];

  return merged
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, 50);
}
