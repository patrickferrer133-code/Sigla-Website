import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  blocks,
  checkins,
  clientMetricsDaily,
  clientProfiles,
  engagements,
  goals,
  programWeeks,
  programs,
  sessionLogs,
  sessions,
  setLogs,
  users,
} from "@/lib/db/schema";
import { detectClientAlerts, type ClientAlert } from "@/lib/domain/alerts";
import { mondayOfIsoDate, weekOfFor } from "@/lib/domain/checkins";

const ACTIVE_ENGAGEMENT_STATUSES = ["accepted", "active", "paused"] as const;
const LOOKBACK_DAYS = 28; // enough for 3-4 weekly buckets, cheap enough to run on every dashboard load

export interface AlertQueueItem {
  engagementId: string;
  clientId: string;
  clientDisplayName: string;
  alerts: ClientAlert[];
}

export async function getCoachAlertQueue(coachId: string): Promise<AlertQueueItem[]> {
  const engagementRows = await db
    .select({
      id: engagements.id,
      clientId: engagements.clientId,
      startedAt: engagements.startedAt,
      clientDisplayName: users.displayName,
    })
    .from(engagements)
    .innerJoin(clientProfiles, eq(clientProfiles.id, engagements.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(and(eq(engagements.coachId, coachId), inArray(engagements.status, ACTIVE_ENGAGEMENT_STATUSES)));

  if (engagementRows.length === 0) return [];

  const engagementIds = engagementRows.map((e) => e.id);
  const clientIds = engagementRows.map((e) => e.clientId);
  const today = new Date();
  const lookbackStart = new Date(today.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [sessionRows, logRows, checkinRows, trendRows, goalRows, painRows] = await Promise.all([
    // Prescribed sessions, via program structure (never from logs — a
    // session never opened has no log row, which would silently undercount).
    db
      .select({ engagementId: programs.engagementId, sessionId: sessions.id, weekNumber: programWeeks.weekNumber, startsOn: programs.startsOn })
      .from(sessions)
      .innerJoin(programWeeks, eq(programWeeks.id, sessions.programWeekId))
      .innerJoin(blocks, eq(blocks.id, programWeeks.blockId))
      .innerJoin(programs, eq(programs.id, blocks.programId))
      .where(inArray(programs.engagementId, engagementIds)),
    // Completed sessions + RPE, trailing lookback window.
    db
      .select({ engagementId: sessionLogs.engagementId, sessionId: sessionLogs.sessionId, completedAt: sessionLogs.completedAt, startedAt: sessionLogs.startedAt, sessionRpe: sessionLogs.sessionRpe, status: sessionLogs.status, clientId: sessionLogs.clientId })
      .from(sessionLogs)
      .where(and(inArray(sessionLogs.engagementId, engagementIds), gte(sessionLogs.startedAt, lookbackStart))),
    // Current-week check-in presence, per engagement.
    db
      .select({ engagementId: checkins.engagementId, weekOf: checkins.weekOf })
      .from(checkins)
      .where(inArray(checkins.engagementId, engagementIds)),
    // Weight trend, weekly-sampled, per client.
    db
      .select({ clientId: clientMetricsDaily.clientId, date: clientMetricsDaily.date, bodyweightTrendKg: clientMetricsDaily.bodyweightTrendKg })
      .from(clientMetricsDaily)
      .where(and(inArray(clientMetricsDaily.clientId, clientIds), gte(clientMetricsDaily.date, lookbackStart.toISOString().slice(0, 10))))
      .orderBy(desc(clientMetricsDaily.date)),
    // Active primary goal, per client.
    db
      .select({ clientId: goals.clientId, type: goals.type })
      .from(goals)
      .where(and(inArray(goals.clientId, clientIds), eq(goals.isPrimary, true), eq(goals.status, "active"))),
    // High-severity pain reports, trailing 7 days.
    db
      .select({ clientId: sessionLogs.clientId, painScore: setLogs.painScore, loggedAt: setLogs.loggedAt })
      .from(setLogs)
      .innerJoin(sessionLogs, eq(sessionLogs.id, setLogs.sessionLogId))
      .where(and(inArray(sessionLogs.engagementId, engagementIds), eq(setLogs.painReported, true), gte(setLogs.loggedAt, new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)))),
  ]);

  return engagementRows.map((e) => {
    const alerts = detectClientAlerts(buildAlertInput(e, today, { sessionRows, logRows, checkinRows, trendRows, goalRows, painRows }));
    return { engagementId: e.id, clientId: e.clientId, clientDisplayName: e.clientDisplayName, alerts };
  });
}

interface RawData {
  sessionRows: { engagementId: string | null; sessionId: string; weekNumber: number; startsOn: string | null }[];
  logRows: { engagementId: string | null; sessionId: string | null; completedAt: Date | null; startedAt: Date | null; sessionRpe: number | null; status: string | null; clientId: string }[];
  checkinRows: { engagementId: string; weekOf: string }[];
  trendRows: { clientId: string; date: string; bodyweightTrendKg: string | null }[];
  goalRows: { clientId: string; type: string }[];
  painRows: { clientId: string; painScore: number | null; loggedAt: Date | null }[];
}

function buildAlertInput(
  engagement: { id: string; clientId: string; startedAt: Date | null },
  today: Date,
  data: RawData,
) {
  const weeksSinceStart = engagement.startedAt ? Math.floor((today.getTime() - engagement.startedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0;

  // Bucket prescribed sessions by their planned Monday.
  const prescribedByWeek = new Map<string, number>();
  const sessionIdToWeek = new Map<string, string>();
  for (const row of data.sessionRows) {
    if (row.engagementId !== engagement.id || !row.startsOn) continue;
    const [y, m, d] = row.startsOn.split("-").map(Number);
    const startsOn = new Date(Date.UTC(y, m - 1, d));
    startsOn.setUTCDate(startsOn.getUTCDate() + (row.weekNumber - 1) * 7);
    const weekOf = mondayOfIsoDate(startsOn.toISOString().slice(0, 10));
    prescribedByWeek.set(weekOf, (prescribedByWeek.get(weekOf) ?? 0) + 1);
    sessionIdToWeek.set(row.sessionId, weekOf);
  }

  const completedByWeek = new Map<string, number>();
  const rpeByWeek = new Map<string, number[]>();
  let lastActivityAt: Date | null = null;
  for (const row of data.logRows) {
    if (row.engagementId !== engagement.id) continue;
    if (row.startedAt && (!lastActivityAt || row.startedAt > lastActivityAt)) lastActivityAt = row.startedAt;
    if (row.status !== "completed" || !row.completedAt) continue;
    const weekOf = row.sessionId ? sessionIdToWeek.get(row.sessionId) : undefined;
    if (weekOf) completedByWeek.set(weekOf, (completedByWeek.get(weekOf) ?? 0) + 1);
    if (row.sessionRpe !== null) {
      const list = weekOf ? (rpeByWeek.get(weekOf) ?? []) : [];
      if (weekOf) {
        list.push(row.sessionRpe);
        rpeByWeek.set(weekOf, list);
      }
    }
  }

  const thisWeekOf = weekOfFor(today, "Asia/Manila");
  const lastWeekOf = mondayOfIsoDate(new Date(new Date(thisWeekOf).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const sessionsPrescribed7d = prescribedByWeek.get(thisWeekOf) ?? 0;
  const sessionsCompleted7d = completedByWeek.get(thisWeekOf) ?? 0;
  const thisWeekRate = sessionsPrescribed7d > 0 ? sessionsCompleted7d / sessionsPrescribed7d : null;
  const lastWeekPrescribed = prescribedByWeek.get(lastWeekOf) ?? 0;
  const lastWeekCompleted = completedByWeek.get(lastWeekOf) ?? 0;
  const lastWeekRate = lastWeekPrescribed > 0 ? lastWeekCompleted / lastWeekPrescribed : null;
  const adherenceTrendDeclining = thisWeekRate !== null && lastWeekRate !== null && thisWeekRate < lastWeekRate;

  const daysSinceLastAppOpen = lastActivityAt ? (today.getTime() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000) : LOOKBACK_DAYS;

  const hasCheckinForWeek = data.checkinRows.some((c) => c.engagementId === engagement.id && c.weekOf === thisWeekOf);

  // One weight-trend sample per week, most recent value in each week.
  const trendByWeek = new Map<string, number>();
  for (const row of data.trendRows) {
    if (row.clientId !== engagement.clientId || row.bodyweightTrendKg === null) continue;
    const weekOf = mondayOfIsoDate(row.date);
    if (!trendByWeek.has(weekOf)) trendByWeek.set(weekOf, Number(row.bodyweightTrendKg)); // rows are date-desc, so first hit per week is the latest
  }
  const weeklyTrendKg = [...trendByWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);

  const goalType = data.goalRows.find((g) => g.clientId === engagement.clientId)?.type ?? "";

  const recentPainReports = data.painRows
    .filter((p) => p.clientId === engagement.clientId && p.painScore !== null && p.loggedAt !== null)
    .map((p) => ({ painScore: p.painScore as number, daysAgo: (today.getTime() - (p.loggedAt as Date).getTime()) / (24 * 60 * 60 * 1000) }));

  const weeklyVolumeLoadKg: number[] = []; // not computed yet — see follow-up note in the dashboard page

  const weeklyRpeWeeks = [...rpeByWeek.keys()].sort();
  const weeklyAvgSessionRpe = weeklyRpeWeeks.map((w) => {
    const list = rpeByWeek.get(w) ?? [];
    return list.reduce((a, b) => a + b, 0) / list.length;
  });

  return {
    weeksSinceEngagementStart: weeksSinceStart,
    adherenceTrendDeclining,
    appEngagementDeclining: daysSinceLastAppOpen >= 4,
    sessionsPrescribed7d,
    sessionsCompleted7d,
    daysSinceLastAppOpen,
    checkin: { weekOf: new Date(thisWeekOf), today, hasCheckinForWeek },
    weeklyTrendKg,
    goalType,
    recentPainReports,
    weeklyAvgSessionRpe,
    weeklyVolumeLoadKg,
    subscription: null, // no payment tracking — coaches bill off-platform (docs/02 §9 decision 4)
  };
}
