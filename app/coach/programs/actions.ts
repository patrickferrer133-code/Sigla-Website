"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import {
  addExerciseToSessionSchema,
  addSessionSchema,
  assignProgramSchema,
  createTemplateSchema,
  deleteEntitySchema,
} from "@/lib/programs/schemas";
import {
  addExerciseToSession,
  addSessionToWeek,
  addWeekToBlock,
  assignProgramToEngagement,
  createTemplateProgram,
  deleteExerciseGroup,
  deleteSession,
  getCoachProfileIdForUser,
} from "@/lib/programs/service";

async function requireCoachProfileId(): Promise<string> {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) redirect("/onboarding");
  return coachId;
}

export type FormActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export async function createTemplateAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const coachId = await requireCoachProfileId();
  const parsed = createTemplateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    goalType: formData.get("goalType") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Give the template a title." };

  const result = await createTemplateProgram(coachId, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not create the template." };

  redirect(`/coach/programs/${result.data.programId}`);
}

export async function addWeekAction(blockId: string, _formData: FormData) {
  const coachId = await requireCoachProfileId();
  const result = await addWeekToBlock(blockId, coachId);
  if (result.ok) revalidatePath(`/coach/programs`);
}

export async function addSessionAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const coachId = await requireCoachProfileId();
  const parsed = addSessionSchema.safeParse({
    programWeekId: formData.get("programWeekId"),
    name: formData.get("name"),
    dayIndex: formData.get("dayIndex") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Give the session a name." };

  const result = await addSessionToWeek(parsed.data, coachId);
  if (!result.ok) return { status: "error", message: "Could not add the session." };
  revalidatePath(`/coach/programs`);
  return { status: "idle" };
}

export async function addExerciseAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const coachId = await requireCoachProfileId();

  const setCount = Number(formData.get("setCount") ?? 3);
  const oneSet = {
    repsMin: formData.get("repsMin") ?? 8,
    repsMax: formData.get("repsMax") ?? 12,
    loadKg: formData.get("loadKg") ?? 20,
  };
  const sets = Array.from({ length: setCount }, () => oneSet);

  const parsed = addExerciseToSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    exerciseId: formData.get("exerciseId"),
    restSeconds: formData.get("restSeconds") || 90,
    sets,
  });
  if (!parsed.success) return { status: "error", message: "Pick an exercise and valid set numbers." };

  const result = await addExerciseToSession(parsed.data, coachId);
  if (!result.ok) return { status: "error", message: "Could not add the exercise." };
  revalidatePath(`/coach/programs`);
  return { status: "success", message: "Exercise added." };
}

export async function deleteSessionAction(formData: FormData) {
  const coachId = await requireCoachProfileId();
  const parsed = deleteEntitySchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await deleteSession(parsed.data.id, coachId);
  revalidatePath(`/coach/programs`);
}

export async function deleteExerciseGroupAction(formData: FormData) {
  const coachId = await requireCoachProfileId();
  const parsed = deleteEntitySchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await deleteExerciseGroup(parsed.data.id, coachId);
  revalidatePath(`/coach/programs`);
}

export async function assignProgramAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const coachId = await requireCoachProfileId();
  const parsed = assignProgramSchema.safeParse({
    templateProgramId: formData.get("templateProgramId"),
    engagementId: formData.get("engagementId"),
  });
  if (!parsed.success) return { status: "error", message: "Pick a client to assign this to." };

  const result = await assignProgramToEngagement(parsed.data, coachId);
  if (!result.ok) return { status: "error", message: "Could not assign the program." };

  revalidatePath("/coach/programs");
  return { status: "success", message: "Program assigned." };
}
