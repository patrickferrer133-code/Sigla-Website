import { describe, expect, it } from "vitest";
import { announcementIdSchema, saveAnnouncementSchema } from "./schemas";

describe("saveAnnouncementSchema", () => {
  it("accepts a valid announcement and defaults audience to all", () => {
    const parsed = saveAnnouncementSchema.parse({ title: "Maintenance", body: "We're upgrading on Sunday." });
    expect(parsed.audience).toBe("all");
    expect(parsed.title).toBe("Maintenance");
  });

  it("trims whitespace and rejects a whitespace-only title", () => {
    expect(saveAnnouncementSchema.parse({ title: "  Hi  ", body: "x" }).title).toBe("Hi");
    expect(saveAnnouncementSchema.safeParse({ title: "   ", body: "x" }).success).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(saveAnnouncementSchema.safeParse({ title: "Hi", body: "" }).success).toBe(false);
  });

  it("rejects an unknown audience", () => {
    expect(saveAnnouncementSchema.safeParse({ title: "Hi", body: "x", audience: "admins" }).success).toBe(false);
  });

  it("accepts each supported audience", () => {
    for (const audience of ["all", "coaches", "clients"] as const) {
      expect(saveAnnouncementSchema.parse({ title: "Hi", body: "x", audience }).audience).toBe(audience);
    }
  });

  it("enforces length caps", () => {
    expect(saveAnnouncementSchema.safeParse({ title: "a".repeat(141), body: "x" }).success).toBe(false);
    expect(saveAnnouncementSchema.safeParse({ title: "Hi", body: "x".repeat(4001) }).success).toBe(false);
  });
});

describe("announcementIdSchema", () => {
  it("requires a uuid", () => {
    expect(announcementIdSchema.safeParse({ announcementId: "01890a5d-ac96-774b-bcce-b302099a8057" }).success).toBe(true);
    expect(announcementIdSchema.safeParse({ announcementId: "not-a-uuid" }).success).toBe(false);
  });
});
