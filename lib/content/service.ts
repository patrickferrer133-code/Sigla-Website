import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coachPosts } from "@/lib/db/schema/community";
import { coachProfiles, users } from "@/lib/db/schema/identity";
import { engagements } from "@/lib/db/schema/commerce";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SavePostInput } from "./schemas";

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

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 100;

export type PostMedia = { type: "image" | "video"; url: string };

// Public bucket (post-media): coach marketing content, not a client progress
// photo — CLAUDE.md rule 3 (private keys + signed URLs only) applies to
// client progress photos, not to a coach's own promotional post media.
export async function uploadPostMedia(coachId: string, file: File): Promise<ContentResult<PostMedia>> {
  const isImage = IMAGE_TYPES.has(file.type);
  const isVideo = VIDEO_TYPES.has(file.type);
  if (!isImage && !isVideo) return fail({ code: "unsupported_file_type" });

  const maxMb = isImage ? MAX_IMAGE_MB : MAX_VIDEO_MB;
  if (file.size > maxMb * 1024 * 1024) return fail({ code: "file_too_large", maxMb });

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? (isImage ? "jpg" : "mp4");
  const path = `${coachId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("post-media").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return fail({ code: "upload_failed" });

  const { data: publicUrl } = supabase.storage.from("post-media").getPublicUrl(path);
  return ok({ type: isImage ? "image" : "video", url: publicUrl.publicUrl });
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

export async function listPostsForCoachOwner(coachId: string) {
  return db.select().from(coachPosts).where(eq(coachPosts.coachId, coachId)).orderBy(desc(coachPosts.publishedAt));
}

export async function listPublicPostsForCoach(coachId: string) {
  return db
    .select()
    .from(coachPosts)
    .where(and(eq(coachPosts.coachId, coachId), eq(coachPosts.visibility, "public")))
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
    .where(
      engagedCoachIds.length > 0
        ? or(eq(coachPosts.visibility, "public"), and(eq(coachPosts.visibility, "clients_only"), inArray(coachPosts.coachId, engagedCoachIds)))
        : eq(coachPosts.visibility, "public"),
    )
    .orderBy(desc(coachPosts.publishedAt))
    .limit(50);
}
