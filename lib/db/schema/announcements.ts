import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity";
import { idColumn, timestamps } from "./_shared";

// Platform-wide news and updates written by an admin. Not client health data —
// nothing in docs/06 applies here, and nothing personal is ever stored on a row.
export const announcements = pgTable(
  "announcements",
  {
    id: idColumn(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    audience: text("audience", { enum: ["all", "coaches", "clients"] })
      .notNull()
      .default("all"),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    // The read path is always "published, for this audience, newest first".
    index("announcements_published_idx").on(table.isPublished, table.publishedAt),
  ],
);
