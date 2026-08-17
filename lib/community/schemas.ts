import { z } from "zod";

export const createPostSchema = z.object({
  communityId: z.string().uuid(),
  bodyMd: z.string().trim().min(1).max(4000),
  isAnonymous: z.coerce.boolean().default(false),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const createCommentSchema = z.object({
  postId: z.string().uuid(),
  bodyMd: z.string().trim().min(1).max(2000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const reportReasonSchema = z.enum([
  "restriction_content",
  "body_shaming",
  "harassment",
  "medical_advice",
  "selling_or_poaching",
  "self_harm_risk",
  "other",
]);

export const createReportSchema = z.object({
  targetType: z.enum(["community_post", "community_comment"]),
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
});
export type CreateReportInput = z.infer<typeof createReportSchema>;
