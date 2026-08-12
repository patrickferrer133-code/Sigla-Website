"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { sendMessageSchema } from "@/lib/messaging/schemas";
import { sendMessage } from "@/lib/messaging/service";

export type SendMessageFormState = { status: "idle" } | { status: "error"; message: string };

export async function sendCoachMessageAction(_prevState: SendMessageFormState, formData: FormData): Promise<SendMessageFormState> {
  const user = await requireRole("coach");
  const parsed = sendMessageSchema.safeParse({
    engagementId: formData.get("engagementId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { status: "error", message: "Write a message before sending." };

  const result = await sendMessage(parsed.data.engagementId, user.id, "coach", parsed.data.body);
  if (!result.ok) {
    if (result.error.code === "engagement_inactive") return { status: "error", message: "This engagement is no longer active." };
    return { status: "error", message: "Could not send that message." };
  }

  revalidatePath(`/coach/messages/${parsed.data.engagementId}`);
  revalidatePath("/coach/messages");
  return { status: "idle" };
}
