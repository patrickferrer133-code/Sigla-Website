"use server";

import { revalidatePath } from "next/cache";
import { requireAnyRole } from "@/lib/auth/require-role";
import {
  createCommentSchema,
  createCommunitySchema,
  createPostSchema,
  createReportSchema,
} from "./schemas";
import {
  clientHasEngagementWithCommunityOwner,
  createComment,
  createCommunity,
  createPost,
  createReport,
  joinCommunity,
  resolveJoinRequest,
  updateCommunityCoverPhoto,
} from "./service";
import { getCommunityOwnerIdentity } from "./owner";
import { getClientProfileIdForUser } from "@/lib/logging/service";

// Communities are a shared surface: a coach and a client both create, own,
// join, and post. Authorization is still server-side on every call
// (requireAnyRole here, plus the per-resource checks in the service layer).
const COMMUNITY_ROLES = ["coach", "client"] as const;

function revalidateCommunitySurfaces() {
  revalidatePath("/client/community");
  revalidatePath("/coach/community");
}

function revalidateCommunityDetail() {
  revalidatePath("/client/community/[communityId]", "page");
  revalidatePath("/coach/community/[communityId]", "page");
}

// --- Create ----------------------------------------------------------------

export type CreateCommunityState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "created"; communityId: string };

export async function createCommunityAction(
  _prevState: CreateCommunityState,
  formData: FormData,
): Promise<CreateCommunityState> {
  const user = await requireAnyRole(COMMUNITY_ROLES);

  const parsed = createCommunitySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    joinPolicy: formData.get("joinPolicy") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Give it a name of at least 3 characters." };

  const owner = await getCommunityOwnerIdentity(user);
  if (!owner) return { status: "error", message: "Finish setting up your profile first." };

  const result = await createCommunity(user.id, owner.ownerProfileId, owner.ownerRole, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not create the community. Try again." };

  revalidateCommunitySurfaces();
  return { status: "created", communityId: result.data.communityId };
}

// --- Join ------------------------------------------------------------------

export async function joinCommunityAction(communityId: string, _formData: FormData) {
  const user = await requireAnyRole(COMMUNITY_ROLES);

  // clients_only communities gate on an engagement with the owning coach. A
  // coach joining another coach's space never satisfies that, which is
  // correct: it is a client space.
  const clientId = user.role === "client" ? await getClientProfileIdForUser(user.id) : null;
  const hasEngagementWithOwner = clientId ? await clientHasEngagementWithCommunityOwner(clientId, communityId) : false;

  await joinCommunity(user.id, communityId, { hasEngagementWithOwner });
  revalidateCommunitySurfaces();
  revalidateCommunityDetail();
}

export async function resolveJoinRequestAction(
  communityId: string,
  targetUserId: string,
  decision: "approve" | "decline",
  _formData: FormData,
) {
  const user = await requireAnyRole(COMMUNITY_ROLES);
  // Owner-only, enforced inside the service against the membership row.
  await resolveJoinRequest(communityId, user.id, targetUserId, decision);
  revalidateCommunityDetail();
}

// --- Posts -----------------------------------------------------------------

export type PostFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "posted"; showCrisisResources: boolean };

export async function createPostAction(
  communityId: string,
  _prevState: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  const user = await requireAnyRole(COMMUNITY_ROLES);

  const parsed = createPostSchema.safeParse({
    communityId,
    bodyMd: formData.get("bodyMd"),
    isAnonymous: formData.get("isAnonymous") === "on",
  });
  if (!parsed.success) return { status: "error", message: "Write something before posting." };

  // The raw File is handed to createPost rather than uploaded here: the
  // membership check lives at the top of createPost, so passing the file
  // through guarantees nothing reaches the PUBLIC post-media bucket until the
  // uploader is a confirmed active member. Uploading first left an orphan
  // object attached to no post row — unreachable by the report button, the
  // moderation queue, and every delete path (docs/06 section 5).
  //
  // Inside createPost the upload still goes through the shared uploadPostMedia
  // path: same size limits, same accepted types, same EXIF/GPS strip, and a
  // storage prefix keyed by community id rather than uploader, so an anonymous
  // post's media URL carries no author signal (CLAUDE.md hard rule 4).
  const formFile = formData.get("media");
  const file = formFile instanceof File && formFile.size > 0 ? formFile : null;

  // Unchanged moderation pipeline: detectFlags on the post text inside
  // createPost, auto-flag report on a hit, crisis resources surfaced here.
  const result = await createPost(user.id, parsed.data, file);
  if (!result.ok) {
    if (result.error.code === "not_a_member") {
      return { status: "error", message: "Join this community before posting." };
    }
    if (result.error.code === "file_too_large") {
      return { status: "error", message: `That file is too large — max ${result.error.maxMb}MB.` };
    }
    if (result.error.code === "unsupported_file_type") {
      return { status: "error", message: "Use a JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV." };
    }
    return { status: "error", message: "Could not post. Try again." };
  }

  revalidateCommunityDetail();
  return { status: "posted", showCrisisResources: result.data.flagged };
}

export type CommentFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "commented"; showCrisisResources: boolean };

export async function createCommentAction(
  postId: string,
  _communityId: string,
  _prevState: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const user = await requireAnyRole(COMMUNITY_ROLES);
  const parsed = createCommentSchema.safeParse({ postId, bodyMd: formData.get("bodyMd") });
  if (!parsed.success) return { status: "error", message: "Write something before replying." };

  const result = await createComment(user.id, parsed.data);
  if (!result.ok) return { status: "error", message: "Could not reply. Try again." };

  revalidateCommunityDetail();
  return { status: "commented", showCrisisResources: result.data.flagged };
}

// --- Moderation ------------------------------------------------------------

export async function reportContentAction(
  targetType: "community_post" | "community_comment",
  targetId: string,
  _communityId: string,
  formData: FormData,
) {
  const user = await requireAnyRole(COMMUNITY_ROLES);
  const parsed = createReportSchema.safeParse({ targetType, targetId, reason: formData.get("reason") });
  if (!parsed.success) return;

  await createReport(user.id, parsed.data);
  revalidateCommunityDetail();
}

// --- Cover photo -----------------------------------------------------------

export type CoverPhotoState = { status: "idle" } | { status: "error"; message: string } | { status: "saved" };

export async function updateCommunityCoverPhotoAction(
  communityId: string,
  _prevState: CoverPhotoState,
  formData: FormData,
): Promise<CoverPhotoState> {
  const user = await requireAnyRole(COMMUNITY_ROLES);

  const file = formData.get("coverPhoto");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a photo first." };

  // Owner-only, checked server-side against the membership row — never
  // inferred from the UI having hidden the control.
  const result = await updateCommunityCoverPhoto(communityId, user.id, file);
  if (!result.ok) {
    if (result.error.code === "forbidden") return { status: "error", message: "Only the owner can change the cover photo." };
    if (result.error.code === "file_too_large") return { status: "error", message: `Photo is too large — max ${result.error.maxMb}MB.` };
    if (result.error.code === "unsupported_file_type") return { status: "error", message: "Use a JPG, PNG, WEBP, or GIF." };
    return { status: "error", message: "Could not upload. Try again." };
  }

  revalidateCommunityDetail();
  return { status: "saved" };
}
