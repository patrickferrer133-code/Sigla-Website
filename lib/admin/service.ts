import "server-only";
import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema/identity";

export async function listAllUsers() {
  return db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      avatarUrl: users.avatarUrl,
      onboardingCompletedAt: users.onboardingCompletedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(500);
}

export async function getSignupCounts() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      coaches: sql<number>`count(*) filter (where role = 'coach')::int`,
      clients: sql<number>`count(*) filter (where role = 'client')::int`,
      last7Days: sql<number>`count(*) filter (where created_at >= now() - interval '7 days')::int`,
    })
    .from(users);
  return row;
}
