"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getCoachClientCheckins } from "@/lib/checkins/service";
import { createNutritionPlanSchema } from "@/lib/nutrition/schemas";
import { createNutritionPlan, getEngagementIdForClientCoach } from "@/lib/nutrition/service";

export type NutritionFormState = { status: "idle" } | { status: "error"; message: string } | { status: "saved"; wasClampedToFloor: boolean };

export async function createNutritionPlanAction(clientId: string, _prevState: NutritionFormState, formData: FormData): Promise<NutritionFormState> {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return { status: "error", message: "Complete your coach profile first." };

  // Re-verifies the engagement server side rather than trusting the clientId
  // in the URL (CLAUDE.md: authorization checked on every operation).
  const access = await getCoachClientCheckins(coachId, clientId);
  if (!access.ok) return { status: "error", message: "You don't have access to this client." };

  const engagementId = await getEngagementIdForClientCoach(clientId, coachId);
  if (!engagementId) return { status: "error", message: "No active engagement with this client." };

  const parsed = createNutritionPlanSchema.safeParse({
    approach: formData.get("approach"),
    habits: formData.get("habits") || undefined,
    activityLevel: formData.get("activityLevel") || undefined,
    adjustmentPct: formData.get("adjustmentPct") || undefined,
    proteinGPerKg: formData.get("proteinGPerKg") || undefined,
    fatGPerKg: formData.get("fatGPerKg") || undefined,
    coachNote: formData.get("coachNote") || undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const result = await createNutritionPlan(clientId, engagementId, parsed.data);
  if (!result.ok) {
    if (result.error.code === "clearance_required") {
      return { status: "error", message: "This client needs a resolved health flag or medical clearance before a numeric target can be generated." };
    }
    if (result.error.code === "calorie_number_in_habits") {
      return {
        status: "error",
        message: `Habits can't contain a calorie number ("${result.error.habit}"). Numeric targets go through the macros or meal-plan approach, which applies the BMR floor. Rewrite it as a behaviour.`,
      };
    }
    if (result.error.code === "missing_data") {
      return { status: "error", message: `Missing ${result.error.field.replace("_", " ")} — a numeric target needs this first.` };
    }
    return { status: "error", message: "Could not save the plan. Try again." };
  }

  revalidatePath(`/coach/clients/${clientId}/nutrition`);
  return { status: "saved", wasClampedToFloor: result.data.wasClampedToFloor };
}
