import { describe, expect, it } from "vitest";
import { isEligibleForReview } from "./reviews";

describe("isEligibleForReview", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("is not eligible before the engagement has started", () => {
    expect(isEligibleForReview({ status: "applied", startedAt: null }, now)).toBe(false);
  });

  it("is not eligible while still just applied even with a startedAt", () => {
    expect(isEligibleForReview({ status: "applied", startedAt: new Date("2026-01-01") }, now)).toBe(false);
  });

  it("is not eligible before the minimum engagement length", () => {
    const startedAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    expect(isEligibleForReview({ status: "active", startedAt }, now)).toBe(false);
  });

  it("is eligible once the minimum engagement length has passed", () => {
    const startedAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    expect(isEligibleForReview({ status: "active", startedAt }, now)).toBe(true);
  });

  it("is eligible for an ended engagement that ran long enough", () => {
    const startedAt = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    expect(isEligibleForReview({ status: "ended", startedAt }, now)).toBe(true);
  });
});
