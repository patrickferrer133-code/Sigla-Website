// docs/06 section 9 safety test 6, extended to community post MEDIA.
//
// Text posts were already covered by anonymity.safety.test.ts. Now that a
// post can carry an image or video, the media URL is a second channel through
// which the author of an anonymous post could be identified: the bucket is
// public, and coach/client post media is stored under `<profileId>/...`. A
// community post must never use an author-derived prefix.
//
// Blocks merges (CLAUDE.md hard rule 1) — do not edit this test to make it
// pass.

import { describe, expect, it, vi } from "vitest";
import { communityMediaPathPrefix } from "@/lib/domain/community-ownership";

vi.mock("server-only", () => ({}));

const COMMUNITY_ID = "3f1c8b9e-0000-4000-8000-000000000001";
const AUTHOR_USER_ID = "user-secret-id";
const AUTHOR_PROFILE_ID = "client-profile-secret";

describe("safety test 6 (media): community post media paths carry no author identity", () => {
  it("prefixes on the community, never the author", () => {
    const prefix = communityMediaPathPrefix(COMMUNITY_ID);
    expect(prefix).toContain(COMMUNITY_ID);
    expect(prefix).not.toContain(AUTHOR_USER_ID);
    expect(prefix).not.toContain(AUTHOR_PROFILE_ID);
  });

  it("produces a stored path whose every segment is community-derived or random", async () => {
    const captured: string[] = [];

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        storage: {
          from: () => ({
            upload: (path: string) => {
              captured.push(path);
              return Promise.resolve({ error: null });
            },
            getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.test/post-media/${path}` } }),
          }),
        },
      }),
    }));
    vi.doMock("@/lib/db/client", () => ({ db: {} }));

    const { uploadPostMedia } = await import("@/lib/content/service");

    // A video is uploaded byte-for-byte, so it exercises the path builder
    // without needing sharp to decode anything.
    const file = new File([new Uint8Array([0, 1, 2])], "maria-santos-at-home.mp4", { type: "video/mp4" });
    const result = await uploadPostMedia(communityMediaPathPrefix(COMMUNITY_ID), file);

    expect(result.ok).toBe(true);
    expect(captured).toHaveLength(1);
    const storedPath = captured[0];

    expect(storedPath.startsWith(`communities/${COMMUNITY_ID}/`)).toBe(true);
    expect(storedPath).not.toContain(AUTHOR_USER_ID);
    expect(storedPath).not.toContain(AUTHOR_PROFILE_ID);
    // The original file name can itself identify a person; only the extension
    // is carried over.
    expect(storedPath).not.toContain("maria-santos");

    if (result.ok) {
      expect(result.data.url).not.toContain(AUTHOR_USER_ID);
      expect(result.data.url).not.toContain("maria-santos");
    }
  });
});
