import { boolean, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestamps } from "./_shared";
import { clientProfiles } from "./identity";
import { engagements } from "./commerce";

// docs/01 section 9's burden ladder. habit_based and portion_based carry no
// numeric target at all — no BMR/TDEE calculation runs for them, so the
// clearance gate in canGenerateNutritionTarget (lib/domain/safety.ts) only
// applies to macros and meal_plan.
export const nutritionPlans = pgTable("nutrition_plans", {
  id: idColumn(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clientProfiles.id),
  engagementId: uuid("engagement_id")
    .notNull()
    .references(() => engagements.id),
  approach: text("approach", { enum: ["habit_based", "portion_based", "macros", "meal_plan"] }).notNull(),
  habits: text("habits").array(),
  // Only populated for macros/meal_plan. calorieTargetKcal is always the
  // post-floor-clamp figure — the pre-clamp requested value is never stored,
  // so there is no code path that could accidentally surface it to a client
  // (docs/06 section 3: "does not show the client the unclamped figure").
  calorieTargetKcal: integer("calorie_target_kcal"),
  proteinG: numeric("protein_g"),
  fatG: numeric("fat_g"),
  carbsG: numeric("carbs_g"),
  wasClampedToFloor: boolean("was_clamped_to_floor").notNull().default(false),
  coachNote: text("coach_note"),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  ...timestamps,
});
