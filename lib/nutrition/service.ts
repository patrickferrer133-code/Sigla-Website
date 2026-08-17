import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { nutritionPlans } from "@/lib/db/schema/nutrition";
import { clientProfiles } from "@/lib/db/schema/identity";
import { checkins } from "@/lib/db/schema/checkins";
import { engagements } from "@/lib/db/schema/commerce";
import { hasUnresolvedBlockingFlag, getLatestIntake } from "@/lib/intake/service";
import { hasUnresolvedEdRiskFlag } from "@/lib/checkins/service";
import { bmrMifflinStJeor, tdee, calorieTarget, macroSplit, type ActivityLevel } from "@/lib/domain/nutrition";
import { clampCalorieTarget, canGenerateNutritionTarget, findNumericCalorieTargetInHabits } from "@/lib/domain/safety";
import { ageInYears } from "@/lib/domain/age";
import type { CreateNutritionPlanInput } from "./schemas";

export type NutritionError =
  | { code: "not_found"; resource: string }
  | { code: "clearance_required" }
  | { code: "missing_data"; field: string }
  | { code: "calorie_number_in_habits"; habit: string };
export type NutritionResult<T> = { ok: true; data: T } | { ok: false; error: NutritionError };
function ok<T>(data: T): NutritionResult<T> {
  return { ok: true, data };
}
function fail<T>(error: NutritionError): NutritionResult<T> {
  return { ok: false, error };
}

const NUMERIC_APPROACHES = new Set(["macros", "meal_plan"]);

export async function createNutritionPlan(
  clientId: string,
  engagementId: string,
  input: CreateNutritionPlanInput,
): Promise<NutritionResult<{ planId: string; wasClampedToFloor: boolean }>> {
  const requiresNumbers = NUMERIC_APPROACHES.has(input.approach);

  // habits is freeform text stored and rendered to the client verbatim, and
  // habit_based/portion_based plans skip both the clearance gate and the BMR
  // clamp. Without this check a coach could write "eat 1000 kcal" as a habit
  // and route around the floor entirely, and it would still render to an
  // ED-flagged client whose numeric target was suppressed (docs/06 section 3,
  // CLAUDE.md rule 2). This is a guard with no override, by design.
  const offendingHabit = findNumericCalorieTargetInHabits(input.habits);
  if (offendingHabit) return fail({ code: "calorie_number_in_habits", habit: offendingHabit });

  if (requiresNumbers) {
    const [blocked, intake] = await Promise.all([hasUnresolvedBlockingFlag(clientId), getLatestIntake(clientId)]);
    const allowed = canGenerateNutritionTarget({
      hasUnresolvedBlockingFlag: blocked,
      medicalClearanceStatus: (intake?.medicalClearanceStatus as "not_required" | "required" | "uploaded" | "approved" | null) ?? "not_required",
    });
    if (!allowed) return fail({ code: "clearance_required" });
  }

  let calorieTargetKcal: number | null = null;
  let proteinG: string | null = null;
  let fatG: string | null = null;
  let carbsG: string | null = null;
  let wasClampedToFloor = false;

  if (requiresNumbers) {
    const [profile] = await db
      .select({ heightCm: clientProfiles.heightCm, sexAtBirth: clientProfiles.sexAtBirth, dateOfBirth: clientProfiles.dateOfBirth })
      .from(clientProfiles)
      .where(eq(clientProfiles.id, clientId))
      .limit(1);
    if (!profile?.heightCm) return fail({ code: "missing_data", field: "height" });
    if (!profile.dateOfBirth) return fail({ code: "missing_data", field: "date_of_birth" });

    const [latestCheckin] = await db
      .select({ bodyweightKg: checkins.bodyweightKg })
      .from(checkins)
      .where(and(eq(checkins.clientId, clientId), eq(checkins.engagementId, engagementId)))
      .orderBy(desc(checkins.weekOf))
      .limit(1);
    if (!latestCheckin?.bodyweightKg) return fail({ code: "missing_data", field: "bodyweight" });

    const weightKg = Number(latestCheckin.bodyweightKg);
    const bmr = bmrMifflinStJeor({
      weightKg,
      heightCm: Number(profile.heightCm),
      ageYears: ageInYears(new Date(profile.dateOfBirth)),
      sexAtBirth: (profile.sexAtBirth ?? "prefer_not_to_say") as "male" | "female" | "prefer_not_to_say",
    });
    const dailyTdee = tdee(bmr, input.activityLevel as ActivityLevel);
    const requestedKcal = calorieTarget(dailyTdee, (input.adjustmentPct ?? 0) / 100);
    const clamp = clampCalorieTarget(requestedKcal, bmr);
    calorieTargetKcal = Math.round(clamp.clampedKcal);
    wasClampedToFloor = clamp.wasClamped;

    const macros = macroSplit({
      calorieTargetKcal,
      weightKg,
      proteinGPerKg: input.proteinGPerKg,
      fatGPerKg: input.fatGPerKg,
    });
    proteinG = macros.proteinG.toFixed(1);
    fatG = macros.fatG.toFixed(1);
    carbsG = macros.carbsG.toFixed(1);
  }

  // Scoped to this engagement, not just this client — a client can have
  // concurrent engagements with more than one coach, and one coach setting
  // a plan must not silently archive a different coach's active plan for
  // the same client.
  await db
    .update(nutritionPlans)
    .set({ status: "archived" })
    .where(and(eq(nutritionPlans.clientId, clientId), eq(nutritionPlans.engagementId, engagementId), eq(nutritionPlans.status, "active")));

  const [plan] = await db
    .insert(nutritionPlans)
    .values({
      clientId,
      engagementId,
      approach: input.approach,
      habits: input.habits,
      calorieTargetKcal,
      proteinG,
      fatG,
      carbsG,
      wasClampedToFloor,
      coachNote: input.coachNote,
    })
    .returning({ id: nutritionPlans.id });

  return ok({ planId: plan.id, wasClampedToFloor });
}

// If a client has concurrent engagements with more than one coach, each can
// have their own active plan (archiving is now engagement-scoped, above).
// This returns the most recently updated one — deterministic, but a client
// with two coaches setting nutrition may see a different plan than either
// coach expects. Full multi-coach plan scoping is out of scope for now.
export async function getActiveNutritionPlanForCoach(clientId: string) {
  const [row] = await db
    .select()
    .from(nutritionPlans)
    .where(and(eq(nutritionPlans.clientId, clientId), eq(nutritionPlans.status, "active")))
    .orderBy(desc(nutritionPlans.updatedAt))
    .limit(1);
  return row ?? null;
}

// Client-facing view: numbers are suppressed entirely — not just the raw
// unclamped figure, the whole calorieTargetKcal/macro set — whenever ED risk
// is flagged (docs/06 section 3), regardless of the plan's approach.
export async function getActiveNutritionPlanForClient(clientId: string) {
  const [plan, edRiskFlagged] = await Promise.all([getActiveNutritionPlanForCoach(clientId), hasUnresolvedEdRiskFlag(clientId)]);
  if (!plan) return null;

  // ED risk is the only thing that suppresses nutrition-plan numbers. The
  // client's separate weight-chart privacy opt-in (privacy_prefs.hideWeight)
  // governs the weight trend display, not their own nutrition targets.
  const suppressNumbers = edRiskFlagged;

  return {
    approach: plan.approach,
    habits: plan.habits,
    // coachNote is deliberately excluded — it's the coach's private note to
    // themselves (see plan-form.tsx), never client-facing.
    numbers: suppressNumbers
      ? null
      : plan.calorieTargetKcal !== null
        ? { calorieTargetKcal: plan.calorieTargetKcal, proteinG: plan.proteinG, fatG: plan.fatG, carbsG: plan.carbsG }
        : null,
  };
}

export async function getEngagementIdForClientCoach(clientId: string, coachId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: engagements.id })
    .from(engagements)
    // Status-scoped: getCoachClientCheckins allows a *read* for up to
    // HISTORICAL_ACCESS_WINDOW_DAYS after an engagement ends. Writing a new
    // nutrition plan is not a historical read, so an ended engagement must
    // never yield an id here (CLAUDE.md rule 5).
    .where(
      and(
        eq(engagements.clientId, clientId),
        eq(engagements.coachId, coachId),
        inArray(engagements.status, ["accepted", "active", "paused"]),
      ),
    )
    .orderBy(desc(engagements.createdAt))
    .limit(1);
  return row?.id ?? null;
}
