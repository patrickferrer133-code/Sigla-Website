import { boolean, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestamps } from "./_shared";
import { coachProfiles } from "./identity";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// Coach private exercises reuse this table with is_global = false and
// owner_coach_id set. Do not build a second table for them.
export const exercises = pgTable("exercises", {
  id: idColumn(),
  name: text("name").notNull(),
  aliases: text("aliases").array(),
  primaryMuscle: text("primary_muscle").notNull(),
  secondaryMuscles: text("secondary_muscles").array(),
  movementPattern: text("movement_pattern", {
    enum: [
      "squat",
      "hinge",
      "h_push",
      "h_pull",
      "v_push",
      "v_pull",
      "lunge",
      "carry",
      "rotation",
      "anti_rotation",
      "isolation",
      "conditioning",
    ],
  }).notNull(),
  equipment: text("equipment").array().notNull(),
  isUnilateral: boolean("is_unilateral").notNull().default(false),
  loadingType: text("loading_type", {
    enum: ["external", "bodyweight", "bw_plus_load", "time", "distance", "calories"],
  }).notNull(),
  difficulty: integer("difficulty"),
  substitutionGroup: text("substitution_group"),
  progressionOf: uuid("progression_of").references((): AnyPgColumn => exercises.id),
  contraindications: text("contraindications").array(),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  cues: text("cues").array(),
  isGlobal: boolean("is_global").notNull().default(true),
  ownerCoachId: uuid("owner_coach_id").references(() => coachProfiles.id),
  ...timestamps,
});
