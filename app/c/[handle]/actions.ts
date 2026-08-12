"use server";

import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { applyToPackageSchema } from "@/lib/marketplace/schemas";
import { applyToPackage } from "@/lib/marketplace/service";

export type ApplyFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function applyToPackageAction(packageId: string, _prevState: ApplyFormState, _formData: FormData): Promise<ApplyFormState> {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return { status: "error", message: "Complete your account first." };

  const parsed = applyToPackageSchema.safeParse({ packageId });
  if (!parsed.success) return { status: "error", message: "Something went wrong. Try again." };

  const result = await applyToPackage(clientId, parsed.data);
  if (!result.ok) {
    if (result.error.code === "already_engaged") return { status: "error", message: "You already have an active application or engagement with this coach." };
    if (result.error.code === "not_accepting_clients") return { status: "error", message: "This coach isn't accepting new clients right now." };
    return { status: "error", message: "Could not submit your application. Try again." };
  }

  return { status: "success" };
}
