"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { respondToApplication } from "@/lib/marketplace/service";

export async function respondToApplicationAction(engagementId: string, decision: "accept" | "decline", _formData: FormData) {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return;

  await respondToApplication(coachId, engagementId, decision);
  revalidatePath("/coach/applications");
}
