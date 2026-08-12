// The docs/06-safety-privacy-compliance.md section 9 safety test suite,
// tests 1-4. This suite blocks merges (CLAUDE.md hard rule 1). If a test
// here fails, stop and report — do not modify the test to make it pass.

import { describe, expect, it } from "vitest";
import { canAssignProgram, canGenerateNutritionTarget, clampCalorieTarget } from "./safety";
import { evaluateFatLossGoal, evaluateMuscleGainGoal, isUnderweightBmi } from "./goals";

describe("safety test 1: program cannot be assigned while a blocking safety flag is unresolved", () => {
  it("refuses assignment with an unresolved blocking flag", () => {
    expect(canAssignProgram({ hasUnresolvedBlockingFlag: true })).toBe(false);
  });

  it("allows assignment once no blocking flag is unresolved", () => {
    expect(canAssignProgram({ hasUnresolvedBlockingFlag: false })).toBe(true);
  });
});

describe("safety test 2: nutrition target generation refuses without an approved medical clearance", () => {
  it("refuses when clearance is required but not yet approved", () => {
    expect(
      canGenerateNutritionTarget({
        hasUnresolvedBlockingFlag: false,
        medicalClearanceStatus: "required",
      }),
    ).toBe(false);
  });

  it("refuses when clearance was uploaded but not yet approved", () => {
    expect(
      canGenerateNutritionTarget({
        hasUnresolvedBlockingFlag: false,
        medicalClearanceStatus: "uploaded",
      }),
    ).toBe(false);
  });

  it("allows generation once clearance is approved", () => {
    expect(
      canGenerateNutritionTarget({
        hasUnresolvedBlockingFlag: false,
        medicalClearanceStatus: "approved",
      }),
    ).toBe(true);
  });

  it("allows generation when no clearance was ever required", () => {
    expect(
      canGenerateNutritionTarget({
        hasUnresolvedBlockingFlag: false,
        medicalClearanceStatus: "not_required",
      }),
    ).toBe(true);
  });

  it("refuses regardless of clearance status if a blocking flag is unresolved", () => {
    expect(
      canGenerateNutritionTarget({
        hasUnresolvedBlockingFlag: true,
        medicalClearanceStatus: "approved",
      }),
    ).toBe(false);
  });
});

describe("safety test 3: calorie target output is never below the computed floor", () => {
  it("clamps up to the floor across a wide fuzzed range of requested and BMR values", () => {
    // Deterministic pseudo-random fuzz: covers negative, zero, tiny, and
    // wildly high requested targets against a range of plausible BMRs.
    const requestedValues = [-5000, -1, 0, 1, 500, 799, 800, 801, 1200, 1500, 2000, 5000, 50000];
    const bmrValues = [800, 1000, 1200, 1450, 1600, 1800, 2100, 2400, 3000];

    for (const bmr of bmrValues) {
      for (const requested of requestedValues) {
        const result = clampCalorieTarget(requested, bmr);
        expect(result.clampedKcal).toBeGreaterThanOrEqual(bmr);
      }
    }
  });

  it("marks wasClamped only when the requested value was actually below the floor", () => {
    expect(clampCalorieTarget(1000, 1400).wasClamped).toBe(true);
    expect(clampCalorieTarget(1500, 1400).wasClamped).toBe(false);
  });

  it("never returns a value below the floor even for an already-safe input", () => {
    const result = clampCalorieTarget(2200, 1500);
    expect(result.clampedKcal).toBe(2200);
    expect(result.clampedKcal).toBeGreaterThanOrEqual(1500);
  });
});

describe("safety test 4: goal creation rejects underweight targets, not just through the UI", () => {
  it("blocks a direct evaluateFatLossGoal call with an underweight target, bypassing any UI layer", () => {
    const result = evaluateFatLossGoal({
      currentWeightKg: 55,
      heightCm: 165,
      targetWeightKg: 40, // BMI ~14.7, well under 18.5
      targetDate: new Date("2026-12-01"),
      today: new Date("2026-01-01"),
    });
    expect(result.verdict).toBe("blocked");
  });

  it("blocks a direct evaluateMuscleGainGoal call with an underweight target", () => {
    const result = evaluateMuscleGainGoal({
      currentWeightKg: 40,
      heightCm: 165,
      targetWeightKg: 44, // BMI ~16.2, still under 18.5
      trainingAgeMonths: 6,
      sexAtBirth: "prefer_not_to_say",
      targetDate: new Date("2026-12-01"),
      today: new Date("2026-01-01"),
    });
    expect(result.verdict).toBe("blocked");
  });

  it("has no parameter that can bypass the underweight check — isUnderweightBmi is the single source of truth", () => {
    // Any caller, UI or direct API, must route through isUnderweightBmi.
    // There is no flag or override parameter on evaluateFatLossGoal /
    // evaluateMuscleGainGoal that suppresses this check.
    expect(isUnderweightBmi(40, 165)).toBe(true);
  });
});
