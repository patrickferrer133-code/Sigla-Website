import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { announcements } from "@/lib/db/schema/announcements";
import type { SaveAnnouncementInput } from "./schemas";

export type AnnouncementError = { code: "not_found"; resource: string };
export type AnnouncementResult<T> = { ok: true; data: T } | { ok: false; error: AnnouncementError };
function ok<T>(data: T): AnnouncementResult<T> {
  return { ok: true, data };
}
function fail<T>(error: AnnouncementError): AnnouncementResult<T> {
  return { ok: false, error };
}

const FEED_LIMIT = 10;

/** Admin management view. Callers must have already checked the admin role. */
export async function listAnnouncementsForAdmin() {
  return db.select().from(announcements).orderBy(desc(announcements.createdAt));
}

export async function createAnnouncement(
  adminUserId: string,
  input: SaveAnnouncementInput,
): Promise<AnnouncementResult<{ announcementId: string }>> {
  const [row] = await db
    .insert(announcements)
    .values({
      title: input.title,
      body: input.body,
      audience: input.audience,
      createdBy: adminUserId,
      isPublished: false,
      publishedAt: null,
    })
    .returning({ id: announcements.id });
  return ok({ announcementId: row.id });
}

async function setPublished(announcementId: string, isPublished: boolean): Promise<AnnouncementResult<true>> {
  const [existing] = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1);
  if (!existing) return fail({ code: "not_found", resource: "announcement" });

  await db
    .update(announcements)
    .set({ isPublished, publishedAt: isPublished ? new Date() : null, updatedAt: new Date() })
    .where(eq(announcements.id, announcementId));
  return ok(true);
}

export function publishAnnouncement(announcementId: string) {
  return setPublished(announcementId, true);
}

export function unpublishAnnouncement(announcementId: string) {
  return setPublished(announcementId, false);
}

export async function deleteAnnouncement(announcementId: string): Promise<AnnouncementResult<true>> {
  const deleted = await db
    .delete(announcements)
    .where(eq(announcements.id, announcementId))
    .returning({ id: announcements.id });
  if (deleted.length === 0) return fail({ code: "not_found", resource: "announcement" });
  return ok(true);
}

/**
 * Published announcements visible to a given role. Admins are not a feed
 * audience — they manage announcements at /admin/news instead.
 */
export async function listPublishedAnnouncementsForRole(role: "coach" | "client", limit = FEED_LIMIT) {
  const audiences = role === "coach" ? (["all", "coaches"] as const) : (["all", "clients"] as const);
  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
    })
    .from(announcements)
    .where(and(eq(announcements.isPublished, true), inArray(announcements.audience, [...audiences])))
    .orderBy(desc(announcements.publishedAt), desc(announcements.createdAt))
    .limit(limit);
}
