import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { idColumn } from "./_shared";
import { coachProfiles, users } from "./identity";

// docs/09 section 4: "Assistant coach seats" — Premium only, 3 included.
// An assistant is an existing user with role 'coach' who gets shared,
// engagement-scoped access to another coach's client roster. Not a
// separate role: an assistant still owns their own coach_profiles row and
// their own clients, if any — this table only grants *additional* access.
export const coachTeamMembers = pgTable("coach_team_members", {
  id: idColumn(),
  ownerCoachId: uuid("owner_coach_id")
    .notNull()
    .references(() => coachProfiles.id),
  memberUserId: uuid("member_user_id")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["active", "removed"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
