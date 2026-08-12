import { describe, expect, it } from "vitest";
import {
  addDaysToIsoDate,
  buildAdherenceSeries,
  buildE1rmSeries,
  denseDateSeries,
  hasAnyCheckinField,
  isCheckinEditable,
  mondayOfIsoDate,
  selectKeyLifts,
  weekOfFor,
  weightTrendSeries,
} from "./checkins";

describe("weekOfFor", () => {
  it("returns the Monday of the week containing the date, in the given timezone", () => {
    // 2026-08-12 is a Wednesday.
    expect(weekOfFor(new Date("2026-08-12T10:00:00Z"), "UTC")).toBe("2026-08-10");
  });

  it("returns the same date when it is already a Monday", () => {
    expect(weekOfFor(new Date("2026-08-10T10:00:00Z"), "UTC")).toBe("2026-08-10");
  });

  it("rolls a Sunday back to the preceding Monday, not forward", () => {
    expect(weekOfFor(new Date("2026-08-16T10:00:00Z"), "UTC")).toBe("2026-08-10");
  });
});

describe("mondayOfIsoDate", () => {
  it("normalizes a program's arbitrary starts_on weekday to its Monday", () => {
    // A coach could set starts_on to any weekday; the adherence series must
    // align it to the same Monday checkins.week_of uses, or every real week
    // shows up as two separate, mostly-empty points.
    expect(mondayOfIsoDate("2026-08-12")).toBe("2026-08-10"); // Wednesday
    expect(mondayOfIsoDate("2026-08-16")).toBe("2026-08-10"); // Sunday
    expect(mondayOfIsoDate("2026-08-10")).toBe("2026-08-10"); // already Monday
  });
});

describe("addDaysToIsoDate", () => {
  it("adds and subtracts across month and year boundaries", () => {
    expect(addDaysToIsoDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToIsoDate("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("denseDateSeries", () => {
  it("fills every day in range, null where no point exists", () => {
    const dense = denseDateSeries("2026-08-10", "2026-08-12", [{ date: "2026-08-11", value: 70 }]);
    expect(dense).toEqual([null, 70, null]);
  });
});

describe("weightTrendSeries — the index-vs-date regression", () => {
  it("is null for a week with only one weigh-in, even though rollingAverage alone would not be", () => {
    // Exactly the bug found in spec review: weekly-only input into a plain
    // rollingAverage would return that single value as "the trend". The
    // guard must reject it.
    const dense = denseDateSeries("2026-08-01", "2026-08-07", [{ date: "2026-08-03", value: 71.4 }]);
    const trend = weightTrendSeries(dense, { windowDays: 7, minObservations: 3 });
    expect(trend.every((v) => v === null)).toBe(true);
  });

  it("produces a real average once the trailing window has enough observations", () => {
    const points = [
      { date: "2026-08-01", value: 70 },
      { date: "2026-08-02", value: 70.4 },
      { date: "2026-08-03", value: 69.8 },
    ];
    const dense = denseDateSeries("2026-08-01", "2026-08-03", points);
    const trend = weightTrendSeries(dense, { windowDays: 7, minObservations: 3 });
    expect(trend[2]).toBeCloseTo((70 + 70.4 + 69.8) / 3, 5);
  });

  it("never carries a value forward into a day with no data of its own once the window empties", () => {
    const dense = denseDateSeries("2026-08-01", "2026-08-20", [
      { date: "2026-08-01", value: 70 },
      { date: "2026-08-02", value: 70 },
      { date: "2026-08-03", value: 70 },
    ]);
    const trend = weightTrendSeries(dense, { windowDays: 7, minObservations: 3 });
    // By day 20 the trailing 7-day window (days 14-20) holds zero weigh-ins.
    expect(trend[19]).toBeNull();
  });
});

describe("selectKeyLifts", () => {
  it("picks one exercise per primary movement pattern, not the highest set count overall", () => {
    const sets = [
      // Curls: high set count, isolation pattern — must not win a primary slot.
      ...Array.from({ length: 10 }, (_, i) => ({ exerciseId: "curl", movementPattern: "isolation", weekStart: `2026-08-0${(i % 2) + 1}` })),
      { exerciseId: "back-squat", movementPattern: "squat", weekStart: "2026-08-01" },
      { exerciseId: "back-squat", movementPattern: "squat", weekStart: "2026-08-08" },
      { exerciseId: "rdl", movementPattern: "hinge", weekStart: "2026-08-01" },
      { exerciseId: "rdl", movementPattern: "hinge", weekStart: "2026-08-08" },
    ];
    const selected = selectKeyLifts(sets);
    expect(selected).toContain("back-squat");
    expect(selected).toContain("rdl");
    expect(selected).not.toContain("curl");
  });

  it("requires at least 2 distinct weeks of data before an exercise qualifies", () => {
    const sets = [
      { exerciseId: "back-squat", movementPattern: "squat", weekStart: "2026-08-01" },
      { exerciseId: "back-squat", movementPattern: "squat", weekStart: "2026-08-01" },
    ];
    expect(selectKeyLifts(sets)).toEqual([]);
  });

  it("falls back to v_pull / v_push when a primary pattern is absent", () => {
    const sets = [
      { exerciseId: "pull-up", movementPattern: "v_pull", weekStart: "2026-08-01" },
      { exerciseId: "pull-up", movementPattern: "v_pull", weekStart: "2026-08-08" },
    ];
    expect(selectKeyLifts(sets)).toEqual(["pull-up"]);
  });
});

describe("buildE1rmSeries", () => {
  it("keeps only the best e1RM per week", () => {
    // 100kg x5 -> e1RM 116.67; 105kg x3 -> e1RM 115.5. The first set wins.
    const series = buildE1rmSeries([
      { weekStart: "2026-08-01", loadKg: 100, reps: 5, isDeloadWeek: false },
      { weekStart: "2026-08-01", loadKg: 105, reps: 3, isDeloadWeek: false },
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].e1rmKg).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });

  it("flags deload weeks so a planned dip is not read as regression", () => {
    const series = buildE1rmSeries([{ weekStart: "2026-08-01", loadKg: 80, reps: 5, isDeloadWeek: true }]);
    expect(series[0].isDeload).toBe(true);
  });
});

describe("buildAdherenceSeries", () => {
  it("emits null, not zero, for a week with nothing prescribed", () => {
    const series = buildAdherenceSeries([{ weekStart: "2026-08-01", prescribed: 0, completed: 0, selfReportedPct: null }]);
    expect(series[0].actualRate).toBeNull();
  });

  it("computes a real rate when something was prescribed", () => {
    const series = buildAdherenceSeries([{ weekStart: "2026-08-01", prescribed: 4, completed: 3, selfReportedPct: 80 }]);
    expect(series[0].actualRate).toBe(0.75);
    expect(series[0].selfReportedPct).toBe(80);
  });
});

describe("isCheckinEditable", () => {
  it("is editable until the coach replies", () => {
    expect(isCheckinEditable(null)).toBe(true);
    expect(isCheckinEditable(new Date())).toBe(false);
  });
});

describe("hasAnyCheckinField", () => {
  it("is false when every field is empty", () => {
    expect(hasAnyCheckinField({})).toBe(false);
    expect(hasAnyCheckinField({ dailyWeightsKg: [null, null], wentWell: "   " })).toBe(false);
  });

  it("is true when at least one field is set", () => {
    expect(hasAnyCheckinField({ mood: 4 })).toBe(true);
    expect(hasAnyCheckinField({ dailyWeightsKg: [null, 70.2, null] })).toBe(true);
    expect(hasAnyCheckinField({ wentWell: "trained 4x" })).toBe(true);
  });
});
