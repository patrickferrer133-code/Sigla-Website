import { z } from "zod";

export const savePostSchema = z.object({
  kind: z.enum(["case_study", "article", "program_showcase", "video", "win"]),
  title: z.string().trim().min(1).max(160),
  bodyMd: z.string().trim().min(1).max(10_000),
  tags: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.split(",").map((t) => t.trim()).filter(Boolean) : [])),
  visibility: z.enum(["public", "clients_only"]),
});
export type SavePostInput = z.infer<typeof savePostSchema>;
