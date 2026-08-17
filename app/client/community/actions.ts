"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { joinCommunity, clientHasEngagementWithCommunityOwner } from "@/lib/community/service";

export async function joinCommunityAction(communityId: string, _formData: FormData) {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return;

  const hasEngagementWithOwner = await clientHasEngagementWithCommunityOwner(clientId, communityId);
  await joinCommunity(user.id, communityId, { hasEngagementWithOwner });
  revalidatePath("/client/community");
}
