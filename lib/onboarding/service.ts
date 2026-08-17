import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clientProfiles, coachProfiles, users } from "@/lib/db/schema/identity";
import type { ClientOnboardingInput, CoachOnboardingInput } from "./schemas";

export type OnboardingError = { code: "handle_taken" } | { code: "already_onboarded" };
export type OnboardingResult<T> = { ok: true; data: T } | { ok: false; error: OnboardingError };
function ok<T>(data: T): OnboardingResult<T> {
  return { ok: true, data };
}
function fail<T>(error: OnboardingError): OnboardingResult<T> {
  return { ok: false, error };
}

export async function completeClientOnboarding(userId: string, input: ClientOnboardingInput): Promise<OnboardingResult<{ clientId: string }>> {
  const [existing] = await db.select({ id: clientProfiles.id }).from(clientProfiles).where(eq(clientProfiles.userId, userId)).limit(1);
  if (existing) return fail({ code: "already_onboarded" });

  const [profile] = await db
    .insert(clientProfiles)
    .values({
      userId,
      dateOfBirth: input.dateOfBirth,
      sexAtBirth: input.sexAtBirth,
      heightCm: input.heightCm.toString(),
      equipmentAccess: input.equipmentAccess,
    })
    .returning({ id: clientProfiles.id });

  await db.update(users).set({ onboardingCompletedAt: new Date() }).where(eq(users.id, userId));
  return ok({ clientId: profile.id });
}

export async function completeCoachOnboarding(userId: string, input: CoachOnboardingInput): Promise<OnboardingResult<{ coachId: string }>> {
  const [existing] = await db.select({ id: coachProfiles.id }).from(coachProfiles).where(eq(coachProfiles.userId, userId)).limit(1);
  if (existing) return fail({ code: "already_onboarded" });

  const [handleOwner] = await db.select({ id: coachProfiles.id }).from(coachProfiles).where(eq(coachProfiles.handle, input.handle)).limit(1);
  if (handleOwner) return fail({ code: "handle_taken" });

  const [profile] = await db
    .insert(coachProfiles)
    .values({
      userId,
      handle: input.handle,
      headline: input.headline,
      specialties: input.specialties,
    })
    .returning({ id: coachProfiles.id });

  await db.update(users).set({ onboardingCompletedAt: new Date() }).where(eq(users.id, userId));
  return ok({ coachId: profile.id });
}
