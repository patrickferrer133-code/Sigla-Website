// docs/06 section 5 + section 9. Community post media must not reach the
// PUBLIC post-media bucket unless the uploader is an ACTIVE member of that
// community.
//
// Why this is a safety test and not just an authz test: an object uploaded
// before the membership check is attached to no post row. It is therefore
// invisible to listPostsForCommunity, to the report button, to the moderation
// queue, and to every delete path — a permanent, publicly-addressable, wholly
// unmoderated piece of user content. A `pending` member (join requested, not
// approved) or a complete non-member can produce one today by posting into any
// community id.
//
// Blocks merges (CLAUDE.md hard rule 1) — do not edit this test to make it
// pass. Fix the ordering in createPostAction instead.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireAnyRole = vi.fn();
vi.mock("@/lib/auth/require-role", () => ({ requireAnyRole: () => requireAnyRole() }));

const uploadCommunityPostMedia = vi.fn();
const createPost = vi.fn();
vi.mock("@/lib/community/service", () => ({
  uploadCommunityPostMedia: (...args: unknown[]) => uploadCommunityPostMedia(...args),
  createPost: (...args: unknown[]) => createPost(...args),
  createComment: vi.fn(),
  createCommunity: vi.fn(),
  createReport: vi.fn(),
  joinCommunity: vi.fn(),
  resolveJoinRequest: vi.fn(),
  updateCommunityCoverPhoto: vi.fn(),
  clientHasEngagementWithCommunityOwner: vi.fn(),
}));
vi.mock("@/lib/community/owner", () => ({ getCommunityOwnerIdentity: vi.fn() }));
vi.mock("@/lib/logging/service", () => ({ getClientProfileIdForUser: vi.fn() }));

const COMMUNITY_ID = "3f1c8b9e-0000-4000-8000-000000000001";

function formDataWithMedia() {
  const fd = new FormData();
  fd.set("bodyMd", "hello");
  fd.set("media", new File([new Uint8Array([0, 1, 2])], "clip.mp4", { type: "video/mp4" }));
  return fd;
}

describe("community post media requires an active membership before upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAnyRole.mockResolvedValue({ id: "user-1", role: "client" });
    // The user is not an active member: `pending`, or never joined at all.
    createPost.mockResolvedValue({ ok: false, error: { code: "not_a_member" } });
    uploadCommunityPostMedia.mockResolvedValue({ ok: true, data: { type: "video", url: "https://example.test/x.mp4" } });
  });

  it("does not upload anything to the public bucket for a non-active member", async () => {
    const { createPostAction } = await import("./actions");
    const state = await createPostAction(COMMUNITY_ID, { status: "idle" }, formDataWithMedia());

    expect(state.status).toBe("error");
    expect(uploadCommunityPostMedia).not.toHaveBeenCalled();
  });
});
