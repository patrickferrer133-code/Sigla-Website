import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { idColumn } from "./_shared";
import { clientProfiles, coachProfiles, users } from "./identity";
import { engagements } from "./commerce";

// Despite the physical table name, this is now the shared posts table for
// both coach-authored and client-authored posts. The table was not renamed
// because a rename is disruptive to every existing migration, policy, and
// query; `author_role` is the discriminator. Exactly one of coach_id /
// client_id is set, enforced by coach_posts_author_consistency_check (raw
// SQL in the migration — Drizzle does not generate CHECK constraints here).
export const coachPosts = pgTable("coach_posts", {
  id: idColumn(),
  coachId: uuid("coach_id").references(() => coachProfiles.id),
  clientId: uuid("client_id").references(() => clientProfiles.id),
  authorRole: text("author_role", { enum: ["coach", "client"] })
    .notNull()
    .default("coach"),
  kind: text("kind", {
    // case_study / article / program_showcase are coach business-content
    // types. update is the client-authored counterpart; video and win are
    // shared.
    enum: ["case_study", "article", "program_showcase", "video", "win", "update"],
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
  // Client-authored posts only: the poster affirms the public-posting
  // guidelines (no before/after or body-comparison imagery, no goal weights
  // or calorie numbers, no restriction content) before the post goes live.
  // Recorded per docs/06 section 8's versioned-acceptance rule — store both
  // when it was accepted and which wording was accepted, so a later revision
  // of the guidelines does not silently rewrite history. Null for
  // coach-authored rows.
  guidelinesAckedAt: timestamp("guidelines_acked_at", { withTimezone: true }),
  guidelinesAckVersion: text("guidelines_ack_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("coach_posts_coach_id_idx").on(table.coachId),
  index("coach_posts_client_id_idx").on(table.clientId),
]);

// Ownership mirrors the coach_posts author pattern: nullable owner_coach_id /
// owner_client_id plus a non-null owner_role discriminator, with a CHECK
// constraint (raw SQL in the migration — Drizzle does not generate CHECK
// constraints) enforcing consistency.
//
// `global_goal` communities are platform-owned and have no owner profile at
// all, which is why the CHECK carves them out rather than demanding exactly
// one owner on every row.
//
// `kind` gains `user_created` rather than reusing `coach_private`:
// coach_private carries lazily-provisioned, clients_only semantics
// (getOrCreateCoachCommunity, listCoachCommunitiesForClient) and a
// coach-created group would otherwise be swept into a client's "your coach's
// community" list.
export const communities = pgTable("communities", {
  id: idColumn(),
  kind: text("kind", { enum: ["global_goal", "coach_private", "user_created"] }).notNull(),
  ownerCoachId: uuid("owner_coach_id").references(() => coachProfiles.id),
  ownerClientId: uuid("owner_client_id").references(() => clientProfiles.id),
  ownerRole: text("owner_role", { enum: ["coach", "client"] })
    .notNull()
    .default("coach"),
  name: text("name").notNull(),
  description: text("description"),
  goalTag: text("goal_tag"),
  joinPolicy: text("join_policy", { enum: ["open", "request", "clients_only"] }).notNull(),
  // Public bucket URL, same treatment as coach_profiles.cover_photo_url. Null
  // renders the default gradient.
  coverPhotoUrl: text("cover_photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// `owner` exists because a community owner may be a client, and
// `coach_moderator` is coach-specific by name and by intent (docs/06 section 5
// lists trusted member and coach moderator as distinct roles). `pending` is a
// requested-but-not-yet-approved membership for a `request` join policy — it
// is NOT a membership for any read or write gate; only `member` and above are.
export const communityMemberships = pgTable("community_memberships", {
  communityId: uuid("community_id")
    .notNull()
    .references(() => communities.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role", { enum: ["pending", "member", "trusted", "coach_moderator", "owner", "admin"] })
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
  // Same typed shape as coach_posts.media. The stored URL must never encode
  // the author (the storage path is prefixed by community id, not by user id)
  // or hard rule 4 would leak through the media URL of an anonymous post.
  media: jsonb("media").$type<{ type: "image" | "video"; url: string } | null>(),
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
  // coach_post covers the shared coach_posts table, so both coach-authored
  // and client-authored posts (including everything on /reels) have a
  // moderation path — docs/06 section 5 requires a report route on every
  // surface that publishes user content.
  targetType: text("target_type", { enum: ["community_post", "community_comment", "message", "coach_post"] }).notNull(),
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
