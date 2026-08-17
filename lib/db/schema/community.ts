import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { idColumn } from "./_shared";
import { coachProfiles, users } from "./identity";
import { engagements } from "./commerce";

export const coachPosts = pgTable("coach_posts", {
  id: idColumn(),
  coachId: uuid("coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  kind: text("kind", {
    enum: ["case_study", "article", "program_showcase", "video", "win"],
  }),
  title: text("title"),
  bodyMd: text("body_md"),
  media: jsonb("media").$type<{ type: "image" | "video"; url: string } | null>(),
  tags: text("tags").array(),
  visibility: text("visibility", { enum: ["public", "clients_only"] }),
  // Requires the platform tier's content push entitlement.
  isPromoted: boolean("is_promoted").notNull().default(false),
  promotedUntil: timestamp("promoted_until", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communities = pgTable("communities", {
  id: idColumn(),
  kind: text("kind", { enum: ["global_goal", "coach_private"] }).notNull(),
  ownerCoachId: uuid("owner_coach_id").references(() => coachProfiles.id),
  name: text("name").notNull(),
  description: text("description"),
  goalTag: text("goal_tag"),
  joinPolicy: text("join_policy", { enum: ["open", "request", "clients_only"] }).notNull(),
});

export const communityMemberships = pgTable("community_memberships", {
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role", { enum: ["member", "trusted", "coach_moderator", "admin"] })
    .notNull()
    .default("member"),
  displayAlias: text("display_alias").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

// author_user_id must never be exposed for a post with is_anonymous = true
// to any non-admin caller — strip it at the serializer, never rely on the
// client to hide it (docs/03 section 11, CLAUDE.md hard rule 4).
export const communityPosts = pgTable("community_posts", {
  id: idColumn(),
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.id),
  authorUserId: uuid("author_user_id")
    .notNull()
    .references(() => users.id),
  bodyMd: text("body_md").notNull(),
  media: jsonb("media"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityComments = pgTable("community_comments", {
  id: idColumn(),
  postId: uuid("post_id")
    .notNull()
    .references(() => communityPosts.id),
  authorUserId: uuid("author_user_id")
    .notNull()
    .references(() => users.id),
  bodyMd: text("body_md").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: idColumn(),
  targetType: text("target_type", { enum: ["community_post", "community_comment", "message"] }).notNull(),
  targetId: uuid("target_id").notNull(),
  // Nullable: a keyword auto-flag has no human reporter. Never backfill this
  // with the content's own author — that corrupts report provenance and
  // becomes a rule-4-adjacent leak the moment this queue opens to
  // coach_moderator (docs/06 section 5's "trusted member and coach moderator
  // roles"), since a moderator would then see who among their clients
  // "reported" their own post.
  reporterUserId: uuid("reporter_user_id").references(() => users.id),
  source: text("source", { enum: ["user_report", "auto_flag"] }).notNull().default("user_report"),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["open", "reviewing", "actioned", "dismissed"] })
    .notNull()
    .default("open"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// No read receipts, typing indicators, or last-seen — a deliberate design
// decision (docs/08 section 1, CLAUDE.md hard rule 9), not a missing feature.
// read_at exists only so the coach's own unread-count UI can work; it is
// never surfaced to the other party as a receipt.
export const messages = pgTable("messages", {
  id: idColumn(),
  engagementId: uuid("engagement_id")
    .notNull()
    .references(() => engagements.id),
  senderUserId: uuid("sender_user_id")
    .notNull()
    .references(() => users.id),
  body: text("body"),
  media: jsonb("media"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
