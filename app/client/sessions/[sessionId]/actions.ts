"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { completeSessionSchema, logSetSchema } from "@/lib/logging/schemas";
import { completeSessionLog, getClientProfileIdForUser, logSet } from "@/lib/logging/service";

async function requireClientProfileId(): Promise<string> {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) redirect("/onboarding");
  return clientId;
}

export type LogActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export async function logSetAction(_prevState: LogActionState, formData: FormData): Promise<LogActionState> {
  const clientId = await requireClientProfileId();
  const parsed = logSetSchema.safeParse({
    sessionLogId: formData.get("sessionLogId"),
    exerciseId: formData.get("exerciseId"),
    setPrescriptionId: formData.get("setPrescriptionId") || undefined,
    setNumber: formData.get("setNumber"),
    reps: formData.get("reps"),
    loadKg: formData.get("loadKg"),
    rpe: formData.get("rpe") || undefined,
    painReported: formData.get("painReported") === "on",
    painScore: formData.get("painScore") || undefined,
    painSite: formData.get("painSite") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Enter valid reps and load." };

  const result = await logSet({ ...parsed.data, clientId });
  if (!result.ok) return { status: "error", message: "Could not log that set." };

  revalidatePath("/client");
  if (result.data.escalatePain) {
    return {
      status: "success",
      message: "Set logged. That pain level is worth a check-in — consider talking to a qualified health professional, and your coach has been notified.",
    };
  }
  return { status: "success", message: result.data.isPr ? "Set logged — new best!" : "Set logged." };
}

export async function completeSessionAction(
  _prevState: LogActionState,
  formData: FormData,
): Promise<LogActionState> {
  const clientId = await requireClientProfileId();
  const parsed = completeSessionSchema.safeParse({
    sessionLogId: formData.get("sessionLogId"),
    sessionRpe: formData.get("sessionRpe") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Something went wrong finishing the session." };

  const result = await completeSessionLog(parsed.data.sessionLogId, clientId, parsed.data.sessionRpe);
  if (!result.ok) return { status: "error", message: "Could not complete the session." };

  revalidatePath("/client");
  redirect("/client");
}
