import { z } from "zod";

export const createPostSchema = z.object({
  communityId: z.string().uuid(),
  bodyMd: z.string().trim().min(1).max(4000),
  isAnonymous: z.coerce.boolean().default(false),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

// A user-created community is never `clients_only` — that policy only means
// something for a coach's own client space. `request` is the default so a new
// group is not silently open to the whole platform.
export const createCommunitySchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500).optional(),
  joinPolicy: z.enum(["open", "request"]).default("request"),
});
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

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
  // coach_post is the shared posts table (coach- and client-authored posts,
  // including reels).
  targetType: z.enum(["community_post", "community_comment", "coach_post"]),
  targetId: z.string().uuid(),
  reason: reportReasonSchema,
});
export type CreateReportInput = z.infer<typeof createReportSchema>;
