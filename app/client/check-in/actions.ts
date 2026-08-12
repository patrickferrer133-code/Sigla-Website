"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { submitCheckinSchema } from "@/lib/checkins/schemas";
import { submitCheckin } from "@/lib/checkins/service";
import { getClientProfileIdForUser } from "@/lib/logging/service";

export type CheckinFormState = { status: "idle" } | { status: "error"; message: string } | { status: "success"; message: string };

async function requireClientProfileId(): Promise<string> {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) redirect("/onboarding");
  return clientId;
}

export async function submitCheckinAction(_prevState: CheckinFormState, formData: FormData): Promise<CheckinFormState> {
  const clientId = await requireClientProfileId();

  const dailyWeightsKg = Array.from({ length: 7 }, (_, i) => {
    const raw = formData.get(`dailyWeightsKg.${i}`);
    return raw && raw !== "" ? raw : null;
  });

  const parsed = submitCheckinSchema.safeParse({
    weekOf: formData.get("weekOf"),
    dailyWeightsKg,
    waistCm: formData.get("waistCm") || undefined,
    hipCm: formData.get("hipCm") || undefined,
    chestCm: formData.get("chestCm") || undefined,
    armCm: formData.get("armCm") || undefined,
    thighCm: formData.get("thighCm") || undefined,
    adherenceTrainingPct: formData.get("adherenceTrainingPct") || undefined,
    adherenceNutritionPct: formData.get("adherenceNutritionPct") || undefined,
    avgSteps: formData.get("avgSteps") || undefined,
    avgSleepHours: formData.get("avgSleepHours") || undefined,
    energy: formData.get("energy") || undefined,
    hunger: formData.get("hunger") || undefined,
    stress: formData.get("stress") || undefined,
    motivation: formData.get("motivation") || undefined,
    soreness: formData.get("soreness") || undefined,
    mood: formData.get("mood") || undefined,
    wentWell: formData.get("wentWell") || undefined,
    gotInTheWay: formData.get("gotInTheWay") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "That looks outside the range we can record — double check the numbers." };
  }

  const result = await submitCheckin(clientId, parsed.data);
  if (!result.ok) {
    if (result.error.code === "validation") return { status: "error", message: result.error.message };
    if (result.error.code === "checkin_locked") return { status: "error", message: "Your coach already replied to this week — it's closed for edits." };
    if (result.error.code === "engagement_inactive") return { status: "error", message: "Check-ins start once you have an active coach." };
    return { status: "error", message: "Could not save your check-in. Try again." };
  }

  revalidatePath("/client/check-in");
  revalidatePath("/client/check-in/history");
  revalidatePath("/client/progress");
  redirect("/client/check-in/history");
}
