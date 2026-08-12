import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  blocks,
  checkins,
  clientMetricsDaily,
  clientProfiles,
  engagements,
  exercises,
  programWeeks,
  programs,
  safetyFlags,
  sessionLogs,
  sessions,
  setLogs,
  setPrescriptions,
  users,
} from "@/lib/db/schema";
import {
  addDaysToIsoDate,
  applyEdRiskWeightSuppression,
  buildAdherenceSeries,
  buildE1rmSeries,
  coachCheckinAccess,
  denseDateSeries,
  hasAnyCheckinField,
  isoDateInTimezone,
  mondayOfIsoDate,
  selectKeyLifts,
  weekOfFor,
  weightTrendSeries,
  weightVisibleToViewer,
  type AdherenceSeriesPoint,
  type E1rmSeriesPoint,
} from "@/lib/domain/checkins";
import { shouldSuppressWeightAndCalorieDisplay } from "@/lib/domain/safety";
import { coachCanAccessClientData, type EngagementStatus } from "@/lib/access/policies";
import type { SubmitCheckinInput } from "./schemas";

// docs/03 section 11 says "define this window in doc 06"; doc 06 never did.
// Proposed default pending Patrick + safety-compliance-reviewer sign-off —
// see docs/_specs/weekly-checkins-spec.md open question 1.
export const HISTORICAL_ACCESS_WINDOW_DAYS = 90;

// docs/_specs/weekly-checkins-spec.md open question 7 — a judgement call,
// not a sourced figure, pending fitness-domain-expert + safety-compliance-reviewer sign-off.
const TREND_MIN_OBSERVATIONS = 3;
const TREND_WINDOW_DAYS = 7;

export type CheckinError =
  | { code: "unauthorized" }
  | { code: "forbidden" }
  | { code: "not_found"; resource: string }
  | { code: "engagement_inactive" }
  | { code: "checkin_locked" }
  | { code: "validation"; field: string; message: string };

export type CheckinResult<T> = { ok: true; data: T } | { ok: false; error: CheckinError };
function ok<T>(data: T): CheckinResult<T> {
  return { ok: true, data };
}
function fail<T>(error: CheckinError): CheckinResult<T> {
  return { ok: false, error };
}

const ACTIVE_ENGAGEMENT_STATUSES = ["accepted", "active", "paused"] as const;

async function findActiveEngagementForClient(clientId: string) {
  const [row] = await db
    .select({ id: engagements.id, coachId: engagements.coachId, startedAt: engagements.startedAt })
    .from(engagements)
    .where(and(eq(engagements.clientId, clientId), inArray(engagements.status, ACTIVE_ENGAGEMENT_STATUSES)))
    // engagements.started_at is nullable (e.g. status "accepted" but not yet
    // started), and Postgres DESC defaults to NULLS FIRST — without an
    // explicit NULLS LAST a not-yet-started engagement would outrank the
    // client's live one and silently steal this week's check-in.
    .orderBy(sql`${engagements.startedAt} DESC NULLS LAST`, desc(engagements.createdAt))
    .limit(1);
  return row ?? null;
}

async function hasUnresolvedEdRiskFlag(clientId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: safetyFlags.id })
    .from(safetyFlags)
    .where(and(eq(safetyFlags.clientId, clientId), eq(safetyFlags.kind, "ed_risk"), isNull(safetyFlags.resolvedAt)))
    .limit(1);
  return Boolean(row);
}

async function getClientPrivacyAndTimezone(clientId: string) {
  const [row] = await db
    .select({ hideWeight: clientProfiles.privacyPrefs, timezone: users.timezone })
    .from(clientProfiles)
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(eq(clientProfiles.id, clientId))
    .limit(1);
  return {
    hideWeight: row?.hideWeight?.hideWeight ?? true,
    timezone: row?.timezone ?? "Asia/Manila",
  };
}

/** Recomputes and persists bodyweight_trend_kg for a span of dates around an edited week. */
async function recomputeWeightTrend(clientId: string, weekOf: string) {
  const spanStart = addDaysToIsoDate(weekOf, -6);
  const spanEnd = addDaysToIsoDate(weekOf, 12);

  const rows = await db
    .select({ date: clientMetricsDaily.date, bodyweightKg: clientMetricsDaily.bodyweightKg })
    .from(clientMetricsDaily)
    .where(and(eq(clientMetricsDaily.clientId, clientId), gte(clientMetricsDaily.date, spanStart), lte(clientMetricsDaily.date, spanEnd)));

  const dense = denseDateSeries(
    spanStart,
    spanEnd,
    rows.filter((r) => r.bodyweightKg !== null).map((r) => ({ date: r.date, value: Number(r.bodyweightKg) })),
  );
  const trend = weightTrendSeries(dense, { windowDays: TREND_WINDOW_DAYS, minObservations: TREND_MIN_OBSERVATIONS });

  // The read span starts 6 days before weekOf so the FIRST written date has
  // a full trailing window — but that means trend[0..5] were computed over
  // a window that runs off the left edge of `dense` (there's no data before
  // spanStart to count), so they're truncated-window values, not real 7-day
  // trends. Writing them would silently overwrite an already-correct stored
  // trend for those prior days with a wrong one on every submit or edit.
  // Only dates >= weekOf have a full window and may be written.
  let cursor = spanStart;
  const updates: { date: string; trend: number | null }[] = [];
  for (const value of trend) {
    if (cursor >= weekOf) updates.push({ date: cursor, trend: value });
    cursor = addDaysToIsoDate(cursor, 1);
  }

  for (const { date, trend: trendValue } of updates) {
    await db
      .insert(clientMetricsDaily)
      .values({ clientId, date, bodyweightTrendKg: trendValue?.toString() })
      .onConflictDoUpdate({
        target: [clientMetricsDaily.clientId, clientMetricsDaily.date],
        set: { bodyweightTrendKg: trendValue?.toString() ?? null },
      });
  }
}

export async function submitCheckin(clientId: string, input: SubmitCheckinInput): Promise<CheckinResult<{ checkinId: string }>> {
  if (!hasAnyCheckinField(input)) {
    return fail({ code: "validation", field: "form", message: "Enter at least one field before submitting." });
  }

  const engagement = await findActiveEngagementForClient(clientId);
  if (!engagement) return fail({ code: "engagement_inactive" });

  const [existing] = await db
    .select({ id: checkins.id, coachRepliedAt: checkins.coachRepliedAt })
    .from(checkins)
    .where(and(eq(checkins.engagementId, engagement.id), eq(checkins.weekOf, input.weekOf)))
    .limit(1);
  if (existing?.coachRepliedAt) return fail({ code: "checkin_locked" });

  const edRiskFlagged = await hasUnresolvedEdRiskFlag(clientId);
  const sanitized = applyEdRiskWeightSuppression(input, edRiskFlagged);
  const dailyWeights = sanitized.dailyWeightsKg;
  const measurements = edRiskFlagged
    ? undefined
    : {
        waistCm: sanitized.waistCm,
        hipCm: sanitized.hipCm,
        chestCm: sanitized.chestCm,
        armCm: sanitized.armCm,
        thighCm: sanitized.thighCm,
      };

  const enteredWeights = dailyWeights.filter((v): v is number => v !== null);
  const meanBodyweightKg = enteredWeights.length > 0 ? Math.round((enteredWeights.reduce((a, b) => a + b, 0) / enteredWeights.length) * 100) / 100 : null;

  // Every optional field is coerced to an explicit null rather than left
  // undefined. Drizzle's mapUpdateSet drops undefined keys from an UPDATE,
  // so on the edit path `undefined` means "leave whatever is stored" — which
  // for an ED-risk-flagged client meant a previously stored bodyweight and
  // measurements survived a submission that was supposed to null them
  // (docs/06 section 3; spec safety test 3), and for everyone else meant a
  // cleared field silently kept its old value.
  const values = {
    engagementId: engagement.id,
    clientId,
    weekOf: input.weekOf,
    bodyweightKg: meanBodyweightKg?.toString() ?? null,
    measurements: measurements ?? null,
    adherenceTrainingPct: input.adherenceTrainingPct ?? null,
    adherenceNutritionPct: input.adherenceNutritionPct ?? null,
    avgSteps: input.avgSteps ?? null,
    avgSleepHours: input.avgSleepHours?.toString() ?? null,
    energy: input.energy ?? null,
    hunger: input.hunger ?? null,
    stress: input.stress ?? null,
    motivation: input.motivation ?? null,
    soreness: input.soreness ?? null,
    mood: input.mood ?? null,
    wentWell: input.wentWell ?? null,
    gotInTheWay: input.gotInTheWay ?? null,
    submittedAt: new Date(),
  };

  let checkinId: string;
  if (existing) {
    await db.update(checkins).set(values).where(eq(checkins.id, existing.id));
    checkinId = existing.id;
  } else {
    const [created] = await db.insert(checkins).values(values).returning({ id: checkins.id });
    checkinId = created.id;
  }

  // Write daily weights into client_metrics_daily, keyed on week_of + dayIndex
  // (not the submission date — see docs/_specs, "Data changes"). Cleared
  // days are nulled, not skipped, so removing a mistyped weight sticks.
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const date = addDaysToIsoDate(input.weekOf, dayIndex);
    const weightKg = dailyWeights[dayIndex];
    await db
      .insert(clientMetricsDaily)
      .values({ clientId, date, bodyweightKg: weightKg?.toString() ?? null })
      .onConflictDoUpdate({
        target: [clientMetricsDaily.clientId, clientMetricsDaily.date],
        set: { bodyweightKg: weightKg?.toString() ?? null },
      });
  }

  await recomputeWeightTrend(clientId, input.weekOf);

  return ok({ checkinId });
}

export async function replyToCheckin(coachId: string, checkinId: string, body: string): Promise<CheckinResult<{ repliedAt: Date }>> {
  const [row] = await db
    .select({
      checkinId: checkins.id,
      engagementId: checkins.engagementId,
      engagementCoachId: engagements.coachId,
      engagementStatus: engagements.status,
    })
    .from(checkins)
    .innerJoin(engagements, eq(engagements.id, checkins.engagementId))
    .where(eq(checkins.id, checkinId))
    .limit(1);

  if (!row || row.engagementCoachId !== coachId) return fail({ code: "not_found", resource: "checkin" });
  if (!ACTIVE_ENGAGEMENT_STATUSES.includes(row.engagementStatus as (typeof ACTIVE_ENGAGEMENT_STATUSES)[number])) {
    return fail({ code: "engagement_inactive" });
  }
  if (!body.trim()) return fail({ code: "validation", field: "body", message: "Write a reply before saving." });

  const repliedAt = new Date();
  await db.update(checkins).set({ coachReply: body.trim(), coachRepliedAt: repliedAt }).where(eq(checkins.id, checkinId));
  return ok({ repliedAt });
}

export interface CheckinSummary {
  id: string;
  weekOf: string;
  bodyweightKg: number | null;
  bodyweightTrendKg: number | null;
  measurements: { waistCm?: number; hipCm?: number; chestCm?: number; armCm?: number; thighCm?: number } | null;
  adherenceTrainingPct: number | null;
  adherenceNutritionPct: number | null;
  avgSteps: number | null;
  avgSleepHours: number | null;
  energy: number | null;
  hunger: number | null;
  stress: number | null;
  motivation: number | null;
  soreness: number | null;
  mood: number | null;
  wentWell: string | null;
  gotInTheWay: string | null;
  coachReply: string | null;
  coachRepliedAt: Date | null;
  editable: boolean;
}

function suppressWeightIfNeeded<T extends { bodyweightKg: number | null; bodyweightTrendKg: number | null; measurements: CheckinSummary["measurements"] }>(
  row: T,
  params: { edRiskFlagged: boolean; hideWeight: boolean },
): T {
  if (params.edRiskFlagged) {
    return { ...row, bodyweightKg: null, bodyweightTrendKg: null, measurements: null };
  }
  if (shouldSuppressWeightAndCalorieDisplay({ edRiskFlagged: false, clientOptedIntoWeightDisplay: !params.hideWeight })) {
    return { ...row, bodyweightKg: null, bodyweightTrendKg: null };
  }
  return row;
}

function toCheckinSummary(row: typeof checkins.$inferSelect, trendKg: number | null): CheckinSummary {
  return {
    id: row.id,
    weekOf: row.weekOf,
    bodyweightKg: row.bodyweightKg !== null ? Number(row.bodyweightKg) : null,
    bodyweightTrendKg: trendKg,
    measurements: row.measurements ?? null,
    adherenceTrainingPct: row.adherenceTrainingPct,
    adherenceNutritionPct: row.adherenceNutritionPct,
    avgSteps: row.avgSteps,
    avgSleepHours: row.avgSleepHours !== null ? Number(row.avgSleepHours) : null,
    energy: row.energy,
    hunger: row.hunger,
    stress: row.stress,
    motivation: row.motivation,
    soreness: row.soreness,
    mood: row.mood,
    wentWell: row.wentWell,
    gotInTheWay: row.gotInTheWay,
    coachReply: row.coachReply,
    coachRepliedAt: row.coachRepliedAt,
    editable: row.coachRepliedAt === null,
  };
}

export async function getCurrentWeekCheckin(clientId: string): Promise<
  CheckinResult<{
    checkin: CheckinSummary | null;
    weekOf: string;
    todayIsoDate: string;
    edRiskFlagged: boolean;
    dailyWeightsKg: (number | null)[];
  }>
> {
  const [{ timezone, hideWeight }, edRiskFlagged] = await Promise.all([getClientPrivacyAndTimezone(clientId), hasUnresolvedEdRiskFlag(clientId)]);
  const weekOf = weekOfFor(new Date(), timezone);
  // Computed in the client's own timezone, not UTC — a form field disabled
  // by comparing dates in the wrong timezone can disable every day's input
  // for hours around midnight local time (e.g. Asia/Manila is UTC+8, so
  // "today" in UTC is still yesterday until 08:00 local).
  const todayIsoDate = isoDateInTimezone(new Date(), timezone);

  const engagement = await findActiveEngagementForClient(clientId);
  if (!engagement) return fail({ code: "engagement_inactive" });

  const [row] = await db
    .select()
    .from(checkins)
    .where(and(eq(checkins.engagementId, engagement.id), eq(checkins.weekOf, weekOf)))
    .limit(1);

  if (!row) return ok({ checkin: null, weekOf, todayIsoDate, edRiskFlagged, dailyWeightsKg: Array(7).fill(null) });

  // Prefilling the edit form with what the client themselves already
  // entered this week is "entering", not "displaying" (spec Story 1 vs
  // Story 2) — it's shown regardless of hideWeight so a typo can be fixed,
  // and it's the only way editing doesn't silently null out saved weights.
  const dailyWeightsKg = edRiskFlagged ? Array(7).fill(null) : await getDailyWeightsForWeek(clientId, weekOf);

  // The computed weekly mean and the trend figure are *displays* of weight,
  // not entry values, so they follow the hideWeight opt-out even though the
  // 7-day grid does not. The form never renders them; keeping them out of
  // the payload keeps it that way (docs/06 section 3).
  const showWeight = weightVisibleToViewer({ viewerRole: "client", edRiskFlagged, hideWeight });
  const trendKg = showWeight ? await getTrendKgForWeek(clientId, weekOf) : null;

  const summary = toCheckinSummary(row, trendKg);
  return ok({
    checkin: showWeight
      ? summary
      : { ...summary, bodyweightKg: null, bodyweightTrendKg: null, measurements: edRiskFlagged ? null : summary.measurements },
    weekOf,
    todayIsoDate,
    edRiskFlagged,
    dailyWeightsKg,
  });
}

/** The most recent non-null bodyweight_trend_kg within a check-in's week — never the checkin's own raw mean. */
async function getTrendKgForWeek(clientId: string, weekOf: string): Promise<number | null> {
  const map = await getTrendKgByWeek(clientId, [weekOf]);
  return map.get(weekOf) ?? null;
}

async function getTrendKgByWeek(clientId: string, weekOfs: string[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (weekOfs.length === 0) return result;

  const minWeek = weekOfs.reduce((a, b) => (a < b ? a : b));
  const maxWeekEnd = addDaysToIsoDate(weekOfs.reduce((a, b) => (a > b ? a : b)), 6);
  const rows = await db
    .select({ date: clientMetricsDaily.date, bodyweightTrendKg: clientMetricsDaily.bodyweightTrendKg })
    .from(clientMetricsDaily)
    .where(and(eq(clientMetricsDaily.clientId, clientId), gte(clientMetricsDaily.date, minWeek), lte(clientMetricsDaily.date, maxWeekEnd)))
    .orderBy(asc(clientMetricsDaily.date));

  for (const weekOf of weekOfs) {
    const spanEnd = addDaysToIsoDate(weekOf, 6);
    const inWeek = rows.filter((r) => r.date >= weekOf && r.date <= spanEnd && r.bodyweightTrendKg !== null);
    const latest = inWeek[inWeek.length - 1];
    result.set(weekOf, latest ? Number(latest.bodyweightTrendKg) : null);
  }
  return result;
}

async function getDailyWeightsForWeek(clientId: string, weekOf: string): Promise<(number | null)[]> {
  const spanEnd = addDaysToIsoDate(weekOf, 6);
  const rows = await db
    .select({ date: clientMetricsDaily.date, bodyweightKg: clientMetricsDaily.bodyweightKg })
    .from(clientMetricsDaily)
    .where(and(eq(clientMetricsDaily.clientId, clientId), gte(clientMetricsDaily.date, weekOf), lte(clientMetricsDaily.date, spanEnd)));
  const byDate = new Map(rows.map((r) => [r.date, r.bodyweightKg !== null ? Number(r.bodyweightKg) : null]));
  return Array.from({ length: 7 }, (_, i) => byDate.get(addDaysToIsoDate(weekOf, i)) ?? null);
}

export async function getClientCheckinHistory(clientId: string, page = 1): Promise<CheckinResult<{ checkins: CheckinSummary[]; hasMore: boolean }>> {
  const pageSize = 12;
  const [{ hideWeight }, edRiskFlagged] = await Promise.all([getClientPrivacyAndTimezone(clientId), hasUnresolvedEdRiskFlag(clientId)]);

  const rows = await db
    .select()
    .from(checkins)
    .where(eq(checkins.clientId, clientId))
    .orderBy(desc(checkins.weekOf))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);

  const page_ = rows.slice(0, pageSize);
  const trendByWeek = edRiskFlagged ? new Map<string, number | null>() : await getTrendKgByWeek(clientId, page_.map((r) => r.weekOf));
  const summaries = page_.map((row) => {
    const summary = toCheckinSummary(row, trendByWeek.get(row.weekOf) ?? null);
    return suppressWeightIfNeeded(summary, { edRiskFlagged, hideWeight });
  });

  return ok({ checkins: summaries, hasMore: rows.length > pageSize });
}

export async function getCoachClientCheckins(coachId: string, clientId: string): Promise<CheckinResult<{ checkins: CheckinSummary[]; clientDisplayName: string }>> {
  const [engagement] = await db
    .select({ id: engagements.id, status: engagements.status, endedAt: engagements.endedAt })
    .from(engagements)
    .where(and(eq(engagements.coachId, coachId), eq(engagements.clientId, clientId)))
    // engagements.started_at is nullable (e.g. status "accepted" but not yet
    // started), and Postgres DESC defaults to NULLS FIRST — without an
    // explicit NULLS LAST a not-yet-started engagement would outrank the
    // client's live one and silently steal this week's check-in.
    .orderBy(sql`${engagements.startedAt} DESC NULLS LAST`, desc(engagements.createdAt))
    .limit(1);
  if (!engagement) return fail({ code: "not_found", resource: "client" });

  // List-level gate. This must deny an ended engagement whose historical
  // window has expired — an earlier version exempted status === "ended"
  // from the gate and relied on the per-row filter, which meant an expired
  // coach still got the client's display name and a rendered trend chart.
  const access = coachCheckinAccess({
    engagementStatus: engagement.status as EngagementStatus,
    engagementEndedAt: engagement.endedAt,
    historicalAccessWindowDays: HISTORICAL_ACCESS_WINDOW_DAYS,
  });
  if (!access.allowed) return fail({ code: "not_found", resource: "client" });

  const [client] = await db
    .select({ displayName: users.displayName })
    .from(clientProfiles)
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(eq(clientProfiles.id, clientId))
    .limit(1);
  if (!client) return fail({ code: "not_found", resource: "client" });

  const rows = await db.select().from(checkins).where(eq(checkins.engagementId, engagement.id)).orderBy(desc(checkins.weekOf));

  const visibleRows = rows.filter((row) =>
    coachCanAccessClientData({
      engagementStatus: engagement.status as EngagementStatus,
      engagementEndedAt: engagement.endedAt,
      dataCreatedAt: row.submittedAt ?? new Date(0),
      historicalAccessWindowDays: HISTORICAL_ACCESS_WINDOW_DAYS,
    }),
  );

  // Conservative reading of docs/06 section 3 (spec open question 2): an
  // unresolved ED risk flag suppresses weight on the coach's view too.
  const edRiskFlagged = await hasUnresolvedEdRiskFlag(clientId);
  // hideWeight is the client's own dashboard preference and is deliberately
  // not passed through here; only an ED risk flag blinds the coach.
  const showWeight = weightVisibleToViewer({ viewerRole: "coach", edRiskFlagged, hideWeight: true });
  const trendByWeek = showWeight ? await getTrendKgByWeek(clientId, visibleRows.map((r) => r.weekOf)) : new Map<string, number | null>();
  const summaries = visibleRows.map((row) => {
    const summary = toCheckinSummary(row, trendByWeek.get(row.weekOf) ?? null);
    return showWeight ? summary : { ...summary, bodyweightKg: null, bodyweightTrendKg: null, measurements: null };
  });

  return ok({ checkins: summaries, clientDisplayName: client.displayName });
}

export interface AwaitingReplyItem {
  checkinId: string;
  clientId: string;
  clientDisplayName: string;
  weekOf: string;
}

export async function getAwaitingReplyCheckins(coachId: string): Promise<AwaitingReplyItem[]> {
  const rows = await db
    .select({
      checkinId: checkins.id,
      clientId: checkins.clientId,
      weekOf: checkins.weekOf,
      clientDisplayName: users.displayName,
    })
    .from(checkins)
    .innerJoin(engagements, eq(engagements.id, checkins.engagementId))
    .innerJoin(clientProfiles, eq(clientProfiles.id, checkins.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(and(eq(engagements.coachId, coachId), inArray(engagements.status, ACTIVE_ENGAGEMENT_STATUSES), isNull(checkins.coachReply)))
    .orderBy(asc(checkins.weekOf));

  return rows;
}

export interface TrendSeries {
  weight: { date: string; trendKg: number | null; rawKg: number | null }[] | null; // null = suppressed
  e1rm: { exerciseId: string; exerciseName: string; points: E1rmSeriesPoint[] }[];
  adherence: AdherenceSeriesPoint[];
}

export async function getTrendSeries(
  clientId: string,
  viewer: { role: "client" } | { role: "coach"; coachId: string },
  windowWeeks = 12,
): Promise<CheckinResult<TrendSeries>> {
  const { hideWeight, timezone } = await getClientPrivacyAndTimezone(clientId);
  const edRiskFlagged = await hasUnresolvedEdRiskFlag(clientId);
  const today = weekOfFor(new Date(), timezone);
  const windowStart = addDaysToIsoDate(today, -windowWeeks * 7);

  // Authorization lives here, not only in the page. A read surface that
  // trusts its caller is one refactor away from being called from an
  // unauthorized one (CLAUDE.md: authorization on every operation, reads
  // included). `visibleUpTo` bounds every query below for an ended
  // engagement — the charts are client data too, and rule 5 covers them
  // exactly as much as it covers the check-in rows.
  let visibleUpTo: Date | null = null;
  let scopedEngagementIds: string[] | null = null;
  // Lower bound for a coach viewer: never show data from before THIS
  // engagement started, so a coach can't see a client's history from a
  // previous coach (or before they connected at all).
  let visibleFromIsoDate: string | null = null;
  if (viewer.role === "coach") {
    const [engagement] = await db
      .select({ id: engagements.id, status: engagements.status, endedAt: engagements.endedAt, startedAt: engagements.startedAt })
      .from(engagements)
      .where(and(eq(engagements.coachId, viewer.coachId), eq(engagements.clientId, clientId)))
      // engagements.started_at is nullable (e.g. status "accepted" but not yet
    // started), and Postgres DESC defaults to NULLS FIRST — without an
    // explicit NULLS LAST a not-yet-started engagement would outrank the
    // client's live one and silently steal this week's check-in.
    .orderBy(sql`${engagements.startedAt} DESC NULLS LAST`, desc(engagements.createdAt))
      .limit(1);
    if (!engagement) return fail({ code: "not_found", resource: "client" });

    const access = coachCheckinAccess({
      engagementStatus: engagement.status as EngagementStatus,
      engagementEndedAt: engagement.endedAt,
      historicalAccessWindowDays: HISTORICAL_ACCESS_WINDOW_DAYS,
    });
    if (!access.allowed) return fail({ code: "not_found", resource: "client" });
    visibleUpTo = access.visibleUpTo;
    scopedEngagementIds = [engagement.id];
    visibleFromIsoDate = engagement.startedAt ? engagement.startedAt.toISOString().slice(0, 10) : null;
  }
  const visibleUpToIsoDate = visibleUpTo ? visibleUpTo.toISOString().slice(0, 10) : null;
  const effectiveWindowStart = visibleFromIsoDate && visibleFromIsoDate > windowStart ? visibleFromIsoDate : windowStart;

  // hideWeight is the client's own anxiety-management preference for their
  // own dashboard (docs/06 section 3) — it is not a data-sharing toggle
  // with their coach, who needs this data to coach. Only an unresolved
  // ed_risk flag suppresses on both sides (spec open question 2, taken
  // conservatively either way).
  const weightSuppressed = !weightVisibleToViewer({ viewerRole: viewer.role, edRiskFlagged, hideWeight });
  let weight: TrendSeries["weight"] = null;
  if (!weightSuppressed) {
    const rows = await db
      .select({ date: clientMetricsDaily.date, bodyweightKg: clientMetricsDaily.bodyweightKg, bodyweightTrendKg: clientMetricsDaily.bodyweightTrendKg })
      .from(clientMetricsDaily)
      .where(
        and(
          eq(clientMetricsDaily.clientId, clientId),
          gte(clientMetricsDaily.date, effectiveWindowStart),
          ...(visibleUpToIsoDate ? [lte(clientMetricsDaily.date, visibleUpToIsoDate)] : []),
        ),
      )
      .orderBy(asc(clientMetricsDaily.date));
    weight = rows.map((r) => ({
      date: r.date,
      trendKg: r.bodyweightTrendKg !== null ? Number(r.bodyweightTrendKg) : null,
      rawKg: r.bodyweightKg !== null ? Number(r.bodyweightKg) : null,
    }));
  }

  let engagementIds: string[];
  if (scopedEngagementIds) {
    engagementIds = scopedEngagementIds;
  } else {
    const engagements_ = await db
      .select({ id: engagements.id })
      .from(engagements)
      .where(eq(engagements.clientId, clientId));
    engagementIds = engagements_.map((e) => e.id);
  }

  // Only scope the e1RM query to specific engagement ids for a coach viewer
  // — the client's own view intentionally spans all of their engagements.
  const e1rmScopeIds = scopedEngagementIds;
  const e1rm = await computeE1rmSeries(clientId, e1rmScopeIds, effectiveWindowStart, timezone, visibleUpTo);
  const adherence = await computeAdherenceSeries(engagementIds, effectiveWindowStart, visibleUpToIsoDate);

  return ok({ weight, e1rm, adherence });
}

async function computeE1rmSeries(
  clientId: string,
  // null = the client's own view, spanning all of their engagements past
  // and present. A non-null array scopes to a specific coach's engagement
  // only — without this, a coach could see sets logged under a different
  // (e.g. previous) coach's engagement, since set_logs only carries clientId.
  scopedEngagementIds: string[] | null,
  windowStart: string,
  timezone: string,
  visibleUpTo: Date | null,
): Promise<TrendSeries["e1rm"]> {
  if (scopedEngagementIds && scopedEngagementIds.length === 0) return [];

  const windowStartUtc = new Date(`${windowStart}T00:00:00.000Z`);

  const rows = await db
    .select({
      exerciseId: setLogs.exerciseId,
      exerciseName: exercises.name,
      movementPattern: exercises.movementPattern,
      loadingType: exercises.loadingType,
      loadKg: setLogs.loadKg,
      reps: setLogs.reps,
      loggedAt: setLogs.loggedAt,
      setType: setPrescriptions.setType,
      isDeload: programWeeks.isDeload,
    })
    .from(setLogs)
    .innerJoin(sessionLogs, eq(sessionLogs.id, setLogs.sessionLogId))
    .innerJoin(exercises, eq(exercises.id, setLogs.exerciseId))
    .leftJoin(setPrescriptions, eq(setPrescriptions.id, setLogs.setPrescriptionId))
    .leftJoin(sessions, eq(sessions.id, sessionLogs.sessionId))
    .leftJoin(programWeeks, eq(programWeeks.id, sessions.programWeekId))
    .where(
      and(
        eq(sessionLogs.clientId, clientId),
        gte(setLogs.loggedAt, windowStartUtc),
        ...(scopedEngagementIds ? [inArray(sessionLogs.engagementId, scopedEngagementIds)] : []),
      ),
    );

  // Four mandatory filters from spec Story 5 chart 2: set_prescription_id
  // must be linked (unclassifiable sets are excluded, not guessed at),
  // set_type working/backoff only, reps <= 10, loadable exercises only.
  const qualifying = rows.filter(
    (r) =>
      r.setType !== null &&
      (r.setType === "working" || r.setType === "backoff") &&
      r.reps !== null &&
      r.reps <= 10 &&
      r.loadKg !== null &&
      Number(r.loadKg) > 0 &&
      (r.loadingType === "external" || r.loadingType === "bw_plus_load") &&
      r.loggedAt !== null &&
      r.loggedAt.toISOString().slice(0, 10) >= windowStart &&
      // Sets logged after the engagement ended are new client data and are
      // never visible to the former coach (CLAUDE.md rule 5).
      (visibleUpTo === null || r.loggedAt.getTime() <= visibleUpTo.getTime()),
  );

  const withWeek = qualifying.map((r) => ({
    ...r,
    weekStart: weekOfFor(r.loggedAt as Date, timezone),
  }));

  const selectedIds = selectKeyLifts(
    withWeek.map((r) => ({ exerciseId: r.exerciseId, movementPattern: r.movementPattern, weekStart: r.weekStart })),
  );

  const nameById = new Map(withWeek.map((r) => [r.exerciseId, r.exerciseName]));

  return selectedIds.map((exerciseId) => {
    const sets = withWeek
      .filter((r) => r.exerciseId === exerciseId)
      .map((r) => ({ weekStart: r.weekStart, loadKg: Number(r.loadKg), reps: r.reps as number, isDeloadWeek: r.isDeload ?? false }));
    return { exerciseId, exerciseName: nameById.get(exerciseId) ?? "Unknown exercise", points: buildE1rmSeries(sets) };
  });
}

async function computeAdherenceSeries(engagementIds: string[], windowStart: string, visibleUpToIsoDate: string | null): Promise<AdherenceSeriesPoint[]> {
  if (engagementIds.length === 0) return [];

  const sessionRows = await db
    .select({ sessionId: sessions.id, weekNumber: programWeeks.weekNumber, startsOn: programs.startsOn })
    .from(sessions)
    .innerJoin(programWeeks, eq(programWeeks.id, sessions.programWeekId))
    .innerJoin(blocks, eq(blocks.id, programWeeks.blockId))
    .innerJoin(programs, eq(programs.id, blocks.programId))
    .where(inArray(programs.engagementId, engagementIds));

  const sessionWeekOf = new Map<string, string>();
  for (const row of sessionRows) {
    if (!row.startsOn) continue;
    // Normalized to the Monday of its week so it lines up with
    // checkins.week_of — programs.starts_on isn't necessarily a Monday.
    const weekOf = mondayOfIsoDate(addDaysToIsoDate(row.startsOn, (row.weekNumber - 1) * 7));
    if (weekOf < windowStart) continue;
    if (visibleUpToIsoDate !== null && weekOf > visibleUpToIsoDate) continue;
    sessionWeekOf.set(row.sessionId, weekOf);
  }

  const prescribedByWeek = new Map<string, number>();
  for (const weekOf of sessionWeekOf.values()) {
    prescribedByWeek.set(weekOf, (prescribedByWeek.get(weekOf) ?? 0) + 1);
  }

  const sessionIds = [...sessionWeekOf.keys()];
  const completedLogs = sessionIds.length
    ? await db
        .select({ sessionId: sessionLogs.sessionId })
        .from(sessionLogs)
        .where(and(inArray(sessionLogs.sessionId, sessionIds), eq(sessionLogs.status, "completed")))
    : [];
  const completedByWeek = new Map<string, number>();
  for (const log of completedLogs) {
    if (!log.sessionId) continue;
    const weekOf = sessionWeekOf.get(log.sessionId);
    if (weekOf) completedByWeek.set(weekOf, (completedByWeek.get(weekOf) ?? 0) + 1);
  }

  const selfReportedRows = await db
    .select({ weekOf: checkins.weekOf, adherenceTrainingPct: checkins.adherenceTrainingPct })
    .from(checkins)
    .where(
      and(
        inArray(checkins.engagementId, engagementIds),
        gte(checkins.weekOf, windowStart),
        ...(visibleUpToIsoDate ? [lte(checkins.weekOf, visibleUpToIsoDate)] : []),
      ),
    );
  const selfReportedByWeek = new Map(selfReportedRows.map((r) => [r.weekOf, r.adherenceTrainingPct]));

  const allWeeks = new Set([...prescribedByWeek.keys(), ...selfReportedByWeek.keys()]);
  const weeks = [...allWeeks].map((weekStart) => ({
    weekStart,
    prescribed: prescribedByWeek.get(weekStart) ?? 0,
    completed: completedByWeek.get(weekStart) ?? 0,
    selfReportedPct: selfReportedByWeek.get(weekStart) ?? null,
  }));

  return buildAdherenceSeries(weeks);
}
