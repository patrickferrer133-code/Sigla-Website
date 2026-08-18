import { describe, expect, it } from "vitest";
import { saveClientPostSchema, savePostSchema } from "./schemas";

const base = {
  kind: "win",
  title: "First unbroken pull-up",
  bodyMd: "Took eight weeks. Worth it.",
  visibility: "public",
  guidelinesAck: "on",
};

describe("saveClientPostSchema", () => {
  it("accepts a valid client post and splits tags", () => {
    const result = saveClientPostSchema.safeParse({ ...base, tags: "strength, consistency" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tags).toEqual(["strength", "consistency"]);
  });

  it("defaults tags to an empty array when omitted", () => {
    const result = saveClientPostSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tags).toEqual([]);
  });

  it("rejects a post without the guidelines acknowledgement", () => {
    const result = saveClientPostSchema.safeParse({ ...base, guidelinesAck: undefined });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path[0] === "guidelinesAck")).toBe(true);
  });

  it("rejects coach business-content kinds", () => {
    for (const kind of ["case_study", "article", "program_showcase"]) {
      expect(saveClientPostSchema.safeParse({ ...base, kind }).success).toBe(false);
    }
  });

  it("rejects a clients_only visibility, since a client has no clients", () => {
    expect(saveClientPostSchema.safeParse({ ...base, visibility: "clients_only" }).success).toBe(false);
  });

  it("rejects an empty title or body", () => {
    expect(saveClientPostSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
    expect(saveClientPostSchema.safeParse({ ...base, bodyMd: "" }).success).toBe(false);
  });
});

describe("savePostSchema", () => {
  it("still accepts coach business-content kinds and clients_only visibility", () => {
    const result = savePostSchema.safeParse({
      kind: "case_study",
      title: "How Ana added 20kg to her squat",
      bodyMd: "Details.",
      visibility: "clients_only",
    });
    expect(result.success).toBe(true);
  });

  it("does not accept the client-only 'update' kind", () => {
    expect(
      savePostSchema.safeParse({ kind: "update", title: "t", bodyMd: "b", visibility: "public" }).success,
    ).toBe(false);
  });
});
