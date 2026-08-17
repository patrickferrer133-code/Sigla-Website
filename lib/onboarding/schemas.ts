import { z } from "zod";

export const clientOnboardingSchema = z.object({
  dateOfBirth: z.string().min(1, "Enter your date of birth."),
  sexAtBirth: z.enum(["male", "female", "prefer_not_to_say"]),
  heightCm: z.coerce.number().min(100).max(250),
  equipmentAccess: z
    .array(z.enum(["full_gym", "home_dumbbells", "home_barbell", "bands_only", "bodyweight_only"]))
    .default([]),
});
export type ClientOnboardingInput = z.infer<typeof clientOnboardingSchema>;

export const coachOnboardingSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only."),
  headline: z.string().trim().max(160).optional(),
  specialties: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])),
});
export type CoachOnboardingInput = z.infer<typeof coachOnboardingSchema>;
