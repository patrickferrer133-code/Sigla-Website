import { z } from "zod";

const tagsField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.split(",").map((t) => t.trim()).filter(Boolean) : []));

export const savePostSchema = z.object({
  kind: z.enum(["case_study", "article", "program_showcase", "video", "win"]),
  title: z.string().trim().min(1).max(160),
  bodyMd: z.string().trim().min(1).max(10_000),
  tags: tagsField,
  visibility: z.enum(["public", "clients_only"]),
});
export type SavePostInput = z.infer<typeof savePostSchema>;

// Clients get a personal-post kind set, not the coach business-content kinds
// (case_study / program_showcase / article are marketing artifacts).
export const saveClientPostSchema = z.object({
  kind: z.enum(["win", "video", "update"]),
  title: z.string().trim().min(1).max(160),
  bodyMd: z.string().trim().min(1).max(10_000),
  tags: tagsField,
  // Client posts are public or nothing: there is no "clients_only" audience
  // for a client, since a client has no clients. Kept as an enum so the
  // shape stays compatible with the shared insert path.
  visibility: z.literal("public"),
  // docs/06 section 3 and 5: no before/after or progress-photo content in
  // shared spaces. The client must affirm this before the post goes public.
  guidelinesAck: z.literal("on", { message: "You must confirm the posting guidelines." }),
});
export type SaveClientPostInput = z.infer<typeof saveClientPostSchema>;
