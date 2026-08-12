"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { setWeightVisibility } from "@/lib/checkins/service";

export async function setWeightVisibilityAction(visible: boolean, _formData: FormData) {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return;

  await setWeightVisibility(clientId, visible);
  revalidatePath("/client/progress");
  revalidatePath("/client/check-in");
  revalidatePath("/client/check-in/history");
}
