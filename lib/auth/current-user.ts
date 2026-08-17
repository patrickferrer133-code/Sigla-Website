import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "coach" | "client" | "admin";
  onboardingCompletedAt: Date | null;
}

/**
 * Resolves the authenticated Supabase user against our own `users` table,
 * which is the source of truth for role (docs/03 section 2). Returns null
 * when there is no session or the user has not completed signup in our DB
 * yet (e.g. mid-onboarding).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const [row] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: row.role as "coach" | "client" | "admin",
    onboardingCompletedAt: row.onboardingCompletedAt,
  };
}
