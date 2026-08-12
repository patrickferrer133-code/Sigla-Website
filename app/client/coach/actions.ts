"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { submitReviewSchema } from "@/lib/marketplace/schemas";
import { submitReview } from "@/lib/marketplace/service";

export type ReviewFormState = { status: "idle" } | { status: "error"; message: string } | { status: "success" };

export async function submitReviewAction(engagementId: string, _prevState: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return { status: "error", message: "Complete your account first." };

  const parsed = submitReviewSchema.safeParse({
    engagementId,
    rating: formData.get("rating"),
    body: formData.get("body") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Pick a rating from 1 to 5." };

  const result = await submitReview(clientId, parsed.data);
  if (!result.ok) {
    if (result.error.code === "already_reviewed") return { status: "error", message: "You already reviewed this coach." };
    if (result.error.code === "not_eligible") return { status: "error", message: "You can review once you've been working with this coach a bit longer." };
    return { status: "error", message: "Could not submit your review. Try again." };
  }

  revalidatePath("/client/coach");
  return { status: "success" };
}
