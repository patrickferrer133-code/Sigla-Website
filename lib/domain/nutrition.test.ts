import { describe, expect, it } from "vitest";
import {
  bmrKatchMcArdle,
  bmrMifflinStJeor,
  calorieTarget,
  macroSplit,
  tdee,
} from "./nutrition";

describe("bmrMifflinStJeor", () => {
  it("computes BMR for a man: 10w + 6.25h - 5a + 5", () => {
    const bmr = bmrMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, sexAtBirth: "male" });
    expect(bmr).toBeCloseTo(10 * 80 + 6.25 * 180 - 5 * 30 + 5, 5);
  });

  it("computes BMR for a woman: 10w + 6.25h - 5a - 161", () => {
    const bmr = bmrMifflinStJeor({ weightKg: 65, heightCm: 165, ageYears: 28, sexAtBirth: "female" });
    expect(bmr).toBeCloseTo(10 * 65 + 6.25 * 165 - 5 * 28 - 161, 5);
  });

  it("falls back to the midpoint offset for prefer_not_to_say", () => {
    const base = 10 * 70 + 6.25 * 170 - 5 * 25;
    const bmr = bmrMifflinStJeor({
      weightKg: 70,
      heightCm: 170,
      ageYears: 25,
      sexAtBirth: "prefer_not_to_say",
    });
    expect(bmr).toBeCloseTo(base + (5 + -161) / 2, 5);
  });
});

describe("bmrKatchMcArdle", () => {
  it("computes BMR from lean body mass: 370 + 21.6 * lean_kg", () => {
    const bmr = bmrKatchMcArdle(80, 0.2);
    const leanKg = 80 * 0.8;
    expect(bmr).toBeCloseTo(370 + 21.6 * leanKg, 5);
  });

  it("rejects an out-of-range body fat fraction", () => {
    expect(() => bmrKatchMcArdle(80, -0.1)).toThrow();
    expect(() => bmrKatchMcArdle(80, 1)).toThrow();
  });
});

describe("tdee", () => {
  it("multiplies BMR by the activity factor", () => {
    expect(tdee(1600, "sedentary")).toBeCloseTo(1920, 5);
    expect(tdee(1600, "very_active")).toBeCloseTo(3040, 5);
  });
});

describe("calorieTarget", () => {
  it("applies a deficit as a negative fraction", () => {
    expect(calorieTarget(2500, -0.15)).toBeCloseTo(2125, 5);
  });

  it("applies a surplus as a positive fraction", () => {
    expect(calorieTarget(2500, 0.1)).toBeCloseTo(2750, 5);
  });
});

describe("macroSplit", () => {
  it("orders protein first, then fat, then fills carbs with the remainder", () => {
    const split = macroSplit({ calorieTargetKcal: 2200, weightKg: 75, proteinGPerKg: 2, fatGPerKg: 0.8 });
    expect(split.proteinG).toBe(150);
    expect(split.fatG).toBe(60);
    const remainingKcal = 2200 - 150 * 4 - 60 * 9;
    expect(split.carbsG).toBeCloseTo(remainingKcal / 4, 5);
  });

  it("never lets carbs go negative when protein and fat already exceed the target", () => {
    const split = macroSplit({ calorieTargetKcal: 500, weightKg: 100, proteinGPerKg: 2.2, fatGPerKg: 1 });
    expect(split.carbsG).toBe(0);
  });

  it("uses mid-range defaults when protein/fat per kg are not provided", () => {
    const split = macroSplit({ calorieTargetKcal: 2000, weightKg: 70 });
    expect(split.proteinG).toBe(140);
    expect(split.fatG).toBe(56);
  });
});
