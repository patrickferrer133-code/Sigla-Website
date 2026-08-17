import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coachTeamMembers } from "@/lib/db/schema/team";
import { coachProfiles, users } from "@/lib/db/schema/identity";
import { getCoachTier } from "@/lib/billing/service";
import { getEntitlementsForTier } from "@/lib/billing/entitlements";
import type { InviteTeamMemberInput } from "./schemas";

export type TeamError =
  | { code: "not_found"; resource: string }
  | { code: "seat_limit_reached" }
  | { code: "already_member" }
  | { code: "not_a_coach" }
  | { code: "cannot_invite_self" };
export type TeamResult<T> = { ok: true; data: T } | { ok: false; error: TeamError };
function ok<T>(data: T): TeamResult<T> {
  return { ok: true, data };
}
function fail<T>(error: TeamError): TeamResult<T> {
  return { ok: false, error };
}

export async function countActiveTeamMembers(ownerCoachId: string): Promise<number> {
  const rows = await db
    .select({ id: coachTeamMembers.id })
    .from(coachTeamMembers)
    .where(and(eq(coachTeamMembers.ownerCoachId, ownerCoachId), eq(coachTeamMembers.status, "active")));
  return rows.length;
}

export async function inviteTeamMember(ownerCoachId: string, ownerUserId: string, input: InviteTeamMemberInput): Promise<TeamResult<{ memberId: string }>> {
  const tier = await getCoachTier(ownerCoachId);
  const seatLimit = getEntitlementsForTier(tier).assistantSeats;
  const activeCount = await countActiveTeamMembers(ownerCoachId);
  if (activeCount >= seatLimit) return fail({ code: "seat_limit_reached" });

  const [targetUser] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, input.email)).limit(1);
  if (!targetUser) return fail({ code: "not_found", resource: "user" });
  if (targetUser.role !== "coach") return fail({ code: "not_a_coach" });
  if (targetUser.id === ownerUserId) return fail({ code: "cannot_invite_self" });

  const [existing] = await db
    .select({ id: coachTeamMembers.id })
    .from(coachTeamMembers)
    .where(and(eq(coachTeamMembers.ownerCoachId, ownerCoachId), eq(coachTeamMembers.memberUserId, targetUser.id), eq(coachTeamMembers.status, "active")))
    .limit(1);
  if (existing) return fail({ code: "already_member" });

  const [member] = await db
    .insert(coachTeamMembers)
    .values({ ownerCoachId, memberUserId: targetUser.id, status: "active" })
    .returning({ id: coachTeamMembers.id });

  return ok({ memberId: member.id });
}

export async function removeTeamMember(ownerCoachId: string, memberId: string): Promise<TeamResult<true>> {
  const [existing] = await db
    .select({ id: coachTeamMembers.id })
    .from(coachTeamMembers)
    .where(and(eq(coachTeamMembers.id, memberId), eq(coachTeamMembers.ownerCoachId, ownerCoachId)))
    .limit(1);
  if (!existing) return fail({ code: "not_found", resource: "member" });

  await db.update(coachTeamMembers).set({ status: "removed" }).where(eq(coachTeamMembers.id, memberId));
  return ok(true);
}

export async function listTeamMembers(ownerCoachId: string) {
  return db
    .select({ id: coachTeamMembers.id, displayName: users.displayName, email: users.email, createdAt: coachTeamMembers.createdAt })
    .from(coachTeamMembers)
    .innerJoin(users, eq(users.id, coachTeamMembers.memberUserId))
    .where(and(eq(coachTeamMembers.ownerCoachId, ownerCoachId), eq(coachTeamMembers.status, "active")));
}

// Coaches this user assists (in addition to their own roster, if any).
export async function listCoachesAssistedByUser(userId: string) {
  return db
    .select({ ownerCoachId: coachTeamMembers.ownerCoachId, handle: coachProfiles.handle, displayName: users.displayName })
    .from(coachTeamMembers)
    .innerJoin(coachProfiles, eq(coachProfiles.id, coachTeamMembers.ownerCoachId))
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(and(eq(coachTeamMembers.memberUserId, userId), eq(coachTeamMembers.status, "active")));
}

// The one authorization primitive every assistant-facing surface must call:
// true if userId owns coachId directly, or is an active assistant for it.
// Never trust a coachId passed by the client without this check.
export async function isAuthorizedForCoach(userId: string, coachId: string): Promise<boolean> {
  const [owned] = await db.select({ id: coachProfiles.id }).from(coachProfiles).where(and(eq(coachProfiles.id, coachId), eq(coachProfiles.userId, userId))).limit(1);
  if (owned) return true;

  const [membership] = await db
    .select({ id: coachTeamMembers.id })
    .from(coachTeamMembers)
    .where(and(eq(coachTeamMembers.ownerCoachId, coachId), eq(coachTeamMembers.memberUserId, userId), eq(coachTeamMembers.status, "active")))
    .limit(1);
  return Boolean(membership);
}
