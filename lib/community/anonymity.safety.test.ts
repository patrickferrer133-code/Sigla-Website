// docs/06 section 9 safety test 6, applied to the REAL read path.
//
// The existing test in lib/access/policies.safety.test.ts covers
// serializeCommunityPost, which the community feature does not actually call.
// The path a client request really takes is listPostsForCommunity, so that is
// what has to be pinned. Blocks merges (CLAUDE.md hard rule 1) — do not edit
// this test to make it pass.

import { describe, expect, it, vi, beforeEach } from "vitest";

const rows = [
  {
    id: "post-anon",
    bodyMd: "I have not trained in 3 weeks and I feel like giving up.",
    isAnonymous: true,
    createdAt: new Date("2026-01-01"),
    authorUserId: "user-secret-id",
    authorDisplayName: "Maria Santos",
    authorAlias: "Quiet Otter 314",
  },
  {
    id: "post-named",
    bodyMd: "Hit a 100kg squat today.",
    isAnonymous: false,
    createdAt: new Date("2026-01-02"),
    authorUserId: "user-public-id",
    authorDisplayName: "Jose Cruz",
    authorAlias: "Bold Falcon 777",
  },
  {
    id: "post-anon-no-membership",
    bodyMd: "Struggling this week.",
    isAnonymous: true,
    createdAt: new Date("2026-01-03"),
    authorUserId: "user-secret-2",
    authorDisplayName: "Ana Reyes",
    authorAlias: null,
  },
];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return { db: chain };
});

const { listPostsForCommunity } = await import("./service");

describe("safety test 6 (real path): listPostsForCommunity never returns author_user_id", () => {
  let posts: Awaited<ReturnType<typeof listPostsForCommunity>>;

  beforeEach(async () => {
    posts = await listPostsForCommunity("community-1");
  });

  it("excludes authorUserId structurally from every post, anonymous or not", () => {
    for (const post of posts) {
      expect(Object.keys(post)).not.toContain("authorUserId");
      expect(Object.keys(post)).not.toContain("author_user_id");
    }
  });

  it("leaks no author user id anywhere in the serialized payload", () => {
    const serialized = JSON.stringify(posts);
    expect(serialized).not.toContain("user-secret-id");
    expect(serialized).not.toContain("user-secret-2");
  });

  it("shows the stable alias, never the real display name, for an anonymous post", () => {
    const anon = posts.find((p) => p.id === "post-anon");
    expect(anon?.displayName).toBe("Quiet Otter 314");
    expect(anon?.displayName).not.toBe("Maria Santos");
  });

  it("falls back to a non-identifying label when an anonymous author has no alias row", () => {
    const anon = posts.find((p) => p.id === "post-anon-no-membership");
    expect(anon?.displayName).toBe("Anonymous");
    expect(anon?.displayName).not.toBe("Ana Reyes");
  });

  it("still shows the real display name for a non-anonymous post", () => {
    const named = posts.find((p) => p.id === "post-named");
    expect(named?.displayName).toBe("Jose Cruz");
  });
});
