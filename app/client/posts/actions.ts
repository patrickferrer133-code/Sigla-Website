"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { saveClientPostSchema } from "@/lib/content/schemas";
import { createClientPost, deleteClientPost, uploadPostMedia } from "@/lib/content/service";

export type ClientPostFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  // showCrisisResources mirrors the community post form: a crisis-level
  // auto-flag never leaves the poster unanswered (docs/06 section 5). The
  // post itself stays up and goes to human review.
  | { status: "saved"; showCrisisResources: boolean };

export async function createClientPostAction(
  _prevState: ClientPostFormState,
  formData: FormData,
): Promise<ClientPostFormState> {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return { status: "error", message: "Complete your profile first." };

  const parsed = saveClientPostSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    bodyMd: formData.get("bodyMd"),
    tags: formData.get("tags") || undefined,
    visibility: "public",
    guidelinesAck: formData.get("guidelinesAck"),
  });
  if (!parsed.success) {
    const ackFailed = parsed.error.issues.some((issue) => issue.path[0] === "guidelinesAck");
    return {
      status: "error",
      message: ackFailed ? "Please confirm the posting guidelines before posting." : "Double check the fields.",
    };
  }

  const file = formData.get("media");
  let media = null;
  if (file instanceof File && file.size > 0) {
    const uploadResult = await uploadPostMedia(clientId, file);
    if (!uploadResult.ok) {
      if (uploadResult.error.code === "file_too_large") return { status: "error", message: `File is too large — max ${uploadResult.error.maxMb}MB.` };
      if (uploadResult.error.code === "unsupported_file_type") return { status: "error", message: "Unsupported file type. Use JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV." };
      return { status: "error", message: "Could not upload the file. Try again." };
    }
    media = uploadResult.data;
  }

  const result = await createClientPost(clientId, parsed.data, media);
  if (!result.ok) return { status: "error", message: "Could not post. Try again." };

  revalidatePath("/client/posts");
  revalidatePath("/reels");
  return { status: "saved", showCrisisResources: result.data.flagged };
}

export async function deleteClientPostAction(postId: string, _formData: FormData) {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return;

  await deleteClientPost(clientId, postId);
  revalidatePath("/client/posts");
  revalidatePath("/reels");
}
