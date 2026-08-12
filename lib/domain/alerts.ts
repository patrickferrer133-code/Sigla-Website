// At-risk client detection, docs/04-architecture.md section 3.3 plus the
// docs/08-coach-pain-points.md section 2 amendment. The coach dashboard is
// an alert queue first and a client list second — "that ordering is the
// product." weeks_3_to_6_churn_risk outranks every other alert because it
// is the highest-leverage retention signal in the research.

export type AlertKind =
  | "weeks_3_to_6_churn_risk"
  | "missed_sessions"
  | "gone_quiet"
  | "checkin_missed"
  | "stalled_progress"
  | "pain_reported"
  | "overreaching"
  | "renewal_risk";

export interface ClientAlert {
  kind: AlertKind;
  reason: string;
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
}

/** prescribed minus completed >= 2 in a rolling 7 day window. */
export function detectMissedSessions(sessionsPrescribed7d: number, sessionsCompleted7d: number): boolean {
  return sessionsPrescribed7d - sessionsCompleted7d >= 2;
}

/** no app open in 7 days. */
export function detectGoneQuiet(daysSinceLastAppOpen: number): boolean {
  return daysSinceLastAppOpen >= 7;
}

/** no checkin for the current week_of by day 2 of the new week (i.e. 9+ days after week_of). */
export function detectCheckinMissed(params: { weekOf: Date; today: Date; hasCheckinForWeek: boolean }): boolean {
  if (params.hasCheckinForWeek) return false;
  return daysBetween(params.weekOf, params.today) >= 9;
}

/**
 * Weight trend flat for 3 weeks against an active fat loss or muscle gain
 * goal. "Flat" means the net change over the trailing 3 weekly trend points
 * is within a small fraction of bodyweight (default 0.2%).
 */
export function detectStalledProgress(params: {
  weeklyTrendKg: readonly number[];
  goalType: string;
  flatThresholdFraction?: number;
}): boolean {
  if (params.goalType !== "fat_loss" && params.goalType !== "muscle_gain") return false;
  if (params.weeklyTrendKg.length < 3) return false;

  const window = params.weeklyTrendKg.slice(-3);
  const startWeight = window[0];
  const totalChange = window[window.length - 1] - startWeight;
  const threshold = (params.flatThresholdFraction ?? 0.002) * startWeight;
  return Math.abs(totalChange) <= threshold;
}

/** Any high-severity pain report (per safety.ts's shouldEscalatePain) in the last 7 days. */
export function detectPainReported(recentPainReports: readonly { painScore: number; daysAgo: number }[]): boolean {
  return recentPainReports.some((report) => report.daysAgo <= 7 && report.painScore >= 7);
}

/** session_rpe trending up while volume load trends down, for 2 consecutive weeks. */
export function detectOverreaching(params: {
  weeklyAvgSessionRpe: readonly number[];
  weeklyVolumeLoadKg: readonly number[];
}): boolean {
  const { weeklyAvgSessionRpe: rpe, weeklyVolumeLoadKg: vol } = params;
  if (rpe.length < 3 || vol.length < 3) return false;

  const n = rpe.length;
  const rpeUpBothWeeks = rpe[n - 1] > rpe[n - 2] && rpe[n - 2] > rpe[n - 3];
  const volDownBothWeeks = vol[n - 1] < vol[n - 2] && vol[n - 2] < vol[n - 3];
  return rpeUpBothWeeks && volDownBothWeeks;
}

/** Subscription period ends within 10 days and rolling adherence is under 60 percent. */
export function detectRenewalRisk(params: { daysUntilPeriodEnd: number; adherenceRate: number }): boolean {
  return params.daysUntilPeriodEnd <= 10 && params.adherenceRate < 0.6;
}

/**
 * docs/08 section 2: a client between weeks 3 and 6 of their engagement
 * whose adherence or app engagement is falling has roughly one week before
 * they quit. This is the single highest-priority alert.
 */
export function detectWeeksThreeToSixChurnRisk(params: {
  weeksSinceEngagementStart: number;
  adherenceTrendDeclining: boolean;
  appEngagementDeclining: boolean;
}): boolean {
  const inWindow = params.weeksSinceEngagementStart >= 3 && params.weeksSinceEngagementStart <= 6;
  return inWindow && (params.adherenceTrendDeclining || params.appEngagementDeclining);
}

export interface ClientAlertInput {
  weeksSinceEngagementStart: number;
  adherenceTrendDeclining: boolean;
  appEngagementDeclining: boolean;
  sessionsPrescribed7d: number;
  sessionsCompleted7d: number;
  daysSinceLastAppOpen: number;
  checkin: { weekOf: Date; today: Date; hasCheckinForWeek: boolean };
  weeklyTrendKg: readonly number[];
  goalType: string;
  recentPainReports: readonly { painScore: number; daysAgo: number }[];
  weeklyAvgSessionRpe: readonly number[];
  weeklyVolumeLoadKg: readonly number[];
  subscription: { daysUntilPeriodEnd: number; adherenceRate: number } | null;
}

/** Returns every triggered alert, ordered with weeks_3_to_6_churn_risk first per docs/08. */
export function detectClientAlerts(input: ClientAlertInput): ClientAlert[] {
  const alerts: ClientAlert[] = [];

  if (
    detectWeeksThreeToSixChurnRisk({
      weeksSinceEngagementStart: input.weeksSinceEngagementStart,
      adherenceTrendDeclining: input.adherenceTrendDeclining,
      appEngagementDeclining: input.appEngagementDeclining,
    })
  ) {
    alerts.push({
      kind: "weeks_3_to_6_churn_risk",
      reason: "Client is in weeks 3-6 with falling adherence or app engagement — the highest-risk churn window.",
    });
  }

  if (detectMissedSessions(input.sessionsPrescribed7d, input.sessionsCompleted7d)) {
    alerts.push({ kind: "missed_sessions", reason: "Missed 2 or more prescribed sessions in the last 7 days." });
  }

  if (detectGoneQuiet(input.daysSinceLastAppOpen)) {
    alerts.push({ kind: "gone_quiet", reason: "No app open in 7 or more days." });
  }

  if (detectCheckinMissed(input.checkin)) {
    alerts.push({ kind: "checkin_missed", reason: "No check-in submitted for the current week." });
  }

  if (detectStalledProgress({ weeklyTrendKg: input.weeklyTrendKg, goalType: input.goalType })) {
    alerts.push({ kind: "stalled_progress", reason: "Weight trend has been flat for 3 weeks against an active goal." });
  }

  if (detectPainReported(input.recentPainReports)) {
    alerts.push({ kind: "pain_reported", reason: "High-severity pain reported in the last 7 days." });
  }

  if (
    detectOverreaching({
      weeklyAvgSessionRpe: input.weeklyAvgSessionRpe,
      weeklyVolumeLoadKg: input.weeklyVolumeLoadKg,
    })
  ) {
    alerts.push({ kind: "overreaching", reason: "Session RPE rising while volume load falls, 2 weeks running." });
  }

  if (input.subscription && detectRenewalRisk(input.subscription)) {
    alerts.push({ kind: "renewal_risk", reason: "Subscription renews within 10 days and adherence is under 60%." });
  }

  return alerts;
}
