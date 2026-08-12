import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clientProfiles, goals, intakes, safetyFlags } from "@/lib/db/schema";
import { evaluateParq, evaluateEdRiskScreen } from "@/lib/domain/safety";
import {
  evaluateFatLossGoal,
  evaluateMuscleGainGoal,
  evaluateStrengthGoal,
  type GoalRealismResult,
} from "@/lib/domain/goals";
import type { SubmitGoalInput, SubmitIntakeInput } from "./schemas";

export type IntakeError = { code: "not_found"; resource: string } | { code: "validation"; message: string };
export type IntakeResult<T> = { ok: true; data: T } | { ok: false; error: IntakeError };
function ok<T>(data: T): IntakeResult<T> {
  return { ok: true, data };
}
function fail<T>(error: IntakeError): IntakeResult<T> {
  return { ok: false, error };
}

export interface SubmitIntakeOutcome {
  intakeId: string;
  parqFlagged: boolean;
  edRiskFlagged: boolean;
}

/**
 * Intake -> safety.evaluateParq() -> safety flags, per docs/04 section 3.1.
 * A blocking flag prevents program assignment until resolved (CLAUDE.md
 * rule 1 and 2 — not configurable, not overridable, not tier-gated).
 */
export async function submitIntake(clientId: string, input: SubmitIntakeInput): Promise<IntakeResult<SubmitIntakeOutcome>> {
  const parqEvaluation = evaluateParq(input.parq);
  const edEvaluation = evaluateEdRiskScreen(input.scoff);

  // Save the physical stats the realism engine needs onto the client
  // profile — there's nowhere else for them to live before a first check-in exists.
  await db
    .update(clientProfiles)
    .set({ heightCm: input.heightCm.toString(), sexAtBirth: input.sexAtBirth, trainingAgeMonths: input.trainingAgeMonths })
    .where(eq(clientProfiles.id, clientId));

  const [intake] = await db
    .insert(intakes)
    .values({
      clientId,
      parqAnswers: input.parq,
      parqFlagged: parqEvaluation.flagged,
      medicalClearanceStatus: parqEvaluation.flagged ? "required" : "not_required",
      conditions: input.conditions ? input.conditions.split(",").map((c) => c.trim()).filter(Boolean) : undefined,
      medications: input.medications ? input.medications.split(",").map((m) => m.trim()).filter(Boolean) : undefined,
      pregnancyStatus: input.pregnancyStatus,
      daysAvailable: input.daysAvailable,
      sessionMinutesMax: input.sessionMinutesMax,
      sleepHours: input.sleepHours.toString(),
      stressLevel: input.stressLevel,
      notes: input.notes,
      submittedAt: new Date(),
    })
    .returning({ id: intakes.id });

  if (parqEvaluation.flagged) {
    await db.insert(safetyFlags).values({
      clientId,
      kind: "parq_cardiac",
      severity: "block",
      payload: { reasons: parqEvaluation.reasons },
    });
  }

  if (edEvaluation.flagged) {
    await db.insert(safetyFlags).values({
      clientId,
      kind: "ed_risk",
      severity: "block",
      payload: { score: edEvaluation.score },
    });
  }

  return ok({ intakeId: intake.id, parqFlagged: parqEvaluation.flagged, edRiskFlagged: edEvaluation.flagged });
}

export async function hasUnresolvedBlockingFlag(clientId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: safetyFlags.id })
    .from(safetyFlags)
    .where(and(eq(safetyFlags.clientId, clientId), eq(safetyFlags.severity, "block"), isNull(safetyFlags.resolvedAt)))
    .limit(1);
  return Boolean(row);
}

export async function getLatestIntake(clientId: string) {
  const [row] = await db.select().from(intakes).where(eq(intakes.clientId, clientId)).orderBy(desc(intakes.submittedAt)).limit(1);
  return row ?? null;
}

/**
 * Runs the realism engine (docs/02 section 5) and stores the verdict on the
 * goal row. The underweight block inside evaluateFatLossGoal/evaluateMuscleGainGoal
 * is absolute — this function never overrides it, it only relays the result.
 */
export async function submitGoal(clientId: string, input: SubmitGoalInput): Promise<IntakeResult<{ goalId: string; realism: GoalRealismResult | null }>> {
  const [profile] = await db
    .select({ heightCm: clientProfiles.heightCm, sexAtBirth: clientProfiles.sexAtBirth, trainingAgeMonths: clientProfiles.trainingAgeMonths })
    .from(clientProfiles)
    .where(eq(clientProfiles.id, clientId))
    .limit(1);
  if (!profile) return fail({ code: "not_found", resource: "client" });

  const targetDate = new Date(`${input.targetDate}T00:00:00.000Z`);
  let realism: GoalRealismResult | null = null;
  let targetMetric: "bodyweight_kg" | "e1rm_kg" | null = null;

  if (input.type === "fat_loss" && input.currentWeightKg && input.targetWeightKg && profile.heightCm) {
    realism = evaluateFatLossGoal({
      currentWeightKg: input.currentWeightKg,
      heightCm: Number(profile.heightCm),
      targetWeightKg: input.targetWeightKg,
      targetDate,
    });
    targetMetric = "bodyweight_kg";
  } else if (input.type === "muscle_gain" && input.currentWeightKg && input.targetWeightKg && profile.heightCm) {
    realism = evaluateMuscleGainGoal({
      currentWeightKg: input.currentWeightKg,
      heightCm: Number(profile.heightCm),
      targetWeightKg: input.targetWeightKg,
      trainingAgeMonths: profile.trainingAgeMonths ?? 0,
      sexAtBirth: (profile.sexAtBirth ?? "prefer_not_to_say") as "male" | "female" | "prefer_not_to_say",
      targetDate,
    });
    targetMetric = "bodyweight_kg";
  } else if (input.type === "strength" && input.currentE1rmKg && input.targetE1rmKg) {
    realism = evaluateStrengthGoal({
      currentE1rmKg: input.currentE1rmKg,
      targetE1rmKg: input.targetE1rmKg,
      trainingAgeMonths: profile.trainingAgeMonths ?? 0,
      targetDate,
    });
    targetMetric = "e1rm_kg";
  }

  // A blocked goal (underweight target) is never written as the client's
  // stated target — the flow pivots away from it entirely, no exceptions
  // (CLAUDE.md rule 2). This is a per-submission rejection, not a systemic
  // gate: doc 06 describes "pivot to other goal types", not a medical hold
  // like a PARQ flag. Severity is "warn", not "block" — it's worth a
  // coach's attention, but it must not lock the client out of setting a
  // different goal on the very next submission, and it must not trip
  // canAssignProgram's blocking-flag gate, which is reserved for genuine
  // medical clearance holds.
  if (realism?.verdict === "blocked") {
    await db.insert(safetyFlags).values({
      clientId,
      kind: "underweight_target",
      severity: "warn",
      payload: { requestedType: input.type, requestedTargetWeightKg: input.targetWeightKg },
    });
    return ok({ goalId: "", realism });
  }

  const [goal] = await db
    .insert(goals)
    .values({
      clientId,
      type: input.type,
      isPrimary: true,
      targetMetric: targetMetric ?? undefined,
      targetValue: (input.type === "strength" ? input.targetE1rmKg : input.targetWeightKg)?.toString(),
      targetDate: input.targetDate,
      whyNow: input.whyNow,
      successDefinition: input.successDefinition,
      realismVerdict: realism?.verdict ?? "realistic",
      realismSuggestedValue: realism?.achievableValueByRequestedDate?.toString(),
      realismSuggestedDate: realism?.achievableDateForRequestedValue?.toISOString().slice(0, 10),
      status: "active",
    })
    .returning({ id: goals.id });

  return ok({ goalId: goal.id, realism });
}
