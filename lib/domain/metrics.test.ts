import { describe, expect, it } from "vitest";
import {
  adherenceRate28d,
  estimatedOneRepMaxBrzycki,
  estimatedOneRepMaxEpley,
  loadDeltaKg,
  rollingAverage,
  sessionCompletionRate,
  setCompletionRate,
  volumeLoad,
} from "./metrics";

describe("estimatedOneRepMaxEpley", () => {
  it("computes 1RM = weight x (1 + reps / 30)", () => {
    expect(estimatedOneRepMaxEpley(100, 5)).toBeCloseTo(116.667, 2);
  });

  it("returns 0 for non-positive weight or reps", () => {
    expect(estimatedOneRepMaxEpley(0, 5)).toBe(0);
    expect(estimatedOneRepMaxEpley(100, 0)).toBe(0);
    expect(estimatedOneRepMaxEpley(-10, 5)).toBe(0);
  });
});

describe("estimatedOneRepMaxBrzycki", () => {
  it("computes 1RM = weight x 36 / (37 - reps)", () => {
    expect(estimatedOneRepMaxBrzycki(100, 5)).toBeCloseTo(112.5, 2);
  });

  it("guards the singularity at 37 reps and beyond", () => {
    expect(estimatedOneRepMaxBrzycki(100, 37)).toBe(0);
    expect(estimatedOneRepMaxBrzycki(100, 40)).toBe(0);
  });

  it("returns 0 for non-positive weight or reps", () => {
    expect(estimatedOneRepMaxBrzycki(0, 5)).toBe(0);
    expect(estimatedOneRepMaxBrzycki(100, 0)).toBe(0);
  });
});

describe("volumeLoad", () => {
  it("computes sets x reps x load", () => {
    expect(volumeLoad(3, 8, 60)).toBe(1440);
  });

  it("returns 0 for any non-positive input", () => {
    expect(volumeLoad(0, 8, 60)).toBe(0);
    expect(volumeLoad(3, 0, 60)).toBe(0);
    expect(volumeLoad(3, 8, 0)).toBe(0);
  });
});

describe("rollingAverage", () => {
  it("averages the trailing window of non-null values", () => {
    const values = [70, 70.5, 71, null, 69.5, 70, 70.2];
    const result = rollingAverage(values, 3);
    expect(result[2]).toBeCloseTo((70 + 70.5 + 71) / 3, 5);
    // index 3 is null itself but the window [70.5, 71] still has data
    expect(result[3]).toBeCloseTo((70.5 + 71) / 2, 5);
    expect(result[6]).toBeCloseTo((69.5 + 70 + 70.2) / 3, 5);
  });

  it("returns null when the window has no data", () => {
    const result = rollingAverage([null, null, null], 7);
    expect(result).toEqual([null, null, null]);
  });

  it("shrinks the window at the start of the series instead of padding with zeros", () => {
    const result = rollingAverage([80], 7);
    expect(result[0]).toBe(80);
  });

  it("throws on a non-positive window size", () => {
    expect(() => rollingAverage([1, 2, 3], 0)).toThrow();
  });
});

describe("sessionCompletionRate / setCompletionRate", () => {
  it("computes completed over prescribed", () => {
    expect(sessionCompletionRate(3, 4)).toBe(0.75);
    expect(setCompletionRate(9, 12)).toBe(0.75);
  });

  it("clamps to 1 when completed exceeds prescribed", () => {
    expect(sessionCompletionRate(5, 4)).toBe(1);
  });

  it("handles zero prescribed without dividing by zero", () => {
    expect(sessionCompletionRate(0, 0)).toBe(0);
    expect(sessionCompletionRate(2, 0)).toBe(1);
  });
});

describe("loadDeltaKg", () => {
  it("is positive when the client went heavier than prescribed", () => {
    expect(loadDeltaKg(60, 62.5)).toBe(2.5);
  });

  it("is negative when the client went lighter than prescribed", () => {
    expect(loadDeltaKg(60, 55)).toBe(-5);
  });
});

describe("adherenceRate28d", () => {
  it("delegates to the same completion-rate logic as sessions", () => {
    expect(adherenceRate28d(20, 28)).toBeCloseTo(20 / 28, 5);
  });
});
