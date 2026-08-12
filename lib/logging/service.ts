import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  blocks,
  clientProfiles,
  engagements,
  exerciseGroups,
  exerciseInstances,
  exercises,
  programWeeks,
  programs,
  safetyFlags,
  sessionLogs,
  sessions,
  setLogs,
  setPrescriptions,
} from "@/lib/db/schema";
import { estimatedOneRepMaxEpley, volumeLoad } from "@/lib/domain/metrics";
import { shouldEscalatePain } from "@/lib/domain/safety";

export type LoggingError = { code: "unauthorized" } | { code: "not_found"; resource: string } | { code: "forbidden" };
export type LoggingResult<T> = { ok: true; data: T } | { ok: false; error: LoggingError };
function ok<T>(data: T): LoggingResult<T> {
  return { ok: true, data };
}
function fail<T>(error: LoggingError): LoggingResult<T> {
  return { ok: false, error };
}

export async function getClientProfileIdForUser(userId: string): Promise<string | null> {
  const [row] = await db.select({ id: clientProfiles.id }).from(clientProfiles).where(eq(clientProfiles.userId, userId)).limit(1);
  return row?.id ?? null;
}

export interface ClientProgramSession {
  sessionId: string;
  sessionName: string | null;
  weekNumber: number;
  exerciseCount: number;
}

export async function getClientActiveProgramSessions(clientId: string): Promise<ClientProgramSession[]> {
  const [engagement] = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(and(eq(engagements.clientId, clientId), inArray(engagements.status, ["accepted", "active", "paused"])))
    .limit(1);
  if (!engagement) return [];

  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.engagementId, engagement.id), eq(programs.isTemplate, false)))
    .limit(1);
  if (!program) return [];

  const programBlocks = await db.select({ id: blocks.id }).from(blocks).where(eq(blocks.programId, program.id));
  const blockIds = programBlocks.map((b) => b.id);
  if (blockIds.length === 0) return [];

  const weeks = await db.select().from(programWeeks).where(inArray(programWeeks.blockId, blockIds)).orderBy(programWeeks.weekNumber);
  const weekIds = weeks.map((w) => w.id);
  if (weekIds.length === 0) return [];

  const sessionRows = await db.select().from(sessions).where(inArray(sessions.programWeekId, weekIds)).orderBy(sessions.orderIndex);
  const sessionIds = sessionRows.map((s) => s.id);
  const groupCounts = sessionIds.length
    ? await db.select({ sessionId: exerciseGroups.sessionId }).from(exerciseGroups).where(inArray(exerciseGroups.sessionId, sessionIds))
    : [];
  const countBySession = new Map<string, number>();
  for (const g of groupCounts) countBySession.set(g.sessionId, (countBySession.get(g.sessionId) ?? 0) + 1);

  const weekById = new Map(weeks.map((w) => [w.id, w]));

  return sessionRows
    .map((s) => ({
      sessionId: s.id,
      sessionName: s.name,
      weekNumber: weekById.get(s.programWeekId)?.weekNumber ?? 0,
      orderIndex: s.orderIndex,
      exerciseCount: countBySession.get(s.id) ?? 0,
    }))
    .sort((a, b) => a.weekNumber - b.weekNumber || a.orderIndex - b.orderIndex);
}

export interface SessionExercise {
  groupId: string;
  exerciseId: string;
  exerciseName: string;
  cues: string[];
  prescriptions: { id: string; setNumber: number; repsMin: number | null; repsMax: number | null; loadKg: number | null }[];
  previousPerformance: { loadKg: number; reps: number; loggedAt: Date } | null;
}

export interface SessionDetail {
  sessionId: string;
  sessionName: string | null;
  exercises: SessionExercise[];
}

// A single join instead of 4 sequential single-row lookups (session ->
// week -> block -> program -> engagement). This is called on every session
// page load and every set logged, so the round-trip count matters.
async function assertClientOwnsSession(sessionId: string, clientId: string) {
  const [row] = await db
    .select({ sessionName: sessions.name, engagementId: programs.engagementId, ownerClientId: engagements.clientId })
    .from(sessions)
    .innerJoin(programWeeks, eq(programWeeks.id, sessions.programWeekId))
    .innerJoin(blocks, eq(blocks.id, programWeeks.blockId))
    .innerJoin(programs, eq(programs.id, blocks.programId))
    .innerJoin(engagements, eq(engagements.id, programs.engagementId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row || !row.engagementId || row.ownerClientId !== clientId) return null;
  return { engagementId: row.engagementId, sessionName: row.sessionName };
}

async function fetchSessionDetail(
  sessionId: string,
  clientId: string,
  ownership: { engagementId: string; sessionName: string | null },
): Promise<SessionDetail> {
  const groups = await db.select().from(exerciseGroups).where(eq(exerciseGroups.sessionId, sessionId)).orderBy(exerciseGroups.orderIndex);
  const groupIds = groups.map((g) => g.id);
  const instances = groupIds.length ? await db.select().from(exerciseInstances).where(inArray(exerciseInstances.exerciseGroupId, groupIds)) : [];
  const instanceByGroupId = new Map(instances.map((i) => [i.exerciseGroupId, i]));
  const exerciseIds = [...new Set(instances.map((i) => i.exerciseId))];
  const instanceIds = instances.map((i) => i.id);

  // These three are independent of each other — run them concurrently
  // instead of as separate awaited round-trips.
  const [exerciseRows, prescriptionRows, previousRows] = await Promise.all([
    exerciseIds.length
      ? db.select({ id: exercises.id, name: exercises.name, cues: exercises.cues }).from(exercises).where(inArray(exercises.id, exerciseIds))
      : Promise.resolve([]),
    instanceIds.length
      ? db.select().from(setPrescriptions).where(inArray(setPrescriptions.exerciseInstanceId, instanceIds)).orderBy(setPrescriptions.setNumber)
      : Promise.resolve([]),
    // One query for "last logged set per exercise" instead of one query
    // per exercise (was an N+1 round-trip per exercise in this session).
    exerciseIds.length
      ? db
          .selectDistinctOn([setLogs.exerciseId], {
            exerciseId: setLogs.exerciseId,
            loadKg: setLogs.loadKg,
            reps: setLogs.reps,
            loggedAt: setLogs.loggedAt,
          })
          .from(setLogs)
          .innerJoin(sessionLogs, eq(sessionLogs.id, setLogs.sessionLogId))
          .where(and(eq(sessionLogs.clientId, clientId), inArray(setLogs.exerciseId, exerciseIds)))
          .orderBy(setLogs.exerciseId, desc(setLogs.loggedAt))
      : Promise.resolve([]),
  ]);

  const exerciseById = new Map(exerciseRows.map((e) => [e.id, e]));

  const prescriptionsByInstance = new Map<string, typeof prescriptionRows>();
  for (const p of prescriptionRows) {
    const list = prescriptionsByInstance.get(p.exerciseInstanceId) ?? [];
    list.push(p);
    prescriptionsByInstance.set(p.exerciseInstanceId, list);
  }

  const previousByExerciseId = new Map<string, { loadKg: number; reps: number; loggedAt: Date }>();
  for (const row of previousRows) {
    if (row.loggedAt && row.loadKg && row.reps) {
      previousByExerciseId.set(row.exerciseId, { loadKg: Number(row.loadKg), reps: row.reps, loggedAt: row.loggedAt });
    }
  }

  const sessionExercises: SessionExercise[] = groups.map((group) => {
    const instance = instanceByGroupId.get(group.id);
    const exercise = instance ? exerciseById.get(instance.exerciseId) : undefined;
    const prescriptions = instance ? (prescriptionsByInstance.get(instance.id) ?? []) : [];
    return {
      groupId: group.id,
      exerciseId: instance?.exerciseId ?? "",
      exerciseName: exercise?.name ?? "Unknown exercise",
      cues: exercise?.cues ?? [],
      prescriptions: prescriptions.map((p) => ({
        id: p.id,
        setNumber: p.setNumber,
        repsMin: p.repsMin,
        repsMax: p.repsMax,
        loadKg: (p.load as { value?: number } | null)?.value ?? null,
      })),
      previousPerformance: instance ? (previousByExerciseId.get(instance.exerciseId) ?? null) : null,
    };
  });

  return { sessionId, sessionName: ownership.sessionName, exercises: sessionExercises };
}

async function fetchOrCreateInProgressSessionLog(
  sessionId: string,
  clientId: string,
  ownership: { engagementId: string },
): Promise<{ sessionLogId: string }> {
  const [existing] = await db
    .select({ id: sessionLogs.id })
    .from(sessionLogs)
    .where(and(eq(sessionLogs.sessionId, sessionId), eq(sessionLogs.clientId, clientId), eq(sessionLogs.status, "in_progress")))
    .limit(1);
  if (existing) return { sessionLogId: existing.id };

  const [created] = await db
    .insert(sessionLogs)
    .values({
      sessionId,
      clientId,
      engagementId: ownership.engagementId,
      startedAt: new Date(),
      status: "in_progress",
    })
    .returning({ id: sessionLogs.id });

  return { sessionLogId: created.id };
}

export interface SessionPageData {
  detail: SessionDetail;
  sessionLogId: string;
}

/**
 * The session logger page needs both the exercise/prescription tree and an
 * in-progress session_log row. Both used to independently re-verify
 * ownership (session -> week -> block -> program -> engagement), doubling
 * the round trips on every page load. Check ownership once here and run
 * the two independent fetches concurrently.
 */
export async function getSessionPageData(sessionId: string, clientId: string): Promise<LoggingResult<SessionPageData>> {
  const ownership = await assertClientOwnsSession(sessionId, clientId);
  if (!ownership) return fail({ code: "forbidden" });

  const [detail, log] = await Promise.all([
    fetchSessionDetail(sessionId, clientId, ownership),
    fetchOrCreateInProgressSessionLog(sessionId, clientId, ownership),
  ]);

  return ok({ detail, sessionLogId: log.sessionLogId });
}

export async function logSet(params: {
  sessionLogId: string;
  clientId: string;
  exerciseId: string;
  setPrescriptionId?: string;
  setNumber: number;
  reps: number;
  loadKg: number;
  rpe?: number;
  painReported: boolean;
  painScore?: number;
  painSite?: string;
}): Promise<LoggingResult<{ isPr: boolean; escalatePain: boolean }>> {
  const [log] = await db.select({ clientId: sessionLogs.clientId }).from(sessionLogs).where(eq(sessionLogs.id, params.sessionLogId)).limit(1);
  if (!log || log.clientId !== params.clientId) return fail({ code: "forbidden" });

  const e1rm = estimatedOneRepMaxEpley(params.loadKg, params.reps);
  const [bestPrior] = await db
    .select({ loadKg: setLogs.loadKg, reps: setLogs.reps })
    .from(setLogs)
    .innerJoin(sessionLogs, eq(sessionLogs.id, setLogs.sessionLogId))
    .where(and(eq(setLogs.exerciseId, params.exerciseId), eq(sessionLogs.clientId, params.clientId)))
    .orderBy(desc(setLogs.loggedAt))
    .limit(50);
  const priorBestE1rm = bestPrior ? estimatedOneRepMaxEpley(Number(bestPrior.loadKg ?? 0), bestPrior.reps ?? 0) : 0;
  const isPr = e1rm > priorBestE1rm && e1rm > 0;

  let sameExerciseConsecutiveSessions = 0;
  if (params.painReported) {
    const recentPainLogs = await db
      .select({ painReported: setLogs.painReported })
      .from(setLogs)
      .innerJoin(sessionLogs, eq(sessionLogs.id, setLogs.sessionLogId))
      .where(and(eq(setLogs.exerciseId, params.exerciseId), eq(sessionLogs.clientId, params.clientId)))
      .orderBy(desc(setLogs.loggedAt))
      .limit(3);
    sameExerciseConsecutiveSessions = recentPainLogs.filter((r) => r.painReported).length + 1;
  }
  const escalatePain =
    params.painReported &&
    shouldEscalatePain({ painScore: params.painScore ?? 0, sameExerciseConsecutiveSessions });

  await db.insert(setLogs).values({
    sessionLogId: params.sessionLogId,
    setPrescriptionId: params.setPrescriptionId,
    exerciseId: params.exerciseId,
    setNumber: params.setNumber,
    reps: params.reps,
    loadKg: params.loadKg.toString(),
    rpe: params.rpe?.toString(),
    isPr,
    painReported: params.painReported,
    painScore: params.painReported ? params.painScore : undefined,
    painSite: params.painReported ? params.painSite : undefined,
    loggedAt: new Date(),
  });

  // Every pain report creates a flag visible to the coach on their next
  // dashboard load (docs/06 section 2) — not just escalated ones. The
  // platform never diagnoses or names a suspected injury here.
  if (params.painReported) {
    await db.insert(safetyFlags).values({
      clientId: params.clientId,
      kind: "pain_report",
      severity: escalatePain ? "warn" : "info",
      payload: { exerciseId: params.exerciseId, painScore: params.painScore, painSite: params.painSite, escalated: escalatePain },
    });
  }

  void volumeLoad; // volume rollups are computed at read time from set_logs, per docs/03 section 7

  return ok({ isPr, escalatePain });
}

export async function completeSessionLog(sessionLogId: string, clientId: string, sessionRpe?: number): Promise<LoggingResult<true>> {
  const [log] = await db.select({ clientId: sessionLogs.clientId }).from(sessionLogs).where(eq(sessionLogs.id, sessionLogId)).limit(1);
  if (!log || log.clientId !== clientId) return fail({ code: "forbidden" });

  await db
    .update(sessionLogs)
    .set({ status: "completed", completedAt: new Date(), sessionRpe })
    .where(eq(sessionLogs.id, sessionLogId));
  return ok(true);
}
