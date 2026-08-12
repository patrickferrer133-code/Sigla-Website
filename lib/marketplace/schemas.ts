import { z } from "zod";

export const discoverFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  specialty: z.string().trim().max(50).optional(),
  mode: z.enum(["online", "in_person", "hybrid"]).optional(),
  city: z.string().trim().max(100).optional(),
});
export type DiscoverFilters = z.infer<typeof discoverFiltersSchema>;

export const applyToPackageSchema = z.object({
  packageId: z.string().uuid(),
});
export type ApplyToPackageInput = z.infer<typeof applyToPackageSchema>;

export const savePackageSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  priceCents: z.coerce.number().int().min(0).max(100_000_00),
  currency: z.string().trim().length(3).default("PHP"),
  billingPeriod: z.enum(["one_time", "monthly", "quarterly", "per_12_weeks"]),
  inclusions: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.split("\n").map((s) => s.trim()).filter(Boolean) : [])),
  slotLimit: z.coerce.number().int().min(1).max(1000).optional(),
});
export type SavePackageInput = z.infer<typeof savePackageSchema>;

export const submitReviewSchema = z.object({
  engagementId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional(),
});
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

export const saveCoachProfileSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only."),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(4000).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
  specialties: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])),
  languages: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])),
  coachingMode: z.array(z.enum(["online", "in_person", "hybrid"])).default([]),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  acceptingClients: z.coerce.boolean().default(false),
});
export type SaveCoachProfileInput = z.infer<typeof saveCoachProfileSchema>;
