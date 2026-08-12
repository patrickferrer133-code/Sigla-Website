import { describe, expect, it } from "vitest";
import {
  classifyTrainingExperience,
  daysBetween,
  evaluateFatLossGoal,
  evaluateMuscleGainGoal,
  evaluateStrengthGoal,
  isUnderweightBmi,
} from "./goals";

const TODAY = new Date("2026-01-01T00:00:00Z");

describe("isUnderweightBmi", () => {
  it("flags a BMI under 18.5 as underweight", () => {
    // 45kg at 170cm -> BMI ~15.6
    expect(isUnderweightBmi(45, 170)).toBe(true);
  });

  it("does not flag a healthy BMI", () => {
    // 70kg at 175cm -> BMI ~22.9
    expect(isUnderweightBmi(70, 175)).toBe(false);
  });
});

describe("evaluateFatLossGoal", () => {
  it("blocks any target weight that would be clinically underweight, no exceptions", () => {
    const result = evaluateFatLossGoal({
      currentWeightKg: 60,
      heightCm: 170,
      targetWeightKg: 45,
      targetDate: new Date("2026-06-01"),
      today: TODAY,
    });
    expect(result.verdict).toBe("blocked");
    expect(result.achievableValueByRequestedDate).toBeUndefined();
  });

  it("accepts a fat loss goal within the 1.0 percent bodyweight per week ceiling", () => {
    // 80kg -> 76kg over 8 weeks = 0.5kg/week = 0.625%/week, within the safe band.
    const result = evaluateFatLossGoal({
      currentWeightKg: 80,
      heightCm: 180,
      targetWeightKg: 76,
      targetDate: new Date("2026-02-26"),
      today: TODAY,
    });
    expect(result.verdict).toBe("realistic");
  });

  it("reframes a goal that requires losing weight faster than the safe ceiling", () => {
    // 80kg -> 70kg (10kg) in 4 weeks = 2.5kg/week, far past the 1.0% (0.8kg/week) ceiling.
    const result = evaluateFatLossGoal({
      currentWeightKg: 80,
      heightCm: 180,
      targetWeightKg: 70,
      targetDate: new Date("2026-01-29"),
      today: TODAY,
    });
    expect(result.verdict).toBe("reframed");
    expect(result.achievableValueByRequestedDate).toBeDefined();
    expect(result.achievableDateForRequestedValue).toBeDefined();
    // Achievable weight by the requested date should be less extreme than the raw request.
    expect(result.achievableValueByRequestedDate!).toBeGreaterThan(70);
    // The achievable date for hitting 70kg should be later than the originally requested date.
    expect(result.achievableDateForRequestedValue!.getTime()).toBeGreaterThan(
      new Date("2026-01-29").getTime(),
    );
  });

  it("treats a goal with no required loss as realistic", () => {
    const result = evaluateFatLossGoal({
      currentWeightKg: 70,
      heightCm: 175,
      targetWeightKg: 72,
      targetDate: new Date("2026-06-01"),
      today: TODAY,
    });
    expect(result.verdict).toBe("realistic");
  });
});

describe("evaluateMuscleGainGoal", () => {
  it("blocks an underweight target even when framed as muscle gain", () => {
    const result = evaluateMuscleGainGoal({
      currentWeightKg: 42,
      heightCm: 165,
      targetWeightKg: 44,
      trainingAgeMonths: 2,
      sexAtBirth: "female",
      targetDate: new Date("2026-12-01"),
      today: TODAY,
    });
    expect(result.verdict).toBe("blocked");
  });

  it("rejects a novice goal of rapid muscle gain (10kg in 8 weeks) as unrealistic", () => {
    const result = evaluateMuscleGainGoal({
      currentWeightKg: 70,
      heightCm: 175,
      targetWeightKg: 80,
      trainingAgeMonths: 2,
      sexAtBirth: "male",
      targetDate: new Date("2026-02-26"),
      today: TODAY,
    });
    expect(result.verdict).toBe("reframed");
  });

  it("accepts a slow, well-paced novice muscle gain goal", () => {
    // 70kg -> 71kg (1kg) over 12 months for a novice: well within 0.5%/month * 12 = 6% cap (~4.2kg).
    const result = evaluateMuscleGainGoal({
      currentWeightKg: 70,
      heightCm: 175,
      targetWeightKg: 71,
      trainingAgeMonths: 2,
      sexAtBirth: "male",
      targetDate: new Date("2026-12-25"),
      today: TODAY,
    });
    expect(result.verdict).toBe("realistic");
  });
});

describe("evaluateStrengthGoal", () => {
  it("classifies training experience by training age", () => {
    expect(classifyTrainingExperience(3)).toBe("novice");
    expect(classifyTrainingExperience(18)).toBe("intermediate");
    expect(classifyTrainingExperience(48)).toBe("advanced");
  });

  it("reframes an advanced lifter's unrealistic short-term strength jump", () => {
    const result = evaluateStrengthGoal({
      currentE1rmKg: 150,
      targetE1rmKg: 200,
      trainingAgeMonths: 60,
      targetDate: new Date("2026-02-01"),
      today: TODAY,
    });
    expect(result.verdict).toBe("reframed");
  });

  it("accepts a novice's fast early strength progress", () => {
    const result = evaluateStrengthGoal({
      currentE1rmKg: 60,
      targetE1rmKg: 70,
      trainingAgeMonths: 2,
      targetDate: new Date("2026-04-01"),
      today: TODAY,
    });
    expect(result.verdict).toBe("realistic");
  });
});

describe("daysBetween", () => {
  it("computes whole days between two dates", () => {
    expect(daysBetween(new Date("2026-01-01"), new Date("2026-01-08"))).toBe(7);
  });
});
