"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { resolveReport } from "@/lib/community/service";
import { takeDownPost } from "@/lib/content/service";

export async function resolveReportAction(reportId: string, status: "actioned" | "dismissed", _formData: FormData) {
  const user = await requireRole("admin");
  await resolveReport(user.id, reportId, status);
  revalidatePath("/admin/moderation");
}

/**
 * Takedown for a reported post (coach- or client-authored). Deletes the post
 * row and its storage object — the media bucket is public, so leaving the
 * object behind would keep the content served at a URL that may already have
 * been shared. Only an admin can do this; auto-flagging never takes content
 * down on its own (docs/06 section 5).
 */
export async function takeDownPostAction(reportId: string, postId: string, _formData: FormData) {
  const user = await requireRole("admin");
  await takeDownPost(postId);
  await resolveReport(user.id, reportId, "actioned");
  revalidatePath("/admin/moderation");
  revalidatePath("/reels");
}
