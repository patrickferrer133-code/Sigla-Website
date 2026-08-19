"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { deleteCommunityComment, deleteCommunityPost, resolveReport } from "@/lib/community/service";
import { takeDownPost } from "@/lib/content/service";

function revalidateCommunitySurfaces() {
  revalidatePath("/client/community/[communityId]", "page");
  revalidatePath("/coach/community/[communityId]", "page");
}

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

/**
 * Takedown for a reported community post. Same contract as takeDownPostAction
 * above, against community_posts: the row and its public storage object both
 * go. Without this a moderator could only mark a report actioned, which left
 * reported photos and videos live at their public URL indefinitely.
 */
export async function takeDownCommunityPostAction(reportId: string, postId: string, _formData: FormData) {
  const user = await requireRole("admin");
  await deleteCommunityPost(postId);
  await resolveReport(user.id, reportId, "actioned");
  revalidatePath("/admin/moderation");
  revalidateCommunitySurfaces();
}

/** Takedown for a reported comment. Text-only, so no storage cleanup. */
export async function takeDownCommunityCommentAction(reportId: string, commentId: string, _formData: FormData) {
  const user = await requireRole("admin");
  await deleteCommunityComment(commentId);
  await resolveReport(user.id, reportId, "actioned");
  revalidatePath("/admin/moderation");
  revalidateCommunitySurfaces();
}
