import { z } from "zod";

export const logSetSchema = z.object({
  sessionLogId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  setPrescriptionId: z.string().uuid().optional(),
  setNumber: z.coerce.number().int().min(1).max(20),
  reps: z.coerce.number().int().min(0).max(200),
  loadKg: z.coerce.number().min(0).max(500),
  rpe: z.coerce.number().min(1).max(10).optional(),
  painReported: z.coerce.boolean().default(false),
  painScore: z.coerce.number().int().min(0).max(10).optional(),
  painSite: z.string().max(60).optional(),
});

export const completeSessionSchema = z.object({
  sessionLogId: z.string().uuid(),
  sessionRpe: z.coerce.number().int().min(1).max(10).optional(),
});
