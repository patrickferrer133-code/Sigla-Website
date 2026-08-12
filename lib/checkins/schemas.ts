import { z } from "zod";

// A shared 20-250cm bound would let a waist typed in inches ("32") pass
// validation and silently corrupt the series — per-field bounds instead.
const dailyWeightsSchema = z
  .array(z.coerce.number().min(25).max(350).multipleOf(0.1).nullable())
  .length(7);

export const submitCheckinSchema = z.object({
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyWeightsKg: dailyWeightsSchema,
  waistCm: z.coerce.number().min(40).max(200).optional(),
  hipCm: z.coerce.number().min(50).max(200).optional(),
  chestCm: z.coerce.number().min(50).max(200).optional(),
  armCm: z.coerce.number().min(15).max(80).optional(),
  thighCm: z.coerce.number().min(25).max(120).optional(),
  adherenceTrainingPct: z.coerce.number().int().min(0).max(100).optional(),
  adherenceNutritionPct: z.coerce.number().int().min(0).max(100).optional(),
  avgSteps: z.coerce.number().int().min(0).max(50000).optional(),
  avgSleepHours: z.coerce.number().min(2).max(14).multipleOf(0.5).optional(),
  energy: z.coerce.number().int().min(1).max(5).optional(),
  hunger: z.coerce.number().int().min(1).max(5).optional(),
  stress: z.coerce.number().int().min(1).max(5).optional(),
  motivation: z.coerce.number().int().min(1).max(5).optional(),
  soreness: z.coerce.number().int().min(1).max(5).optional(),
  mood: z.coerce.number().int().min(1).max(5).optional(),
  wentWell: z.string().max(2000).trim().optional(),
  gotInTheWay: z.string().max(2000).trim().optional(),
});

export const replyToCheckinSchema = z.object({
  checkinId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export type SubmitCheckinInput = z.infer<typeof submitCheckinSchema>;
export type ReplyToCheckinInput = z.infer<typeof replyToCheckinSchema>;
