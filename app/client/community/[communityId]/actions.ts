"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createPostSchema, createCommentSchema, createReportSchema } from "@/lib/community/schemas";
import { createPost, createComment, createReport } from "@/lib/community/service";

export type PostFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "posted"; showCrisisResources: boolean };

export async function createPostAction(communityId: string, _prevState: PostFormState, formData: FormData): Promise<PostFormState> {
  const user = await requireRole("client");

  const parsed = createPostSchema.safeParse({
    communityId,
    bodyMd: formData.get("bodyMd"),
    isAnonymous: formData.get("isAnonymous") === "on",
  });
  if (!parsed.success) return { status: "error", message: "Write something before posting." };

  const result = await createPost(user.id, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not post. Try again." };

  revalidatePath(`/client/community/${communityId}`);
  return { status: "posted", showCrisisResources: result.data.flagged };
}

export type CommentFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "commented"; showCrisisResources: boolean };

export async function createCommentAction(postId: string, communityId: string, _prevState: CommentFormState, formData: FormData): Promise<CommentFormState> {
  const user = await requireRole("client");
  const parsed = createCommentSchema.safeParse({ postId, bodyMd: formData.get("bodyMd") });
  if (!parsed.success) return { status: "error", message: "Write something before replying." };

  const result = await createComment(user.id, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not reply. Try again." };

  revalidatePath(`/client/community/${communityId}`);
  return { status: "commented", showCrisisResources: result.data.flagged };
}

export async function reportContentAction(targetType: "community_post" | "community_comment", targetId: string, communityId: string, formData: FormData) {
  const user = await requireRole("client");
  const parsed = createReportSchema.safeParse({ targetType, targetId, reason: formData.get("reason") });
  if (!parsed.success) return;

  await createReport(user.id, parsed.data);
  revalidatePath(`/client/community/${communityId}`);
}
