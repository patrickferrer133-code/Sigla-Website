// PAR-Q+ screening, the calorie floor, and ED risk screening, from
// docs/06-safety-privacy-compliance.md. These are hard gates: CLAUDE.md
// rules 1 and 2 forbid any bypass, admin override, or tier gate on them,
// and the doc 06 section 9 safety test suite enforces this in CI.

import { bmrMifflinStJeor, type SexAtBirth } from "./nutrition";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PARQ_RESCREEN_INTERVAL_DAYS = 365;

export interface ParqAnswers {
  cardiacSymptoms: boolean;
  chestPain: boolean;
  dizzinessOrLossOfConsciousness: boolean;
  uncontrolledBloodPressure: boolean;
  doctorSupervisionRequired: boolean;
}

export interface ParqEvaluation {
  flagged: boolean;
  severity: "block" | null;
  reasons: (keyof ParqAnswers)[];
}

/**
 * Any positive answer creates a blocking flag (docs/06 section 1). There is
 * no partial-credit scoring here — a single "yes" is enough, by design.
 */
export function evaluateParq(answers: ParqAnswers): ParqEvaluation {
  const reasons = (Object.keys(answers) as (keyof ParqAnswers)[]).filter((key) => answers[key]);
  return {
    flagged: reasons.length > 0,
    severity: reasons.length > 0 ? "block" : null,
    reasons,
  };
}

export function isParqRescreenDue(lastScreenedAt: Date, today: Date = new Date()): boolean {
  const daysSince = (today.getTime() - lastScreenedAt.getTime()) / MS_PER_DAY;
  return daysSince >= PARQ_RESCREEN_INTERVAL_DAYS;
}

/**
 * The floor is the client's own computed BMR (docs/06 section 3: "never
 * rendered below a floor derived from the client's own calculated basal
 * metabolic rate"). Not a multiple of BMR, not an absolute constant — the
 * literal BMR figure.
 */
export function calorieFloor(bmrKcal: number): number {
  return bmrKcal;
}

export function calorieFloorFromProfile(params: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sexAtBirth: SexAtBirth;
}): number {
  return calorieFloor(bmrMifflinStJeor(params));
}

export interface CalorieClampResult {
  clampedKcal: number;
  wasClamped: boolean;
}

/**
 * Clamps a requested (possibly coach-entered) calorie target up to the
 * floor. The caller must show the client only `clampedKcal` — the
 * unclamped figure is never surfaced (docs/06 section 3).
 */
export function clampCalorieTarget(requestedKcal: number, bmrKcal: number): CalorieClampResult {
  const floor = calorieFloor(bmrKcal);
  if (requestedKcal < floor) {
    return { clampedKcal: floor, wasClamped: true };
  }
  return { clampedKcal: requestedKcal, wasClamped: false };
}

/**
 * Escalation trigger for the logger's pain report control (docs/06 section
 * 2): pain reported at 7+, or on the same exercise three sessions running.
 * The caller substitutes or removes the exercise pending coach review — this
 * function only decides whether to escalate, never diagnoses or names an injury.
 */
export function shouldEscalatePain(params: {
  painScore: number;
  sameExerciseConsecutiveSessions: number;
}): boolean {
  return params.painScore >= 7 || params.sameExerciseConsecutiveSessions >= 3;
}

// The SCOFF questionnaire (Morgan, Reid & Lacey, 1999): a short, validated
// eating-disorder screening tool. A score of 2 or more "yes" answers out of
// 5 is the published positive-screen threshold.
export interface ScoffAnswers {
  /** Do you make yourself Sick because you feel uncomfortably full? */
  makesSelfSick: boolean;
  /** Do you worry you have lost Control over how much you eat? */
  lossOfControl: boolean;
  /** Have you recently lost more than One stone (~6.35kg) in a 3 month period? */
  recentOneStoneLoss: boolean;
  /** Do you believe yourself to be Fat when others say you are too thin? */
  believesSelfFat: boolean;
  /** Would you say that Food dominates your life? */
  foodDominatesLife: boolean;
}

export interface EdRiskScreenResult {
  flagged: boolean;
  score: number;
}

export function evaluateEdRiskScreen(answers: ScoffAnswers): EdRiskScreenResult {
  const score = Object.values(answers).filter(Boolean).length;
  return { flagged: score >= 2, score };
}

/**
 * A positive ED screen suppresses all weight and calorie displays for the
 * client, regardless of their own privacy_prefs opt-in (docs/06 section 3).
 */
export function shouldSuppressWeightAndCalorieDisplay(params: {
  edRiskFlagged: boolean;
  clientOptedIntoWeightDisplay: boolean;
}): boolean {
  if (params.edRiskFlagged) return true;
  return !params.clientOptedIntoWeightDisplay;
}

/**
 * The freeform habits/notes text on a nutrition plan is a floor-bypass and
 * ED-suppression bypass vector: habit_based and portion_based plans skip the
 * clearance gate and the BMR clamp entirely (docs/01 section 9), and the
 * habits array is rendered to the client verbatim even when ED-risk
 * suppression has nulled the numeric target. A coach typing "eat 1000 kcal"
 * or "stay under 1200 calories" as a habit routes around both. Detect it and
 * refuse the write — this is a guard, never an override (CLAUDE.md rule 2).
 */
export function containsNumericCalorieTarget(text: string): boolean {
  // A bare number adjacent to a calorie/energy word, in either order.
  const unit = "(?:k?cals?\\b|kilo ?calories?\\b|calories?\\b|kj\\b)";
  const patterns = [
    new RegExp(`\\d[\\d,.]*\\s*${unit}`, "i"),
    new RegExp(`${unit}[^.\\n]{0,20}?\\d`, "i"),
  ];
  return patterns.some((p) => p.test(text));
}

export function findNumericCalorieTargetInHabits(habits: readonly string[]): string | null {
  return habits.find((h) => containsNumericCalorieTarget(h)) ?? null;
}

export interface SafetyGateInput {
  hasUnresolvedBlockingFlag: boolean;
}

/** docs/06 section 1: a blocking flag prevents program assignment until resolved. */
export function canAssignProgram(input: SafetyGateInput): boolean {
  return !input.hasUnresolvedBlockingFlag;
}

export interface NutritionGateInput extends SafetyGateInput {
  medicalClearanceStatus: "not_required" | "required" | "uploaded" | "approved" | null;
}

/** docs/06 section 1 and 4: nutrition targets also require an approved clearance when one is required. */
export function canGenerateNutritionTarget(input: NutritionGateInput): boolean {
  if (input.hasUnresolvedBlockingFlag) return false;
  if (input.medicalClearanceStatus === "required" || input.medicalClearanceStatus === "uploaded") {
    return false;
  }
  return true;
}
