// Weekly check-in domain logic. See docs/_specs/weekly-checkins-spec.md.
//
// The weight-trend functions exist specifically to close a safety gap found
// during spec review: rollingAverage() in metrics.ts is index-based, not
// date-based. Handed a sparse/compacted array it silently averages across
// arbitrary time spans. These helpers force callers through a dense,
// date-indexed representation instead.

import { estimatedOneRepMaxEpley, rollingAverage, sessionCompletionRate } from "./metrics";
import type { EngagementStatus } from "../access/policies";

export interface CoachCheckinAccess {
  /** False means the coach gets nothing at all — not an empty list, not a name, not a chart. */
  allowed: boolean;
  /**
   * The newest instant of client data this coach may see. `null` means
   * "no upper bound" (live engagement). For an ended engagement it is
   * `ended_at`: every query that serves this coach must be clamped to it,
   * not just the check-in rows (CLAUDE.md rule 5, docs/06 section 7).
   */
  visibleUpTo: Date | null;
}

/**
 * One decision for every coach-facing read in this feature: may this coach
 * see this client's data at all, and up to what point in time.
 *
 * Split out because deciding it per-query is how the trend charts ended up
 * unbounded while the check-in list was correctly filtered — the coach got
 * no rows but a full weight chart, including days after the engagement
 * ended. Callers must use both fields.
 */
export function coachCheckinAccess(params: {
  engagementStatus: EngagementStatus;
  engagementEndedAt: Date | null;
  historicalAccessWindowDays: number;
  now?: Date;
}): CoachCheckinAccess {
  const denied: CoachCheckinAccess = { allowed: false, visibleUpTo: null };

  if (params.engagementStatus === "applied") return denied;
  if (params.engagementStatus !== "ended") return { allowed: true, visibleUpTo: null };

  // Ended: access survives only for the historical window, and only over
  // data that already existed when the engagement ended.
  if (!params.engagementEndedAt) return denied;
  const now = params.now ?? new Date();
  const daysSinceEnded = (now.getTime() - params.engagementEndedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (daysSinceEnded > params.historicalAccessWindowDays) return denied;
  return { allowed: true, visibleUpTo: params.engagementEndedAt };
}

/** YYYY-MM-DD for a Date, in a given IANA timezone. */
export function isoDateInTimezone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // en-CA formats as YYYY-MM-DD
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday, for a YYYY-MM-DD calendar date (timezone-agnostic once extracted). */
function isoWeekday(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** The Monday of the week containing `date`, in the client's own timezone. */
export function weekOfFor(date: Date, timeZone: string): string {
  const iso = isoDateInTimezone(date, timeZone);
  return addDaysToIsoDate(iso, -isoWeekday(iso));
}

/**
 * The Monday of the week containing a calendar date. Program-derived week
 * boundaries (`programs.starts_on + (week_number-1)*7`) inherit whatever
 * weekday a coach happened to set `starts_on` to, while `checkins.week_of`
 * is always a Monday — comparing the two without normalizing produces two
 * separate entries for what should be one real week.
 */
export function mondayOfIsoDate(isoDate: string): string {
  return addDaysToIsoDate(isoDate, -isoWeekday(isoDate));
}

/** A coach reply locks the check-in against further client edits. */
export function isCheckinEditable(coachRepliedAt: Date | null): boolean {
  return coachRepliedAt === null;
}

export interface DatedPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

/**
 * Builds one slot per calendar day from `fromIsoDate` to `toIsoDate`
 * inclusive, null where no point exists for that date. This is the
 * "dense, date-indexed array" rollingAverage()-based functions require —
 * never hand rollingAverage a compacted array of only the rows that exist.
 */
export function denseDateSeries(fromIsoDate: string, toIsoDate: string, points: readonly DatedPoint[]): (number | null)[] {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  const dense: (number | null)[] = [];
  let cursor = fromIsoDate;
  // Bounded by calendar-day arithmetic on real ISO strings; a malformed
  // range simply produces zero iterations rather than looping forever.
  while (cursor <= toIsoDate) {
    dense.push(byDate.get(cursor) ?? null);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return dense;
}

/**
 * The 7-day weight trend, with a minimum-observations guard. Without the
 * guard, a client who weighs in once still gets a "trend" equal to that
 * single number — the exact harm docs/06 section 3 exists to prevent, and
 * the reason weekly-only weight input was rejected during spec review.
 */
export function weightTrendSeries(
  denseValues: readonly (number | null)[],
  options: { windowDays: number; minObservations: number },
): (number | null)[] {
  const means = rollingAverage(denseValues, options.windowDays);
  return denseValues.map((_, index) => {
    const windowStart = Math.max(0, index - options.windowDays + 1);
    const observations = denseValues.slice(windowStart, index + 1).filter((v) => v !== null).length;
    return observations >= options.minObservations ? means[index] : null;
  });
}

const KEY_LIFT_PRIMARY_PATTERNS = ["squat", "hinge", "h_push", "h_pull"] as const;
const KEY_LIFT_FALLBACK_PATTERNS = ["v_pull", "v_push"] as const;

export interface QualifyingWorkingSet {
  exerciseId: string;
  movementPattern: string;
  weekStart: string; // which week (Monday) this set falls in
}

/**
 * Selects up to one exercise per movement pattern (squat, hinge, h_push,
 * h_pull, falling back to v_pull/v_push), per docs/01 section 8's "3 to 5
 * key lifts" — not the highest-set-count exercises overall, which would
 * elect isolation work over compounds. Requires >= 2 distinct weeks of
 * qualifying data before an exercise is eligible at all.
 */
export function selectKeyLifts(sets: readonly QualifyingWorkingSet[]): string[] {
  const byExercise = new Map<string, { movementPattern: string; setCount: number; weeks: Set<string> }>();
  for (const s of sets) {
    const entry = byExercise.get(s.exerciseId) ?? { movementPattern: s.movementPattern, setCount: 0, weeks: new Set<string>() };
    entry.setCount += 1;
    entry.weeks.add(s.weekStart);
    byExercise.set(s.exerciseId, entry);
  }

  const qualifying = [...byExercise.entries()].filter(([, v]) => v.weeks.size >= 2);
  const bestForPattern = (pattern: string, exclude: Set<string>) =>
    qualifying
      .filter(([id, v]) => v.movementPattern === pattern && !exclude.has(id))
      .sort((a, b) => b[1].setCount - a[1].setCount)[0]?.[0];

  const selected: string[] = [];
  for (const pattern of KEY_LIFT_PRIMARY_PATTERNS) {
    const best = bestForPattern(pattern, new Set(selected));
    if (best) selected.push(best);
  }
  for (const pattern of KEY_LIFT_FALLBACK_PATTERNS) {
    if (selected.length >= 4) break;
    const best = bestForPattern(pattern, new Set(selected));
    if (best) selected.push(best);
  }
  return selected;
}

export interface E1rmInputSet {
  weekStart: string;
  loadKg: number;
  reps: number;
  isDeloadWeek: boolean;
}

export interface E1rmSeriesPoint {
  weekStart: string;
  e1rmKg: number;
  isDeload: boolean;
}

/** Weekly-best e1RM. Caller must have already filtered to qualifying sets (see spec Story 5, chart 2). */
export function buildE1rmSeries(sets: readonly E1rmInputSet[]): E1rmSeriesPoint[] {
  const byWeek = new Map<string, E1rmSeriesPoint>();
  for (const s of sets) {
    const e1rm = estimatedOneRepMaxEpley(s.loadKg, s.reps);
    const existing = byWeek.get(s.weekStart);
    if (!existing || e1rm > existing.e1rmKg) {
      byWeek.set(s.weekStart, { weekStart: s.weekStart, e1rmKg: e1rm, isDeload: s.isDeloadWeek });
    }
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface AdherenceWeekInput {
  weekStart: string;
  prescribed: number;
  completed: number;
  selfReportedPct: number | null;
}

export interface AdherenceSeriesPoint {
  weekStart: string;
  actualRate: number | null; // null (not 0) when prescribed === 0 — see spec Story 5
  selfReportedPct: number | null;
}

export function buildAdherenceSeries(weeks: readonly AdherenceWeekInput[]): AdherenceSeriesPoint[] {
  return weeks
    .map((w) => ({
      weekStart: w.weekStart,
      actualRate: w.prescribed === 0 ? null : sessionCompletionRate(w.completed, w.prescribed),
      selfReportedPct: w.selfReportedPct,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** True when at least one field of a check-in submission is non-empty (Story 1: nothing is individually required). */
export function hasAnyCheckinField(input: {
  dailyWeightsKg?: (number | null)[];
  measurements?: Record<string, number | null | undefined>;
  adherenceTrainingPct?: number | null;
  adherenceNutritionPct?: number | null;
  avgSteps?: number | null;
  avgSleepHours?: number | null;
  energy?: number | null;
  hunger?: number | null;
  stress?: number | null;
  motivation?: number | null;
  soreness?: number | null;
  mood?: number | null;
  wentWell?: string | null;
  gotInTheWay?: string | null;
}): boolean {
  if (input.dailyWeightsKg?.some((v) => v !== null && v !== undefined)) return true;
  if (input.measurements && Object.values(input.measurements).some((v) => v !== null && v !== undefined)) return true;
  const scalarFields: (keyof typeof input)[] = [
    "adherenceTrainingPct",
    "adherenceNutritionPct",
    "avgSteps",
    "avgSleepHours",
    "energy",
    "hunger",
    "stress",
    "motivation",
    "soreness",
    "mood",
  ];
  if (scalarFields.some((key) => input[key] !== null && input[key] !== undefined)) return true;
  if (input.wentWell?.trim()) return true;
  if (input.gotInTheWay?.trim()) return true;
  return false;
}

/**
 * Under an unresolved ED risk flag, weight and measurements are dropped
 * server-side regardless of what was submitted — the rest of the check-in
 * still saves (docs/06 section 3; spec Story 2). Pulled out as a pure
 * function so the rule has one tested implementation instead of being
 * re-decided at every call site.
 */
export function applyEdRiskWeightSuppression<
  T extends { dailyWeightsKg: (number | null)[]; waistCm?: number; hipCm?: number; chestCm?: number; armCm?: number; thighCm?: number },
>(input: T, edRiskFlagged: boolean): T {
  if (!edRiskFlagged) return input;
  return {
    ...input,
    dailyWeightsKg: input.dailyWeightsKg.map(() => null),
    waistCm: undefined,
    hipCm: undefined,
    chestCm: undefined,
    armCm: undefined,
    thighCm: undefined,
  };
}

/**
 * Whether weight and measurement values may appear in a payload at all.
 *
 * Two different rules, deliberately:
 * - `edRiskFlagged` suppresses on BOTH sides. docs/06 section 3 says a
 *   positive screen "suppresses all weight and calorie displays for that
 *   client" and separately tells the coach to refer out — the coach gets
 *   guidance, not numbers. Absolute; no viewer role escapes it.
 * - `hideWeight` is the client's own opt-out for their own dashboard. It is
 *   a display preference, not a data-sharing permission, so it does not
 *   blind the coach who needs the number to coach.
 *
 * Centralised because this was previously re-decided at four call sites.
 */
export function weightVisibleToViewer(params: {
  viewerRole: "client" | "coach";
  edRiskFlagged: boolean;
  hideWeight: boolean;
}): boolean {
  if (params.edRiskFlagged) return false;
  if (params.viewerRole === "client" && params.hideWeight) return false;
  return true;
}

/**
 * The headline weight figure shown anywhere in the product is always the
 * rolling trend, never the raw value (docs/06 section 3) — a single
 * tested choice instead of each surface deciding independently.
 */
export function headlineWeightKg(_bodyweightKg: number | null, bodyweightTrendKg: number | null): number | null {
  return bodyweightTrendKg;
}
