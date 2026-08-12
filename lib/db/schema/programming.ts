import { boolean, integer, jsonb, pgTable, text, date, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestamps } from "./_shared";
import { coachProfiles } from "./identity";
import { engagements } from "./commerce";
import { exercises } from "./exercises";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const programs = pgTable("programs", {
  id: idColumn(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  // Null means this program is a template, not assigned to a client.
  engagementId: uuid("engagement_id").references(() => engagements.id),
  isTemplate: boolean("is_template").notNull().default(false),
  title: text("title").notNull(),
  description: text("description"),
  goalType: text("goal_type"),
  weeksTotal: integer("weeks_total"),
  version: integer("version").notNull().default(1),
  // Version lineage — never destructively edit a program a client is mid-way through.
  parentProgramId: uuid("parent_program_id").references((): AnyPgColumn => programs.id),
  status: text("status", { enum: ["draft", "active", "completed", "archived"] }),
  startsOn: date("starts_on"),
  ...timestamps,
});

export const blocks = pgTable("blocks", {
  id: idColumn(),
  programId: uuid("program_id")
    .notNull()
    .references(() => programs.id),
  name: text("name"),
  focus: text("focus", {
    enum: ["accumulation", "intensification", "realization", "deload", "base"],
  }),
  orderIndex: integer("order_index").notNull().default(0),
  weeks: integer("weeks"),
});

export const programWeeks = pgTable("program_weeks", {
  id: idColumn(),
  blockId: uuid("block_id")
    .notNull()
    .references(() => blocks.id),
  weekNumber: integer("week_number").notNull(),
  isDeload: boolean("is_deload").notNull().default(false),
  coachNote: text("coach_note"),
});

export const sessions = pgTable("sessions", {
  id: idColumn(),
  programWeekId: uuid("program_week_id")
    .notNull()
    .references(() => programWeeks.id),
  name: text("name"),
  // 0 to 6, or null for flexible scheduling.
  dayIndex: integer("day_index"),
  estimatedMinutes: integer("estimated_minutes"),
  coachNote: text("coach_note"),
  orderIndex: integer("order_index").notNull().default(0),
});

export const exerciseGroups = pgTable("exercise_groups", {
  id: idColumn(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id),
  kind: text("kind", {
    enum: ["straight", "superset", "circuit", "giant", "emom", "amrap_block"],
  }).notNull(),
  label: text("label"),
  rounds: integer("rounds"),
  restSeconds: integer("rest_seconds"),
  orderIndex: integer("order_index").notNull().default(0),
});

export const exerciseInstances = pgTable("exercise_instances", {
  id: idColumn(),
  exerciseGroupId: uuid("exercise_group_id")
    .notNull()
    .references(() => exerciseGroups.id),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id),
  orderIndex: integer("order_index").notNull().default(0),
  coachNote: text("coach_note"),
  substitutionAllowed: boolean("substitution_allowed").notNull().default(true),
});

// The load column is deliberately jsonb: { type, value, unit, reference }.
// Do not flatten it into a numeric column — coaches need pct_1rm, rpe, rir,
// bodyweight, band, and relative loads ("last week plus 2.5kg") from day one.
export const setPrescriptions = pgTable("set_prescriptions", {
  id: idColumn(),
  exerciseInstanceId: uuid("exercise_instance_id")
    .notNull()
    .references(() => exerciseInstances.id),
  setNumber: integer("set_number").notNull(),
  setType: text("set_type", {
    enum: ["warmup", "working", "backoff", "drop", "cluster", "myoreps"],
  })
    .notNull()
    .default("working"),
  repsMode: text("reps_mode", {
    enum: ["fixed", "range", "amrap", "time", "distance", "calories"],
  }).notNull(),
  repsMin: integer("reps_min"),
  repsMax: integer("reps_max"),
  durationSeconds: integer("duration_seconds"),
  distanceM: integer("distance_m"),
  load: jsonb("load")
    .$type<{
      type: "kg" | "pct_1rm" | "rpe" | "rir" | "bodyweight" | "band" | "relative";
      value: number | string;
      reference?: string;
    }>()
    .notNull(),
  tempo: text("tempo"),
  restSeconds: integer("rest_seconds"),
  progression: jsonb("progression").$type<{
    model: "double" | "linear" | "pct" | "rpe";
    increment?: number;
    unit?: string;
  }>(),
});
