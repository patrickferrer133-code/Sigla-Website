"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { replyToCheckinSchema } from "@/lib/checkins/schemas";
import { replyToCheckin } from "@/lib/checkins/service";

export type ReplyFormState = { status: "idle" } | { status: "error"; message: string } | { status: "success"; message: string };

export async function replyToCheckinAction(_prevState: ReplyFormState, formData: FormData): Promise<ReplyFormState> {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return { status: "error", message: "Complete your coach profile first." };

  const parsed = replyToCheckinSchema.safeParse({
    checkinId: formData.get("checkinId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { status: "error", message: "Write a reply before saving." };

  const result = await replyToCheckin(coachId, parsed.data.checkinId, parsed.data.body);
  if (!result.ok) {
    if (result.error.code === "validation") return { status: "error", message: result.error.message };
    if (result.error.code === "engagement_inactive") return { status: "error", message: "This engagement is no longer active." };
    return { status: "error", message: "Could not save your reply." };
  }

  revalidatePath("/coach/checkins");
  revalidatePath("/coach/clients", "layout");
  return { status: "success", message: "Reply saved." };
}
