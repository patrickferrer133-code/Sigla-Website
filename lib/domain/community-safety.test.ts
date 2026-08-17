import { describe, expect, it } from "vitest";
import { detectFlags, getCrisisResources } from "./community-safety";

describe("detectFlags", () => {
  it("flags crisis language", () => {
    expect(detectFlags("I don't want to be here anymore, I want to kill myself")).toContain("crisis");
  });

  it("flags restriction language", () => {
    expect(detectFlags("today I only ate 400 calories")).toContain("restriction");
    expect(detectFlags("my goal weight is 45kg")).toContain("restriction");
  });

  it("flags harassment language", () => {
    expect(detectFlags("you're such a fat pig")).toContain("harassment");
  });

  it("returns no flags for ordinary supportive posts", () => {
    expect(detectFlags("had a rough week but back at it today, proud of showing up")).toEqual([]);
  });

  it("can return multiple flags at once", () => {
    const flags = detectFlags("I only eat 300 calories a day and honestly sometimes I want to kill myself");
    expect(flags).toContain("crisis");
    expect(flags).toContain("restriction");
  });
});

describe("getCrisisResources", () => {
  it("returns PH-specific resources for PH", () => {
    const resources = getCrisisResources("PH");
    expect(resources.length).toBeGreaterThan(0);
    expect(resources.some((r) => r.label.includes("Hopeline"))).toBe(true);
  });

  it("falls back to generic resources for other or missing countries", () => {
    expect(getCrisisResources(null).length).toBeGreaterThan(0);
    expect(getCrisisResources("US").length).toBeGreaterThan(0);
  });
});
