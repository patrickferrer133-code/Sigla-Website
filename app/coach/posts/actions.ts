"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { savePostSchema } from "@/lib/content/schemas";
import { createPost, deletePost } from "@/lib/content/service";

export type PostFormState = { status: "idle" } | { status: "error"; message: string } | { status: "saved" };

export async function createPostAction(_prevState: PostFormState, formData: FormData): Promise<PostFormState> {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return { status: "error", message: "Complete your coach profile first." };

  const parsed = savePostSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title"),
    bodyMd: formData.get("bodyMd"),
    tags: formData.get("tags") || undefined,
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return { status: "error", message: "Double check the fields." };

  await createPost(coachId, parsed.data);
  revalidatePath("/coach/posts");
  return { status: "saved" };
}

export async function deletePostAction(postId: string, _formData: FormData) {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return;

  await deletePost(coachId, postId);
  revalidatePath("/coach/posts");
}
