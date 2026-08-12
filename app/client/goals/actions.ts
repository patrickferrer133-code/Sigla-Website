"use server";

import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { submitGoalSchema } from "@/lib/intake/schemas";
import { submitGoal } from "@/lib/intake/service";
import type { GoalRealismResult } from "@/lib/domain/goals";

export type GoalFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "result"; realism: GoalRealismResult | null; saved: boolean };

export async function submitGoalAction(_prevState: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return { status: "error", message: "Complete your account first." };

  const parsed = submitGoalSchema.safeParse({
    type: formData.get("type"),
    currentWeightKg: formData.get("currentWeightKg") || undefined,
    targetWeightKg: formData.get("targetWeightKg") || undefined,
    currentE1rmKg: formData.get("currentE1rmKg") || undefined,
    targetE1rmKg: formData.get("targetE1rmKg") || undefined,
    targetDate: formData.get("targetDate"),
    whyNow: formData.get("whyNow") || undefined,
    successDefinition: formData.get("successDefinition") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Double check the numbers and date you entered." };

  const result = await submitGoal(clientId, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not save your goal. Try again." };

  // Deliberately not revalidating this page: the realism-engine message is
  // shown via this action's own returned state, and revalidating here would
  // re-run the page's server component and swap it out from under the
  // client-rendered result before the client sees it.
  return { status: "result", realism: result.data.realism, saved: result.data.goalId !== "" };
}
