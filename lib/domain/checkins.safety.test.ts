// New additions to the docs/06-safety-privacy-compliance.md section 9 safety
// test suite for the weekly check-ins feature, per
// docs/_specs/weekly-checkins-spec.md. This suite blocks merges (CLAUDE.md
// hard rule 1). If a test here fails, stop and report — do not modify the
// test to make it pass.

import { describe, expect, it } from "vitest";
import { shouldSuppressWeightAndCalorieDisplay } from "./safety";
import { coachCanAccessClientData } from "../access/policies";
import {
  applyEdRiskWeightSuppression,
  coachCheckinAccess,
  denseDateSeries,
  headlineWeightKg,
  weightTrendSeries,
  weightVisibleToViewer,
} from "./checkins";

describe("safety test: check-in surfaces contain no weight value when the client has not opted in", () => {
  it("suppresses weight and trend when hideWeight is true (the default for every new client)", () => {
    const suppressed = shouldSuppressWeightAndCalorieDisplay({ edRiskFlagged: false, clientOptedIntoWeightDisplay: false });
    expect(suppressed).toBe(true);
  });

  it("shows weight only when the client has explicitly opted in and there is no ED risk flag", () => {
    const suppressed = shouldSuppressWeightAndCalorieDisplay({ edRiskFlagged: false, clientOptedIntoWeightDisplay: true });
    expect(suppressed).toBe(false);
  });
});

describe("safety test: an unresolved ED risk flag suppresses weight even when the client opted in", () => {
  it("still suppresses when clientOptedIntoWeightDisplay is true", () => {
    const suppressed = shouldSuppressWeightAndCalorieDisplay({ edRiskFlagged: true, clientOptedIntoWeightDisplay: true });
    expect(suppressed).toBe(true);
  });
});

describe("safety test: an ED risk flag suppresses weight on the coach's view as well as the client's", () => {
  // docs/06 section 3: a positive screen "suppresses all weight and calorie
  // displays for that client" and notifies the coach with guidance to refer
  // out. The coach gets the guidance, not the numbers. No viewer role is
  // exempt — this is the assertion that stops the coach surface being
  // treated as a special case later.
  it("suppresses for the coach when the flag is unresolved", () => {
    expect(weightVisibleToViewer({ viewerRole: "coach", edRiskFlagged: true, hideWeight: false })).toBe(false);
    expect(weightVisibleToViewer({ viewerRole: "coach", edRiskFlagged: true, hideWeight: true })).toBe(false);
  });

  it("suppresses for the client when the flag is unresolved, whatever hideWeight says", () => {
    expect(weightVisibleToViewer({ viewerRole: "client", edRiskFlagged: true, hideWeight: false })).toBe(false);
  });

  it("hides weight from a client who has not opted in, but not from their coach", () => {
    // Deliberate product decision, recorded here so a future change to it is
    // a conscious one: hideWeight is the client's own anxiety-management
    // preference for their own dashboard, not a data-sharing permission.
    expect(weightVisibleToViewer({ viewerRole: "client", edRiskFlagged: false, hideWeight: true })).toBe(false);
    expect(weightVisibleToViewer({ viewerRole: "coach", edRiskFlagged: false, hideWeight: true })).toBe(true);
  });
});

describe("safety test: a check-in submission for an ED-risk-flagged client stores weight as null and still saves the rest", () => {
  it("nulls every daily weight and every measurement", () => {
    const input = {
      dailyWeightsKg: [70, 70.2, null, null, null, null, null] as (number | null)[],
      waistCm: 80,
      hipCm: 95,
      chestCm: 100,
      armCm: 32,
      thighCm: 55,
      wentWell: "trained 4 times",
    };
    const sanitized = applyEdRiskWeightSuppression(input, true);
    expect(sanitized.dailyWeightsKg.every((v) => v === null)).toBe(true);
    expect(sanitized.waistCm).toBeUndefined();
    expect(sanitized.hipCm).toBeUndefined();
    expect(sanitized.chestCm).toBeUndefined();
    expect(sanitized.armCm).toBeUndefined();
    expect(sanitized.thighCm).toBeUndefined();
  });

  it("leaves the rest of the check-in untouched", () => {
    const input = { dailyWeightsKg: [70, null, null, null, null, null, null] as (number | null)[], wentWell: "trained 4 times" };
    const sanitized = applyEdRiskWeightSuppression(input, true);
    expect(sanitized.wentWell).toBe("trained 4 times");
  });

  it("passes input through unchanged when there is no flag", () => {
    const input = { dailyWeightsKg: [70, null, null, null, null, null, null] as (number | null)[], waistCm: 80 };
    expect(applyEdRiskWeightSuppression(input, false)).toEqual(input);
  });
});

describe("safety test: a coach on an ended engagement receives no check-in submitted after the engagement ended", () => {
  it("denies access to a check-in submitted after ended_at", () => {
    const access = coachCanAccessClientData({
      engagementStatus: "ended",
      engagementEndedAt: new Date("2026-06-01"),
      dataCreatedAt: new Date("2026-06-03"), // a check-in submitted 2 days after the engagement ended
      now: new Date("2026-06-03"),
      historicalAccessWindowDays: 90,
    });
    expect(access).toBe(false);
  });

  it("allows a check-in submitted before ended_at, within the retention window", () => {
    const access = coachCanAccessClientData({
      engagementStatus: "ended",
      engagementEndedAt: new Date("2026-06-01"),
      dataCreatedAt: new Date("2026-05-20"),
      now: new Date("2026-06-10"),
      historicalAccessWindowDays: 90,
    });
    expect(access).toBe(true);
  });
});

describe("safety test: coach access to every check-in surface is gated and time-bounded, not just the check-in rows", () => {
  // Regression test for a real hole found in safety review: the list-level
  // gate exempted status === "ended" and leaned on a per-row filter, so a
  // coach past the historical window still got the client's display name
  // and a fully rendered weight/adherence chart while the row list came
  // back empty. The gate and the bound are one decision, and every
  // coach-facing query in the feature has to use both halves of it.
  const WINDOW_DAYS = 90;

  it("denies a coach whose engagement never started (applied)", () => {
    const access = coachCheckinAccess({
      engagementStatus: "applied",
      engagementEndedAt: null,
      historicalAccessWindowDays: WINDOW_DAYS,
      now: new Date("2026-08-12"),
    });
    expect(access.allowed).toBe(false);
  });

  it("denies a coach entirely once the historical access window has expired", () => {
    const access = coachCheckinAccess({
      engagementStatus: "ended",
      engagementEndedAt: new Date("2026-01-01"),
      historicalAccessWindowDays: WINDOW_DAYS,
      now: new Date("2026-08-12"), // ~223 days later
    });
    // Not "allowed with an empty list" — nothing at all, including the
    // client's name and the trend charts.
    expect(access.allowed).toBe(false);
    expect(access.visibleUpTo).toBeNull();
  });

  it("bounds an in-window ended engagement to data that existed at ended_at", () => {
    const endedAt = new Date("2026-07-01");
    const access = coachCheckinAccess({
      engagementStatus: "ended",
      engagementEndedAt: endedAt,
      historicalAccessWindowDays: WINDOW_DAYS,
      now: new Date("2026-08-12"),
    });
    expect(access.allowed).toBe(true);
    // The bound is what stops the weight trend, e1RM, and adherence series
    // from including anything the client logged after the engagement ended.
    expect(access.visibleUpTo).toEqual(endedAt);
  });

  it("denies an ended engagement with no ended_at rather than treating it as unbounded", () => {
    const access = coachCheckinAccess({
      engagementStatus: "ended",
      engagementEndedAt: null,
      historicalAccessWindowDays: WINDOW_DAYS,
    });
    expect(access.allowed).toBe(false);
  });

  it("places no upper bound on a live engagement", () => {
    for (const status of ["accepted", "active", "paused"] as const) {
      const access = coachCheckinAccess({
        engagementStatus: status,
        engagementEndedAt: null,
        historicalAccessWindowDays: WINDOW_DAYS,
      });
      expect(access.allowed).toBe(true);
      expect(access.visibleUpTo).toBeNull();
    }
  });
});

describe("safety test: the headline weight figure is always the rolling trend, never the raw value", () => {
  it("returns the trend value even when a raw value is also present", () => {
    expect(headlineWeightKg(71.4, 70.2)).toBe(70.2);
  });

  it("returns null when there is no trend, even if a raw value exists", () => {
    expect(headlineWeightKg(71.4, null)).toBeNull();
  });
});

describe("safety test: a week with fewer than 3 weigh-ins yields a null trend and no headline figure", () => {
  // The regression test for the index-vs-date bug found during spec review:
  // rollingAverage() alone would return a single weigh-in as "the trend",
  // which is the exact single-day-number-as-fact pattern docs/06 section 3
  // exists to prevent. Without the minObservations guard this test — and
  // only this test — would fail while every other test in the suite passes.
  it("is null for every day when only 2 weigh-ins fall in the trailing window", () => {
    const dense = denseDateSeries("2026-08-01", "2026-08-07", [
      { date: "2026-08-01", value: 70 },
      { date: "2026-08-04", value: 70.4 },
    ]);
    const trend = weightTrendSeries(dense, { windowDays: 7, minObservations: 3 });
    expect(trend.every((v) => v === null)).toBe(true);
    expect(headlineWeightKg(70.4, trend[trend.length - 1])).toBeNull();
  });

  it("is null for every day when the client weighs in exactly once — the weekly-only input case", () => {
    // The precise shape the original design would have produced: one weight
    // per week, which a plain index-based rollingAverage returns unchanged
    // and a chart then labels "7-day trend".
    const dense = denseDateSeries("2026-08-01", "2026-08-21", [{ date: "2026-08-03", value: 71.4 }]);
    const trend = weightTrendSeries(dense, { windowDays: 7, minObservations: 3 });
    expect(trend.every((v) => v === null)).toBe(true);
  });

  it("never returns a trend equal to a lone raw value", () => {
    const dense = denseDateSeries("2026-08-01", "2026-08-07", [{ date: "2026-08-05", value: 71.4 }]);
    const trend = weightTrendSeries(dense, { windowDays: 7, minObservations: 3 });
    expect(trend).not.toContain(71.4);
  });

  it("releases a trend at exactly 3 weigh-ins in the trailing window, and withdraws it when the window drops back to 2", () => {
    // Guards the boundary in both directions: the guard must not be so
    // strict that a compliant client never sees a trend, and must not leak
    // one back once the observations age out of the window.
    const dense = denseDateSeries("2026-08-01", "2026-08-12", [
      { date: "2026-08-01", value: 70 },
      { date: "2026-08-03", value: 70.6 },
      { date: "2026-08-05", value: 70.1 },
    ]);
    // Index 3 = 2026-08-04: only 2 observations in the trailing 7 days.
    expect(trendAt(dense, "2026-08-01", "2026-08-04")).toBeNull();
    // Index 4 = 2026-08-05: the third observation lands.
    expect(trendAt(dense, "2026-08-01", "2026-08-05")).toBeCloseTo((70 + 70.6 + 70.1) / 3, 5);
    // 2026-08-08: window is 08-02..08-08, holding only 08-03 and 08-05.
    expect(trendAt(dense, "2026-08-01", "2026-08-08")).toBeNull();
  });

  function trendAt(dense: (number | null)[], fromIsoDate: string, targetIsoDate: string): number | null {
    const trend = weightTrendSeries(dense, { windowDays: 7, minObservations: 3 });
    const dayIndex = Math.round((Date.parse(targetIsoDate) - Date.parse(fromIsoDate)) / 86_400_000);
    return trend[dayIndex];
  }
});
