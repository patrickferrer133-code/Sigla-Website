import { z } from "zod";

export const createTemplateSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  goalType: z.enum(["fat_loss", "muscle_gain", "strength", "endurance", "health", "habit"]).optional(),
});

export const addWeekSchema = z.object({
  blockId: z.string().uuid(),
});

export const addSessionSchema = z.object({
  programWeekId: z.string().uuid(),
  name: z.string().min(1).max(120),
  dayIndex: z.coerce.number().int().min(0).max(6).optional(),
});

export const setInputSchema = z.object({
  repsMin: z.coerce.number().int().min(1).max(100),
  repsMax: z.coerce.number().int().min(1).max(100),
  loadKg: z.coerce.number().min(0).max(500),
});

export const addExerciseToSessionSchema = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  restSeconds: z.coerce.number().int().min(0).max(600).default(90),
  sets: z.array(setInputSchema).min(1).max(10),
});

export const deleteEntitySchema = z.object({
  id: z.string().uuid(),
});

export const assignProgramSchema = z.object({
  templateProgramId: z.string().uuid(),
  engagementId: z.string().uuid(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type AddSessionInput = z.infer<typeof addSessionSchema>;
export type AddExerciseToSessionInput = z.infer<typeof addExerciseToSessionSchema>;
export type AssignProgramInput = z.infer<typeof assignProgramSchema>;
