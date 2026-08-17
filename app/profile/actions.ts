"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { uploadAvatar, updateDisplayName } from "@/lib/profile/service";

export type ProfileFormState = { status: "idle" } | { status: "error"; message: string } | { status: "saved" };

export async function updateAvatarAction(_prevState: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Sign in first." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a photo first." };

  const result = await uploadAvatar(user.id, file);
  if (!result.ok) {
    if (result.error.code === "file_too_large") return { status: "error", message: `Photo is too large — max ${result.error.maxMb}MB.` };
    if (result.error.code === "unsupported_file_type") return { status: "error", message: "Use a JPG, PNG, WEBP, or GIF." };
    return { status: "error", message: "Could not upload. Try again." };
  }

  revalidatePath("/profile");
  return { status: "saved" };
}

export async function updateNameAction(_prevState: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Sign in first." };

  const name = formData.get("displayName");
  if (typeof name !== "string" || name.trim().length === 0) return { status: "error", message: "Enter a name." };

  await updateDisplayName(user.id, name.trim());
  revalidatePath("/profile");
  return { status: "saved" };
}
