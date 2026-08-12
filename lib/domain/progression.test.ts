import { describe, expect, it } from "vitest";
import {
  deloadLoad,
  doubleProgression,
  linearProgression,
  percentageBasedLoad,
  rpeAnchoredTarget,
} from "./progression";

describe("linearProgression", () => {
  it("adds a fixed increment to the current load", () => {
    expect(linearProgression(60, 2.5)).toBe(62.5);
  });
});

describe("doubleProgression", () => {
  it("holds load when the client has not yet hit the top of the rep range", () => {
    const next = doubleProgression({
      currentLoadKg: 60,
      repsMax: 10,
      lastTopSetReps: 8,
      incrementKg: 2.5,
    });
    expect(next).toBe(60);
  });

  it("adds the increment once the client hits the top of the rep range", () => {
    const next = doubleProgression({
      currentLoadKg: 60,
      repsMax: 10,
      lastTopSetReps: 10,
      incrementKg: 2.5,
    });
    expect(next).toBe(62.5);
  });

  it("adds the increment when the client exceeds the top of the rep range", () => {
    const next = doubleProgression({
      currentLoadKg: 60,
      repsMax: 10,
      lastTopSetReps: 12,
      incrementKg: 2.5,
    });
    expect(next).toBe(62.5);
  });
});

describe("percentageBasedLoad", () => {
  it("computes load as a percentage of 1RM", () => {
    expect(percentageBasedLoad(100, 0.75)).toBe(75);
  });

  it("returns 0 for a non-positive 1RM or percentage", () => {
    expect(percentageBasedLoad(0, 0.75)).toBe(0);
    expect(percentageBasedLoad(100, 0)).toBe(0);
  });
});

describe("rpeAnchoredTarget", () => {
  it("passes the target RPE through as a client-choice directive", () => {
    expect(rpeAnchoredTarget(8)).toEqual({ mode: "client_choice", targetRpe: 8 });
  });

  it("rejects an RPE outside 1 to 10", () => {
    expect(() => rpeAnchoredTarget(0)).toThrow();
    expect(() => rpeAnchoredTarget(11)).toThrow();
  });
});

describe("deloadLoad", () => {
  it("reduces load by the default 40 percent", () => {
    expect(deloadLoad(100)).toBe(60);
  });

  it("reduces load by a custom fraction", () => {
    expect(deloadLoad(100, 0.5)).toBe(50);
  });

  it("rejects a fraction outside 0 to 1", () => {
    expect(() => deloadLoad(100, 1.5)).toThrow();
    expect(() => deloadLoad(100, -0.1)).toThrow();
  });
});
