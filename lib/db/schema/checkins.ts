import { integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid, date } from "drizzle-orm/pg-core";
import { idColumn } from "./_shared";
import { clientProfiles } from "./identity";
import { engagements } from "./commerce";

// Photos are stored as private object storage keys and served only through
// short-lived signed URLs. Never store a public URL for a progress photo
// (docs/06 section 3, CLAUDE.md hard rule 3).
export const checkins = pgTable(
  "checkins",
  {
    id: idColumn(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clientProfiles.id),
    weekOf: date("week_of").notNull(),
    bodyweightKg: numeric("bodyweight_kg"),
    measurements: jsonb("measurements").$type<{
      waistCm?: number;
      hipCm?: number;
      chestCm?: number;
      armCm?: number;
      thighCm?: number;
    }>(),
    photoKeys: text("photo_keys").array(),
    adherenceTrainingPct: integer("adherence_training_pct"),
    adherenceNutritionPct: integer("adherence_nutrition_pct"),
    avgSteps: integer("avg_steps"),
    avgSleepHours: numeric("avg_sleep_hours"),
    energy: integer("energy"),
    hunger: integer("hunger"),
    stress: integer("stress"),
    motivation: integer("motivation"),
    soreness: integer("soreness"),
    mood: integer("mood"),
    wentWell: text("went_well"),
    gotInTheWay: text("got_in_the_way"),
    coachReply: text("coach_reply"),
    coachRepliedAt: timestamp("coach_replied_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.engagementId, table.weekOf)],
);
