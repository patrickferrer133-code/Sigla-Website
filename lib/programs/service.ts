import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/lib/db/client";
import {
  blocks,
  clientProfiles,
  coachProfiles,
  engagements,
  exerciseGroups,
  exerciseInstances,
  exercises,
  programWeeks,
  programs,
  sessions,
  setPrescriptions,
  users,
} from "@/lib/db/schema";
import type {
  AddExerciseToSessionInput,
  AddSessionInput,
  AssignProgramInput,
  CreateTemplateInput,
} from "./schemas";

export type ProgramError =
  | { code: "unauthorized" }
  | { code: "not_found"; resource: string }
  | { code: "forbidden" };

export type ProgramResult<T> = { ok: true; data: T } | { ok: false; error: ProgramError };

function ok<T>(data: T): ProgramResult<T> {
  return { ok: true, data };
}
function fail<T>(error: ProgramError): ProgramResult<T> {
  return { ok: false, error };
}

export async function getCoachProfileIdForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: coachProfiles.id })
    .from(coachProfiles)
    .where(eq(coachProfiles.userId, userId))
    .limit(1);
  return row?.id ?? null;
}

async function assertProgramOwnedByCoach(programId: string, coachId: string) {
  const [row] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.coachId, coachId)))
    .limit(1);
  return Boolean(row);
}

export async function listCoachTemplates(coachId: string) {
  return db
    .select()
    .from(programs)
    .where(and(eq(programs.coachId, coachId), eq(programs.isTemplate, true)))
    .orderBy(asc(programs.createdAt));
}

export async function createTemplateProgram(
  coachId: string,
  input: CreateTemplateInput,
): Promise<ProgramResult<{ programId: string }>> {
  const [program] = await db
    .insert(programs)
    .values({
      coachId,
      isTemplate: true,
      title: input.title,
      description: input.description,
      goalType: input.goalType,
      status: "draft",
    })
    .returning({ id: programs.id });

  await db.insert(blocks).values({ programId: program.id, name: "Main Block", focus: "base", orderIndex: 0 });

  return ok({ programId: program.id });
}

export interface ProgramTree {
  id: string;
  title: string;
  description: string | null;
  isTemplate: boolean;
  weeksByBlock: {
    blockId: string;
    weeks: {
      id: string;
      weekNumber: number;
      isDeload: boolean;
      sessions: {
        id: string;
        name: string | null;
        dayIndex: number | null;
        groups: {
          id: string;
          exerciseId: string;
          exerciseName: string;
          restSeconds: number | null;
          sets: { id: string; setNumber: number; repsMin: number | null; repsMax: number | null; loadKg: number | null }[];
        }[];
      }[];
    }[];
  }[];
}

export async function getProgramTree(programId: string, coachId: string): Promise<ProgramResult<ProgramTree>> {
  const [program] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.coachId, coachId)))
    .limit(1);
  if (!program) return fail({ code: "not_found", resource: "program" });

  const programBlocks = await db.select().from(blocks).where(eq(blocks.programId, programId)).orderBy(asc(blocks.orderIndex));
  const blockIds = programBlocks.map((b) => b.id);

  const weeks = blockIds.length
    ? await db.select().from(programWeeks).where(inArray(programWeeks.blockId, blockIds)).orderBy(asc(programWeeks.weekNumber))
    : [];
  const weekIds = weeks.map((w) => w.id);

  const sessionRows = weekIds.length
    ? await db.select().from(sessions).where(inArray(sessions.programWeekId, weekIds)).orderBy(asc(sessions.orderIndex))
    : [];
  const sessionIds = sessionRows.map((s) => s.id);

  const groupRows = sessionIds.length
    ? await db.select().from(exerciseGroups).where(inArray(exerciseGroups.sessionId, sessionIds)).orderBy(asc(exerciseGroups.orderIndex))
    : [];
  const groupIds = groupRows.map((g) => g.id);

  const instanceRows = groupIds.length
    ? await db.select().from(exerciseInstances).where(inArray(exerciseInstances.exerciseGroupId, groupIds))
    : [];
  const instanceIds = instanceRows.map((i) => i.id);
  const exerciseIds = [...new Set(instanceRows.map((i) => i.exerciseId))];

  // Both depend only on instanceRows above, not on each other — run concurrently.
  const [exerciseRows, prescriptionRows] = await Promise.all([
    exerciseIds.length
      ? db.select({ id: exercises.id, name: exercises.name }).from(exercises).where(inArray(exercises.id, exerciseIds))
      : Promise.resolve([]),
    instanceIds.length
      ? db
          .select()
          .from(setPrescriptions)
          .where(inArray(setPrescriptions.exerciseInstanceId, instanceIds))
          .orderBy(asc(setPrescriptions.setNumber))
      : Promise.resolve([]),
  ]);
  const exerciseNameById = new Map(exerciseRows.map((e) => [e.id, e.name]));

  const instanceByGroupId = new Map(instanceRows.map((i) => [i.exerciseGroupId, i]));
  const prescriptionsByInstanceId = new Map<string, typeof prescriptionRows>();
  for (const p of prescriptionRows) {
    const list = prescriptionsByInstanceId.get(p.exerciseInstanceId) ?? [];
    list.push(p);
    prescriptionsByInstanceId.set(p.exerciseInstanceId, list);
  }

  const groupsBySessionId = new Map<string, typeof groupRows>();
  for (const g of groupRows) {
    const list = groupsBySessionId.get(g.sessionId) ?? [];
    list.push(g);
    groupsBySessionId.set(g.sessionId, list);
  }

  const sessionsByWeekId = new Map<string, typeof sessionRows>();
  for (const s of sessionRows) {
    const list = sessionsByWeekId.get(s.programWeekId) ?? [];
    list.push(s);
    sessionsByWeekId.set(s.programWeekId, list);
  }

  const weeksByBlockId = new Map<string, typeof weeks>();
  for (const w of weeks) {
    const list = weeksByBlockId.get(w.blockId) ?? [];
    list.push(w);
    weeksByBlockId.set(w.blockId, list);
  }

  const tree: ProgramTree = {
    id: program.id,
    title: program.title,
    description: program.description,
    isTemplate: program.isTemplate,
    weeksByBlock: programBlocks.map((block) => ({
      blockId: block.id,
      weeks: (weeksByBlockId.get(block.id) ?? []).map((week) => ({
        id: week.id,
        weekNumber: week.weekNumber,
        isDeload: week.isDeload,
        sessions: (sessionsByWeekId.get(week.id) ?? []).map((session) => ({
          id: session.id,
          name: session.name,
          dayIndex: session.dayIndex,
          groups: (groupsBySessionId.get(session.id) ?? []).map((group) => {
            const instance = instanceByGroupId.get(group.id);
            const prescriptions = instance ? (prescriptionsByInstanceId.get(instance.id) ?? []) : [];
            return {
              id: group.id,
              exerciseId: instance?.exerciseId ?? "",
              exerciseName: instance ? (exerciseNameById.get(instance.exerciseId) ?? "Unknown exercise") : "Unknown exercise",
              restSeconds: group.restSeconds,
              sets: prescriptions.map((p) => ({
                id: p.id,
                setNumber: p.setNumber,
                repsMin: p.repsMin,
                repsMax: p.repsMax,
                loadKg: (p.load as { value?: number } | null)?.value ?? null,
              })),
            };
          }),
        })),
      })),
    })),
  };

  return ok(tree);
}

export async function addWeekToBlock(blockId: string, coachId: string): Promise<ProgramResult<{ weekId: string }>> {
  const [block] = await db
    .select({ id: blocks.id, programId: blocks.programId })
    .from(blocks)
    .where(eq(blocks.id, blockId))
    .limit(1);
  if (!block) return fail({ code: "not_found", resource: "block" });
  if (!(await assertProgramOwnedByCoach(block.programId, coachId))) return fail({ code: "forbidden" });

  const existingWeeks = await db.select({ weekNumber: programWeeks.weekNumber }).from(programWeeks).where(eq(programWeeks.blockId, blockId));
  const nextWeekNumber = existingWeeks.length > 0 ? Math.max(...existingWeeks.map((w) => w.weekNumber)) + 1 : 1;

  const [week] = await db.insert(programWeeks).values({ blockId, weekNumber: nextWeekNumber }).returning({ id: programWeeks.id });
  return ok({ weekId: week.id });
}

export async function addSessionToWeek(input: AddSessionInput, coachId: string): Promise<ProgramResult<{ sessionId: string }>> {
  const [week] = await db
    .select({ id: programWeeks.id, blockId: programWeeks.blockId })
    .from(programWeeks)
    .where(eq(programWeeks.id, input.programWeekId))
    .limit(1);
  if (!week) return fail({ code: "not_found", resource: "week" });

  const [block] = await db.select({ programId: blocks.programId }).from(blocks).where(eq(blocks.id, week.blockId)).limit(1);
  if (!block || !(await assertProgramOwnedByCoach(block.programId, coachId))) return fail({ code: "forbidden" });

  const existingSessions = await db.select({ orderIndex: sessions.orderIndex }).from(sessions).where(eq(sessions.programWeekId, input.programWeekId));
  const nextOrder = existingSessions.length;

  const [session] = await db
    .insert(sessions)
    .values({ programWeekId: input.programWeekId, name: input.name, dayIndex: input.dayIndex, orderIndex: nextOrder })
    .returning({ id: sessions.id });
  return ok({ sessionId: session.id });
}

export async function addExerciseToSession(
  input: AddExerciseToSessionInput,
  coachId: string,
): Promise<ProgramResult<{ groupId: string }>> {
  const [session] = await db.select({ id: sessions.id, programWeekId: sessions.programWeekId }).from(sessions).where(eq(sessions.id, input.sessionId)).limit(1);
  if (!session) return fail({ code: "not_found", resource: "session" });

  const [week] = await db.select({ blockId: programWeeks.blockId }).from(programWeeks).where(eq(programWeeks.id, session.programWeekId)).limit(1);
  if (!week) return fail({ code: "not_found", resource: "week" });
  const [block] = await db.select({ programId: blocks.programId }).from(blocks).where(eq(blocks.id, week.blockId)).limit(1);
  if (!block || !(await assertProgramOwnedByCoach(block.programId, coachId))) return fail({ code: "forbidden" });

  const [exercise] = await db.select({ id: exercises.id }).from(exercises).where(eq(exercises.id, input.exerciseId)).limit(1);
  if (!exercise) return fail({ code: "not_found", resource: "exercise" });

  const existingGroups = await db.select({ orderIndex: exerciseGroups.orderIndex }).from(exerciseGroups).where(eq(exerciseGroups.sessionId, input.sessionId));
  const nextOrder = existingGroups.length;

  const [group] = await db
    .insert(exerciseGroups)
    .values({ sessionId: input.sessionId, kind: "straight", label: "A", restSeconds: input.restSeconds, orderIndex: nextOrder })
    .returning({ id: exerciseGroups.id });

  const [instance] = await db
    .insert(exerciseInstances)
    .values({ exerciseGroupId: group.id, exerciseId: input.exerciseId, orderIndex: 0 })
    .returning({ id: exerciseInstances.id });

  await db.insert(setPrescriptions).values(
    input.sets.map((set, idx) => ({
      exerciseInstanceId: instance.id,
      setNumber: idx + 1,
      setType: "working" as const,
      repsMode: "range" as const,
      repsMin: set.repsMin,
      repsMax: set.repsMax,
      load: { type: "kg" as const, value: set.loadKg },
      restSeconds: input.restSeconds,
    })),
  );

  return ok({ groupId: group.id });
}

export async function deleteSession(sessionId: string, coachId: string): Promise<ProgramResult<true>> {
  const [session] = await db.select({ programWeekId: sessions.programWeekId }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) return fail({ code: "not_found", resource: "session" });
  const [week] = await db.select({ blockId: programWeeks.blockId }).from(programWeeks).where(eq(programWeeks.id, session.programWeekId)).limit(1);
  if (!week) return fail({ code: "not_found", resource: "week" });
  const [block] = await db.select({ programId: blocks.programId }).from(blocks).where(eq(blocks.id, week.blockId)).limit(1);
  if (!block || !(await assertProgramOwnedByCoach(block.programId, coachId))) return fail({ code: "forbidden" });

  await db.delete(sessions).where(eq(sessions.id, sessionId));
  return ok(true);
}

export async function deleteExerciseGroup(groupId: string, coachId: string): Promise<ProgramResult<true>> {
  const [group] = await db.select({ sessionId: exerciseGroups.sessionId }).from(exerciseGroups).where(eq(exerciseGroups.id, groupId)).limit(1);
  if (!group) return fail({ code: "not_found", resource: "group" });
  const [session] = await db.select({ programWeekId: sessions.programWeekId }).from(sessions).where(eq(sessions.id, group.sessionId)).limit(1);
  if (!session) return fail({ code: "not_found", resource: "session" });
  const [week] = await db.select({ blockId: programWeeks.blockId }).from(programWeeks).where(eq(programWeeks.id, session.programWeekId)).limit(1);
  if (!week) return fail({ code: "not_found", resource: "week" });
  const [block] = await db.select({ programId: blocks.programId }).from(blocks).where(eq(blocks.id, week.blockId)).limit(1);
  if (!block || !(await assertProgramOwnedByCoach(block.programId, coachId))) return fail({ code: "forbidden" });

  await db.delete(exerciseGroups).where(eq(exerciseGroups.id, groupId));
  return ok(true);
}

export async function listAssignableEngagements(coachId: string) {
  const rows = await db
    .select({
      engagementId: engagements.id,
      clientDisplayName: users.displayName,
      status: engagements.status,
      hasProgram: programs.id,
    })
    .from(engagements)
    .innerJoin(clientProfiles, eq(clientProfiles.id, engagements.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .leftJoin(programs, and(eq(programs.engagementId, engagements.id), eq(programs.isTemplate, false)))
    .where(and(eq(engagements.coachId, coachId), inArray(engagements.status, ["accepted", "active"])));

  return rows.filter((r) => !r.hasProgram);
}

export async function assignProgramToEngagement(
  input: AssignProgramInput,
  coachId: string,
): Promise<ProgramResult<{ programId: string }>> {
  const [template] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, input.templateProgramId), eq(programs.coachId, coachId), eq(programs.isTemplate, true)))
    .limit(1);
  if (!template) return fail({ code: "not_found", resource: "template" });

  const [engagement] = await db
    .select()
    .from(engagements)
    .where(and(eq(engagements.id, input.engagementId), eq(engagements.coachId, coachId)))
    .limit(1);
  if (!engagement) return fail({ code: "not_found", resource: "engagement" });

  const treeResult = await getProgramTree(template.id, coachId);
  if (!treeResult.ok) return treeResult;
  const tree = treeResult.data;

  const [clonedProgram] = await db
    .insert(programs)
    .values({
      coachId,
      engagementId: engagement.id,
      isTemplate: false,
      title: tree.title,
      description: tree.description,
      goalType: template.goalType,
      weeksTotal: tree.weeksByBlock.reduce((sum, b) => sum + b.weeks.length, 0),
      version: 1,
      parentProgramId: template.id,
      status: "active",
      startsOn: new Date().toISOString().slice(0, 10),
    })
    .returning({ id: programs.id });

  // Pre-generate every child ID so the whole tree can be inserted in one
  // batched statement per table level, instead of one round-trip per row
  // (a template with 4 weeks x 3 sessions x 5 exercises was previously
  // ~200 sequential inserts — a real cause of the slow "assign" click).
  const blockRows: (typeof blocks.$inferInsert)[] = [];
  const weekRows: (typeof programWeeks.$inferInsert)[] = [];
  const sessionRows: (typeof sessions.$inferInsert)[] = [];
  const groupRows: (typeof exerciseGroups.$inferInsert)[] = [];
  const instanceRows: (typeof exerciseInstances.$inferInsert)[] = [];
  const prescriptionRows: (typeof setPrescriptions.$inferInsert)[] = [];

  for (const block of tree.weeksByBlock) {
    const blockId = uuidv7();
    blockRows.push({ id: blockId, programId: clonedProgram.id, name: "Main Block", focus: "base", orderIndex: 0 });

    for (const week of block.weeks) {
      const weekId = uuidv7();
      weekRows.push({ id: weekId, blockId, weekNumber: week.weekNumber, isDeload: week.isDeload });

      for (let sIdx = 0; sIdx < week.sessions.length; sIdx += 1) {
        const session = week.sessions[sIdx];
        const sessionId = uuidv7();
        sessionRows.push({ id: sessionId, programWeekId: weekId, name: session.name, dayIndex: session.dayIndex, orderIndex: sIdx });

        for (let gIdx = 0; gIdx < session.groups.length; gIdx += 1) {
          const group = session.groups[gIdx];
          const groupId = uuidv7();
          groupRows.push({ id: groupId, sessionId, kind: "straight", label: "A", restSeconds: group.restSeconds, orderIndex: gIdx });

          const instanceId = uuidv7();
          instanceRows.push({ id: instanceId, exerciseGroupId: groupId, exerciseId: group.exerciseId, orderIndex: 0 });

          for (const set of group.sets) {
            prescriptionRows.push({
              exerciseInstanceId: instanceId,
              setNumber: set.setNumber,
              setType: "working",
              repsMode: "range",
              repsMin: set.repsMin,
              repsMax: set.repsMax,
              load: { type: "kg", value: set.loadKg ?? 0 },
              restSeconds: group.restSeconds,
            });
          }
        }
      }
    }
  }

  if (blockRows.length) await db.insert(blocks).values(blockRows);
  if (weekRows.length) await db.insert(programWeeks).values(weekRows);
  if (sessionRows.length) await db.insert(sessions).values(sessionRows);
  if (groupRows.length) await db.insert(exerciseGroups).values(groupRows);
  if (instanceRows.length) await db.insert(exerciseInstances).values(instanceRows);
  if (prescriptionRows.length) await db.insert(setPrescriptions).values(prescriptionRows);

  return ok({ programId: clonedProgram.id });
}
