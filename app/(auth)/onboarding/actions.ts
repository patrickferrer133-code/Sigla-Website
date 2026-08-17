"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { clientOnboardingSchema, coachOnboardingSchema } from "@/lib/onboarding/schemas";
import { completeClientOnboarding, completeCoachOnboarding } from "@/lib/onboarding/service";

export type OnboardingFormState = { status: "idle" } | { status: "error"; message: string };

export async function completeClientOnboardingAction(_prevState: OnboardingFormState, formData: FormData): Promise<OnboardingFormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "client") return { status: "error", message: "Sign in as a client first." };

  const parsed = clientOnboardingSchema.safeParse({
    dateOfBirth: formData.get("dateOfBirth"),
    sexAtBirth: formData.get("sexAtBirth"),
    heightCm: formData.get("heightCm"),
    equipmentAccess: formData.getAll("equipmentAccess"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const result = await completeClientOnboarding(user.id, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not save. Try again." };

  redirect("/client/intake");
}

export async function completeCoachOnboardingAction(_prevState: OnboardingFormState, formData: FormData): Promise<OnboardingFormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") return { status: "error", message: "Sign in as a coach first." };

  const parsed = coachOnboardingSchema.safeParse({
    handle: formData.get("handle"),
    headline: formData.get("headline") || undefined,
    specialties: formData.get("specialties") || undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const result = await completeCoachOnboarding(user.id, parsed.data);
  if (!result.ok) {
    if (result.error.code === "handle_taken") return { status: "error", message: "That handle is already taken." };
    return { status: "error", message: "Could not save. Try again." };
  }

  redirect("/coach/settings");
}
