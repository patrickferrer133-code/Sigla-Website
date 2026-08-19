import { describe, expect, it } from "vitest";
import {
  canManageCommunity,
  communityMediaPathPrefix,
  isActiveMember,
  ownerLinkHref,
  resolveJoinOutcome,
} from "./community-ownership";

describe("isActiveMember", () => {
  it("treats a pending request as not a member", () => {
    expect(isActiveMember("pending")).toBe(false);
  });

  it("accepts every approved role", () => {
    for (const role of ["member", "trusted", "coach_moderator", "owner", "admin"] as const) {
      expect(isActiveMember(role)).toBe(true);
    }
  });

  it("treats a missing membership as not a member", () => {
    expect(isActiveMember(null)).toBe(false);
    expect(isActiveMember(undefined)).toBe(false);
  });
});

describe("canManageCommunity", () => {
  it("allows the owner and platform admins only", () => {
    expect(canManageCommunity("owner")).toBe(true);
    expect(canManageCommunity("admin")).toBe(true);
  });

  it("refuses ordinary and elevated non-owner members", () => {
    for (const role of ["pending", "member", "trusted", "coach_moderator"] as const) {
      expect(canManageCommunity(role)).toBe(false);
    }
    expect(canManageCommunity(null)).toBe(false);
  });
});

describe("resolveJoinOutcome", () => {
  it("joins immediately on an open policy", () => {
    expect(resolveJoinOutcome("open", { hasEngagementWithOwner: false })).toEqual({ outcome: "joined", role: "member" });
  });

  it("creates a pending row on a request policy", () => {
    expect(resolveJoinOutcome("request", { hasEngagementWithOwner: false })).toEqual({
      outcome: "requested",
      role: "pending",
    });
  });

  it("requires an engagement for a clients_only policy", () => {
    expect(resolveJoinOutcome("clients_only", { hasEngagementWithOwner: true })).toEqual({
      outcome: "joined",
      role: "member",
    });
    expect(resolveJoinOutcome("clients_only", { hasEngagementWithOwner: false })).toEqual({ outcome: "not_eligible" });
  });
});

describe("communityMediaPathPrefix", () => {
  it("keys on the community, never the author", () => {
    expect(communityMediaPathPrefix("community-1")).toBe("communities/community-1");
  });

  it("contains no author identifier for an anonymous poster (hard rule 4)", () => {
    const prefix = communityMediaPathPrefix("community-1");
    expect(prefix).not.toContain("user-secret-id");
    expect(prefix.split("/")).toEqual(["communities", "community-1"]);
  });
});

describe("ownerLinkHref", () => {
  it("links a coach owner to their public page", () => {
    expect(ownerLinkHref({ role: "coach", displayName: "Ana", handle: "ana-fit" })).toBe("/c/ana-fit");
  });

  it("never links a client owner — clients have no public profile page", () => {
    expect(ownerLinkHref({ role: "client", displayName: "Jose", handle: null })).toBeNull();
  });

  it("does not link a coach with no handle yet", () => {
    expect(ownerLinkHref({ role: "coach", displayName: "Ana", handle: null })).toBeNull();
  });

  it("handles a platform-owned community with no owner", () => {
    expect(ownerLinkHref(null)).toBeNull();
  });
});
