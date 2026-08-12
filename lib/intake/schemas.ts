import { z } from "zod";

export const parqSchema = z.object({
  cardiacSymptoms: z.coerce.boolean().default(false),
  chestPain: z.coerce.boolean().default(false),
  dizzinessOrLossOfConsciousness: z.coerce.boolean().default(false),
  uncontrolledBloodPressure: z.coerce.boolean().default(false),
  doctorSupervisionRequired: z.coerce.boolean().default(false),
});

export const scoffSchema = z.object({
  makesSelfSick: z.coerce.boolean().default(false),
  lossOfControl: z.coerce.boolean().default(false),
  recentOneStoneLoss: z.coerce.boolean().default(false),
  believesSelfFat: z.coerce.boolean().default(false),
  foodDominatesLife: z.coerce.boolean().default(false),
});

export const submitIntakeSchema = z.object({
  parq: parqSchema,
  scoff: scoffSchema,
  heightCm: z.coerce.number().min(100).max(230),
  sexAtBirth: z.enum(["male", "female", "prefer_not_to_say"]),
  trainingAgeMonths: z.coerce.number().int().min(0).max(600),
  daysAvailable: z.coerce.number().int().min(1).max(7),
  sessionMinutesMax: z.coerce.number().int().min(10).max(240),
  sleepHours: z.coerce.number().min(0).max(16),
  stressLevel: z.coerce.number().int().min(1).max(5),
  pregnancyStatus: z.enum(["not_pregnant", "pregnant", "postpartum", "prefer_not_to_say"]).default("prefer_not_to_say"),
  conditions: z.string().max(500).optional(),
  medications: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export const submitGoalSchema = z.object({
  type: z.enum(["fat_loss", "muscle_gain", "strength", "endurance", "health", "habit"]),
  currentWeightKg: z.coerce.number().min(25).max(350).optional(),
  targetWeightKg: z.coerce.number().min(25).max(350).optional(),
  currentE1rmKg: z.coerce.number().min(1).max(500).optional(),
  targetE1rmKg: z.coerce.number().min(1).max(500).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  whyNow: z.string().max(1000).optional(),
  successDefinition: z.string().max(1000).optional(),
});

export type SubmitIntakeInput = z.infer<typeof submitIntakeSchema>;
export type SubmitGoalInput = z.infer<typeof submitGoalSchema>;
