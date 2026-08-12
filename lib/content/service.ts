import "server-only";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coachPosts } from "@/lib/db/schema/community";
import { coachProfiles, users } from "@/lib/db/schema/identity";
import { engagements } from "@/lib/db/schema/commerce";
import type { SavePostInput } from "./schemas";

export type ContentError = { code: "not_found"; resource: string };
export type ContentResult<T> = { ok: true; data: T } | { ok: false; error: ContentError };
function ok<T>(data: T): ContentResult<T> {
  return { ok: true, data };
}
function fail<T>(error: ContentError): ContentResult<T> {
  return { ok: false, error };
}

// Freeform coach-authored text only — no automatic pull-in of a client's
// numbers, photos, or story. That is the consent-gated content-seed system
// (docs/08, Content Studio), a separate and later feature. Nothing here
// needs client consent because nothing here is generated from client data.
export async function createPost(coachId: string, input: SavePostInput): Promise<ContentResult<{ postId: string }>> {
  const [post] = await db
    .insert(coachPosts)
    .values({
      coachId,
      kind: input.kind,
      title: input.title,
      bodyMd: input.bodyMd,
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
