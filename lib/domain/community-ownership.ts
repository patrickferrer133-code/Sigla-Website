// Pure decision logic for community ownership, join eligibility, and the
// storage path used for community post media. No I/O — the service layer
// orchestrates, these functions decide (CLAUDE.md conventions).

export type CommunityKind = "global_goal" | "coach_private" | "user_created";
export type JoinPolicy = "open" | "request" | "clients_only";
export type MembershipRole = "pending" | "member" | "trusted" | "coach_moderator" | "owner" | "admin";
export type OwnerRole = "coach" | "client";

/** Roles that count as being *in* the community. `pending` deliberately does not. */
const ACTIVE_ROLES: ReadonlySet<MembershipRole> = new Set<MembershipRole>([
  "member",
  "trusted",
  "coach_moderator",
  "owner",
  "admin",
]);

export function isActiveMember(role: MembershipRole | null | undefined): boolean {
  return role != null && ACTIVE_ROLES.has(role);
}

/** Only the owner and platform admins manage a community (cover photo, join requests). */
export function canManageCommunity(role: MembershipRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export type JoinOutcome =
  | { outcome: "joined"; role: MembershipRole }
  | { outcome: "requested"; role: MembershipRole }
  | { outcome: "not_eligible" };

/**
 * What happens when a user asks to join. `clients_only` still requires an
 * engagement with the owning coach; `request` creates a pending row that the
 * owner must approve before the user can read or post.
 */
export function resolveJoinOutcome(policy: JoinPolicy, ctx: { hasEngagementWithOwner: boolean }): JoinOutcome {
  switch (policy) {
    case "open":
      return { outcome: "joined", role: "member" };
    case "request":
      return { outcome: "requested", role: "pending" };
    case "clients_only":
      return ctx.hasEngagementWithOwner ? { outcome: "joined", role: "member" } : { outcome: "not_eligible" };
  }
}

/**
 * Storage path prefix for a community post's media.
 *
 * CLAUDE.md hard rule 4: the media lands in a PUBLIC bucket and its URL is
 * rendered to every member, so the path must not contain the author's user id
 * or profile id. An anonymous post whose image lived under `<userId>/...`
 * would identify its author to anyone who read the URL. Keying on the
 * community — which every viewer already knows — carries no author signal.
 *
 * Do not change this to include a user identifier.
 */
export function communityMediaPathPrefix(communityId: string): string {
  return `communities/${communityId}`;
}

export interface CommunityOwnerView {
  role: OwnerRole;
  displayName: string;
  /** Coach handle for a public page link. Always null for a client owner — clients have no public profile route. */
  handle: string | null;
}

/**
 * How a community owner is presented. A coach owner links to /c/{handle}; a
 * client owner is plain text with a "Client" badge, matching how a
 * client-authored reel is displayed.
 */
export function ownerLinkHref(owner: CommunityOwnerView | null): string | null {
  if (!owner || owner.role !== "coach" || !owner.handle) return null;
  return `/c/${owner.handle}`;
}

/** Default join policy for a brand new user-created community. */
export const DEFAULT_USER_COMMUNITY_JOIN_POLICY: JoinPolicy = "request";
