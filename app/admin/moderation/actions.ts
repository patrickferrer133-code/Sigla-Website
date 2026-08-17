"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { resolveReport } from "@/lib/community/service";

export async function resolveReportAction(reportId: string, status: "actioned" | "dismissed", _formData: FormData) {
  const user = await requireRole("admin");
  await resolveReport(user.id, reportId, status);
  revalidatePath("/admin/moderation");
}
