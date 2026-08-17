// docs/06-safety-privacy-compliance.md section 9 safety suite, extending
// test 3 (calorie floor) to the nutrition-plan feature's full computation
// chain, and covering the freeform-habits bypass vector. Blocks merges
// (CLAUDE.md hard rule 1). Do not modify a test here to make it pass.

import { describe, expect, it } from "vitest";
import { bmrMifflinStJeor, tdee, calorieTarget, macroSplit, type ActivityLevel, type SexAtBirth } from "./nutrition";
import { clampCalorieTarget, calorieFloor, containsNumericCalorieTarget, findNumericCalorieTargetInHabits } from "./safety";

const ACTIVITY: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const SEXES: SexAtBirth[] = ["male", "female", "prefer_not_to_say"];

describe("safety test 3 (nutrition plans): the stored calorie target is never below the client's own BMR floor", () => {
  it("holds across the full fuzzed input range the coach form can produce", () => {
    for (const sexAtBirth of SEXES) {
      for (let weightKg = 38; weightKg <= 180; weightKg += 11) {
        for (let heightCm = 140; heightCm <= 200; heightCm += 12) {
          for (let ageYears = 18; ageYears <= 80; ageYears += 15) {
            const bmr = bmrMifflinStJeor({ weightKg, heightCm, ageYears, sexAtBirth });
            for (const activityLevel of ACTIVITY) {
              // The schema bounds adjustmentPct to [-25, 25]; test past both
              // ends so a future bound change cannot silently open a hole.
              for (let pct = -95; pct <= 25; pct += 5) {
                const requested = calorieTarget(tdee(bmr, activityLevel), pct / 100);
                const { clampedKcal, wasClamped } = clampCalorieTarget(requested, bmr);
                const stored = Math.round(clampedKcal);

                expect(stored).toBeGreaterThanOrEqual(Math.floor(calorieFloor(bmr)));
                expect(wasClamped).toBe(requested < bmr);
              }
            }
          }
        }
      }
    }
  });

  it("derives macros from the post-clamp figure, so macro kcal never undercuts the floor", () => {
    const bmr = bmrMifflinStJeor({ weightKg: 55, heightCm: 160, ageYears: 30, sexAtBirth: "female" });
    const requested = calorieTarget(tdee(bmr, "sedentary"), -0.25);
    const { clampedKcal } = clampCalorieTarget(requested, bmr);
    const stored = Math.round(clampedKcal);
    const macros = macroSplit({ calorieTargetKcal: stored, weightKg: 55 });
    const macroKcal = macros.proteinG * 4 + macros.fatG * 9 + macros.carbsG * 4;

    expect(stored).toBeGreaterThanOrEqual(Math.floor(bmr));
    expect(macroKcal).toBeGreaterThanOrEqual(Math.floor(bmr));
  });

  it("has no parameter that can lower the floor below the client's own BMR", () => {
    // clampCalorieTarget takes exactly (requestedKcal, bmrKcal). If a third
    // configuration argument ever appears, this fails and the reviewer looks.
    expect(clampCalorieTarget.length).toBe(2);
    expect(calorieFloor.length).toBe(1);
  });
});

describe("safety test 3 (nutrition plans): freeform habit text cannot smuggle a calorie number past the floor", () => {
  const bypasses = [
    "eat 1000 kcal",
    "Stay under 1200 calories",
    "target 900kcal on rest days",
    "1,100 Cal max",
    "calories: 800",
    "keep calories below 950",
    "aim for 1500 kilocalories",
  ];

  it.each(bypasses)("rejects %j as a habit", (habit) => {
    expect(containsNumericCalorieTarget(habit)).toBe(true);
    expect(findNumericCalorieTargetInHabits(["Protein at every meal", habit])).toBe(habit);
  });

  const legitimate = [
    "Protein at every meal",
    "Vegetables at 2 meals a day",
    "Stop eating 2 hours before bed",
    "Walk 8000 steps daily",
    "2 palms of protein per meal",
    "Sleep 7 hours",
  ];

  it.each(legitimate)("allows %j", (habit) => {
    expect(containsNumericCalorieTarget(habit)).toBe(false);
  });

  it("finds nothing in an all-legitimate habit list", () => {
    expect(findNumericCalorieTargetInHabits(legitimate)).toBeNull();
  });
});
