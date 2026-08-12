import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { citext, idColumn } from "./_shared";
import { coachProfiles, users } from "./identity";

export const pipelineStages = pgTable("pipeline_stages", {
  id: idColumn(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  name: text("name").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  isWon: boolean("is_won").notNull().default(false),
  isLost: boolean("is_lost").notNull().default(false),
});

export const leads = pgTable("leads", {
  id: idColumn(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  source: text("source", {
    enum: ["quiz", "profile_cta", "post", "referral", "import"],
  }),
  email: citext("email"),
  name: text("name"),
  phone: text("phone"),
  quizAnswers: jsonb("quiz_answers"),
  score: integer("score"),
  stageId: uuid("stage_id").references(() => pipelineStages.id),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  status: text("status", {
    enum: ["new", "contacted", "qualified", "proposal", "won", "lost"],
  })
    .notNull()
    .default("new"),
  lostReason: text("lost_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadEvents = pgTable("lead_events", {
  id: idColumn(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id),
  kind: text("kind", {
    enum: ["viewed_profile", "submitted_quiz", "booked_call", "no_show", "sent_proposal"],
  }).notNull(),
  payload: jsonb("payload"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sequences = pgTable("sequences", {
  id: idColumn(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  name: text("name").notNull(),
  trigger: text("trigger", {
    enum: [
      "quiz_completed",
      "lead_created",
      "stage_changed",
      "no_reply_after_n_days",
      "call_no_show",
      "engagement_ended",
    ],
  }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const sequenceSteps = pgTable("sequence_steps", {
  id: idColumn(),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => sequences.id),
  orderIndex: integer("order_index").notNull().default(0),
  delayHours: integer("delay_hours").notNull().default(0),
  // SMS only with explicit consent (docs/05 section 4).
  channel: text("channel", { enum: ["email", "in_app", "sms"] }).notNull(),
  templateMd: text("template_md").notNull(),
});

// Sending refuses without a stored consent record and honors a global
// unsubscribe (docs/06 safety test 8, docs/05 section 4).
export const sequenceEnrollments = pgTable("sequence_enrollments", {
  id: idColumn(),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => sequences.id),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id),
  currentStep: integer("current_step").notNull().default(0),
  status: text("status", { enum: ["active", "completed", "unsubscribed", "paused"] })
    .notNull()
    .default("active"),
  nextSendAt: timestamp("next_send_at", { withTimezone: true }),
});
