"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { respondToApplication } from "@/lib/marketplace/service";

export type RespondFormState = { status: "idle" } | { status: "error"; message: string };

export async function respondToApplicationAction(
  engagementId: string,
  decision: "accept" | "decline",
  _prevState: RespondFormState,
  _formData: FormData,
): Promise<RespondFormState> {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return { status: "error", message: "Complete your coach profile first." };

  const result = await respondToApplication(coachId, engagementId, decision);
  if (!result.ok) {
    if (result.error.code === "client_limit_reached") {
      return { status: "error", message: "You're at your plan's client limit. Upgrade to accept more clients." };
    }
    return { status: "error", message: "Could not process this application. Try again." };
  }

  revalidatePath("/coach/applications");
  return { status: "idle" };
}
