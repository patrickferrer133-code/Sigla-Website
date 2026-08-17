"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { setCoachTier } from "@/lib/billing/service";
import type { CoachTier } from "@/lib/billing/entitlements";

export async function setCoachTierAction(coachId: string, tier: CoachTier, _formData: FormData) {
  await requireRole("admin");
  await setCoachTier(coachId, tier);
  revalidatePath("/admin/coaches");
}
