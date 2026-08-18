"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createReportSchema } from "@/lib/community/schemas";
import { createReport } from "@/lib/community/service";

/**
 * Reports a reel (coach- or client-authored — the same posts table either
 * way). /reels is a public, unauthenticated surface, so a reporter may have
 * no session; the report is still recorded, with a null reporter, and lands
 * in the same human-review queue as everything else (docs/06 section 5).
 * Reporting never hides or deletes the post.
 */
export async function reportReelAction(postId: string, formData: FormData): Promise<void> {
  const parsed = createReportSchema.safeParse({
    targetType: "coach_post",
    targetId: postId,
    reason: formData.get("reason"),
  });
  if (!parsed.success) return;

  const user = await getCurrentUser();
  await createReport(user?.id ?? null, parsed.data);
  revalidatePath("/admin/moderation");
}
