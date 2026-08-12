"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { savePackageSchema } from "@/lib/marketplace/schemas";
import { createPackage, updatePackage, setPackagePublished } from "@/lib/marketplace/service";

export type PackageFormState = { status: "idle" } | { status: "error"; message: string } | { status: "saved" };
export const initialPackageFormState: PackageFormState = { status: "idle" };

function parseForm(formData: FormData) {
  return savePackageSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priceCents: formData.get("priceCents"),
    currency: formData.get("currency") || "PHP",
    billingPeriod: formData.get("billingPeriod"),
    inclusions: formData.get("inclusions") || undefined,
    slotLimit: formData.get("slotLimit") || undefined,
  });
}

export async function createPackageAction(_prevState: PackageFormState, formData: FormData): Promise<PackageFormState> {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return { status: "error", message: "Complete your coach profile first." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { status: "error", message: "Double check the fields." };

  await createPackage(coachId, parsed.data);
  revalidatePath("/coach/packages");
  return { status: "saved" };
}

export async function updatePackageAction(packageId: string, _prevState: PackageFormState, formData: FormData): Promise<PackageFormState> {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return { status: "error", message: "Complete your coach profile first." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { status: "error", message: "Double check the fields." };

  const result = await updatePackage(coachId, packageId, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not save. Try again." };
  revalidatePath("/coach/packages");
  return { status: "saved" };
}

export async function togglePublishAction(packageId: string, isPublished: boolean, _formData: FormData) {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return;

  await setPackagePublished(coachId, packageId, isPublished);
  revalidatePath("/coach/packages");
}
