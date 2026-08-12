import { describe, expect, it } from "vitest";
import {
  detectCheckinMissed,
  detectClientAlerts,
  detectGoneQuiet,
  detectMissedSessions,
  detectOverreaching,
  detectPainReported,
  detectRenewalRisk,
  detectStalledProgress,
  detectWeeksThreeToSixChurnRisk,
} from "./alerts";

describe("detectMissedSessions", () => {
  it("flags when 2 or more prescribed sessions are missed in 7 days", () => {
    expect(detectMissedSessions(4, 2)).toBe(true);
  });

  it("does not flag a single missed session", () => {
    expect(detectMissedSessions(4, 3)).toBe(false);
  });
});

describe("detectGoneQuiet", () => {
  it("flags at 7 or more days since last app open", () => {
    expect(detectGoneQuiet(7)).toBe(true);
    expect(detectGoneQuiet(10)).toBe(true);
  });

  it("does not flag under 7 days", () => {
    expect(detectGoneQuiet(6)).toBe(false);
  });
});

describe("detectCheckinMissed", () => {
  it("flags once 9 or more days have passed since week_of with no check-in", () => {
    expect(
      detectCheckinMissed({
        weekOf: new Date("2026-01-01"),
        today: new Date("2026-01-10"),
        hasCheckinForWeek: false,
      }),
    ).toBe(true);
  });

  it("does not flag within the grace window", () => {
    expect(
      detectCheckinMissed({
        weekOf: new Date("2026-01-01"),
        today: new Date("2026-01-08"),
        hasCheckinForWeek: false,
      }),
    ).toBe(false);
  });

  it("never flags once a check-in exists for the week", () => {
    expect(
      detectCheckinMissed({
        weekOf: new Date("2026-01-01"),
        today: new Date("2026-01-15"),
        hasCheckinForWeek: true,
      }),
    ).toBe(false);
  });
});

describe("detectStalledProgress", () => {
  it("flags a flat weight trend against an active fat loss goal", () => {
    expect(detectStalledProgress({ weeklyTrendKg: [80.1, 80.0, 80.1], goalType: "fat_loss" })).toBe(true);
  });

  it("does not flag meaningful movement", () => {
    expect(detectStalledProgress({ weeklyTrendKg: [80, 79, 78], goalType: "fat_loss" })).toBe(false);
  });

  it("does not apply to goal types other than fat_loss or muscle_gain", () => {
    expect(detectStalledProgress({ weeklyTrendKg: [80.1, 80.0, 80.1], goalType: "strength" })).toBe(false);
  });
});

describe("detectPainReported", () => {
  it("flags a high-severity report within the last 7 days", () => {
    expect(detectPainReported([{ painScore: 8, daysAgo: 2 }])).toBe(true);
  });

  it("does not flag a low-severity report", () => {
    expect(detectPainReported([{ painScore: 4, daysAgo: 2 }])).toBe(false);
  });

  it("does not flag a high-severity report outside the 7 day window", () => {
    expect(detectPainReported([{ painScore: 9, daysAgo: 10 }])).toBe(false);
  });
});

describe("detectOverreaching", () => {
  it("flags RPE rising while volume falls for 2 consecutive weeks", () => {
    expect(
      detectOverreaching({
        weeklyAvgSessionRpe: [7, 7.5, 8.2],
        weeklyVolumeLoadKg: [12000, 11000, 9500],
      }),
    ).toBe(true);
  });

  it("does not flag when volume is rising alongside RPE", () => {
    expect(
      detectOverreaching({
        weeklyAvgSessionRpe: [7, 7.5, 8.2],
        weeklyVolumeLoadKg: [12000, 13000, 14000],
      }),
    ).toBe(false);
  });

  it("requires at least 3 weeks of data", () => {
    expect(detectOverreaching({ weeklyAvgSessionRpe: [7, 8], weeklyVolumeLoadKg: [12000, 11000] })).toBe(false);
  });
});

describe("detectRenewalRisk", () => {
  it("flags a renewal within 10 days with low adherence", () => {
    expect(detectRenewalRisk({ daysUntilPeriodEnd: 5, adherenceRate: 0.4 })).toBe(true);
  });

  it("does not flag a renewal far in the future", () => {
    expect(detectRenewalRisk({ daysUntilPeriodEnd: 20, adherenceRate: 0.4 })).toBe(false);
  });

  it("does not flag a near renewal with healthy adherence", () => {
    expect(detectRenewalRisk({ daysUntilPeriodEnd: 5, adherenceRate: 0.8 })).toBe(false);
  });
});

describe("detectWeeksThreeToSixChurnRisk", () => {
  it("flags a client in the weeks 3-6 window with declining adherence", () => {
    expect(
      detectWeeksThreeToSixChurnRisk({
        weeksSinceEngagementStart: 4,
        adherenceTrendDeclining: true,
        appEngagementDeclining: false,
      }),
    ).toBe(true);
  });

  it("does not flag outside the weeks 3-6 window even with declining signals", () => {
    expect(
      detectWeeksThreeToSixChurnRisk({
        weeksSinceEngagementStart: 8,
        adherenceTrendDeclining: true,
        appEngagementDeclining: true,
      }),
    ).toBe(false);
  });
});

describe("detectClientAlerts", () => {
  it("ranks weeks_3_to_6_churn_risk first when multiple alerts trigger", () => {
    const alerts = detectClientAlerts({
      weeksSinceEngagementStart: 4,
      adherenceTrendDeclining: true,
      appEngagementDeclining: false,
      sessionsPrescribed7d: 4,
      sessionsCompleted7d: 1,
      daysSinceLastAppOpen: 8,
      checkin: { weekOf: new Date("2026-01-01"), today: new Date("2026-01-12"), hasCheckinForWeek: false },
      weeklyTrendKg: [80, 79, 78],
      goalType: "fat_loss",
      recentPainReports: [],
      weeklyAvgSessionRpe: [],
      weeklyVolumeLoadKg: [],
      subscription: null,
    });

    expect(alerts.length).toBeGreaterThan(1);
    expect(alerts[0].kind).toBe("weeks_3_to_6_churn_risk");
  });

  it("returns no alerts for a healthy, on-track client", () => {
    const alerts = detectClientAlerts({
      weeksSinceEngagementStart: 10,
      adherenceTrendDeclining: false,
      appEngagementDeclining: false,
      sessionsPrescribed7d: 4,
      sessionsCompleted7d: 4,
      daysSinceLastAppOpen: 0,
      checkin: { weekOf: new Date("2026-01-01"), today: new Date("2026-01-02"), hasCheckinForWeek: true },
      weeklyTrendKg: [80, 79, 78],
      goalType: "fat_loss",
      recentPainReports: [],
      weeklyAvgSessionRpe: [7, 7, 7],
      weeklyVolumeLoadKg: [10000, 10500, 11000],
      subscription: { daysUntilPeriodEnd: 20, adherenceRate: 0.9 },
    });

    expect(alerts).toEqual([]);
  });
});
