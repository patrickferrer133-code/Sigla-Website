"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { saveCoachProfileSchema } from "@/lib/marketplace/schemas";
import { updateCoachProfile } from "@/lib/marketplace/service";

export type SettingsFormState = { status: "idle" } | { status: "error"; message: string } | { status: "saved" };

export async function updateCoachProfileAction(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return { status: "error", message: "Complete your coach profile first." };

  const parsed = saveCoachProfileSchema.safeParse({
    handle: formData.get("handle"),
    headline: formData.get("headline") || undefined,
    bio: formData.get("bio") || undefined,
    yearsExperience: formData.get("yearsExperience") || undefined,
    specialties: formData.get("specialties") || undefined,
    languages: formData.get("languages") || undefined,
    coachingMode: formData.getAll("coachingMode"),
    city: formData.get("city") || undefined,
    country: formData.get("country") || undefined,
    acceptingClients: formData.get("acceptingClients") === "on",
  });
  if (!parsed.success) return { status: "error", message: "Double check the fields, especially your handle." };

  const result = await updateCoachProfile(coachId, parsed.data);
  if (!result.ok) {
    if (result.error.code === "handle_taken") return { status: "error", message: "That handle is already taken." };
    return { status: "error", message: "Could not save. Try again." };
  }

  revalidatePath("/coach/settings");
  return { status: "saved" };
}
