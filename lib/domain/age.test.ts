import { describe, expect, it } from "vitest";
import { isAtLeastMinimumAge } from "./age";

describe("isAtLeastMinimumAge", () => {
  const now = new Date("2026-06-15T00:00:00.000Z");

  it("is false for someone under 18", () => {
    expect(isAtLeastMinimumAge(new Date("2010-01-01"), now)).toBe(false);
  });

  it("is false the day before their 18th birthday", () => {
    expect(isAtLeastMinimumAge(new Date("2008-06-16"), now)).toBe(false);
  });

  it("is true on their 18th birthday", () => {
    expect(isAtLeastMinimumAge(new Date("2008-06-15"), now)).toBe(true);
  });

  it("is true for someone well over 18", () => {
    expect(isAtLeastMinimumAge(new Date("1990-01-01"), now)).toBe(true);
  });
});
