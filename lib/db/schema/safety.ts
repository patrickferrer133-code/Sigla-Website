import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { idColumn } from "./_shared";
import { clientProfiles, users } from "./identity";
import { engagements } from "./commerce";

export const intakes = pgTable("intakes", {
  id: idColumn(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clientProfiles.id),
  // Null if self-serve (not yet attached to a coaching engagement).
  engagementId: uuid("engagement_id").references(() => engagements.id),
  parqAnswers: jsonb("parq_answers").notNull(),
  parqFlagged: boolean("parq_flagged").notNull().default(false),
  medicalClearanceStatus: text("medical_clearance_status", {
    enum: ["not_required", "required", "uploaded", "approved"],
  }),
  medicalClearanceUrl: text("medical_clearance_url"),
  // [{site, side, onset, pain_now_0_10, aggravating_movements[]}]
  injuries: jsonb("injuries"),
  conditions: text("conditions").array(),
  medications: text("medications").array(),
  pregnancyStatus: text("pregnancy_status"),
  daysAvailable: integer("days_available"),
  sessionMinutesMax: integer("session_minutes_max"),
  sleepHours: numeric("sleep_hours"),
  stressLevel: integer("stress_level"),
  stepBaseline: integer("step_baseline"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});

export const goals = pgTable("goals", {
  id: idColumn(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clientProfiles.id),
  type: text("type", {
    enum: ["fat_loss", "muscle_gain", "strength", "endurance", "health", "habit"],
  }).notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  targetMetric: text("target_metric", {
    enum: ["bodyweight_kg", "waist_cm", "e1rm_kg", "sessions_per_week", "steps"],
  }),
  targetValue: numeric("target_value"),
  targetDate: date("target_date"),
  whyNow: text("why_now"),
  successDefinition: text("success_definition"),
  realismVerdict: text("realism_verdict", {
    enum: ["realistic", "stretch", "reframed", "blocked"],
  }),
  realismSuggestedValue: numeric("realism_suggested_value"),
  realismSuggestedDate: date("realism_suggested_date"),
  status: text("status", {
    enum: ["active", "achieved", "revised", "abandoned"],
  })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// safety_flags with severity 'block' must prevent program assignment and
// nutrition targets until resolved. Enforced at the service layer (see
// /lib/domain/safety.ts), not the UI layer.
export const safetyFlags = pgTable("safety_flags", {
  id: idColumn(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clientProfiles.id),
  kind: text("kind", {
    enum: ["parq_cardiac", "pain_report", "ed_risk", "underweight_target", "rapid_loss"],
  }).notNull(),
  severity: text("severity", { enum: ["info", "warn", "block"] }).notNull(),
  payload: jsonb("payload"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => users.id),
});
