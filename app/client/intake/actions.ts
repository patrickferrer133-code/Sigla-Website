"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { submitIntakeSchema } from "@/lib/intake/schemas";
import { submitIntake } from "@/lib/intake/service";

export type IntakeFormState = { status: "idle" } | { status: "error"; message: string };

export async function submitIntakeAction(_prevState: IntakeFormState, formData: FormData): Promise<IntakeFormState> {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return { status: "error", message: "Complete your account first." };

  const parsed = submitIntakeSchema.safeParse({
    parq: {
      cardiacSymptoms: formData.get("cardiacSymptoms") === "on",
      chestPain: formData.get("chestPain") === "on",
      dizzinessOrLossOfConsciousness: formData.get("dizzinessOrLossOfConsciousness") === "on",
      uncontrolledBloodPressure: formData.get("uncontrolledBloodPressure") === "on",
      doctorSupervisionRequired: formData.get("doctorSupervisionRequired") === "on",
    },
    scoff: {
      makesSelfSick: formData.get("makesSelfSick") === "on",
      lossOfControl: formData.get("lossOfControl") === "on",
      recentOneStoneLoss: formData.get("recentOneStoneLoss") === "on",
      believesSelfFat: formData.get("believesSelfFat") === "on",
      foodDominatesLife: formData.get("foodDominatesLife") === "on",
    },
    heightCm: formData.get("heightCm"),
    sexAtBirth: formData.get("sexAtBirth"),
    trainingAgeMonths: formData.get("trainingAgeMonths"),
    daysAvailable: formData.get("daysAvailable"),
    sessionMinutesMax: formData.get("sessionMinutesMax"),
    sleepHours: formData.get("sleepHours"),
    stressLevel: formData.get("stressLevel"),
    pregnancyStatus: formData.get("pregnancyStatus") || "prefer_not_to_say",
    conditions: formData.get("conditions") || undefined,
    medications: formData.get("medications") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return { status: "error", message: "Double check the numbers you entered." };

  const result = await submitIntake(clientId, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not save your intake. Try again." };

  revalidatePath("/client/intake");
  revalidatePath("/client/goals");
  redirect("/client/goals");
}
