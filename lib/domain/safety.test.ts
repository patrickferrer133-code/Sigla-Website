import { describe, expect, it } from "vitest";
import {
  calorieFloor,
  calorieFloorFromProfile,
  evaluateEdRiskScreen,
  evaluateParq,
  isParqRescreenDue,
  shouldEscalatePain,
  shouldSuppressWeightAndCalorieDisplay,
} from "./safety";

const CLEAN_PARQ = {
  cardiacSymptoms: false,
  chestPain: false,
  dizzinessOrLossOfConsciousness: false,
  uncontrolledBloodPressure: false,
  doctorSupervisionRequired: false,
};

describe("evaluateParq", () => {
  it("does not flag a fully clean screen", () => {
    const result = evaluateParq(CLEAN_PARQ);
    expect(result.flagged).toBe(false);
    expect(result.severity).toBeNull();
  });

  it("flags with severity block on any single positive answer", () => {
    const result = evaluateParq({ ...CLEAN_PARQ, chestPain: true });
    expect(result.flagged).toBe(true);
    expect(result.severity).toBe("block");
    expect(result.reasons).toEqual(["chestPain"]);
  });

  it("collects every positive reason", () => {
    const result = evaluateParq({ ...CLEAN_PARQ, chestPain: true, dizzinessOrLossOfConsciousness: true });
    expect(result.reasons).toEqual(["chestPain", "dizzinessOrLossOfConsciousness"]);
  });
});

describe("isParqRescreenDue", () => {
  it("is not due before 12 months have passed", () => {
    expect(isParqRescreenDue(new Date("2026-01-01"), new Date("2026-06-01"))).toBe(false);
  });

  it("is due once 12 months have passed", () => {
    expect(isParqRescreenDue(new Date("2025-01-01"), new Date("2026-01-05"))).toBe(true);
  });
});

describe("calorieFloor / calorieFloorFromProfile", () => {
  it("is exactly the client's own BMR", () => {
    expect(calorieFloor(1450)).toBe(1450);
  });

  it("derives the floor from profile inputs via Mifflin-St Jeor", () => {
    const floor = calorieFloorFromProfile({ weightKg: 65, heightCm: 165, ageYears: 30, sexAtBirth: "female" });
    expect(floor).toBeCloseTo(10 * 65 + 6.25 * 165 - 5 * 30 - 161, 5);
  });
});

describe("shouldEscalatePain", () => {
  it("escalates at pain score 7 or above", () => {
    expect(shouldEscalatePain({ painScore: 7, sameExerciseConsecutiveSessions: 1 })).toBe(true);
  });

  it("escalates on the same exercise for 3 consecutive sessions even at low pain score", () => {
    expect(shouldEscalatePain({ painScore: 3, sameExerciseConsecutiveSessions: 3 })).toBe(true);
  });

  it("does not escalate below both thresholds", () => {
    expect(shouldEscalatePain({ painScore: 4, sameExerciseConsecutiveSessions: 1 })).toBe(false);
  });
});

describe("evaluateEdRiskScreen", () => {
  it("flags a positive SCOFF screen at 2 or more yes answers", () => {
    const result = evaluateEdRiskScreen({
      makesSelfSick: true,
      lossOfControl: true,
      recentOneStoneLoss: false,
      believesSelfFat: false,
      foodDominatesLife: false,
    });
    expect(result.flagged).toBe(true);
    expect(result.score).toBe(2);
  });

  it("does not flag a single yes answer", () => {
    const result = evaluateEdRiskScreen({
      makesSelfSick: true,
      lossOfControl: false,
      recentOneStoneLoss: false,
      believesSelfFat: false,
      foodDominatesLife: false,
    });
    expect(result.flagged).toBe(false);
  });
});

describe("shouldSuppressWeightAndCalorieDisplay", () => {
  it("suppresses on a positive ED risk flag regardless of opt-in", () => {
    expect(
      shouldSuppressWeightAndCalorieDisplay({ edRiskFlagged: true, clientOptedIntoWeightDisplay: true }),
    ).toBe(true);
  });

  it("suppresses by default when the client has not opted in", () => {
    expect(
      shouldSuppressWeightAndCalorieDisplay({ edRiskFlagged: false, clientOptedIntoWeightDisplay: false }),
    ).toBe(true);
  });

  it("shows the display only when opted in and no ED risk flag", () => {
    expect(
      shouldSuppressWeightAndCalorieDisplay({ edRiskFlagged: false, clientOptedIntoWeightDisplay: true }),
    ).toBe(false);
  });
});
