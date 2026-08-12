// Nutrition calculation chain from docs/01-domain-knowledge.md section 9.
// This module is pure computation only — it never enforces the calorie
// floor. Floor enforcement lives in safety.ts, which calls bmrMifflinStJeor
// here to derive the floor it clamps against.

export type SexAtBirth = "male" | "female" | "prefer_not_to_say";

export function bmrMifflinStJeor(params: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sexAtBirth: SexAtBirth;
}): number {
  const { weightKg, heightCm, ageYears, sexAtBirth } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  if (sexAtBirth === "male") return base + 5;
  if (sexAtBirth === "female") return base - 161;
  // "prefer not to say" falls back to the midpoint of the male/female
  // constant, per docs/03-data-model.md section 2.
  return base + (5 + -161) / 2;
}

/** Used when body fat percentage is known — more accurate than Mifflin-St Jeor. */
export function bmrKatchMcArdle(weightKg: number, bodyFatFraction: number): number {
  if (weightKg <= 0 || bodyFatFraction < 0 || bodyFatFraction >= 1) {
    throw new Error("bodyFatFraction must be in [0, 1) and weightKg must be positive");
  }
  const leanMassKg = weightKg * (1 - bodyFatFraction);
  return 370 + 21.6 * leanMassKg;
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function tdee(bmrKcal: number, activityLevel: ActivityLevel): number {
  return bmrKcal * ACTIVITY_FACTORS[activityLevel];
}

/**
 * adjustmentFraction is negative for a deficit, positive for a surplus
 * (e.g. -0.15 for a 15 percent deficit). Not clamped to the safe band here —
 * see safety.ts for the enforced floor and rate caps.
 */
export function calorieTarget(tdeeKcal: number, adjustmentFraction: number): number {
  return tdeeKcal * (1 + adjustmentFraction);
}

export interface MacroSplit {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/**
 * Protein first, fat floor, carbs fill the remainder — the burden-ladder
 * order from docs/01 section 9. Defaults sit mid-range of the documented
 * bands (protein 1.6-2.2 g/kg, fat 0.6-1.0 g/kg).
 */
export function macroSplit(params: {
  calorieTargetKcal: number;
  weightKg: number;
  proteinGPerKg?: number;
  fatGPerKg?: number;
}): MacroSplit {
  const proteinGPerKg = params.proteinGPerKg ?? 2.0;
  const fatGPerKg = params.fatGPerKg ?? 0.8;

  const proteinG = proteinGPerKg * params.weightKg;
  const fatG = fatGPerKg * params.weightKg;
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const remainingKcal = Math.max(0, params.calorieTargetKcal - proteinKcal - fatKcal);
  const carbsG = remainingKcal / 4;

  return { proteinG, fatG, carbsG };
}
