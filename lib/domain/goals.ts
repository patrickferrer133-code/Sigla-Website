// The goal realism engine, docs/02-product-requirements.md section 5.
// "Output format is always: 'Here is what is achievable by {date}. Here is
// what {their target} would actually take, and why we do not recommend it.'
// Then it offers a process goal instead of an outcome goal."
//
// The underweight block is absolute: CLAUDE.md hard rule 2 and
// docs/06-safety-privacy-compliance.md section 3 both state it is not
// configurable, not overridable, and not tier-gated. No caller of this
// module may bypass it.

import type { SexAtBirth } from "./nutrition";

export type RealismVerdict = "realistic" | "reframed" | "blocked";

export interface GoalRealismResult {
  verdict: RealismVerdict;
  /** What's realistically achievable by the client's requested date, at the safe max rate. */
  achievableValueByRequestedDate?: number;
  /** When the client's requested value is realistically achievable, at the safe max rate. */
  achievableDateForRequestedValue?: Date;
  message: string;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function weeksBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_WEEK;
}

function addWeeks(from: Date, weeks: number): Date {
  return new Date(from.getTime() + weeks * MS_PER_WEEK);
}

/**
 * Clinically underweight per WHO's BMI convention (BMI < 18.5). Any goal
 * whose target weight would land here is blocked outright — the flow pivots
 * to non-weight goals rather than negotiating a lower target.
 */
export function isUnderweightBmi(weightKg: number, heightCm: number): boolean {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return bmi < 18.5;
}

const FAT_LOSS_MAX_WEEKLY_RATE = 0.01; // 1.0% of bodyweight per week, the upper safe bound

export function evaluateFatLossGoal(params: {
  currentWeightKg: number;
  heightCm: number;
  targetWeightKg: number;
  targetDate: Date;
  today?: Date;
}): GoalRealismResult {
  const today = params.today ?? new Date();

  if (isUnderweightBmi(params.targetWeightKg, params.heightCm)) {
    return {
      verdict: "blocked",
      message:
        "That target falls in a clinically underweight range, so we can't set it as a weight goal. " +
        "Let's build toward strength, performance, or a habit goal instead — that's how this platform works, no exceptions.",
    };
  }

  const weeks = weeksBetween(today, params.targetDate);
  const totalLossKg = params.currentWeightKg - params.targetWeightKg;

  if (totalLossKg <= 0 || weeks <= 0) {
    return {
      verdict: "realistic",
      message: "This goal doesn't require a weight decrease, or the date has already passed — no reframe needed.",
    };
  }

  const maxWeeklyLossKg = params.currentWeightKg * FAT_LOSS_MAX_WEEKLY_RATE;
  const requiredWeeklyLossKg = totalLossKg / weeks;

  if (requiredWeeklyLossKg <= maxWeeklyLossKg) {
    return {
      verdict: "realistic",
      message: `Losing ${totalLossKg.toFixed(1)}kg by ${params.targetDate.toDateString()} is within a sustainable rate. Let's go.`,
    };
  }

  const achievableValueByRequestedDate = params.currentWeightKg - maxWeeklyLossKg * weeks;
  const weeksNeededForFullTarget = totalLossKg / maxWeeklyLossKg;
  const achievableDateForRequestedValue = addWeeks(today, weeksNeededForFullTarget);

  return {
    verdict: "reframed",
    achievableValueByRequestedDate,
    achievableDateForRequestedValue,
    message:
      `Here is what's achievable by ${params.targetDate.toDateString()}: about ${achievableValueByRequestedDate.toFixed(1)}kg. ` +
      `Here is what ${params.targetWeightKg}kg would actually take: until ${achievableDateForRequestedValue.toDateString()}, ` +
      "and we don't recommend going faster than that, even if it's technically possible short term.",
  };
}

const MUSCLE_GAIN_MAX_MONTHLY_RATE_NOVICE = 0.005; // 0.5% of bodyweight per month
const MUSCLE_GAIN_MAX_MONTHLY_RATE_TRAINED = 0.0025; // 0.25% of bodyweight per month
const NOVICE_TRAINING_AGE_MONTHS = 6; // docs/01 section 6: linear progression "works for beginners for about 3 to 6 months"
// Approximate adjustment for typically lower rates of muscle gain in women,
// per docs/02 section 5 ("slower for most women"). Applied only when known;
// "prefer_not_to_say" clients are not penalized for an unknown value.
const MUSCLE_GAIN_FEMALE_ADJUSTMENT = 0.7;

export function evaluateMuscleGainGoal(params: {
  currentWeightKg: number;
  heightCm: number;
  targetWeightKg: number;
  trainingAgeMonths: number;
  sexAtBirth: SexAtBirth;
  targetDate: Date;
  today?: Date;
}): GoalRealismResult {
  const today = params.today ?? new Date();

  if (isUnderweightBmi(params.targetWeightKg, params.heightCm)) {
    return {
      verdict: "blocked",
      message:
        "That target falls in a clinically underweight range, so we can't set it as a weight goal. " +
        "Let's build toward strength, performance, or a habit goal instead — that's how this platform works, no exceptions.",
    };
  }

  const weeks = weeksBetween(today, params.targetDate);
  const totalGainKg = params.targetWeightKg - params.currentWeightKg;

  if (totalGainKg <= 0 || weeks <= 0) {
    return {
      verdict: "realistic",
      message: "This goal doesn't require a weight increase, or the date has already passed — no reframe needed.",
    };
  }

  const months = weeks / (52 / 12);
  let maxMonthlyRate =
    params.trainingAgeMonths < NOVICE_TRAINING_AGE_MONTHS
      ? MUSCLE_GAIN_MAX_MONTHLY_RATE_NOVICE
      : MUSCLE_GAIN_MAX_MONTHLY_RATE_TRAINED;
  if (params.sexAtBirth === "female") {
    maxMonthlyRate *= MUSCLE_GAIN_FEMALE_ADJUSTMENT;
  }

  const maxGainKg = params.currentWeightKg * maxMonthlyRate * months;

  if (totalGainKg <= maxGainKg) {
    return {
      verdict: "realistic",
      message: `Gaining ${totalGainKg.toFixed(1)}kg by ${params.targetDate.toDateString()} is within a sustainable rate for your training age. Let's go.`,
    };
  }

  const monthsNeededForFullTarget = totalGainKg / (params.currentWeightKg * maxMonthlyRate);
  const achievableDateForRequestedValue = addWeeks(today, monthsNeededForFullTarget * (52 / 12));
  const achievableValueByRequestedDate = params.currentWeightKg + params.currentWeightKg * maxMonthlyRate * months;

  return {
    verdict: "reframed",
    achievableValueByRequestedDate,
    achievableDateForRequestedValue,
    message:
      `Here is what's achievable by ${params.targetDate.toDateString()}: about ${achievableValueByRequestedDate.toFixed(1)}kg. ` +
      `Here is what ${params.targetWeightKg}kg would actually take: until ${achievableDateForRequestedValue.toDateString()}, ` +
      "and real muscle isn't built faster than that no matter the program.",
  };
}

export type TrainingExperience = "novice" | "intermediate" | "advanced";

export function classifyTrainingExperience(trainingAgeMonths: number): TrainingExperience {
  if (trainingAgeMonths < 12) return "novice";
  if (trainingAgeMonths < 36) return "intermediate";
  return "advanced";
}

// Approximate ceilings on sustainable monthly e1RM percentage gain by
// training experience, translating docs/01's qualitative guidance ("novices
// can add substantial numbers quickly, intermediates cannot") into a
// checkable rate. These are configurable defaults, not a cited study.
const STRENGTH_MAX_MONTHLY_PCT_GAIN: Record<TrainingExperience, number> = {
  novice: 0.15,
  intermediate: 0.04,
  advanced: 0.015,
};

export function evaluateStrengthGoal(params: {
  currentE1rmKg: number;
  targetE1rmKg: number;
  trainingAgeMonths: number;
  targetDate: Date;
  today?: Date;
}): GoalRealismResult {
  const today = params.today ?? new Date();
  const weeks = weeksBetween(today, params.targetDate);
  const totalGainKg = params.targetE1rmKg - params.currentE1rmKg;

  if (totalGainKg <= 0 || weeks <= 0) {
    return {
      verdict: "realistic",
      message: "This goal doesn't require a strength increase, or the date has already passed — no reframe needed.",
    };
  }

  const experience = classifyTrainingExperience(params.trainingAgeMonths);
  const months = weeks / (52 / 12);
  const maxMonthlyPct = STRENGTH_MAX_MONTHLY_PCT_GAIN[experience];
  const maxGainKg = params.currentE1rmKg * maxMonthlyPct * months;

  if (totalGainKg <= maxGainKg) {
    return {
      verdict: "realistic",
      message: `Adding ${totalGainKg.toFixed(1)}kg to this lift by ${params.targetDate.toDateString()} is realistic for your training age.`,
    };
  }

  const monthsNeededForFullTarget = totalGainKg / (params.currentE1rmKg * maxMonthlyPct);
  const achievableDateForRequestedValue = addWeeks(today, monthsNeededForFullTarget * (52 / 12));
  const achievableValueByRequestedDate = params.currentE1rmKg + params.currentE1rmKg * maxMonthlyPct * months;

  return {
    verdict: "reframed",
    achievableValueByRequestedDate,
    achievableDateForRequestedValue,
    message:
      `Here is what's achievable by ${params.targetDate.toDateString()}: about ${achievableValueByRequestedDate.toFixed(1)}kg. ` +
      `Here is what ${params.targetE1rmKg}kg would actually take: until ${achievableDateForRequestedValue.toDateString()}, ` +
      `given ${experience} training experience.`,
  };
}

/** Days between two dates, for callers that want raw duration rather than weeks/months. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}
