// Companion to client-posts.safety.test.ts. Same intent (docs/06 section 5:
// client posts run through the same keyword auto-flag -> human review
// pipeline as community posts), but the db mock here resolves the table name
// through drizzle's public getTableName() rather than a `_.name` property,
// which drizzle 0.45 does not expose — see the note in the report accompanying
// this change.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { getTableName, type Table } from "drizzle-orm";

const inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
const storageCalls: Array<{ op: string; arg: unknown }> = [];

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/client", async () => {
  const { getTableName: name } = await import("drizzle-orm");
  const selectChain = {
    select: () => selectChain,
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => selectChain,
    orderBy: () => selectChain,
    limit: () => Promise.resolve([{ id: "post-1", media: { type: "image", url: "https://pub/post-media/client-1/abc.jpg" } }]),
  };
  return {
    db: {
      ...selectChain,
      insert: (table: Table) => ({
        values: (values: Record<string, unknown>) => {
          inserted.push({ table: name(table), values });
          return { returning: () => Promise.resolve([{ id: "post-1" }]) };
        },
      }),
      delete: () => ({ where: () => Promise.resolve() }),
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: (_path: string, file: unknown) => {
          storageCalls.push({ op: "upload", arg: file });
          return Promise.resolve({ error: null });
        },
        remove: (paths: unknown) => {
          storageCalls.push({ op: "remove", arg: paths });
          return Promise.resolve({ error: null });
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://pub/post-media/${path}` } }),
      }),
    },
  }),
}));

const service = await import("./service");

beforeEach(() => {
  inserted.length = 0;
  storageCalls.length = 0;
});

const basePost = {
  kind: "update" as const,
  title: "Week 6",
  tags: [],
  visibility: "public" as const,
  guidelinesAck: "on" as const,
};

function reportRow() {
  return inserted.find((row) => row.table === "reports");
}

describe("createClientPost moderation pipeline", () => {
  it("sanity-checks that the mock sees real table names", async () => {
    await service.createClientPost("client-1", { ...basePost, bodyMd: "Nothing to flag here." }, null);
    expect(inserted.map((row) => row.table)).toContain("coach_posts");
    expect(getTableName).toBeTypeOf("function");
  });

  it("auto-flags restriction content into an open report for human review", async () => {
    await service.createClientPost("client-1", { ...basePost, bodyMd: "Down to 900 calories a day and my goal weight is close." }, null);

    const report = reportRow();
    expect(report).toBeDefined();
    expect(report?.values.targetType).toBe("coach_post");
    expect(report?.values.source).toBe("auto_flag");
    expect(report?.values.reason).toBe("restriction_content");
    expect(report?.values.status).toBe("open");
    expect(report?.values.reporterUserId ?? null).toBeNull();
  });

  it("auto-flags crisis language as self_harm_risk and signals the caller", async () => {
    const result = await service.createClientPost("client-1", { ...basePost, bodyMd: "I want to die, nothing is working." }, null);

    expect(reportRow()?.values.reason).toBe("self_harm_risk");
    expect(result.ok && result.data.flagged).toBe(true);
  });

  it("scans the title as well as the body", async () => {
    await service.createClientPost("client-1", { ...basePost, title: "I want to die", bodyMd: "Rest day." }, null);
    expect(reportRow()?.values.reason).toBe("self_harm_risk");
  });

  it("never hides or deletes a flagged post", async () => {
    const result = await service.createClientPost("client-1", { ...basePost, bodyMd: "I want to die." }, null);
    expect(result.ok).toBe(true);
    expect(storageCalls.some((c) => c.op === "remove")).toBe(false);
  });

  it("leaves an ordinary post unflagged", async () => {
    const result = await service.createClientPost("client-1", { ...basePost, bodyMd: "First unassisted pull-up today." }, null);
    expect(reportRow()).toBeUndefined();
    expect(result.ok && result.data.flagged).toBe(false);
  });

  it("records the guidelines acknowledgment with its version", async () => {
    await service.createClientPost("client-1", { ...basePost, bodyMd: "Good week." }, null);

    const post = inserted.find((row) => row.table === "coach_posts");
    expect(post?.values.guidelinesAckedAt).toBeInstanceOf(Date);
    expect(post?.values.guidelinesAckVersion).toBe(service.CLIENT_POST_GUIDELINES_VERSION);
  });
});

describe("post media deletion", () => {
  it("removes the storage object on owner delete", async () => {
    await service.deleteClientPost("client-1", "post-1");
    expect(storageCalls.find((c) => c.op === "remove")?.arg).toEqual(["client-1/abc.jpg"]);
  });

  it("removes the storage object on admin takedown", async () => {
    await service.takeDownPost("post-1");
    expect(storageCalls.find((c) => c.op === "remove")?.arg).toEqual(["client-1/abc.jpg"]);
  });

  it("ignores media hosted outside the post-media bucket", () => {
    expect(service.postMediaStoragePath("https://example.com/elsewhere/a.jpg")).toBeNull();
    expect(service.postMediaStoragePath("https://pub/post-media/client-1/abc.jpg")).toBe("client-1/abc.jpg");
  });
});

describe("image upload sanitisation", () => {
  it("uploads re-encoded bytes, never the original File", async () => {
    const raw = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10])], "gym.jpg", { type: "image/jpeg" });
    const result = await service.uploadPostMedia("client-1", raw);

    expect(result.ok).toBe(true);
    const upload = storageCalls.find((c) => c.op === "upload");
    expect(upload?.arg).not.toBe(raw);
    expect(upload?.arg).toBeInstanceOf(Uint8Array);
  });

  it("uploads video files unchanged (transcode-based stripping is out of scope)", async () => {
    const raw = new File([new Uint8Array([0x00, 0x00, 0x00, 0x18])], "clip.mp4", { type: "video/mp4" });
    await service.uploadPostMedia("client-1", raw);
    expect(storageCalls.find((c) => c.op === "upload")?.arg).toBe(raw);
  });
});
