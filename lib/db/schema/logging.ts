import { boolean, date, integer, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { idColumn } from "./_shared";
import { clientProfiles } from "./identity";
import { engagements } from "./commerce";
import { sessions, setPrescriptions } from "./programming";
import { exercises } from "./exercises";

export const sessionLogs = pgTable("session_logs", {
  id: idColumn(),
  // Null for ad hoc sessions not tied to a prescribed session.
  sessionId: uuid("session_id").references(() => sessions.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clientProfiles.id),
  engagementId: uuid("engagement_id").references(() => engagements.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: text("status", { enum: ["in_progress", "completed", "skipped"] }),
  skipReason: text("skip_reason"),
  sessionRpe: integer("session_rpe"),
  mood: integer("mood"),
  energy: integer("energy"),
  notes: text("notes"),
});

export const setLogs = pgTable("set_logs", {
  id: idColumn(),
  sessionLogId: uuid("session_log_id")
    .notNull()
    .references(() => sessionLogs.id),
  setPrescriptionId: uuid("set_prescription_id").references(() => setPrescriptions.id),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id),
  setNumber: integer("set_number"),
  reps: integer("reps"),
  loadKg: numeric("load_kg"),
  durationSeconds: integer("duration_seconds"),
  distanceM: integer("distance_m"),
  rpe: numeric("rpe"),
  rir: integer("rir"),
  isPr: boolean("is_pr").notNull().default(false),
  painReported: boolean("pain_reported").notNull().default(false),
  painSite: text("pain_site"),
  painScore: integer("pain_score"),
  substitutedFromExerciseId: uuid("substituted_from_exercise_id").references(() => exercises.id),
  loggedAt: timestamp("logged_at", { withTimezone: true }),
});

// Materialized daily rollup for chart performance. e1RM, volume load, and
// adherence are otherwise computed on read, not stored raw.
export const clientMetricsDaily = pgTable(
  "client_metrics_daily",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clientProfiles.id),
    date: date("date").notNull(),
    bodyweightKg: numeric("bodyweight_kg"),
    // 7 day rolling average — this is the number we display.
    bodyweightTrendKg: numeric("bodyweight_trend_kg"),
    steps: integer("steps"),
    sleepHours: numeric("sleep_hours"),
    sessionsPrescribed: integer("sessions_prescribed"),
    sessionsCompleted: integer("sessions_completed"),
    volumeLoadKg: numeric("volume_load_kg"),
  },
  (table) => [primaryKey({ columns: [table.clientId, table.date] })],
);
