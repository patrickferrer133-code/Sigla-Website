import "server-only";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { OwnerRole } from "@/lib/domain/community-ownership";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { getCoachProfileIdForUser } from "@/lib/programs/service";

export interface CommunityOwnerIdentity {
  ownerProfileId: string;
  ownerRole: OwnerRole;
}

/**
 * Resolves the owning profile for a coach or client user. Communities can be
 * owned by either, so the profile lookup has to branch on the user's role
 * rather than assuming a coach. Returns null when the profile row does not
 * exist yet (mid-onboarding), which the caller must treat as "cannot own".
 */
export async function getCommunityOwnerIdentity(user: CurrentUser): Promise<CommunityOwnerIdentity | null> {
  if (user.role === "coach") {
    const ownerProfileId = await getCoachProfileIdForUser(user.id);
    return ownerProfileId ? { ownerProfileId, ownerRole: "coach" } : null;
  }
  if (user.role === "client") {
    const ownerProfileId = await getClientProfileIdForUser(user.id);
    return ownerProfileId ? { ownerProfileId, ownerRole: "client" } : null;
  }
  return null;
}

/** The route prefix for the signed-in user's community surface. */
export function communityBasePath(role: CurrentUser["role"]): string {
  return role === "coach" ? "/coach/community" : "/client/community";
}
