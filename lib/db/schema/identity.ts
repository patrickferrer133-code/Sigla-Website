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
import { citext, idColumn, softDelete, timestamps } from "./_shared";

export const users = pgTable("users", {
  id: idColumn(),
  email: citext("email").notNull().unique(),
  phone: text("phone"),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["coach", "client", "admin"] }).notNull(),
  locale: text("locale").notNull().default("en-PH"),
  timezone: text("timezone").notNull().default("Asia/Manila"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  ...timestamps,
  ...softDelete,
});

export const coachProfiles = pgTable("coach_profiles", {
  id: idColumn(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  handle: citext("handle").notNull().unique(),
  headline: text("headline"),
  bio: text("bio"),
  yearsExperience: integer("years_experience"),
  specialties: text("specialties").array(),
  languages: text("languages").array(),
  // online, in_person, hybrid — a coach can offer more than one.
  coachingMode: text("coaching_mode").array(),
  city: text("city"),
  country: text("country"),
  // [{name, issuer, issued_at, expires_at, verified, evidence_url}]
  credentials: jsonb("credentials"),
  verificationStatus: text("verification_status", {
    enum: ["unverified", "pending", "verified"],
  })
    .notNull()
    .default("unverified"),
  introVideoUrl: text("intro_video_url"),
  tier: text("tier", { enum: ["free", "pro", "premium"] })
    .notNull()
    .default("free"),
  acceptingClients: boolean("accepting_clients").notNull().default(true),
  ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }),
  ratingCount: integer("rating_count").notNull().default(0),
  ...timestamps,
});

export const clientProfiles = pgTable("client_profiles", {
  id: idColumn(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  dateOfBirth: date("date_of_birth"),
  // Required by BMR formulas (docs/01 section 9). Never rendered publicly.
  // "prefer_not_to_say" falls back to an average-based formula.
  sexAtBirth: text("sex_at_birth", { enum: ["male", "female", "prefer_not_to_say"] }),
  heightCm: numeric("height_cm"),
  trainingAgeMonths: integer("training_age_months"),
  equipmentAccess: text("equipment_access").array(),
  // {hide_weight, hide_photos, anonymous_in_community}
  privacyPrefs: jsonb("privacy_prefs")
    .$type<{
      hideWeight: boolean;
      hidePhotos: boolean;
      anonymousInCommunity: boolean;
    }>()
    .notNull()
    .default({ hideWeight: true, hidePhotos: true, anonymousInCommunity: true }),
  ...timestamps,
});
