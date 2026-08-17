import { z } from "zod";

export const createNutritionPlanSchema = z
  .object({
    approach: z.enum(["habit_based", "portion_based", "macros", "meal_plan"]),
    habits: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.split("\n").map((s) => s.trim()).filter(Boolean) : [])),
    activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
    // Negative for a deficit, positive for a surplus, e.g. -15 for a 15% deficit.
    adjustmentPct: z.coerce.number().min(-25).max(25).optional(),
    proteinGPerKg: z.coerce.number().min(1).max(3).optional(),
    fatGPerKg: z.coerce.number().min(0.4).max(1.5).optional(),
    coachNote: z.string().trim().max(2000).optional(),
  })
  .refine(
    (data) => data.approach !== "macros" && data.approach !== "meal_plan" ? true : data.activityLevel !== undefined && data.adjustmentPct !== undefined,
    { message: "Activity level and a deficit/surplus percent are required for macros or a meal plan.", path: ["activityLevel"] },
  );
export type CreateNutritionPlanInput = z.infer<typeof createNutritionPlanSchema>;
