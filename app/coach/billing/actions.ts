"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { startPlatformCheckout } from "@/lib/billing/checkout";

export type CheckoutFormState = { status: "idle" } | { status: "error"; message: string };

// Starter is the free default tier and needs no checkout, so it is not a valid
// input here.
const startCheckoutSchema = z.object({
  planCode: z.enum(["pro", "premium"]),
});

function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function startCheckoutAction(
  _prevState: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  // Zod at the boundary, before anything else happens.
  const parsed = startCheckoutSchema.safeParse({ planCode: formData.get("planCode") });
  if (!parsed.success) return { status: "error", message: "Pick a valid plan." };

  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return { status: "error", message: "Complete your coach profile first." };

  const base = appBaseUrl();
  const result = await startPlatformCheckout({
    coachId,
    planCode: parsed.data.planCode,
    successUrl: `${base}/coach/billing?checkout=success`,
    cancelUrl: `${base}/coach/billing?checkout=canceled`,
  });

  if (!result.ok) {
    switch (result.error.code) {
      case "not_an_upgrade":
        return { status: "error", message: "You're already on this plan or a higher one." };
      case "plan_not_found":
      case "price_not_found":
        return { status: "error", message: "That plan isn't available right now. Contact support." };
      case "provider_unavailable":
        // The provider detail stays server side; it can contain request
        // identifiers that are no use to the coach.
        console.error("[billing] PayMongo checkout session failed", result.error.detail);
        return { status: "error", message: "Payments are temporarily unavailable. Try again shortly." };
    }
  }

  // `redirect` throws a control-flow signal, so it must be outside any
  // try/catch and is always the last statement.
  redirect(result.data.checkoutUrl);
}
